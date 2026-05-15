#!/usr/bin/env bash
set -eo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$REPO_DIR/models.env"
ZSHRC="$HOME/.zshrc"
RA_DB="$HOME/.ra/data.sql"
MARKER="# >>> omp-mc config >>>"
MARKER_END="# <<< omp-mc config <<<"

[ -f "$CONFIG_FILE" ] && source "$CONFIG_FILE"

echo "🔧 Installing omp-mc (MaaS Creative Distribution)..."

echo "🔎 Ensuring OSS audit tools are installed..."
if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm is required to install OSS audit tools."
  exit 1
fi

missing_audit_tools=()
command -v cucumber-js >/dev/null 2>&1 || missing_audit_tools+=("@cucumber/cucumber")
command -v depcruise >/dev/null 2>&1 || missing_audit_tools+=("dependency-cruiser")
command -v spectral >/dev/null 2>&1 || missing_audit_tools+=("@stoplight/spectral-cli")
command -v stryker >/dev/null 2>&1 || missing_audit_tools+=("stryker-cli")

if [ "${#missing_audit_tools[@]}" -gt 0 ]; then
  echo "📦 Installing missing audit tools: ${missing_audit_tools[*]}"
  npm install -g "${missing_audit_tools[@]}"
else
  echo "✅ OSS audit tools already available."
fi

# 1. Symlinks
mkdir -p "$HOME/.omp/rules" "$HOME/.omp/agent/agents" "$HOME/.omp/hooks/pre" "$HOME/.omp/hooks/post"
for f in "$REPO_DIR"/.omp/rules/*.md; do ln -sf "$f" "$HOME/.omp/rules/$(basename "$f")"; done
for f in "$REPO_DIR"/.omp/agents/*.md; do ln -sf "$f" "$HOME/.omp/agent/agents/$(basename "$f")"; done
for f in "$REPO_DIR"/.omp/hooks/pre/*; do [ -f "$f" ] && ln -sf "$f" "$HOME/.omp/hooks/pre/$(basename "$f")"; done
for f in "$REPO_DIR"/.omp/hooks/post/*; do [ -f "$f" ] && ln -sf "$f" "$HOME/.omp/hooks/post/$(basename "$f")"; done

# 2. Remote Agent / DB Injection
if [ -f "$RA_DB" ]; then
  echo "💉 Injecting 'omp-mc' provider into remote-agent..."
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  sqlite3 "$RA_DB" <<SQL
INSERT OR IGNORE INTO custom_agent_providers (id, name, command, args_json, created_at, updated_at) 
VALUES ('omp-mc-id', 'MaaS Creative / omp-mc', 'omp', '["acp"]', '$NOW', '$NOW');
SQL
fi

# 3. Zshrc Update
if grep -q "$MARKER" "$ZSHRC" 2>/dev/null; then
  sed -i '' "/$MARKER/,/$MARKER_END/d" "$ZSHRC"
fi

EFFECTIVE_MODE="${REMOTE_MODE:-tailscale}"
[ "$EFFECTIVE_MODE" = "tailscale" ] && ! command -v tailscale &>/dev/null && EFFECTIVE_MODE="lan"
case "$EFFECTIVE_MODE" in
  tailscale) RA_FLAGS="--tailscale"; [ "${REMOTE_TAILSCALE_FUNNEL:-false}" = "true" ] && RA_FLAGS="$RA_FLAGS --funnel"; ;;
  lan) RA_FLAGS="--same-lan"; ;;
esac

cat >> "$ZSHRC" <<EOF

$MARKER
# omp-mc configuration
[ -f "$REPO_DIR/models.env" ] && source "$REPO_DIR/models.env"

alias omp-mc='omp'

# Smart remote-agent launcher with auto-kill
unalias omp-mc-remote 2>/dev/null
function omp-mc-remote() {
  local port=\${REMOTE_PORT:-44444}
  # TCP ポートの LISTEN プロセスを特定
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

function omc-init() {
  mkdir -p features .omp/audit
  npx -y npm-add-script -k "audit" -v "bun '$REPO_DIR/scripts/omp-mc-audit.ts'"
  echo "✅ omp-mc audit script and directories added"
}
$MARKER_END
EOF

echo "✅ Setup Complete!"
echo "   🚀 Command: omp-mc"
echo "   🌐 Remote:  omp-mc-remote"
echo ""
echo "Please run: source ~/.zshrc"
