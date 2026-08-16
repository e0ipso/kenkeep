#!/bin/sh
# Fully init a consumer repo for Claude Code, Codex, and Grok Build.
# Usage: init-repo.sh [repo-root]
# Env:   KENKEEP_HARNESSES=claude,codex,grok   (default)
#        KENKEEP_BIN=...                       (see resolve-kenkeep.sh)
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
. "$SCRIPT_DIR/resolve-kenkeep.sh"

ROOT=${1:-.}
ROOT=$(CDPATH= cd -- "$ROOT" && pwd)
HARNESSES=${KENKEEP_HARNESSES:-claude,codex,grok}

echo "kenkeep-init: repo=$ROOT harnesses=$HARNESSES"
cd "$ROOT"

if [ ! -d .git ]; then
  git init
  echo "kenkeep-init: git init"
fi

if [ -f .ai/kenkeep/.state/installed-version ]; then
  kk init --harnesses "$HARNESSES" --upgrade
else
  kk init --harnesses "$HARNESSES"
fi

"$SCRIPT_DIR/ensure-claude-pointer.sh" "$ROOT"

# Never enable vendor memory from this script.
if [ -f "$HOME/.grok/config.toml" ] && grep -qE '^[[:space:]]*enabled[[:space:]]*=[[:space:]]*true' "$HOME/.grok/config.toml"; then
  echo "kenkeep-init: WARNING Grok [memory] looks enabled. Leave it off; Kenkeep is the store." >&2
fi

echo "kenkeep-init: doctor"
kk doctor

cat <<'EOF'

NEXT (human, once per repo):
  Grok:  /hooks-trust   (or launch with grok --trust)
  Codex: /hooks         (trust kenkeep hook scripts in that session)

Do not turn on Grok experimental memory.
EOF
