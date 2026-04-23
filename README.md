# boring-astro

Source for [boringbydesign.ca](https://boringbydesign.ca). Static Astro 6 site
deployed to Cloudflare Workers (Workers Assets). Warm-neutral palette, AAA
contrast, system fonts, no client JS beyond the theme toggle and Astro view
transitions.

## Prereqs

- **Node 22.12+** (`.nvmrc` pins `22.18.0` — `nvm use` picks it up)
- **npm** (comes with Node)
- **Chrome or Chromium** — required locally for `npm run pa11y` and
  `npm run lighthouse`. `scripts/run-pa11y.mjs` auto-detects via
  `chrome-launcher` on macOS/Linux/Windows.
- **lychee** — only for `npm run link-check`. `brew install lychee` on macOS,
  `cargo install lychee` on Linux.
- **prek** — pre-commit hook runner. `brew install prek`. Run `prek install`
  once per clone to install the git hooks.

## Common commands

| Command                 | What it does                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Astro dev server with hot reload at `http://localhost:4321/`                                      |
| `npm run build`         | Produces `dist/client/` static output                                                             |
| `npm run preview`       | Runs `wrangler dev` — serves the built site via the real Workers runtime on `:8787`               |
| `npm run preview:astro` | Serves the built site via `astro preview` on `127.0.0.1:4321` — port pa11y expects                |
| `npm run check`         | `astro check` + `tsc` + `prettier --check` + `eslint`                                             |
| `npm run pa11y`         | Audits every sitemap URL for WCAG AAA (needs `npm run preview:astro` running in another terminal) |
| `npm run lighthouse`    | Builds, then runs LHCI against the budgets in `.lighthouserc.json`                                |
| `npm run link-check`    | Builds, then runs lychee across the built HTML                                                    |

## Adding content

All content lives under `src/content/` and is validated against Zod schemas in
`src/content.config.ts`. Write Markdown or MDX files in the right subdirectory
and the site picks them up on next build.

### A new writing post

Create `src/content/writing/<slug>.md`. Required frontmatter:

```yaml
---
title: "On the virtues of boring infrastructure"
description: "One sentence that ends up in meta tags and the RSS feed."
publishedAt: 2026-05-12
tags: [web, meta] # optional
updatedAt: 2026-05-14 # optional
draft: false # optional; omit to publish
---
```

Body is Markdown. Shows up at `/writing/<slug>/` and in the RSS feed. Sorted
reverse-chronological by `publishedAt`.

### A new project

Create `src/content/projects/<slug>.md`:

```yaml
---
title: project-name
summary: One-line pitch.
status: active # or "archived" or "experimental"
startedAt: 2026-01-15 # Date; used for sorting
displayYear: "2026" # optional override; e.g. "2023–present"
tech: [Rust, CLI]
featured: true # optional; shows on home page if true
links: # optional
  repo: https://github.com/gtritchie/foo
  site: https://example.com
  docs: https://example.com/docs
draft: false # optional
---
```

Body is Markdown. Shows at `/projects/<slug>/`. Home page includes up to 4
`featured: true` projects.

### A new interest

Create `src/content/interests/<slug>.md`:

```yaml
---
title: Photography
summary: Cameras, favorite rolls, travel gallery.
kind: photography # optional free-form tag
draft: false # optional
---
```

Body is Markdown. Shows at `/interests/<slug>/`.

### Drafts

Set `draft: true` in frontmatter to build the file locally but exclude it from
all listings, RSS, and the sitemap. `astro check` still validates the
frontmatter.

### Images

Drop images next to the Markdown file and reference them with relative paths.
Astro 6 auto-routes them through the Image pipeline (WebP/AVIF output,
responsive srcset). Always include `alt` text.

## Editing design

- **Colors / spacing / typography** — `src/styles/tokens.css`. Every visible
  style reads from these tokens. Light/dark palettes live side-by-side there.
- **Element-level styles** — `src/styles/global.css` (imports tokens + reset)
- **Reset** — `src/styles/reset.css` (minimal, a11y-aware)
- **Layouts** — `src/layouts/BaseLayout.astro` (full chrome) and
  `ProseLayout.astro` (article wrapper with reading-width constraint)
- **Components** — `src/components/` (SiteHeader, SiteFooter, ThemeToggle,
  SkipLink, ProjectCard, EntryList)

Astro scopes component CSS automatically — class names like `.inner` or
`.card` won't collide across components.

## Deploy

GitHub Actions runs on every push and PR to `main`: `npm run check`, build,
link check, pa11y, Lighthouse, and — on `main` only — deploy via
`cloudflare/wrangler-action` (all actions pinned to SHAs). Secrets required
are documented in
[`docs/superpowers/runbooks/2026-04-23-dns-migration.md`](docs/superpowers/runbooks/2026-04-23-dns-migration.md).

Day-to-day flow: branch, commit, open PR to `main`, wait for CI, merge. Deploy
is automatic on merge.

**Never push directly to `main`.** Branch protection should enforce this in
the GitHub repo settings once the remote is set up.

## Reference

- **Design spec** — `docs/superpowers/specs/2026-04-23-boringbydesign-site-design.md`
- **Implementation plan** — `docs/superpowers/plans/2026-04-23-boringbydesign-site.md`
- **DNS migration runbook** — `docs/superpowers/runbooks/2026-04-23-dns-migration.md`

## Stack notes worth remembering

- **Astro 6 content layer** — collections use `loader: glob(...)` in
  `src/content.config.ts`. Entries have `entry.id` (not `slug`). Render via
  `render(entry)` imported from `astro:content`.
- **ClientRouter, not ViewTransitions** — the component was renamed in Astro 5+.
- **`exactOptionalPropertyTypes: true`** — passing optional props often
  requires `{...(value && { key: value })}` instead of `key={value}`.
- **UTC dates** — YAML frontmatter dates parse as UTC midnight. All rendering
  uses `timeZone: "UTC"` and `getUTCFullYear()` so a `2026-04-23` value always
  displays as April 23 regardless of the host or reader's timezone.
- **Supply-chain policy** — `.npmrc` has `save-exact=true` (no `^`/`~`),
  `engine-strict=true`, and `ignore-scripts=true`. Puppeteer's browser
  postinstall is therefore suppressed; CI provisions Chrome via
  `browser-actions/setup-chrome` and `scripts/run-pa11y.mjs` auto-detects
  system Chrome for local runs.
- **Cloudflare adapter output** — `dist/client/` (not `dist/`) because in
  static mode the adapter doesn't emit a `_worker.js`. `wrangler.jsonc`
  points `assets.directory` at `./dist/client`.
