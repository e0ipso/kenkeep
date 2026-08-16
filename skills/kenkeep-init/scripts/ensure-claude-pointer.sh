#!/bin/sh
# Ensure CLAUDE.md imports AGENTS.md. Claude Code does not auto-load AGENTS.md.
# Usage: ensure-claude-pointer.sh <repo-root>
set -eu
ROOT=${1:?repo root required}
CLAUDE="$ROOT/CLAUDE.md"

if [ ! -f "$CLAUDE" ]; then
  printf '%s\n' '@AGENTS.md' >"$CLAUDE"
  echo "wrote $CLAUDE"
  exit 0
fi

if grep -q 'AGENTS.md' "$CLAUDE"; then
  echo "ok $CLAUDE already references AGENTS.md"
  exit 0
fi

tmp=$(mktemp)
{
  printf '%s\n\n' '@AGENTS.md'
  cat "$CLAUDE"
} >"$tmp"
mv "$tmp" "$CLAUDE"
echo "prepended @AGENTS.md to $CLAUDE"
