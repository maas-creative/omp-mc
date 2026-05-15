#!/usr/bin/env bash
# =============================================================================
# omp-mc install.sh — Maas Creative oh-my-pi distribution setup
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$REPO_DIR/models.env"
OMP_RULES_DIR="$HOME/.omp/rules"
OMP_AGENTS_DIR="$HOME/.omp/agent/agents"
ZSHRC="$HOME/.zshrc"
MARKER="# >>> omp-mc config >>>"
MARKER_END="# <<< omp-mc config <<<"

# --- Load config ---
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ models.env not found. Copy models.env.example to models.env and edit it."
  exit 1
fi
source "$CONFIG_FILE"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        omp-mc Installer (Maas Creative)      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# =============================================================================
# 1. Audit OSS tools (Global)
# =============================================================================
echo "🔍 Checking global audit tools..."
MISSING=()
for cmd in cucumber-js spectral depcruise stryker; do
  command -v "$cmd" &>/dev/null || MISSING+=("$cmd")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "📦 Installing: ${MISSING[*]}"
  npm install -g @cucumber/cucumber @stoplight/spectral-cli dependency-cruiser stryker-cli
else
  echo "✅ All global audit tools installed."
fi

# =============================================================================
# 2. Remote Agent Setup
# =============================================================================
echo ""
echo "🌐 Setting up remote access..."
if [ "${REMOTE_MODE:-tailscale}" = "disabled" ]; then
  echo "   ⏭  Remote mode is 'disabled'. Skipping."
else
  command -v remote-agent &>/dev/null || npm install -g @kimuson/remote-agent
  
  EFFECTIVE_MODE="${REMOTE_MODE:-tailscale}"
  if [ "$EFFECTIVE_MODE" = "tailscale" ] && ! command -v tailscale &>/dev/null; then
    echo "   ⚠️  Tailscale not found — falling back to 'lan'."
    EFFECTIVE_MODE="lan"
  fi

  case "$EFFECTIVE_MODE" in
    tailscale)
      RA_FLAGS="--tailscale"
      [ "${REMOTE_TAILSCALE_FUNNEL:-false}" = "true" ] && RA_FLAGS="$RA_FLAGS --funnel"
      ;;
    lan)
      RA_FLAGS="--same-lan"
      ;;
  esac
fi

# =============================================================================
# 3. Rules & Agents (Symlinks)
# =============================================================================
echo ""
echo "📁 Updating ~/.omp symlinks..."
mkdir -p "$OMP_RULES_DIR" "$OMP_AGENTS_DIR"
for f in "$REPO_DIR"/.omp/rules/*.md; do ln -sf "$f" "$OMP_RULES_DIR/$(basename "$f")"; done
for f in "$REPO_DIR"/.omp/agents/*.md; do ln -sf "$f" "$OMP_AGENTS_DIR/$(basename "$f")"; done
echo "   ✅ Symlinks updated."

# =============================================================================
# 4. Zshrc configuration (including omc-init helper)
# =============================================================================
echo ""
echo "⚙️  Configuring ~/.zshrc..."

if grep -q "$MARKER" "$ZSHRC" 2>/dev/null; then
  sed -i '' "/$MARKER/,/$MARKER_END/d" "$ZSHRC"
fi

# Build aliases
REMOTE_ALIAS="# remote disabled"
[ "${REMOTE_MODE:-tailscale}" != "disabled" ] && REMOTE_ALIAS="alias omp-remote='npx @kimuson/remote-agent serve ${RA_FLAGS} --port \${REMOTE_PORT:-44444} -- omp acp'"

cat >> "$ZSHRC" <<EOF

$MARKER
# omp-mc configuration (Do not edit this block directly)
[ -f "$REPO_DIR/models.env" ] && source "$REPO_DIR/models.env"
$REMOTE_ALIAS

# Helper to initialize mechanical audit in the current project
function omc-init() {
  if [ ! -f "package.json" ]; then
    echo "❌ No package.json found in current directory."
    return 1
  fi
  echo "🔧 Adding audit scripts to package.json..."
  npx -y npm-add-script \
    -k "audit" -v "npm run audit:bdd && npm run audit:arch && npm run audit:api && npm run audit:sec" \
    -k "audit:bdd" -v "cucumber-js" \
    -k "audit:arch" -v "depcruise src" \
    -k "audit:api" -v "spectral lint openapi.yaml" \
    -k "audit:sec" -v "npm audit"
  echo "✅ Done. You can now run 'npm run audit' to satisfy omp-mc requirements."
}
$MARKER_END
EOF

echo "   ✅ ~/.zshrc updated (new command 'omc-init' added)"

source "$CONFIG_FILE"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║            ✅ Setup Complete!                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  🚀 Commands available:"
echo "    omp-remote : Start remote access (Phone/PWA)"
echo "    omc-init   : Initialize audit scripts in a new project"
echo ""
