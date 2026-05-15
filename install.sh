#!/usr/bin/env bash
set -eo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$REPO_DIR/models.env"
ZSHRC="$HOME/.zshrc"
MARKER="# >>> omp-mc config >>>"
MARKER_END="# <<< omp-mc config <<<"

[ -f "$CONFIG_FILE" ] && source "$CONFIG_FILE"

echo "🔧 Installing omp-mc..."

# 1. Rules & Agents Symlinks
mkdir -p "$HOME/.omp/rules" "$HOME/.omp/agent/agents"
for f in "$REPO_DIR"/.omp/rules/*.md; do ln -sf "$f" "$HOME/.omp/rules/$(basename "$f")"; done
for f in "$REPO_DIR"/.omp/agents/*.md; do ln -sf "$f" "$HOME/.omp/agent/agents/$(basename "$f")"; done

# 2. Remote Agent Compatibility (pi -> omp link)
if command -v omp &>/dev/null && ! command -v pi &>/dev/null; then
  echo "🔗 Creating 'pi' compatibility link to 'omp'..."
  OMP_PATH=$(which omp)
  BIN_DIR=$(dirname "$OMP_PATH")
  if [ -w "$BIN_DIR" ]; then
    ln -sf "$OMP_PATH" "$BIN_DIR/pi"
  else
    echo "   ⚠️  Insufficient permissions for $BIN_DIR. Please run: sudo ln -sf $OMP_PATH $BIN_DIR/pi"
  fi
fi

# 3. Remote Agent Setup
EFFECTIVE_MODE="${REMOTE_MODE:-tailscale}"
[ "$EFFECTIVE_MODE" = "tailscale" ] && ! command -v tailscale &>/dev/null && EFFECTIVE_MODE="lan"
case "$EFFECTIVE_MODE" in
  tailscale) RA_FLAGS="--tailscale"; [ "${REMOTE_TAILSCALE_FUNNEL:-false}" = "true" ] && RA_FLAGS="$RA_FLAGS --funnel"; ;;
  lan) RA_FLAGS="--same-lan"; ;;
esac

# 4. Zshrc Update
if grep -q "$MARKER" "$ZSHRC" 2>/dev/null; then
  sed -i '' "/$MARKER/,/$MARKER_END/d" "$ZSHRC"
fi

REMOTE_ALIAS="alias omp-remote='npx @kimuson/remote-agent serve ${RA_FLAGS} --port \${REMOTE_PORT:-44444}'"

cat >> "$ZSHRC" <<EOF

$MARKER
# omp-mc config
[ -f "$REPO_DIR/models.env" ] && source "$REPO_DIR/models.env"
$REMOTE_ALIAS

function omc-init() {
  npx -y npm-add-script -k "audit" -v "cucumber-js && depcruise src && npm audit"
}
$MARKER_END
EOF

echo "✅ Done. Run 'source ~/.zshrc' then 'omp-remote'"
