#!/bin/sh
# Resolve a grok-capable kenkeep CLI into $KK_CMD (one argv token or
# "node /path/to/cli.js"). Source this file; do not exec it.
# Override: KENKEEP_BIN=/path/to/kenkeep-or-cli.js
set -eu

kk_help_has_grok() {
  # $1 = command, remaining args optional (e.g. node /path/cli.js)
  "$@" init --help 2>/dev/null | grep -q 'grok'
}

kk_set_cmd() {
  KK_CMD=$1
  shift
  KK_CMD_ARGS=$*
}

kk() {
  # shellcheck disable=SC2086
  if [ -n "${KK_CMD_ARGS:-}" ]; then
    "$KK_CMD" $KK_CMD_ARGS "$@"
  else
    "$KK_CMD" "$@"
  fi
}

if [ -n "${KENKEEP_BIN:-}" ]; then
  if [ -f "$KENKEEP_BIN" ] && grep -q '#!/usr/bin/env node' "$KENKEEP_BIN" 2>/dev/null; then
    if kk_help_has_grok node "$KENKEEP_BIN"; then
      kk_set_cmd node "$KENKEEP_BIN"
      return 0 2>/dev/null || exit 0
    fi
  elif command -v "$KENKEEP_BIN" >/dev/null 2>&1 && kk_help_has_grok "$KENKEEP_BIN"; then
    kk_set_cmd "$KENKEEP_BIN"
    return 0 2>/dev/null || exit 0
  fi
  echo "kenkeep-init: KENKEEP_BIN=$KENKEEP_BIN is not a grok-capable kenkeep" >&2
  exit 1
fi

if command -v kenkeep >/dev/null 2>&1 && kk_help_has_grok kenkeep; then
  kk_set_cmd kenkeep
  return 0 2>/dev/null || exit 0
fi

# Common checkout next to other Projects trees (this machine's convention).
for candidate in \
  "${KENKEEP_HOME:-}/dist/cli.js" \
  "$HOME/Projects/KenKeep/dist/cli.js" \
  "$HOME/Projects/kenkeep/dist/cli.js"; do
  [ -n "$candidate" ] || continue
  [ -f "$candidate" ] || continue
  if kk_help_has_grok node "$candidate"; then
    kk_set_cmd node "$candidate"
    return 0 2>/dev/null || exit 0
  fi
done

echo "kenkeep-init: no grok-capable kenkeep on PATH." >&2
echo "Install this checkout: ~/Projects/KenKeep/scripts/install-cli.sh" >&2
echo "Do not use npx kenkeep until upstream publishes the grok adapter." >&2
exit 1
