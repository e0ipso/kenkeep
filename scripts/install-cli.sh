#!/bin/sh
# Install this checkout's kenkeep CLI onto PATH as `kenkeep`.
# New repo: kenkeep init --harnesses grok
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm install
npm run build
BIN="${HOME}/.local/bin"
mkdir -p "$BIN"
cat >"$BIN/kenkeep" <<EOF
#!/bin/sh
exec node "$ROOT/dist/cli.js" "\$@"
EOF
chmod +x "$BIN/kenkeep"
echo "Installed $BIN/kenkeep -> $ROOT/dist/cli.js"
if ! command -v kenkeep >/dev/null 2>&1; then
  echo "Note: $BIN is not on PATH. Add it, then open a new shell."
fi
kenkeep --help | head -5 || true
