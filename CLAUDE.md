# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Source for [boringbydesign.ca](https://boringbydesign.ca). Static Astro 6 site deployed to Cloudflare Workers (Workers Assets) via Cloudflare Workers Builds. No client JS beyond the theme toggle and Astro's `ClientRouter` view transitions. See `README.md` for content-authoring and design-token locations.

## Commands

Node 24+ required (`.nvmrc` pins `24.15.0`).

- `npm run dev` — Astro dev server on `:4321`
- `npm run build` — outputs to `dist/client/` (not `dist/` — see below)
- `npm run preview` — `wrangler dev` on `:8787` (real Workers runtime against built output)
- `npm run preview:astro` — builds, then `astro preview` on `127.0.0.1:4321` — pa11y expects this exact origin
- `npm run check` — `astro check` + `prettier --check` + `eslint`
- `npm run format` — `prettier --write .`
- `npm run pa11y` — WCAG AAA audit of every sitemap URL; needs `preview:astro` running in another terminal
- `npm run lighthouse` — builds, then LHCI against budgets in `.lighthouserc.json`
- `npm run link-check` — builds, then lychee across built HTML (requires `lychee` installed — `brew install lychee`)

No unit test suite. Verification in CI is linting, type-checking, link-check, and pa11y. Lighthouse is local-only (`npm run lighthouse`).

## Architecture

**Static Astro, no SSR.** `output: "static"` with the Cloudflare adapter. The adapter does _not_ emit `_worker.js` in static mode, so build output lives at `dist/client/` and `wrangler.jsonc`'s `assets.directory` points there. Don't assume `dist/` like typical Astro projects.

**Content is the data model.** All user-visible content lives under `src/content/{writing,projects,interests}/` as Markdown/MDX, validated against Zod schemas in `src/content.config.ts`. Collections use Astro 6's content layer (`loader: glob(...)`). Entries expose `entry.id` (not `slug`); render with `render(entry)` imported from `astro:content`. Adding fields means updating both the schema and any consuming page/component.

**Routing mirrors collections.** `src/pages/{writing,projects,interests}/[...slug].astro` renders individual entries; sibling `index.astro` renders listings. `rss.xml.ts` generates the feed from the `writing` collection. Draft entries (`draft: true`) are excluded from listings, RSS, and the sitemap but still type-check and build.

**Styling flows from tokens.** Every visible style reads from `src/styles/tokens.css` (colors, spacing, typography, light+dark palettes side-by-side). `global.css` imports tokens + `reset.css`. Component `<style>` blocks are Astro-scoped — class names don't collide across components. Warm-neutral palette, AAA contrast required.

**Two layouts.** `BaseLayout.astro` wraps full-chrome pages; `ProseLayout.astro` constrains reading width for articles.

## Gotchas worth remembering

- **`ClientRouter`, not `ViewTransitions`** — renamed in Astro 5+.
- **UTC dates everywhere.** YAML frontmatter dates parse as UTC midnight. Render with `timeZone: "UTC"` and `getUTCFullYear()` so `2026-04-23` always displays as April 23 regardless of host/reader timezone.
- **pa11y uses Puppeteer's bundled Chrome** at `~/.cache/puppeteer/`. `run-pa11y.mjs` leaves `chromeLaunchConfig.executablePath` unset so pa11y auto-detects it. `run-pa11y.mjs` also rewrites sitemap URLs to the preview origin — don't regress that when touching the script.
- **`preview:astro` is what pa11y targets**, not `wrangler dev`. They listen on different ports.
- **Deploy is Workers Assets only** — no binding to `env.ASSETS`; `wrangler.jsonc` intentionally has no `assets.binding` key (see commit b7ab667).

## CI / deploy

`.github/workflows/ci.yml` runs on push/PR to `main`: `check` → `build` → `link-check` → `pa11y`. CI is the quality gate; it does not deploy.

**Deploy is Cloudflare Workers Builds.** The `boring-site` Worker is connected to this repo via the Cloudflare dashboard (Settings → Build). On push to `main`, Cloudflare runs `npm run build` then `npx wrangler deploy` against the production Worker. On push to any other branch, Cloudflare runs `npm run build` then `npx wrangler versions upload`, which produces a unique preview URL per build. Node 24 is auto-detected from `.nvmrc`.

**Preview URLs are `noindex`'d.** `BaseLayout.astro` reads `import.meta.env.WORKERS_CI_BRANCH` (auto-set by Workers Builds) at build time and emits `<meta name="robots" content="noindex, nofollow">` whenever the branch isn't `main`. ProseLayout extends BaseLayout, so this covers every page.

**Build env vars** live in Cloudflare → Worker → Settings → Environment variables → Build variables. `PUBLIC_CF_WA_TOKEN` (Cloudflare Web Analytics) goes here if you want analytics on production. There are no longer any deploy-related GitHub Actions secrets.

Lighthouse is not run in CI — run `npm run lighthouse` locally as needed.

Branch protection on `main` — always work on a feature branch and open a PR.

## Reference docs

- Design spec: `docs/superpowers/specs/2026-04-23-boringbydesign-site-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-23-boringbydesign-site.md`
- Content-authoring details and frontmatter schemas: `README.md`
