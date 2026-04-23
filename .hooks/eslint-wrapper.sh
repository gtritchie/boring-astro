#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm use --silent >/dev/null 2>&1 || true
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "pre-commit: node is not on PATH and nvm could not activate the version in .nvmrc." >&2
    echo "           Run \`nvm install\` (reads .nvmrc) and retry." >&2
    exit 1
  fi
fi

exec npx eslint --fix --max-warnings 0 "$@"
