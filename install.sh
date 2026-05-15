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

# 2. Create 'omp-mc' wrapper command
if command -v omp &>/dev/null; then
  OMP_PATH=$(which omp)
  BIN_DIR=$(dirname "$OMP_PATH")
  
  echo "🚀 Creating 'omp-mc' wrapper in $BIN_DIR..."
  
  # omp-mc command (ACP mode by default)
  cat > "$REPO_DIR/omp-mc-wrapper" <<EOF
#!/usr/bin/env bash
# omp-mc wrapper for ACP / Remote Agent
exec "$OMP_PATH" acp "\$@"
EOF
  chmod +x "$REPO_DIR/omp-mc-wrapper"
  
  if [ -w "$BIN_DIR" ]; then
    ln -sf "$REPO_DIR/omp-mc-wrapper" "$BIN_DIR/omp-mc"
    # Also link 'pi' for default compatibility with remote-agent built-ins
    ln -sf "$BIN_DIR/omp-mc" "$BIN_DIR/pi"
    echo "   ✅ 'omp-mc' and 'pi' commands are now available."
  else
    echo "   ⚠️  Permission denied for $BIN_DIR. Please run manually:"
    echo "       sudo ln -sf $REPO_DIR/omp-mc-wrapper $BIN_DIR/omp-mc"
    echo "       sudo ln -sf $BIN_DIR/omp-mc $BIN_DIR/pi"
  fi
fi

# 3. Remote Agent Setup Flags
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

# Helper for project initialization
function omc-init() {
  npx -y npm-add-script -k "audit" -v "cucumber-js && depcruise src && npm audit"
  echo "✅ Audit scripts added to package.json"
}
$MARKER_END
EOF

echo "✅ Done. Run 'source ~/.zshrc' then 'omp-remote'"
