#!/usr/bin/env bash
set -euo pipefail

# lychee is a Rust binary, not an npm package. Check for it up front so
# "npm run link-check" fails with install guidance instead of a bare
# "command not found" from the shell.
if ! command -v lychee >/dev/null 2>&1; then
  cat >&2 <<'EOF'
link-check: lychee is not on PATH.

Install it before running this script:
  macOS:   brew install lychee
  Linux:   cargo install lychee
           (or see https://github.com/lycheeverse/lychee for a pre-built release)
  GitHub Actions: uses lycheeverse/lychee-action (see .github/workflows/deploy.yml)
EOF
  exit 1
fi

exec lychee --config lychee.toml 'dist/client/**/*.html'
