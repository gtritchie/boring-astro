# boring-astro

Source for [boringbydesign.ca](https://boringbydesign.ca). Static Astro 7 site
deployed to Cloudflare Workers (Workers Assets). Warm-neutral palette, AAA
contrast, system fonts, no client JS beyond the theme toggle and Astro view
transitions.

## Prereqs

- **Node 24+** (`.nvmrc` pins `24.15.0` — `nvm use` picks it up)
- **npm** (included with Node)
- **Chrome or Chromium** — required locally for `npm run lighthouse`.
  `npm run pa11y` uses Puppeteer's bundled Chrome, installed automatically
  by `npm install`.
- **lychee** — only for `npm run link-check`. Pin to a 0.23.x release to
  match CI (`lycheeverse/lychee-action@v2` defaults to v0.23.0, and 0.24+
  changed the `lychee.toml` schema). Easiest install:
  `cargo install lychee --version '~0.23'` (Rust toolchain required).
  Recent `brew install lychee` ships 0.24+ and will reject this repo's
  `lychee.toml`.

## Common commands

| Command                 | What it does                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Astro dev server with hot reload at `http://localhost:4321/`                                      |
| `npm run build`         | Produces `dist/client/` static output                                                             |
| `npm run preview`       | Runs `wrangler dev` — serves the built site via the real Workers runtime on `:8787`               |
| `npm run preview:astro` | Builds, then serves via `astro preview` on `127.0.0.1:4321` — port pa11y expects                  |
| `npm run check`         | `astro check` + `prettier --check` + `eslint`                                                     |
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
startedAt: 2026-01-15 # Date; drives the "Year" label and is the sort fallback
displayYear: "2026" # optional override; e.g. "2023–present"
order: 50 # optional; primary sort key, ascending (lower = first)
tags: [Rust, CLI]
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

Both the projects listing and the home page sort by `order` ascending (lower
first). Projects with `order` set always come before those without; ties — and
any entries without `order` — fall back to `startedAt` descending (newest
first).

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

Drop images next to the content file and reference them with Astro's
`<Image>` component (this requires the file to be `.mdx`, not `.md`):

```mdx
import { Image } from "astro:assets";
import screenshot from "./screenshot.png";

<Image
  src={screenshot}
  alt="Describe what the image shows"
  sizes="(min-width: 770px) 722px, calc(100vw - 3rem)"
/>
```

Astro converts to WebP and emits a responsive `srcset` at build. The explicit
`sizes` tells the browser the real rendered slot is the 68ch (~722px) reading
column, so it downloads a ~750w candidate instead of over-serving at viewport
width. Plain Markdown `![](…)` still builds, but its auto `sizes` collapses to
`100vw` and ships oversized files — prefer `<Image>`. Always include `alt`.

Cap source masters at roughly **1600px wide** — when an image is wider than
that, resize it in place with `sips --resampleWidth 1600 image.png`. Width is
the axis that matters: images render in the 68ch (~722px) reading column, so
~1600px covers it at 2× DPR (1444px) with margin. A tall portrait screenshot can
stay taller than 1600px as long as its width is in range. Anything wider only
bloats the repo and the largest srcset candidate; WebP conversion already
handles byte size, so images already within the width cap need no resize.

### External links

External links in Markdown/MDX get a "leaves the site" glyph and a
screen reader "(opens in a new tab)" announcement automatically — write
them as plain Markdown: `[text](https://example.com)`. The build pipeline
adds `target="_blank"`, merges `noopener noreferrer` into `rel`, and
appends the glyph and SR text.

In `.astro` components, use `<ExternalLink href="…">…</ExternalLink>`
(from `src/components/ExternalLink.astro`) for external links. Do not
write raw `<a target="_blank">` for external destinations — `ExternalLink`
validates the URL and produces the same HTML shape as the Markdown path.

Same-site links (including `https://www.boringbydesign.ca/…`), `mailto:`,
`tel:`, fragment, and root-relative links are treated as internal and get
no affordance.

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

GitHub Actions runs CI on every push and PR to `main`: `npm run check`, build,
and link check. CI is the quality gate; it does not deploy. The pa11y
accessibility audit runs locally only (see below).

Deploys are handled by **Cloudflare Workers Builds**. The `boring-site` Worker
is connected to this repo via the Cloudflare dashboard. On push to `main`,
Cloudflare runs `npm run build` then `npx wrangler deploy`. On push to any
other branch, Cloudflare runs `npm run build` then `npx wrangler versions
upload`, producing a unique preview URL — so every PR gets a working preview
deploy. Node 24 is auto-detected from `.nvmrc` (the Cloudflare default would
otherwise be 22).

Preview URLs are not indexed: `BaseLayout.astro` reads
`import.meta.env.WORKERS_CI_BRANCH` at build time and emits
`<meta name="robots" content="noindex, nofollow">` whenever the branch isn't
`main`.

**Build env vars** live in Cloudflare → Worker → Settings → Environment
variables → Build variables, not in GitHub secrets:

- `PUBLIC_CF_WA_TOKEN` — Cloudflare Web Analytics site token. When set, Astro
  bakes the beacon into the static output at build time. Optional.

Neither pa11y nor Lighthouse runs in CI — both need a browser, which the
GitHub runner image no longer provisions cleanly for Puppeteer. Run
`npm run pa11y` (accessibility) and `npm run lighthouse` (perf) locally; run
pa11y before merging changes that affect markup or styling.

Day-to-day flow: branch, commit, open PR to `main`, wait for CI, click the
Cloudflare preview URL on the PR, merge. Production deploy is automatic on
merge.

**Never push directly to `main`.** Branch protection should enforce this in
the GitHub repo settings.

## Reference

- **Design spec** — `docs/superpowers/specs/2026-04-23-boringbydesign-site-design.md`
- **Implementation plan** — `docs/superpowers/plans/2026-04-23-boringbydesign-site.md`

## Stack notes worth remembering

- **Astro 7 content layer** — collections use `loader: glob(...)` in
  `src/content.config.ts`. Entries have `entry.id` (not `slug`). Render via
  `render(entry)` imported from `astro:content`.
- **ClientRouter, not ViewTransitions** — the component was renamed in Astro 5+.
- **UTC dates** — YAML frontmatter dates parse as UTC midnight. All rendering
  uses `timeZone: "UTC"` and `getUTCFullYear()` so a `2026-04-23` value always
  displays as April 23 regardless of the host or reader's timezone.
- **pa11y uses Puppeteer's browser** — `npm install` runs Puppeteer's
  postinstall, which downloads Chrome for Testing to `~/.cache/puppeteer/`.
  `run-pa11y.mjs` leaves `chromeLaunchConfig.executablePath` unset so pa11y
  picks it up automatically. This is a local-only flow; pa11y is not run in CI.
- **Cloudflare adapter output** — `dist/client/` (not `dist/`) because in
  static mode the adapter doesn't emit a `_worker.js`. `wrangler.jsonc`
  points `assets.directory` at `./dist/client`.
