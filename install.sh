#!/usr/bin/env bash
set -eo pipefail

MARKER="# >>> omp-mc config >>>"
MARKER_END="# <<< omp-mc config <<<"
ZSHRC="$HOME/.zshrc"
RA_DB="$HOME/.ra/data.sql"

# ---- resolve repo dir ---------------------------------------------------
if ! [[ -f "${BASH_SOURCE[0]}" ]]; then
  # Running via curl pipe — self-clone.
  OMP_MC_HOME="${OMP_MC_HOME:-$HOME/.omp-mc}"
  echo "📦 Cloning omp-mc into $OMP_MC_HOME …"
  if [ -d "$OMP_MC_HOME" ]; then
    cd "$OMP_MC_HOME" && git pull --ff-only
  else
    git clone https://github.com/maas-creative/omp-mc.git "$OMP_MC_HOME"
  fi
  exec bash "$OMP_MC_HOME/install.sh"
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔧 Installing omp-mc (MaaS Creative Distribution) …"

# ---- models.env ----------------------------------------------------------
if [ ! -f "$REPO_DIR/models.env" ] && [ -f "$REPO_DIR/models.env.example" ]; then
  cp "$REPO_DIR/models.env.example" "$REPO_DIR/models.env"
  echo "📝 Created models.env from example — edit it and re-run install.sh to apply."
fi

CONFIG_FILE="$REPO_DIR/models.env"
[ -f "$CONFIG_FILE" ] && source "$CONFIG_FILE"

# ---- audit tools ---------------------------------------------------------
echo "🔎 Ensuring OSS audit tools are installed …"
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required."; exit 1; }

missing_audit_tools=()
command -v cucumber-js >/dev/null 2>&1 || missing_audit_tools+=("@cucumber/cucumber")
command -v depcruise    >/dev/null 2>&1 || missing_audit_tools+=("dependency-cruiser")
command -v spectral     >/dev/null 2>&1 || missing_audit_tools+=("@stoplight/spectral-cli")
command -v stryker      >/dev/null 2>&1 || missing_audit_tools+=("stryker-cli")

if [ "${#missing_audit_tools[@]}" -gt 0 ]; then
  echo "📦 Installing: ${missing_audit_tools[*]}"
  npm install -g "${missing_audit_tools[@]}"
else
  echo "✅ OSS audit tools already available."
fi

# ---- symlinks ------------------------------------------------------------
mkdir -p "$HOME/.omp/rules" "$HOME/.omp/agent/agents" "$HOME/.omp/hooks/pre" "$HOME/.omp/hooks/post"
for f in "$REPO_DIR"/.omp/rules/*.md; do ln -sf "$f" "$HOME/.omp/rules/$(basename "$f")"; done
for f in "$REPO_DIR"/.omp/agents/*.md; do ln -sf "$f" "$HOME/.omp/agent/agents/$(basename "$f")"; done
for f in "$REPO_DIR"/.omp/hooks/pre/*;  do [ -f "$f" ] && ln -sf "$f" "$HOME/.omp/hooks/pre/$(basename "$f")";  done
for f in "$REPO_DIR"/.omp/hooks/post/*; do [ -f "$f" ] && ln -sf "$f" "$HOME/.omp/hooks/post/$(basename "$f")"; done

# ---- remote-agent injection ----------------------------------------------
if [ -f "$RA_DB" ]; then
  echo "💉 Injecting 'omp-mc' provider into remote-agent …"
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  sqlite3 "$RA_DB" <<SQL
INSERT OR IGNORE INTO custom_agent_providers (id, name, command, args_json, created_at, updated_at) 
VALUES ('omp-mc-id', 'MaaS Creative / omp-mc', 'omp', '["acp"]', '$NOW', '$NOW');
SQL
fi

# ---- remote access prompt ------------------------------------------------
if [ -t 0 ]; then
  echo ""
  if command -v tailscale &>/dev/null; then
    echo "🌐 Tailscale is installed. Remote access allows controlling omp-mc from your phone/tablet."
    read -p "   Enable remote access via Tailscale? [Y/n]: " ans
    case "${ans:-y}" in
      [Yy]* ) REMOTE_MODE="tailscale";;
      [Nn]* ) REMOTE_MODE="disabled"; echo "   Remote access skipped.";;
      * )     REMOTE_MODE="tailscale";;
    esac
  else
    echo "🌐 Tailscale is not installed."
    read -p "   Enable remote access on LAN only? [y/N]: " ans
    case "${ans:-n}" in
      [Yy]* ) REMOTE_MODE="lan";;
      * )     REMOTE_MODE="disabled"; echo "   Remote access skipped.";;
    esac
  fi
  if [ "$REMOTE_MODE" != "disabled" ]; then
    echo "   ✅ Remote access: $REMOTE_MODE"
  fi
fi

# ---- shell config --------------------------------------------------------
if grep -q "$MARKER" "$ZSHRC" 2>/dev/null; then
  sed -i '' "/$MARKER/,/$MARKER_END/d" "$ZSHRC"
fi

EFFECTIVE_MODE="${REMOTE_MODE:-tailscale}"
[ "$EFFECTIVE_MODE" = "tailscale" ] && ! command -v tailscale &>/dev/null && EFFECTIVE_MODE="lan"
case "$EFFECTIVE_MODE" in
  tailscale) RA_FLAGS="--tailscale"; [ "${REMOTE_TAILSCALE_FUNNEL:-false}" = "true" ] && RA_FLAGS="$RA_FLAGS --funnel"; ;;
  lan) RA_FLAGS="--same-lan"; ;;
  disabled) ;; # will skip the omp-mc-remote function
esac

# Write shell config — conditional remote section
{
  cat <<INNER

$MARKER
# omp-mc configuration
[ -f "$REPO_DIR/models.env" ] && source "$REPO_DIR/models.env"

alias omp-mc='omp'
INNER

  if [ "$EFFECTIVE_MODE" != "disabled" ]; then
    cat <<INNER

# Remote launcher (mode: $EFFECTIVE_MODE)
unalias omp-mc-remote 2>/dev/null
function omp-mc-remote() {
  local port=\${REMOTE_PORT:-44444}
  local pids=\$(lsof -i tcp:\$port -sTCP:LISTEN -t 2>/dev/null || true)

  if [ -n "\$pids" ]; then
    echo "⚠️  Port \$port is occupied by PID(s): \$pids"
    read "ans?   Kill previous session? (y/N): "
    if [[ "\$ans" =~ ^[Yy]$ ]]; then
      echo "💀 Killing processes..."
      echo \$pids | xargs kill -9
      sleep 2
    else
      echo "❌ Aborted."
      return 1
    fi
  fi

  npx @kimuson/remote-agent serve ${RA_FLAGS} --port \$port
}
INNER
  fi

  cat <<INNER

function omp-mc-init() {
  local profile="\${1:-default}"
  mkdir -p features .omp/audit
  npx -y npm-add-script -k "audit" -v "bun '$REPO_DIR/scripts/omp-mc-audit.ts'"

  if [ "\$profile" = "api" ]; then
    cp "$REPO_DIR/templates/api/openapi.yaml" openapi.yaml
    cp "$REPO_DIR/templates/api/.spectral.yaml" .spectral.yaml
    npx -y npm-add-script -k "omp" -v '{ "auditProfile": "api" }'
    echo "✅ omp-mc audit (api profile) + OpenAPI scaffold added"
  else
    echo "✅ omp-mc audit script and directories added"
  fi
}
$MARKER_END
INNER

} >> "$ZSHRC"


echo ""
echo "✅ omp-mc Setup Complete!"
echo "   🚀 omp-mc        — start the agent"
if [ "$EFFECTIVE_MODE" != "disabled" ]; then
  echo "   🌐 omp-mc-remote — remote access ($EFFECTIVE_MODE)"
fi
echo "   🏗️  omp-mc-init   — bootstrap audit in a project"
echo ""
echo "   Run: source ~/.zshrc"
