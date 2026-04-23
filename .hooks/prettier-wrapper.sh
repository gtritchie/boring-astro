#!/bin/bash
set -euo pipefail
export PATH="/Users/gary/.nvm/versions/node/v22.18.0/bin:$PATH"
exec npx prettier --write "$@"
