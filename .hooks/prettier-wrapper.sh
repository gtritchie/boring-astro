#!/usr/bin/env bash
set -euo pipefail

# Portable Node loader for pre-commit hooks:
# - Trusts caller's PATH first (works when git is invoked from a shell
#   that already has node available, e.g. via mise, asdf, volta, fnm,
#   Homebrew, or an nvm-loaded interactive shell).
# - Falls back to sourcing nvm AND activating the version pinned in
#   .nvmrc. We deliberately do NOT fall through to "nvm use default" —
#   that would silently activate whatever Node happens to be the user's
#   default, which may not satisfy the repository's engines constraint.
if ! command -v node >/dev/null 2>&1; then
  nvm_loaded=0
  if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm_loaded=1
    nvm use --silent >/dev/null 2>&1 || true
  fi
  if ! command -v node >/dev/null 2>&1; then
    if (( nvm_loaded )); then
      echo "pre-commit: nvm could not activate the version pinned in .nvmrc." >&2
      echo "           Run \`nvm install\` (reads .nvmrc) and retry." >&2
    else
      echo "pre-commit: node is not on PATH and nvm is not available." >&2
      echo "           Put a supported Node (>=22.12 <23) on PATH, or install nvm" >&2
      echo "           (export NVM_DIR, source nvm.sh) and then \`nvm install\`." >&2
    fi
    exit 1
  fi
fi

exec npx prettier --write "$@"
