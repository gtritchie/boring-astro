#!/usr/bin/env bash
set -euo pipefail

# Portable Node loader for pre-commit hooks:
# - Trusts caller's PATH first (works when git is invoked from a shell
#   that already has node available, e.g. via mise, asdf, volta, fnm,
#   Homebrew, or an nvm-loaded interactive shell).
# - Falls back to sourcing nvm if NVM_DIR is set, so git-commit from a
#   non-interactive context still resolves whatever nvm considers default.
if ! command -v node >/dev/null 2>&1; then
  if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
  fi
fi

exec npx prettier --write "$@"
