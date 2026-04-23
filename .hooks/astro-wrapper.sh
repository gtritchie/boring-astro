#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm use --silent >/dev/null 2>&1 || nvm use --silent default >/dev/null 2>&1 || true
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "pre-commit: node is not on PATH and nvm activation failed. Install Node 22.12+ or \`nvm install\`." >&2
    exit 1
  fi
fi

exec npx astro check
