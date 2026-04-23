#!/usr/bin/env bash
set -euo pipefail

# Portable Node loader for pre-commit hooks:
# - Trusts caller's PATH first (works when git is invoked from a shell
#   that already has node available, e.g. via mise, asdf, volta, fnm,
#   Homebrew, or an nvm-loaded interactive shell).
# - Falls back to sourcing nvm AND activating the version pinned in
#   .nvmrc, which is what actually puts node/npx on PATH.
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

exec npx prettier --write "$@"
