#!/usr/bin/env bash
set -euo pipefail

# lychee is a Rust binary, not an npm package. Check for it FIRST — before
# running astro build — so "npm run link-check" fails fast with install
# guidance on a fresh checkout rather than wasting a build.
if ! command -v lychee >/dev/null 2>&1; then
  cat >&2 <<'EOF'
link-check: lychee is not on PATH.

Install a 0.23.x release to match CI (lycheeverse/lychee-action@v2
defaults to v0.23.0, and 0.24+ changed the lychee.toml schema):
  cargo install lychee --version '~0.23'
  (Rust toolchain required; brew installs 0.24+ which won't work.)
GitHub Actions: uses lycheeverse/lychee-action — see .github/workflows/ci.yml
EOF
  exit 1
fi

npx astro build
exec lychee --config lychee.toml 'dist/client/**/*.html'
