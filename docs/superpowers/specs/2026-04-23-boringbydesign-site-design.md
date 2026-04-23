# Boring by Design — site design spec

**Date:** 2026-04-23
**Domain:** boringbydesign.ca
**Author:** Gary Ritchie
**Status:** Approved — ready for implementation plan

---

## Summary

A personal website at **boringbydesign.ca** serving two purposes:

1. A personal archive — portfolio of software and non-software projects, writing,
   reading list, and tools I use. Durable, readable, mine.
2. A learning artifact — teaches me the full Astro + Cloudflare Workers stack
   so I can later rebuild my wife's slow WordPress site on the same foundation.

The site is a static multi-page application built with Astro 6, deployed as
static assets to Cloudflare Workers via the `@astrojs/cloudflare` adapter.
The visual system is minimalist, typography-first, AAA-contrast in both light
and dark themes, and uses only system fonts. No tracking beyond Cloudflare's
cookieless Web Analytics. No CMS; content lives in Markdown files in the repo.

## Goals

- **Fast.** Edge-served static files. Lighthouse performance ≥ 98.
- **Accessible.** WCAG AAA (≥7:1) for all text. Lighthouse accessibility = 100.
- **Readable at my own eyes.** 18px base size; honors the reader's browser
  font-size preference; explicit light/dark toggle; focus rings always visible.
- **Durable.** Content is Markdown in git. The site is rebuildable from scratch
  from the repo alone. No SaaS lock-in beyond the Cloudflare account.
- **Boring, on purpose.** Proven tools; no framework-of-the-month. Minimal
  client-side JavaScript. No premature abstraction.
- **Low-cost.** Stays inside Cloudflare's free tier at expected traffic
  (low hundreds of visitors per day at most).

## Non-goals

- Audience growth / SEO optimization beyond the basics
- Comments, reactions, newsletter signups
- A content management system or web-based editor
- Dynamic/runtime behavior in v1 (forms, search, personalization)
- Mobile apps, PWA install, offline mode

## Audience

Primarily me — the site is a personal archive I'll read and update over years.
Secondarily usable by a recruiter should I ever need to job hunt (not current),
and occasionally by friends/family/peers who land on a blog post. Not a growth
vehicle; no "hire me" CTA on the homepage.

---

## 1. Architecture & stack

### Runtime

- **Astro 6.1.9** with `output: "static"` — all pages pre-rendered at build
- **`@astrojs/cloudflare`** adapter in Workers Assets mode
- **`@astrojs/mdx`**, **`@astrojs/rss`**, **`@astrojs/sitemap`** integrations
- **Content Collections** with Zod-typed frontmatter
- **Astro Image** (sharp at build time) for responsive images
- **TypeScript strict mode** per project CLAUDE.md (noUncheckedIndexedAccess,
  exactOptionalPropertyTypes, verbatimModuleSyntax, isolatedModules)

### Tooling

- **Node 22 LTS**, **npm** package manager
- Exact-pinned versions (no `^` or `~`); `npm audit --audit-level=moderate` in CI
- **Wrangler** for local dev preview and deploys
- **Prettier + ESLint + astro check** for formatting and linting
- **prek** for pre-commit hooks (auto-update with 7-day cooldown)

### Zero client-side JavaScript by default

Only two tiny scripts ship to the browser:

1. **Theme toggle** (~15 lines of vanilla JS) — reads/writes localStorage,
   toggles a `data-theme` attribute on `<html>`
2. **Astro View Transitions helper** (~3 KB) — adds smooth cross-fades between
   page navigations; disabled for `prefers-reduced-motion: reduce`

No framework runtime (React / Vue / Solid / Preact). No hydration. No islands
in v1.

### No CMS, no dynamic routes

All content is Markdown/MDX committed to git under `src/content/`. Writing a
post or adding a project is creating a file, filling in frontmatter, and
pushing. The repo itself is the durable archive.

---

## 2. Site structure

### Routes

```
/                       Home — intro, featured projects, recent writing
/projects/              List of software projects (reverse chronological by startedAt)
/projects/<slug>/       Individual project write-up
/interests/             List of non-software interests
/interests/<slug>/      Individual interest entry
/writing/               List of posts (reverse chronological)
/writing/<slug>/        Individual post
/about/                 Bio, background, contact links
/uses/                  Single page — hardware/software/tools, updated occasionally
/reading/               Single page — books list
/rss.xml                Feed for /writing/
/sitemap-index.xml      Auto-generated via @astrojs/sitemap
/404                    Custom 404
```

### Navigation

- **Primary nav** (in site header): Projects · Interests · Writing · About
- **Secondary nav** (in site footer): Uses · Reading · RSS · GitHub · Email
- Home link is the wordmark ("Boring by Design") in the header

### Home page composition

In order, top to bottom:

1. Site header (wordmark · primary nav · theme toggle)
2. Short intro paragraph (1–2 sentences)
3. "Featured projects" — up to 4 entries with `featured: true` in frontmatter
4. "Recent writing" — latest 3 posts from the writing collection
5. Site footer (© · RSS link · secondary nav)

No carousel, no hero image, no "hire me" CTA.

---

## 3. Content model

Three collections. Everything else is a single Astro page with inline content.

### `writing` collection (`src/content/writing/*.md(x)`)

```ts
{
  title: string
  description: string         // used for meta description + RSS summary
  publishedAt: Date
  updatedAt?: Date
  draft?: boolean             // excluded from build if true
  tags?: string[]             // optional; shown under post title
}
```

### `projects` collection (`src/content/projects/*.md(x)`)

```ts
{
  title: string
  summary: string             // 1–2 line subtitle on cards
  status: "active" | "archived" | "experimental"
  startedAt: Date              // required; sort key for listings
  displayYear?: string         // optional display override, e.g. "2023–present"
                               // falls back to startedAt.getFullYear() if omitted
  tech: string[]              // ["Rust", "CLI"] — shown as tag chips
  links?: {
    repo?: string
    site?: string
    docs?: string
  }
  featured?: boolean          // appears on home page if true
  draft?: boolean
}
```

### `interests` collection (`src/content/interests/*.md(x)`)

```ts
{
  title: string
  summary: string
  kind?: string               // free-form: "photography", "woodworking", etc.
  draft?: boolean
}
```

Schemas live in `src/content/config.ts`. Build fails on frontmatter violations.

### Why no collection for Reading / Uses / About

Each is a single page whose content is prose plus some structured lists.
Putting them in a collection would be ceremony without payoff. When Reading
grows large enough to want per-book pages, it gets promoted to a collection —
not before.

---

## 4. Visual system

### Philosophy

Minimalist aesthetic + boring-tech engineering ethos. Typography-first.
No decorative graphics. No gradients. No drop shadows. Restraint is the feature.

### Design tokens

All tokens defined once in `src/styles/tokens.css` and referenced everywhere
via CSS custom properties. Exposed per-theme via `[data-theme="light"]` and
`[data-theme="dark"]` attribute selectors on `<html>`.

#### Colors — warm-neutral palette, AAA throughout

| Token          | Light        | Dark         | Purpose                              |
|----------------|--------------|--------------|--------------------------------------|
| `--bg`         | `#FAFAF7`    | `#111111`    | Page background                      |
| `--bg-raised`  | `#FFFFFF`    | `#181816`    | Cards, inline code                   |
| `--fg`         | `#141414`    | `#F2F0EA`    | Body text (≥15:1 on bg)              |
| `--fg-muted`   | `#4A4A4A`    | `#B8B4A9`    | Secondary text (≥8.9:1 on bg)        |
| `--border`     | `#CFCCC1`    | `#3A3A37`    | Decorative dividers                  |
| `--border-ui`  | `#7F7C70`    | `#6B6B6B`    | Interactive element borders (≥3:1)   |
| `--btn-bg`     | `#EFEDE6`    | `#222220`    | Subtle fill on buttons/inputs        |
| `--accent`     | `#7A331A`    | `#E8A98C`    | Links, focus rings (AAA)             |
| `--accent-bg`  | `#F1E7E0`    | `#2A1F1A`    | Inline code background               |
| `--focus-ring` | `#7A331A`    | `#E8A98C`    | 3px solid, 2px offset                |

All body and muted text hits WCAG AAA (≥7:1). All interactive component
boundaries hit WCAG AA (≥3:1). Rust accent chosen to meet AAA in both themes.

#### Typography — system stack only, no downloads

```css
--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

On macOS: San Francisco UI + SF Mono. On Windows: Segoe UI + Cascadia.
On Linux: whatever the user has. No web font downloads, no flash of unstyled
text, no network dependency, no tracking.

Sans everywhere (no serif) — Swiss/documentation feel, most utilitarian,
chosen over serif-headings for uniformity.

#### Type scale

```
Base:   18px (intentionally larger than web default for readability)
Ratio:  1.2 (minor third)

h1: 2.07rem    h2: 1.73rem    h3: 1.44rem    h4: 1.2rem
body: 1rem     small: 0.85rem

Line height: 1.55 body / 1.15 headings
Letter-spacing: -0.02em on h1, -0.01em on wordmark, normal elsewhere
```

All sizing in `rem` so the user's browser font-size preference propagates.

#### Spacing

4px base unit. Tokens `--sp-1` through `--sp-12` (4 px → 64 px).

#### Layout constraints

- Reading width: `max-width: 68ch` on prose content
- Page width: `max-width: 72ch` on chrome (header/footer)
- Single column; no sidebars at any breakpoint

### Theme toggle

- **First visit**: reads `prefers-color-scheme`, applies matching theme
- **User toggle**: overrides and persists to `localStorage.theme` as
  `"light" | "dark" | "system"`
- **UI**: single button in header; cycles Light → Dark → System on click
- **No flash**: inline `<script>` in `<head>` sets `data-theme` before paint
- **Reduced motion**: theme switch animation disabled if user opted out

### View transitions

- Enabled globally via Astro's `<ViewTransitions />` directive in `BaseLayout`
- Default cross-fade only — no slides or flourishes
- Fully disabled for `prefers-reduced-motion: reduce`
- Adds ~3 KB of JS; the one place bytes are spent for polish

### Images

- `<Image />` component for all content images (auto WebP + AVIF, responsive `srcset`)
- Astro 6 automatically optimizes relative image references in Markdown/MDX
  (they route through the Image pipeline at build time)
- No decorative images in site chrome
- **Alt text is an authoring responsibility.** pa11y-ci (section 7) audits
  the rendered HTML in CI and flags missing or empty alt regardless of
  source syntax (`<Image />`, `<img>`, or `![]()`). No source-level AST
  validator — the rendered-HTML audit covers every case.

---

## 5. Accessibility & responsive behavior

### Accessibility commitments

- **Contrast**: AAA (≥7:1) for body and muted text; AA (≥3:1) for UI boundaries
- **Keyboard**: every interactive element reachable by Tab; focus ring always
  visible (3 px solid accent, 2 px offset); never `outline: none`
- **Skip link**: "Skip to content" as first focusable element on every page,
  visible on focus, jumps to `<main>`
- **Landmarks**: one `<header>`, one `<main>`, one `<footer>` per page;
  `<nav>` with `aria-label`
- **Headings**: single `<h1>` per page, no level skips. Authoring convention;
  verified by pa11y-ci against the rendered HTML in CI, which catches
  violations regardless of whether they originated as Markdown, MDX JSX,
  or raw HTML
- **Motion**: `prefers-reduced-motion: reduce` disables view transitions and
  theme-toggle animation
- **Color not sole signifier**: links always underlined; status markers use
  text, not color alone
- **Alt text**: required on all `<Image />`; build-time check
- **Zoom**: usable up to 200 % without horizontal scroll

### Responsive breakpoints

```
< 640 px     phone     single column; nav items wrap to a second row if
                       needed; entry date moves above title (no 6rem
                       date column)
640–899 px   tablet    single column; nav visible in one row
≥ 900 px     desktop   single column centered; max-width 72ch;
                       date column re-appears at 6rem width
```

### No hamburger menu

The site has four primary nav links plus the theme toggle — few enough to
stay visible on phone-width screens. On narrow viewports the nav items wrap
onto a second row via `flex-wrap`; no disclosure control, no JS, no Escape
handler. This keeps the client-JS budget at exactly two scripts
(theme toggle + view transitions) as stated in section 1.

### Browser targets

Evergreen browsers: last 2 Chrome/Firefox/Safari, iOS Safari 17+, Android
Chrome. No IE, no legacy Edge. Site degrades gracefully on older engines
(CSS custom properties fall back, layouts don't break).

---

## 6. Build, deploy, observability

### Repo layout

```
boring-astro/
├── .github/workflows/
│   └── deploy.yml
├── docs/
│   └── superpowers/specs/        # this spec lives here
├── public/                        # static assets copied as-is
├── src/
│   ├── content/
│   │   ├── writing/
│   │   ├── projects/
│   │   ├── interests/
│   │   └── config.ts
│   ├── components/
│   │   ├── SiteHeader.astro
│   │   ├── SiteFooter.astro
│   │   ├── ThemeToggle.astro
│   │   ├── ProjectCard.astro
│   │   └── EntryList.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── ProseLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── uses.astro
│   │   ├── reading.astro
│   │   ├── 404.astro
│   │   ├── projects/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── interests/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── writing/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   └── rss.xml.ts
│   └── styles/
│       ├── tokens.css
│       ├── reset.css
│       └── global.css
├── astro.config.mjs
├── wrangler.jsonc
├── tsconfig.json
├── package.json
└── README.md
```

### Deployment pipeline

1. Feature branch → open PR → merge into `main` (never push directly to `main`)
2. GitHub Actions on merge runs: `npm ci` → `astro check` → `astro build` → `wrangler deploy`
3. Wrangler uploads built assets + worker entrypoint
4. Cloudflare serves from edge globally
5. Preview deploys on PR branches (separate Workers environment)

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` in GitHub repo secrets.
Token scoped to just this Workers project.

### DNS migration (one-time)

1. In Cloudflare dashboard: add `boringbydesign.ca` as a site (Free plan)
2. Cloudflare provides two nameservers
3. In GoDaddy: replace nameservers with the Cloudflare ones; keep the
   registration at GoDaddy (no transfer needed)
4. Wait for propagation (typically under one hour)
5. Bind the Worker's route to `boringbydesign.ca/*` and
   `www.boringbydesign.ca/*` (redirect `www` → apex)
6. Enable "Always Use HTTPS" and "Automatic HTTPS Rewrites" in Cloudflare
   SSL settings

### Observability

- **Cloudflare Web Analytics** — single `<script>` in `BaseLayout`, cookieless,
  no banner required. Reports page views, referrers, top pages, countries.
- **Build failure alerts** — GitHub Actions default (email on workflow failure)
- **Uptime** — Cloudflare's own monitoring; outages are rare and platform-wide

---

## 7. Testing & quality gates

### Local `npm run check`

```
astro check
tsc --noEmit
eslint . --max-warnings 0
prettier --check .
```

### CI (in addition to local checks)

```
astro build                  # bad frontmatter fails here
lychee --no-progress         # internal link checker
pa11y-ci                     # a11y scan on sampled built pages — catches
                             #   missing alt, heading-hierarchy issues, etc.
lhci autorun                 # Lighthouse CI — accessibility must stay at 100
```

### Lighthouse CI budgets (PR fails if regressed)

| Metric         | Floor |
|----------------|-------|
| Performance    | 98    |
| Accessibility  | 100   |
| Best Practices | 95    |
| SEO            | 95    |

Accessibility = 100 is a hard commitment.

### Pre-commit (prek)

```
prettier --write
eslint --fix
astro check
```

### Manual smoke checks before each deploy

1. Light theme readable on my monitor
2. Dark theme readable on my monitor
3. Theme toggle works, persists across reload
4. Keyboard-only nav reaches every link
5. 200 % zoom — no horizontal scroll
6. View a post on a phone-sized viewport

### Not included (deliberately)

- Unit tests — no meaningful logic to unit-test
- E2E tests — Lighthouse + pa11y + link checker cover the same ground
- Visual regression tests — too much maintenance for a site that rarely changes

Revisit these if the site grows dynamic behavior.

---

## 8. Open questions / deferred to implementation

These are not blocking decisions; they'll be resolved during build:

1. **Initial content.** First five project write-ups, about-page copy, and a
   first post. No need to decide the exact set now — placeholders are fine for
   the initial build.
2. **OG image strategy.** Single static OG image for v1; consider per-page
   generated OG images later if I start writing more.
3. **Resume/CV.** For the recruiter-leaning use case, decide later whether
   About suffices or whether a separate `/resume/` page or PDF is worth it.
4. **Search.** Not included in v1. If the writing collection grows past 30–40
   posts, revisit with Pagefind (build-time static search index).
5. **Repo name.** Workspace is currently `boring-astro`; GitHub repo name to
   be picked when the remote is created (`boring-astro` or
   `boringbydesign-site` both fine).

## 9. Success criteria for v1 launch

- Site deployed at `https://boringbydesign.ca`, redirects working from www
- All pages in section 2 reachable and functional
- AAA contrast verified with axe/pa11y
- Lighthouse budgets met
- RSS feed validates
- Sitemap indexed by search engines
- I can add a new writing post by creating a Markdown file, pushing, and it
  shows up at a URL within ~1 minute
- My wife has seen the deployed site and understands how the stack works

---

## Appendix A — key dependency versions (to pin at implementation time)

Resolve these to exact latest-stable versions in the implementation plan:
`astro`, `@astrojs/cloudflare`, `@astrojs/mdx`, `@astrojs/rss`,
`@astrojs/sitemap`, `typescript`, `wrangler`, `prettier`, `eslint`,
`eslint-plugin-astro`, `pa11y-ci`, `@lhci/cli`, `lychee` (binary).
