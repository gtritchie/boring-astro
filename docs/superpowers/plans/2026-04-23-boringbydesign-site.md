# Boring by Design — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a static personal site at boringbydesign.ca on Astro 6 + Cloudflare Workers, matching the approved design spec at `docs/superpowers/specs/2026-04-23-boringbydesign-site-design.md`.

**Architecture:** Astro 6 static output (`output: "static"`) deployed as static assets to Cloudflare Workers via the `@astrojs/cloudflare` adapter. Content is Markdown/MDX in `src/content/` routed through Content Collections. Zero client JS beyond a theme toggle and Astro view transitions. All styling in plain CSS using design tokens.

**Tech Stack:** Astro 6.1.9, `@astrojs/cloudflare`, `@astrojs/mdx`, `@astrojs/rss`, `@astrojs/sitemap`, TypeScript (strict), Node 22 LTS, npm, Wrangler (Cloudflare), Prettier, ESLint with `eslint-plugin-astro`, pa11y-ci, Lighthouse CI (`@lhci/cli`), lychee (binary). No JS frameworks (no React, Vue, Solid, Preact). No web fonts.

**Working directory:** `/Users/gary/code/boring-astro`
**Starting branch:** `docs/site-spec` (spec committed here; implementation extends it)

---

## Pre-flight notes for the executing engineer

- **Node version.** Confirm `node -v` reports Node 22.x. If not, install via nvm: `nvm install 22 && nvm use 22`.
- **Cloudflare account.** Gary already has a Cloudflare account and has done prior Workers experiments on this domain. The executing engineer does **not** need to provision accounts — but will need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from Gary to do real deploys. Use `wrangler login` locally for interactive auth.
- **DNS.** The DNS nameserver swap from GoDaddy to Cloudflare (Task 23) is a Gary-performed manual step — the plan documents it but does not execute it.
- **Version pinning.** Dependencies are installed with `npm install --save-exact <pkg>@latest` to pin the then-current stable. Do NOT guess versions from memory; run the install commands as written.
- **Commit style.** Imperative mood, ≤72 char subject line, body explains why. No Claude Code coauthor mentions.
- **roborev.** Gary runs a roborev daemon that reviews each commit automatically. Commits will be queued for review; no action needed — reviews surface to Gary separately.
- **Test philosophy.** This is a static site with no logic to unit-test. "Test" in each task means: the build succeeds, the expected page is reachable in `wrangler dev`, or the relevant quality gate (pa11y, Lighthouse, lychee) passes. That's the contract.

---

## File structure (target, built across all tasks)

```
boring-astro/
├── .github/workflows/deploy.yml
├── .npmrc
├── .prek-config.yaml
├── .prettierrc.json
├── .prettierignore
├── .pa11yci.json
├── .lighthouserc.json
├── lychee.toml
├── eslint.config.js
├── astro.config.mjs
├── wrangler.jsonc
├── tsconfig.json
├── package.json
├── package-lock.json
├── scripts/
│   └── run-pa11y.mjs
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── content/
│   │   ├── config.ts
│   │   ├── writing/*.md(x)
│   │   ├── projects/*.md(x)
│   │   └── interests/*.md(x)
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── reset.css
│   │   └── global.css
│   ├── components/
│   │   ├── SiteHeader.astro
│   │   ├── SiteFooter.astro
│   │   ├── ThemeToggle.astro
│   │   ├── SkipLink.astro
│   │   ├── ProjectCard.astro
│   │   └── EntryList.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── ProseLayout.astro
│   └── pages/
│       ├── index.astro
│       ├── about.astro
│       ├── uses.astro
│       ├── reading.astro
│       ├── 404.astro
│       ├── rss.xml.ts
│       ├── projects/
│       │   ├── index.astro
│       │   └── [...slug].astro
│       ├── interests/
│       │   ├── index.astro
│       │   └── [...slug].astro
│       └── writing/
│           ├── index.astro
│           └── [...slug].astro
└── docs/superpowers/{specs,plans}/
```

---

## Milestone A — Foundation (scaffold, minimal deploy)

Goal: a one-page hello-world site that builds with Astro and serves locally via Wrangler. Gets the plumbing proven before any design work.

---

### Task A1: Create feature branch and lock down npm policy

**Files:**
- Create: `.npmrc`

- [ ] **Step 1: Create the feature branch off `docs/site-spec`**

```bash
git checkout docs/site-spec
git checkout -b feat/initial-build
```

- [ ] **Step 2: Write the `.npmrc` supply-chain policy**

Create `.npmrc` with the content below (matches Gary's CLAUDE.md standards):

```
save-exact=true
engine-strict=true
ignore-scripts=true
```

The `minimumReleaseAge` setting is documented in Gary's CLAUDE.md as 1440 (24h) but is a global npm config, not a project-level one. Leave that to the user's global `~/.npmrc`.

- [ ] **Step 3: Commit**

```bash
git add .npmrc
git commit -m "Add .npmrc with exact-pin and no-scripts supply-chain policy"
```

Expected: commit succeeds; `git log --oneline -1` shows the new commit.

---

### Task A2: Initialize package.json and install Astro + TypeScript

**Files:**
- Create: `package.json` (via `npm init`)
- Create: `package-lock.json` (via `npm install`)
- Create: `node_modules/` (gitignored)

- [ ] **Step 1: Initialize package.json**

```bash
npm init -y
```

Then edit `package.json` to add `"type": "module"` and `"private": true`, and set Node engine:

```json
{
  "name": "boring-astro",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "engines": {
    "node": ">=22 <23"
  },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "wrangler dev",
    "check": "astro check && tsc --noEmit && prettier --check . && eslint . --max-warnings 0"
  }
}
```

- [ ] **Step 2: Install Astro, TypeScript, and the Cloudflare adapter (pinned latest)**

```bash
npm install --save-exact astro@latest @astrojs/check@latest @astrojs/cloudflare@latest @astrojs/mdx@latest @astrojs/rss@latest @astrojs/sitemap@latest
npm install --save-exact --save-dev typescript@latest wrangler@latest
```

Confirm with `npm ls --depth=0`. Verify the `astro` major version is 6.x per the spec. If npm resolves a different major, stop and report to the user — do not downgrade.

- [ ] **Step 3: Verify Astro CLI works**

```bash
npx astro --version
```

Expected: prints a version string like `6.1.9` or newer 6.x.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install Astro 6, Cloudflare adapter, and core integrations with exact-pinned versions"
```

---

### Task A3: Write Astro config, tsconfig, and Wrangler config

**Files:**
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `wrangler.jsonc`

- [ ] **Step 1: Write `astro.config.mjs`**

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://boringbydesign.ca',
  output: 'static',
  adapter: cloudflare(),
  integrations: [mdx(), sitemap()],
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
```

Why `trailingSlash: 'always'` + `format: 'directory'`: produces `/about/index.html` etc., so URLs are `/about/` and Workers Assets serves them without rewrite rules.

- [ ] **Step 2: Write `tsconfig.json` with strict flags from CLAUDE.md**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": ["src/**/*", "astro.config.mjs", "*.ts"],
  "exclude": ["dist/**/*", "node_modules/**/*"],
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 3: Write `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "boringbydesign",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist/client",
    "binding": "ASSETS",
    "not_found_handling": "404-page"
  },
  "observability": { "enabled": true }
}
```

Notes:
- No `main` field — `@astrojs/cloudflare` in static mode does not emit a worker entrypoint; static assets are served directly by Workers Assets. If SSR routes are added later, set `main` to `./dist/_worker.js/index.js`.
- The adapter emits static output to `dist/client/`, which is why `assets.directory` points there rather than at `./dist`.
- The Worker name `boringbydesign` should be unique to the Cloudflare account. If a name collision occurs at first deploy, rename to `boringbydesign-site`.

- [ ] **Step 4: Verify typecheck passes on empty src**

```bash
mkdir -p src/pages
npx astro check
```

Expected: `astro check` reports 0 errors (may warn "no pages found" — that's fine until A4).

- [ ] **Step 5: Commit**

```bash
git add astro.config.mjs tsconfig.json wrangler.jsonc
git commit -m "Add Astro, TypeScript, and Wrangler configs for static Workers deploy"
```

---

### Task A4: Build hello-world index page and verify local build works

**Files:**
- Create: `src/pages/index.astro`
- Create: `public/robots.txt`

- [ ] **Step 1: Write the minimal index page**

```astro
---
// src/pages/index.astro
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Boring by Design</title>
    <meta name="description" content="Personal site of Gary Ritchie." />
  </head>
  <body>
    <h1>Boring by Design</h1>
    <p>Site under construction.</p>
  </body>
</html>
```

- [ ] **Step 2: Write `public/robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://boringbydesign.ca/sitemap-index.xml
```

- [ ] **Step 3: Run the build**

```bash
npm run build
```

Expected: builds `dist/` with `index.html`, `_worker.js/`, and an `assets/` dir. No errors.

- [ ] **Step 4: Smoke-test locally via Wrangler**

```bash
npx wrangler dev
```

Expected: server on `http://localhost:8787/` serves the `<h1>Boring by Design</h1>` page. Hit `Ctrl-C` to stop.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro public/robots.txt
git commit -m "Add hello-world home page and robots.txt; confirm Astro build and Wrangler dev work"
```

---

## Milestone B — Design system

Goal: design tokens, layouts, and chrome components wired up so future pages compose from shared parts.

---

### Task B1: Design tokens, reset, and global CSS

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/reset.css`
- Create: `src/styles/global.css`

- [ ] **Step 1: Write `src/styles/tokens.css`**

```css
/* src/styles/tokens.css — values locked by the approved design spec */

:root {
  /* Typography */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  /* Type scale (base 18px, ratio 1.2) */
  --fs-base: 1rem;
  --fs-sm: 0.85rem;
  --fs-h4: 1.2rem;
  --fs-h3: 1.44rem;
  --fs-h2: 1.73rem;
  --fs-h1: 2.07rem;

  --lh-body: 1.55;
  --lh-heading: 1.15;

  /* Spacing (4px base) */
  --sp-1: 0.25rem;
  --sp-2: 0.5rem;
  --sp-3: 0.75rem;
  --sp-4: 1rem;
  --sp-5: 1.25rem;
  --sp-6: 1.5rem;
  --sp-8: 2rem;
  --sp-10: 2.5rem;
  --sp-12: 3rem;
  --sp-16: 4rem;

  /* Layout */
  --reading-width: 68ch;
  --page-width: 72ch;
}

/* Light theme (default) */
:root,
[data-theme="light"] {
  --bg: #FAFAF7;
  --bg-raised: #FFFFFF;
  --fg: #141414;
  --fg-muted: #4A4A4A;
  --border: #CFCCC1;
  --border-ui: #7F7C70;
  --btn-bg: #EFEDE6;
  --accent: #7A331A;
  --accent-bg: #F1E7E0;
  --focus-ring: #7A331A;
}

[data-theme="dark"] {
  --bg: #111111;
  --bg-raised: #181816;
  --fg: #F2F0EA;
  --fg-muted: #B8B4A9;
  --border: #3A3A37;
  --border-ui: #6B6B6B;
  --btn-bg: #222220;
  --accent: #E8A98C;
  --accent-bg: #2A1F1A;
  --focus-ring: #E8A98C;
}

/* Respect system preference when no explicit choice */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --bg: #111111;
    --bg-raised: #181816;
    --fg: #F2F0EA;
    --fg-muted: #B8B4A9;
    --border: #3A3A37;
    --border-ui: #6B6B6B;
    --btn-bg: #222220;
    --accent: #E8A98C;
    --accent-bg: #2A1F1A;
    --focus-ring: #E8A98C;
  }
}
```

- [ ] **Step 2: Write `src/styles/reset.css`**

```css
/* src/styles/reset.css — minimal, opinionated reset */

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  min-height: 100vh;
  font-family: var(--font-sans);
  font-size: 18px; /* base size; rem values cascade from here */
  line-height: var(--lh-body);
  background: var(--bg);
  color: var(--fg);
}

h1, h2, h3, h4, h5, h6 {
  margin: 0;
  line-height: var(--lh-heading);
  font-weight: 600;
}

p, ul, ol, pre, blockquote, figure { margin: 0; }

a { color: inherit; text-decoration: none; }

img, picture, svg, video { display: block; max-width: 100%; height: auto; }

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Write `src/styles/global.css`**

```css
/* src/styles/global.css — applied on every page via BaseLayout */

@import "./tokens.css";
@import "./reset.css";

body { font-size: 18px; }

h1 { font-size: var(--fs-h1); letter-spacing: -0.02em; }
h2 { font-size: var(--fs-h2); letter-spacing: -0.015em; }
h3 { font-size: var(--fs-h3); }
h4 { font-size: var(--fs-h4); }

p { max-width: var(--reading-width); }

a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
a:hover { text-decoration-thickness: 2px; }

code {
  font-family: var(--font-mono);
  font-size: 0.85em;
  background: var(--accent-bg);
  color: var(--accent);
  padding: 0.08rem 0.35rem;
  border-radius: 3px;
}

hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: var(--sp-6) 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/
git commit -m "Add design tokens, CSS reset, and global styles per spec"
```

Nothing renders yet — the CSS files are just sitting there until BaseLayout imports them in Task B3.

---

### Task B2: Build `BaseLayout.astro` with inline theme-bootstrap script

**Files:**
- Create: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Write the layout**

```astro
---
// src/layouts/BaseLayout.astro
import "../styles/global.css";

interface Props {
  title: string;
  description?: string;
  canonical?: string;
}

const { title, description, canonical } = Astro.props;
const fullTitle = title === "Boring by Design" ? title : `${title} — Boring by Design`;
const canonicalHref = canonical ?? new URL(Astro.url.pathname, Astro.site).toString();
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    {description && <meta name="description" content={description} />}
    <link rel="canonical" href={canonicalHref} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

    {/* Theme bootstrap — runs inline before first paint to avoid FOUC */}
    <script is:inline>
      (() => {
        try {
          const stored = localStorage.getItem("theme");
          if (stored === "light" || stored === "dark") {
            document.documentElement.setAttribute("data-theme", stored);
          }
          // If "system" or null, leave data-theme unset — CSS
          // uses prefers-color-scheme as the fallback.
        } catch {}
      })();
    </script>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 2: Update `src/pages/index.astro` to use the layout**

Replace the raw HTML with:

```astro
---
// src/pages/index.astro
import BaseLayout from "../layouts/BaseLayout.astro";
---
<BaseLayout title="Boring by Design" description="Personal site of Gary Ritchie.">
  <main>
    <h1>Boring by Design</h1>
    <p>Site under construction.</p>
  </main>
</BaseLayout>
```

- [ ] **Step 3: Rebuild and verify styles apply**

```bash
npm run build
npx wrangler dev
```

In a browser, open `http://localhost:8787/`. Expected: page uses the warm-neutral light palette (off-white background, near-black text). In browser devtools, add `data-theme="dark"` to `<html>` and confirm it flips to the dark palette. Remove it when done.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro src/pages/index.astro
git commit -m "Add BaseLayout with inline theme bootstrap and wire home page to use it"
```

---

### Task B3: Build `ThemeToggle.astro` and `SkipLink.astro`

**Files:**
- Create: `src/components/ThemeToggle.astro`
- Create: `src/components/SkipLink.astro`

- [ ] **Step 1: Write `ThemeToggle.astro`**

```astro
---
// src/components/ThemeToggle.astro — cycles Light → Dark → System; persists to localStorage
---
<button class="theme-toggle" data-theme-toggle aria-label="Cycle theme: light, dark, system" type="button">
  <span data-theme-label>Theme</span>
</button>

<style>
  .theme-toggle {
    background: var(--btn-bg);
    border: 1px solid var(--border-ui);
    color: var(--fg);
    padding: 0.3rem 0.65rem;
    border-radius: 4px;
    font-size: 0.82rem;
    letter-spacing: 0.02em;
  }
  .theme-toggle:hover { background: var(--border); }
</style>

<script>
  // Survives Astro View Transitions: click handler is attached once to
  // `document` via delegation, and label-update runs on both initial load
  // and every `astro:page-load` event after navigation.
  type Choice = "light" | "dark" | "system";
  const ORDER: Choice[] = ["light", "dark", "system"];
  const LABELS: Record<Choice, string> = { light: "Light ☀︎", dark: "Dark ☾", system: "System ⌘" };
  const INIT_FLAG = "__bbdThemeToggleReady";

  function read(): Choice {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  }

  function applyTheme(choice: Choice) {
    if (choice === "system") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "system");
    } else {
      document.documentElement.setAttribute("data-theme", choice);
      localStorage.setItem("theme", choice);
    }
    syncLabels(choice);
  }

  function syncLabels(choice: Choice) {
    for (const el of document.querySelectorAll<HTMLElement>("[data-theme-label]")) {
      el.textContent = LABELS[choice];
    }
  }

  function cycle() {
    const next = ORDER[(ORDER.indexOf(read()) + 1) % ORDER.length]!;
    applyTheme(next);
  }

  function initOnce() {
    const w = window as unknown as Record<string, unknown>;
    if (w[INIT_FLAG]) return;
    w[INIT_FLAG] = true;
    // Delegated click — survives any DOM swap because it lives on document.
    document.addEventListener("click", (e) => {
      const target = e.target as Element | null;
      if (target?.closest("[data-theme-toggle]")) cycle();
    });
    // Per-page label sync after View Transitions. Registered exactly once
    // because initOnce is guarded by INIT_FLAG — re-execution of this
    // component script after a transition is a no-op.
    document.addEventListener("astro:page-load", () => syncLabels(read()));
  }

  // First paint (inline theme bootstrap in <head> has already set data-theme).
  initOnce();
  syncLabels(read());
</script>
```

Astro scopes the `<style>` block to this component; hashed class names prevent collisions.

- [ ] **Step 2: Write `SkipLink.astro`**

```astro
---
// src/components/SkipLink.astro — visually hidden until focused; jumps to #main
---
<a class="skip-link" href="#main">Skip to content</a>

<style>
  .skip-link {
    position: absolute;
    top: -100px;
    left: var(--sp-2);
    background: var(--bg);
    color: var(--fg);
    padding: var(--sp-2) var(--sp-3);
    border: 2px solid var(--accent);
    border-radius: 4px;
    text-decoration: none;
    z-index: 100;
  }
  .skip-link:focus { top: var(--sp-2); }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ThemeToggle.astro src/components/SkipLink.astro
git commit -m "Add ThemeToggle and SkipLink components"
```

---

### Task B4: Build `SiteHeader.astro` and `SiteFooter.astro`

**Files:**
- Create: `src/components/SiteHeader.astro`
- Create: `src/components/SiteFooter.astro`

- [ ] **Step 1: Write `SiteHeader.astro`**

```astro
---
// src/components/SiteHeader.astro
import ThemeToggle from "./ThemeToggle.astro";

const navItems = [
  { href: "/projects/",  label: "Projects" },
  { href: "/interests/", label: "Interests" },
  { href: "/writing/",   label: "Writing" },
  { href: "/about/",     label: "About" },
];

const pathname = Astro.url.pathname;
---
<header class="site-header">
  <div class="inner">
    <a class="wordmark" href="/" aria-label="Home">Boring by Design</a>
    <div class="right">
      <nav aria-label="Primary">
        <ul>
          {navItems.map(item => (
            <li>
              <a
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
              >{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <ThemeToggle />
    </div>
  </div>
</header>

<style>
  .site-header {
    border-bottom: 1px solid var(--border);
    padding: var(--sp-5) var(--sp-6);
  }
  .inner {
    max-width: var(--page-width);
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-4);
    flex-wrap: wrap; /* nav wraps to second row on narrow screens */
  }
  .wordmark {
    font-weight: 600;
    font-size: 1.1rem;
    letter-spacing: -0.01em;
    color: var(--fg);
    text-decoration: none;
  }
  .right {
    display: flex;
    align-items: center;
    gap: var(--sp-6);
    flex-wrap: wrap;
  }
  nav ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    gap: var(--sp-5);
    font-size: 0.95rem;
  }
  nav a {
    color: var(--fg);
    text-decoration: none;
  }
  nav a:hover { text-decoration: underline; text-underline-offset: 4px; }
  nav a[aria-current="page"] { text-decoration: underline; text-underline-offset: 4px; }
</style>
```

- [ ] **Step 2: Write `SiteFooter.astro`**

```astro
---
// src/components/SiteFooter.astro
const year = new Date().getFullYear();
---
<footer class="site-footer">
  <div class="inner">
    <span>© {year} Gary Ritchie · <a href="/rss.xml">RSS</a></span>
    <nav aria-label="Secondary">
      <ul>
        <li><a href="/uses/">Uses</a></li>
        <li><a href="/reading/">Reading</a></li>
        <li><a href="https://github.com/" rel="me">GitHub</a></li>
        <li><a href="mailto:gary.t.ritchie@gmail.com">Email</a></li>
      </ul>
    </nav>
  </div>
</footer>

<style>
  .site-footer {
    border-top: 1px solid var(--border);
    padding: var(--sp-5) var(--sp-6);
    margin-top: var(--sp-12);
    font-size: 0.85rem;
    color: var(--fg-muted);
  }
  .inner {
    max-width: var(--page-width);
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-4);
    flex-wrap: wrap;
  }
  nav ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    gap: var(--sp-4);
  }
  .site-footer a { color: var(--fg-muted); text-decoration: underline; text-underline-offset: 3px; }
  .site-footer a:hover { color: var(--fg); }
</style>
```

Leave the GitHub URL as a placeholder for now — Gary fills in his actual handle in Task C2 or later.

- [ ] **Step 3: Commit**

```bash
git add src/components/SiteHeader.astro src/components/SiteFooter.astro
git commit -m "Add SiteHeader (primary nav + theme toggle) and SiteFooter (secondary nav + RSS)"
```

---

### Task B5: Wire `BaseLayout` to include `SkipLink`, `SiteHeader`, `SiteFooter`, plus Astro View Transitions

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Update `BaseLayout.astro`**

Replace the file contents with the full version:

```astro
---
import "../styles/global.css";
import SkipLink from "../components/SkipLink.astro";
import SiteHeader from "../components/SiteHeader.astro";
import SiteFooter from "../components/SiteFooter.astro";
import { ViewTransitions } from "astro:transitions";

interface Props {
  title: string;
  description?: string;
  canonical?: string;
}

const { title, description, canonical } = Astro.props;
const fullTitle = title === "Boring by Design" ? title : `${title} — Boring by Design`;
const canonicalHref = canonical ?? new URL(Astro.url.pathname, Astro.site).toString();
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    {description && <meta name="description" content={description} />}
    <link rel="canonical" href={canonicalHref} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="alternate" type="application/rss+xml" title="Boring by Design" href="/rss.xml" />

    <script is:inline>
      (() => {
        try {
          const stored = localStorage.getItem("theme");
          if (stored === "light" || stored === "dark") {
            document.documentElement.setAttribute("data-theme", stored);
          }
        } catch {}
      })();
    </script>

    <ViewTransitions />
  </head>
  <body>
    <SkipLink />
    <SiteHeader />
    <slot />
    <SiteFooter />
  </body>
</html>
```

- [ ] **Step 2: Update `src/pages/index.astro` to include a `<main id="main">` wrapper**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---
<BaseLayout title="Boring by Design" description="Personal site of Gary Ritchie.">
  <main id="main">
    <h1>Calm work, quietly shipped.</h1>
    <p>A personal archive of the software I build, the things I'm tinkering with, and the occasional note.</p>
  </main>
</BaseLayout>
```

Add a minimal `<main>` style by appending to `src/styles/global.css`:

```css
main {
  max-width: var(--page-width);
  margin: 0 auto;
  padding: var(--sp-8) var(--sp-6);
}
```

- [ ] **Step 3: Rebuild and verify**

```bash
npm run build && npx wrangler dev
```

Open `http://localhost:8787/`. Expected: header with wordmark + nav + theme toggle; main with heading and intro; footer with copyright + secondary nav. Click the theme toggle — label cycles Light → Dark → System and the palette flips correctly. Keyboard Tab from the URL bar — the Skip link appears top-left on first focus.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro src/pages/index.astro src/styles/global.css
git commit -m "Wire BaseLayout with site chrome, view transitions, and main wrapper"
```

---

### Task B6: Build `ProseLayout.astro`

**Files:**
- Create: `src/layouts/ProseLayout.astro`

- [ ] **Step 1: Write the layout**

```astro
---
// src/layouts/ProseLayout.astro — wraps long-form content (posts, project/interest detail)
import BaseLayout from "./BaseLayout.astro";

interface Props {
  title: string;
  description?: string;
  publishedAt?: Date;
  updatedAt?: Date;
}

const { title, description, publishedAt, updatedAt } = Astro.props;

const fmt = (d?: Date) =>
  d ? new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "long", day: "numeric" }).format(d) : null;
---
<BaseLayout title={title} description={description}>
  <main id="main" class="prose-main">
    <article>
      <header class="prose-header">
        <h1>{title}</h1>
        {publishedAt && (
          <p class="meta">
            <time datetime={publishedAt.toISOString()}>{fmt(publishedAt)}</time>
            {updatedAt && <> · updated <time datetime={updatedAt.toISOString()}>{fmt(updatedAt)}</time></>}
          </p>
        )}
      </header>
      <div class="prose-body">
        <slot />
      </div>
    </article>
  </main>
</BaseLayout>

<style>
  .prose-main { max-width: var(--reading-width); }
  .prose-header { margin-bottom: var(--sp-8); }
  .meta { color: var(--fg-muted); font-size: 0.9rem; margin-top: var(--sp-2); font-family: var(--font-mono); }
  .prose-body :global(h2) { margin-top: var(--sp-10); margin-bottom: var(--sp-3); }
  .prose-body :global(h3) { margin-top: var(--sp-8); margin-bottom: var(--sp-2); }
  .prose-body :global(p)  { margin: var(--sp-4) 0; }
  .prose-body :global(ul),
  .prose-body :global(ol) { margin: var(--sp-4) 0; padding-left: var(--sp-6); }
  .prose-body :global(li) { margin: var(--sp-2) 0; }
  .prose-body :global(pre) {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: var(--sp-3) var(--sp-4);
    overflow-x: auto;
  }
</style>
```

- [ ] **Step 2: Verify build still succeeds**

```bash
npm run build
```

Expected: no errors. ProseLayout isn't used by any page yet — that happens in Milestone C.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/ProseLayout.astro
git commit -m "Add ProseLayout for long-form content"
```

---

## Milestone C — Content

Goal: content collections, all pages wired to real data, seed content in place.

---

### Task C1: Content collection schemas

**Files:**
- Create: `src/content/config.ts`

- [ ] **Step 1: Write `src/content/config.ts`**

```ts
// src/content/config.ts
import { defineCollection, z } from "astro:content";

const writing = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.date(),
    updatedAt: z.date().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).optional(),
  }),
});

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    status: z.enum(["active", "archived", "experimental"]),
    startedAt: z.date(),
    displayYear: z.string().optional(),
    tech: z.array(z.string()),
    links: z
      .object({
        repo: z.string().url().optional(),
        site: z.string().url().optional(),
        docs: z.string().url().optional(),
      })
      .optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const interests = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    kind: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writing, projects, interests };
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npx astro check
```

Expected: 0 errors. Astro generates the `astro:content` types from this schema on build/dev.

- [ ] **Step 3: Commit**

```bash
git add src/content/config.ts
git commit -m "Add Zod schemas for writing, projects, and interests collections"
```

---

### Task C2: Seed content — two entries per collection

**Files:**
- Create: `src/content/writing/hello-world.md`
- Create: `src/content/writing/why-boring.md`
- Create: `src/content/projects/cal-gen.md`
- Create: `src/content/projects/ledger-import.md`
- Create: `src/content/interests/notebook-keeping.md`
- Create: `src/content/interests/photography.md`

These are stubs so listing pages have something to render. Gary replaces them with real content later.

- [ ] **Step 1: Write the two writing stubs**

`src/content/writing/hello-world.md`:

```md
---
title: Hello, world
description: A one-sentence welcome to the site.
publishedAt: 2026-04-23
tags: [meta]
---

This is the first post. More to come when there's something worth writing.
```

`src/content/writing/why-boring.md`:

```md
---
title: On boring websites
description: Why a week away from frameworks produced a better site.
publishedAt: 2026-04-20
tags: [meta, web]
---

There's a lot to be said for choosing the tool that will still be maintained
in five years. This is a placeholder post — a real one will replace it.
```

- [ ] **Step 2: Write the two project stubs**

`src/content/projects/cal-gen.md`:

```md
---
title: cal-gen
summary: A CLI that turns events.yaml into a printable year-at-a-glance PDF.
status: active
startedAt: 2025-02-01
tech: [Rust, CLI]
featured: true
---

Placeholder project entry. Real write-up to follow.
```

`src/content/projects/ledger-import.md`:

```md
---
title: ledger-import
summary: Pulls bank exports into plain-text accounting. Ten years old, still working.
status: archived
startedAt: 2015-06-01
displayYear: "2015–present"
tech: [Python, Personal]
featured: true
---

Placeholder project entry. Real write-up to follow.
```

- [ ] **Step 3: Write the two interest stubs**

`src/content/interests/notebook-keeping.md`:

```md
---
title: Notebook keeping
summary: On the rituals of writing things down by hand.
kind: process
---

Placeholder entry.
```

`src/content/interests/photography.md`:

```md
---
title: Photography
summary: Favorite cameras and a small gallery of travel work.
kind: photography
---

Placeholder entry.
```

- [ ] **Step 4: Verify content loads cleanly**

```bash
npm run build
```

Expected: build succeeds and `dist/` is produced. Any schema violation (missing field, wrong type) fails the build here.

- [ ] **Step 5: Commit**

```bash
git add src/content/
git commit -m "Add seed content stubs for writing, projects, and interests"
```

---

### Task C3: Build `EntryList.astro` and `ProjectCard.astro`

**Files:**
- Create: `src/components/EntryList.astro`
- Create: `src/components/ProjectCard.astro`

- [ ] **Step 1: Write `EntryList.astro`**

```astro
---
// src/components/EntryList.astro — date + title + description rows (writing lists)
interface Entry {
  href: string;
  title: string;
  description: string;
  date: Date;
}
interface Props {
  entries: Entry[];
}

const { entries } = Astro.props;
const fmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
---
<ul class="entry-list">
  {entries.map(e => (
    <li class="entry">
      <time class="date" datetime={e.date.toISOString()}>{fmt.format(e.date)}</time>
      <div>
        <a class="title" href={e.href}>{e.title}</a>
        <p class="desc">{e.description}</p>
      </div>
    </li>
  ))}
</ul>

<style>
  .entry-list { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--border); }
  .entry {
    display: grid;
    grid-template-columns: 6rem 1fr;
    gap: var(--sp-5);
    padding: var(--sp-4) 0;
    border-bottom: 1px solid var(--border);
    align-items: baseline;
  }
  .date { font-family: var(--font-mono); font-size: 0.85rem; color: var(--fg-muted); letter-spacing: 0.02em; }
  .title { color: var(--fg); text-decoration: underline; text-underline-offset: 3px; font-size: 1.1rem; font-weight: 500; }
  .desc { color: var(--fg-muted); font-size: 0.93rem; margin: var(--sp-1) 0 0; }

  @media (max-width: 640px) {
    .entry { grid-template-columns: 1fr; gap: var(--sp-2); }
  }
</style>
```

- [ ] **Step 2: Write `ProjectCard.astro`**

```astro
---
// src/components/ProjectCard.astro
interface Props {
  href: string;
  title: string;
  summary: string;
  tech: string[];
  displayYear: string;
  status: "active" | "archived" | "experimental";
}
const { href, title, summary, tech, displayYear, status } = Astro.props;
---
<article class="card">
  <h3><a href={href}>{title}</a></h3>
  <p class="summary">{summary}</p>
  <div class="meta">
    <ul class="tags">
      {tech.map(t => <li>{t}</li>)}
      <li>{displayYear}</li>
    </ul>
    {status !== "active" && <span class="status">{status}</span>}
  </div>
</article>

<style>
  .card {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: var(--sp-4) var(--sp-5);
    margin-bottom: var(--sp-3);
  }
  .card h3 { font-size: 1.05rem; margin: 0 0 var(--sp-2); }
  .card h3 a { color: var(--fg); text-decoration: none; }
  .card h3 a:hover { text-decoration: underline; text-underline-offset: 3px; }
  .summary { color: var(--fg-muted); font-size: 0.95rem; margin: 0 0 var(--sp-3); max-width: 60ch; }
  .meta { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); }
  .tags {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-wrap: wrap; gap: var(--sp-2);
  }
  .tags li {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--fg-muted);
    border: 1px solid var(--border-ui);
    border-radius: 3px;
    padding: 0.1rem 0.5rem;
  }
  .status { font-size: 0.78rem; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.08em; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/EntryList.astro src/components/ProjectCard.astro
git commit -m "Add EntryList and ProjectCard components"
```

---

### Task C4: Home page — featured projects + recent writing

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Rewrite `src/pages/index.astro`**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import ProjectCard from "../components/ProjectCard.astro";
import EntryList from "../components/EntryList.astro";
import { getCollection } from "astro:content";

const projects = (await getCollection("projects", p => !p.data.draft && p.data.featured))
  .sort((a, b) => b.data.startedAt.getTime() - a.data.startedAt.getTime())
  .slice(0, 4);

const writing = (await getCollection("writing", p => !p.data.draft))
  .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
  .slice(0, 3);

const writingEntries = writing.map(post => ({
  href: `/writing/${post.slug}/`,
  title: post.data.title,
  description: post.data.description,
  date: post.data.publishedAt,
}));
---
<BaseLayout title="Boring by Design" description="Personal site of Gary Ritchie — projects, writing, and tinkering.">
  <main id="main">
    <h1>Calm work, quietly shipped.</h1>
    <p class="intro">A personal archive of the software I build, the things I'm tinkering with, and the occasional note. Nothing flashy — just the stuff that stuck around long enough to be worth writing down.</p>

    <h2 class="section-label">Featured projects</h2>
    {projects.map(p => (
      <ProjectCard
        href={`/projects/${p.slug}/`}
        title={p.data.title}
        summary={p.data.summary}
        tech={p.data.tech}
        displayYear={p.data.displayYear ?? String(p.data.startedAt.getFullYear())}
        status={p.data.status}
      />
    ))}

    <h2 class="section-label">Recent writing</h2>
    <EntryList entries={writingEntries} />
  </main>
</BaseLayout>

<style>
  .intro { font-size: 1.1rem; max-width: 42ch; margin-bottom: var(--sp-10); }
  .section-label {
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
    margin: var(--sp-10) 0 var(--sp-4);
  }
</style>
```

- [ ] **Step 2: Verify**

```bash
npm run build && npx wrangler dev
```

Open `http://localhost:8787/`. Expected: featured projects rendered as cards (two of them from Task C2 seed data) and recent writing as an entry list (two posts).

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "Build home page with featured projects and recent writing"
```

---

### Task C5: Single pages — About, Uses, Reading, 404

**Files:**
- Create: `src/pages/about.astro`
- Create: `src/pages/uses.astro`
- Create: `src/pages/reading.astro`
- Create: `src/pages/404.astro`

- [ ] **Step 1: Write `about.astro`**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---
<BaseLayout title="About" description="About Gary Ritchie.">
  <main id="main" class="prose">
    <h1>About</h1>
    <p>Hi — I'm Gary. Software engineer in Canada. This site is my personal archive and a running excuse to keep the craft fresh.</p>
    <p>If you want to reach me, <a href="mailto:gary.t.ritchie@gmail.com">email works</a>. I'm also on <a href="https://github.com/" rel="me">GitHub</a>.</p>
  </main>
</BaseLayout>

<style>
  .prose { max-width: var(--reading-width); }
  .prose p { margin: var(--sp-4) 0; }
</style>
```

- [ ] **Step 2: Write `uses.astro`**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---
<BaseLayout title="Uses" description="Hardware, software, and tools I use day-to-day.">
  <main id="main" class="prose">
    <h1>Uses</h1>
    <p>Placeholder. Hardware, editor, terminal, CLIs — fill in when there's something worth listing.</p>
  </main>
</BaseLayout>

<style>
  .prose { max-width: var(--reading-width); }
  .prose p { margin: var(--sp-4) 0; }
</style>
```

- [ ] **Step 3: Write `reading.astro`**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---
<BaseLayout title="Reading" description="Recently read, currently reading.">
  <main id="main" class="prose">
    <h1>Reading</h1>
    <p>Placeholder. A chronological log of books, with notes on the ones worth re-reading.</p>
  </main>
</BaseLayout>

<style>
  .prose { max-width: var(--reading-width); }
  .prose p { margin: var(--sp-4) 0; }
</style>
```

- [ ] **Step 4: Write `404.astro`**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---
<BaseLayout title="Not found" description="Page not found.">
  <main id="main" class="prose">
    <h1>Not found</h1>
    <p>That page doesn't exist. <a href="/">Back to the home page.</a></p>
  </main>
</BaseLayout>

<style>
  .prose { max-width: var(--reading-width); }
  .prose p { margin: var(--sp-4) 0; }
</style>
```

- [ ] **Step 5: Verify**

```bash
npm run build && npx wrangler dev
```

Open `http://localhost:8787/about/`, `/uses/`, `/reading/`, and `/does-not-exist/` (should land on the 404 via Wrangler's `not_found_handling`).

- [ ] **Step 6: Commit**

```bash
git add src/pages/about.astro src/pages/uses.astro src/pages/reading.astro src/pages/404.astro
git commit -m "Add About, Uses, Reading, and 404 pages"
```

---

### Task C6: Projects — list and detail pages

**Files:**
- Create: `src/pages/projects/index.astro`
- Create: `src/pages/projects/[...slug].astro`

- [ ] **Step 1: Write the list page**

```astro
---
// src/pages/projects/index.astro
import BaseLayout from "../../layouts/BaseLayout.astro";
import ProjectCard from "../../components/ProjectCard.astro";
import { getCollection } from "astro:content";

const projects = (await getCollection("projects", p => !p.data.draft))
  .sort((a, b) => b.data.startedAt.getTime() - a.data.startedAt.getTime());
---
<BaseLayout title="Projects" description="Software projects — personal and professional.">
  <main id="main">
    <h1>Projects</h1>
    {projects.map(p => (
      <ProjectCard
        href={`/projects/${p.slug}/`}
        title={p.data.title}
        summary={p.data.summary}
        tech={p.data.tech}
        displayYear={p.data.displayYear ?? String(p.data.startedAt.getFullYear())}
        status={p.data.status}
      />
    ))}
  </main>
</BaseLayout>
```

- [ ] **Step 2: Write the detail page**

```astro
---
// src/pages/projects/[...slug].astro
import ProseLayout from "../../layouts/ProseLayout.astro";
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const projects = await getCollection("projects", p => !p.data.draft);
  return projects.map(p => ({ params: { slug: p.slug }, props: { entry: p } }));
}

const { entry } = Astro.props;
const { Content } = await entry.render();
const { data } = entry;
---
<ProseLayout title={data.title} description={data.summary} publishedAt={data.startedAt}>
  <p class="lede">{data.summary}</p>
  <dl class="facts">
    <div><dt>Year</dt><dd>{data.displayYear ?? data.startedAt.getFullYear()}</dd></div>
    <div><dt>Status</dt><dd>{data.status}</dd></div>
    <div><dt>Tech</dt><dd>{data.tech.join(", ")}</dd></div>
    {data.links?.repo && <div><dt>Repo</dt><dd><a href={data.links.repo}>{data.links.repo}</a></dd></div>}
    {data.links?.site && <div><dt>Site</dt><dd><a href={data.links.site}>{data.links.site}</a></dd></div>}
  </dl>
  <Content />
</ProseLayout>

<style>
  .lede { font-size: 1.05rem; color: var(--fg-muted); }
  .facts { display: grid; grid-template-columns: max-content 1fr; gap: var(--sp-2) var(--sp-5); margin: var(--sp-6) 0; }
  .facts > div { display: contents; }
  .facts dt { color: var(--fg-muted); font-size: 0.9rem; }
  .facts dd { margin: 0; }
</style>
```

- [ ] **Step 3: Verify**

```bash
npm run build && npx wrangler dev
```

Open `/projects/` — list of two projects. Click into one — detail page renders with the Markdown body.

- [ ] **Step 4: Commit**

```bash
git add src/pages/projects/
git commit -m "Add projects list and detail pages"
```

---

### Task C7: Interests — list and detail pages

**Files:**
- Create: `src/pages/interests/index.astro`
- Create: `src/pages/interests/[...slug].astro`

- [ ] **Step 1: Write the list page**

```astro
---
// src/pages/interests/index.astro
import BaseLayout from "../../layouts/BaseLayout.astro";
import { getCollection } from "astro:content";

const interests = (await getCollection("interests", p => !p.data.draft))
  .sort((a, b) => a.data.title.localeCompare(b.data.title));
---
<BaseLayout title="Interests" description="Non-software interests and projects.">
  <main id="main">
    <h1>Interests</h1>
    <ul class="list">
      {interests.map(i => (
        <li>
          <h3><a href={`/interests/${i.slug}/`}>{i.data.title}</a></h3>
          <p>{i.data.summary}</p>
          {i.data.kind && <small class="kind">{i.data.kind}</small>}
        </li>
      ))}
    </ul>
  </main>
</BaseLayout>

<style>
  .list { list-style: none; padding: 0; margin: 0; }
  .list li { padding: var(--sp-5) 0; border-bottom: 1px solid var(--border); }
  .list h3 { font-size: 1.1rem; margin: 0 0 var(--sp-1); }
  .list h3 a { color: var(--fg); text-decoration: underline; text-underline-offset: 3px; }
  .list p { color: var(--fg-muted); margin: 0; }
  .kind { display: inline-block; margin-top: var(--sp-2); font-family: var(--font-mono); color: var(--fg-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
</style>
```

- [ ] **Step 2: Write the detail page**

```astro
---
// src/pages/interests/[...slug].astro
import ProseLayout from "../../layouts/ProseLayout.astro";
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const interests = await getCollection("interests", p => !p.data.draft);
  return interests.map(p => ({ params: { slug: p.slug }, props: { entry: p } }));
}

const { entry } = Astro.props;
const { Content } = await entry.render();
const { data } = entry;
---
<ProseLayout title={data.title} description={data.summary}>
  <p class="lede">{data.summary}</p>
  <Content />
</ProseLayout>

<style>
  .lede { font-size: 1.05rem; color: var(--fg-muted); }
</style>
```

- [ ] **Step 3: Verify**

```bash
npm run build && npx wrangler dev
```

Visit `/interests/` and click into one entry.

- [ ] **Step 4: Commit**

```bash
git add src/pages/interests/
git commit -m "Add interests list and detail pages"
```

---

### Task C8: Writing — list and detail pages

**Files:**
- Create: `src/pages/writing/index.astro`
- Create: `src/pages/writing/[...slug].astro`

- [ ] **Step 1: Write the list page**

```astro
---
// src/pages/writing/index.astro
import BaseLayout from "../../layouts/BaseLayout.astro";
import EntryList from "../../components/EntryList.astro";
import { getCollection } from "astro:content";

const posts = (await getCollection("writing", p => !p.data.draft))
  .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());

const entries = posts.map(p => ({
  href: `/writing/${p.slug}/`,
  title: p.data.title,
  description: p.data.description,
  date: p.data.publishedAt,
}));
---
<BaseLayout title="Writing" description="Posts, notes, and the occasional essay.">
  <main id="main">
    <h1>Writing</h1>
    <EntryList entries={entries} />
  </main>
</BaseLayout>
```

- [ ] **Step 2: Write the detail page**

```astro
---
// src/pages/writing/[...slug].astro
import ProseLayout from "../../layouts/ProseLayout.astro";
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("writing", p => !p.data.draft);
  return posts.map(p => ({ params: { slug: p.slug }, props: { entry: p } }));
}

const { entry } = Astro.props;
const { Content } = await entry.render();
const { data } = entry;
---
<ProseLayout
  title={data.title}
  description={data.description}
  publishedAt={data.publishedAt}
  updatedAt={data.updatedAt}
>
  <Content />
</ProseLayout>
```

- [ ] **Step 3: Verify**

```bash
npm run build && npx wrangler dev
```

Visit `/writing/` and click through.

- [ ] **Step 4: Commit**

```bash
git add src/pages/writing/
git commit -m "Add writing list and detail pages"
```

---

## Milestone D — Enhancements (RSS, sitemap, analytics, favicon)

---

### Task D1: RSS feed

**Files:**
- Create: `src/pages/rss.xml.ts`

- [ ] **Step 1: Install `@astrojs/rss` if not already present**

(Already installed in A2, but confirm.)

```bash
npm ls @astrojs/rss
```

- [ ] **Step 2: Write the RSS feed endpoint**

```ts
// src/pages/rss.xml.ts
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const posts = (await getCollection("writing", p => !p.data.draft))
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());

  return rss({
    title: "Boring by Design",
    description: "Writing from Gary Ritchie.",
    site: context.site!.toString(),
    items: posts.map(p => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.publishedAt,
      link: `/writing/${p.slug}/`,
    })),
    customData: "<language>en-ca</language>",
  });
}
```

- [ ] **Step 3: Verify**

```bash
npm run build && npx wrangler dev
```

Open `http://localhost:8787/rss.xml`. Expected: valid XML with an `<rss>` root and `<item>` entries for each post.

- [ ] **Step 4: Commit**

```bash
git add src/pages/rss.xml.ts
git commit -m "Add RSS feed for the writing collection"
```

---

### Task D2: Sitemap and Cloudflare Web Analytics tag

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `astro.config.mjs` (already has sitemap — confirm)

- [ ] **Step 1: Confirm `@astrojs/sitemap` is wired**

Open `astro.config.mjs`. The `sitemap()` integration is already in the `integrations` array from Task A3. Build and verify a sitemap is produced:

```bash
npm run build
ls dist/sitemap*.xml
```

Expected: `dist/sitemap-index.xml` and `dist/sitemap-0.xml` exist.

- [ ] **Step 2: Add Cloudflare Web Analytics tag to `BaseLayout.astro`**

Cloudflare gives you a site-specific token once you add Web Analytics in the Cloudflare dashboard. For now, use a placeholder env var and document the setup.

Edit `BaseLayout.astro`, after the `<ViewTransitions />` element, add:

```astro
{import.meta.env.PUBLIC_CF_WA_TOKEN && (
  <script
    is:inline
    defer
    src="https://static.cloudflareinsights.com/beacon.min.js"
    data-cf-beacon={`{"token": "${import.meta.env.PUBLIC_CF_WA_TOKEN}"}`}
  />
)}
```

- [ ] **Step 3: Document the env var**

Create `.env.example`:

```
# Cloudflare Web Analytics token — obtain from Cloudflare dashboard
# after adding boringbydesign.ca to Web Analytics. Leave unset locally.
PUBLIC_CF_WA_TOKEN=
```

Add `.env` to `.gitignore` if not already there (check — it is, from the earlier .gitignore we wrote).

- [ ] **Step 4: Verify build**

```bash
npm run build && npx wrangler dev
```

Open the home page source — confirm the analytics `<script>` is absent (no token set locally). That's correct — it only injects in production.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BaseLayout.astro .env.example
git commit -m "Wire sitemap and gate Cloudflare Web Analytics behind PUBLIC_CF_WA_TOKEN"
```

---

### Task D3: Favicon

**Files:**
- Create: `public/favicon.svg`

- [ ] **Step 1: Write a minimal text-based favicon**

```xml
<!-- public/favicon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#7A331A"/>
  <text x="16" y="22" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#FAFAF7">B</text>
</svg>
```

A white "B" on rust background. Good enough for v1 — replace with a designed mark later.

- [ ] **Step 2: Verify**

```bash
npm run build && npx wrangler dev
```

Open `/favicon.svg` directly — it should render. The `<link rel="icon">` in `BaseLayout.astro` already points at it.

- [ ] **Step 3: Commit**

```bash
git add public/favicon.svg
git commit -m "Add placeholder favicon — white B on rust"
```

---

## Milestone E — Quality gates, pre-commit, and CI

---

### Task E1: Prettier and ESLint config

**Files:**
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `eslint.config.js`

- [ ] **Step 1: Install dev deps**

```bash
npm install --save-exact --save-dev prettier prettier-plugin-astro eslint eslint-plugin-astro typescript-eslint
```

- [ ] **Step 2: Write `.prettierrc.json`**

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "singleQuote": false,
  "semi": true,
  "trailingComma": "all",
  "plugins": ["prettier-plugin-astro"],
  "overrides": [
    { "files": "*.astro", "options": { "parser": "astro" } }
  ]
}
```

- [ ] **Step 3: Write `.prettierignore`**

```
dist/
node_modules/
.astro/
.wrangler/
package-lock.json
public/
.superpowers/
```

- [ ] **Step 4: Write `eslint.config.js` (flat config)**

```js
// eslint.config.js
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "node_modules/**", ".astro/**", ".wrangler/**", "public/**"] },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
];
```

- [ ] **Step 5: Run formatters/linters over the repo**

```bash
npx prettier --write .
npx eslint . --fix --max-warnings 0
```

Fix anything ESLint reports that isn't auto-fixable. Then:

```bash
npm run check
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add .prettierrc.json .prettierignore eslint.config.js package.json package-lock.json .
git commit -m "Add Prettier + ESLint configs and format the repo"
```

---

### Task E2: Pre-commit hooks via prek

**Files:**
- Create: `.prek-config.yaml`

- [ ] **Step 1: Confirm `prek` is available**

```bash
prek --version
```

Gary has it installed per his CLAUDE.md. If not: `brew install prek` or see prek docs.

- [ ] **Step 2: Write `.prek-config.yaml`**

```yaml
# .prek-config.yaml — runs on every git commit
repos:
  - repo: local
    hooks:
      - id: prettier
        name: prettier
        language: system
        entry: npx prettier --write
        files: \.(ts|js|mjs|cjs|astro|md|mdx|json|css|yaml|yml)$
      - id: eslint
        name: eslint
        language: system
        entry: npx eslint --fix --max-warnings 0
        files: \.(ts|js|mjs|cjs|astro)$
      - id: astro-check
        name: astro check
        language: system
        entry: npx astro check
        pass_filenames: false
```

- [ ] **Step 3: Install the hook**

```bash
prek install
prek auto-update --cooldown-days 7
```

- [ ] **Step 4: Smoke-test**

```bash
prek run --all-files
```

Expected: all three hooks pass.

- [ ] **Step 5: Commit**

```bash
git add .prek-config.yaml
git commit -m "Add prek pre-commit config for prettier, eslint, and astro check"
```

---

### Task E3: pa11y-ci config (driven by sitemap index)

**Files:**
- Create: `.pa11yci.json`
- Create: `scripts/run-pa11y.mjs`

pa11y-ci's `--sitemap` flag handles a single `<urlset>` but does not follow
a sitemap *index* that points to multiple shards. `@astrojs/sitemap` always
emits a `sitemap-index.xml` (and at least one `sitemap-N.xml` shard), so we
use a small runner that walks the index, collects every `<loc>` across all
shards, and feeds the flat URL list to pa11y-ci. This way every URL Astro
publishes is audited, regardless of sharding.

- [ ] **Step 1: Install pa11y-ci**

```bash
npm install --save-exact --save-dev pa11y-ci
```

- [ ] **Step 2: Write `.pa11yci.json` (defaults only; no URL list)**

```json
{
  "defaults": {
    "standard": "WCAG2AAA",
    "timeout": 30000,
    "wait": 500,
    "chromeLaunchConfig": {
      "args": ["--no-sandbox"]
    }
  }
}
```

The runner in the next step injects `urls` at runtime.

- [ ] **Step 3: Write `scripts/run-pa11y.mjs`**

```js
// scripts/run-pa11y.mjs
// Reads sitemap-index.xml from the local preview, walks each shard (also
// fetched from the preview, NOT from production), collects every <loc>, and
// invokes pa11y-ci against that flat URL list. All URLs are rewritten to the
// preview origin so the audit validates the build under test — never the
// deployed site.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.PA11Y_BASE_URL ?? "http://127.0.0.1:4321";

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`);
  return res.text();
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

// Astro emits absolute production URLs in sitemap-index.xml and each
// sitemap-N.xml (anchored at astro.config.mjs's `site`). Rewrite every URL
// to the preview origin so we audit what was just built, not production.
function toLocal(absoluteUrl) {
  const { pathname, search } = new URL(absoluteUrl);
  return `${base}${pathname}${search}`;
}

const indexXml = await fetchText(`${base}/sitemap-index.xml`);
const shardUrls = extractLocs(indexXml).map(toLocal);
if (shardUrls.length === 0) throw new Error("sitemap-index.xml contained no shards");

const pageUrls = [];
for (const shard of shardUrls) {
  const shardXml = await fetchText(shard);
  pageUrls.push(...extractLocs(shardXml).map(toLocal));
}
if (pageUrls.length === 0) throw new Error("no page URLs found across sitemap shards");

const cfg = JSON.parse(readFileSync(".pa11yci.json", "utf8"));
cfg.urls = pageUrls;

mkdirSync(join(tmpdir(), "bbd"), { recursive: true });
const outPath = join(tmpdir(), "bbd", "pa11yci.json");
writeFileSync(outPath, JSON.stringify(cfg, null, 2));

console.log(`pa11y-ci: auditing ${pageUrls.length} URL(s) via ${shardUrls.length} sitemap shard(s) at ${base}`);

const result = spawnSync("npx", ["pa11y-ci", "--config", outPath], { stdio: "inherit" });
process.exit(result.status ?? 1);
```

- [ ] **Step 4: Add the `pa11y` npm script**

Edit `package.json` to add:

```json
"scripts": {
  "pa11y": "node scripts/run-pa11y.mjs"
}
```

(Merge with existing `scripts` block from Task A2.)

- [ ] **Step 3: Run pa11y-ci locally against the preview**

In one terminal:

```bash
npm run build
npx astro preview --host 127.0.0.1 --port 4321
```

In another:

```bash
npm run pa11y
```

Expected: "pa11y-ci: auditing N URL(s) via 1 sitemap shard(s)" followed by 0 errors across every URL. If failures appear (missing alt, contrast, heading order, etc.), fix them before moving on.

- [ ] **Step 5: Commit**

```bash
git add .pa11yci.json scripts/run-pa11y.mjs package.json package-lock.json
git commit -m "Add pa11y-ci AAA audit driven by sitemap index (covers all shards)"
```

---

### Task E4: Lighthouse CI config

**Files:**
- Create: `.lighthouserc.json`

- [ ] **Step 1: Install `@lhci/cli`**

```bash
npm install --save-exact --save-dev @lhci/cli chrome-launcher
```

- [ ] **Step 2: Write `.lighthouserc.json`**

```json
{
  "ci": {
    "collect": {
      "staticDistDir": "./dist",
      "url": [
        "http://localhost/",
        "http://localhost/about/",
        "http://localhost/projects/",
        "http://localhost/writing/",
        "http://localhost/writing/hello-world/"
      ],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop"
      }
    },
    "assert": {
      "assertions": {
        "categories:performance":    ["error", { "minScore": 0.98 }],
        "categories:accessibility":  ["error", { "minScore": 1.00 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo":            ["error", { "minScore": 0.95 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

- [ ] **Step 3: Run LHCI locally**

```bash
npm run build
npx lhci autorun
```

Expected: all four category scores meet or exceed the thresholds. If accessibility is below 100, fix the underlying issue (don't lower the bar).

- [ ] **Step 4: Commit**

```bash
git add .lighthouserc.json package.json package-lock.json
git commit -m "Add Lighthouse CI config with performance/a11y/BP/SEO budgets"
```

---

### Task E5: Lychee link checker config

**Files:**
- Create: `lychee.toml`

- [ ] **Step 1: Ensure `lychee` binary is available**

```bash
which lychee || brew install lychee
```

Lychee is a Rust binary, not an npm package. It's in the spec's Appendix A.

- [ ] **Step 2: Write `lychee.toml`**

```toml
# lychee.toml
verbose = "info"
no_progress = true
retry_wait_time = 2
max_retries = 2
timeout = 20
max_concurrency = 8
skip_missing = false
include_fragments = true

# Only check links *in* the built site; ignore link-farm kind of pages.
include = [
  "dist/**/*.html",
]

# Don't spam third parties that rate-limit or require auth.
exclude = [
  "^https?://(www\\.)?linkedin\\.com",
  "^https?://(www\\.)?twitter\\.com",
  "^https?://(www\\.)?x\\.com",
  "mailto:.*",
]

# Honor robots.txt where hosts provide one
user_agent = "lychee/boringbydesign.ca"
```

- [ ] **Step 3: Run lychee locally**

```bash
npm run build
lychee --config lychee.toml .
```

Expected: 0 broken links. If the GitHub URL in the footer (`https://github.com/`) reports as "too generic" or similar, replace it with Gary's actual handle once he decides on one, or temporarily `exclude` it.

- [ ] **Step 4: Commit**

```bash
git add lychee.toml
git commit -m "Add lychee link-checker config"
```

---

### Task E6: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

This task wires the full CI pipeline: build → checks → a11y → Lighthouse → deploy. For PRs, the pipeline runs checks only. For pushes to `main`, it also deploys to Cloudflare.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/deploy.yml
name: deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write

jobs:
  build-and-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Lint, format, typecheck
        run: npm run check

      - name: Build
        env:
          # PUBLIC_* vars are baked into the static output at build time.
          # Missing on PRs from forks — analytics just won't render in those
          # preview builds, which is fine.
          PUBLIC_CF_WA_TOKEN: ${{ secrets.PUBLIC_CF_WA_TOKEN }}
        run: npm run build

      - name: Install lychee
        run: |
          curl -sSfL https://github.com/lycheeverse/lychee/releases/latest/download/lychee-x86_64-unknown-linux-gnu.tar.gz | tar xzf -
          sudo mv lychee /usr/local/bin/

      - name: Link check
        run: lychee --config lychee.toml .

      - name: Start preview
        run: npx astro preview --host 127.0.0.1 --port 4321 &
      - name: Wait for preview
        run: npx wait-on http://127.0.0.1:4321/ --timeout 60000

      - name: pa11y-ci (AAA, every URL in the sitemap index)
        run: npm run pa11y

      - name: Lighthouse CI
        run: npx lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

      - name: Upload dist
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 1

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: build-and-check
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false

      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

Note: pin the `cloudflare/wrangler-action` SHA before committing. The engineer should run:

```bash
gh api repos/cloudflare/wrangler-action/releases/latest --jq '.tag_name'
# Then resolve tag → SHA:
gh api repos/cloudflare/wrangler-action/git/refs/tags/<tag> --jq '.object.sha'
```

…and replace `@v3` with `@<full-sha>  # v<tag>`. Same approach for `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `actions/download-artifact`. Gary's CLAUDE.md requires SHA pinning with version comments.

- [ ] **Step 2: Install `wait-on` dev dep used in the workflow**

```bash
npm install --save-exact --save-dev wait-on
```

- [ ] **Step 3: Run `zizmor` to audit the workflow**

```bash
which zizmor || brew install zizmor
zizmor .github/workflows/
```

Expected: 0 findings above INFO. Fix anything MEDIUM or above before committing.

- [ ] **Step 4: Run `actionlint`**

```bash
which actionlint || brew install actionlint
actionlint .github/workflows/
```

Expected: 0 findings.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml package.json package-lock.json
git commit -m "Add GitHub Actions workflow: check, build, lychee, pa11y-ci, Lighthouse, deploy"
```

---

## Milestone F — Live deploy

---

### Task F1: DNS migration runbook (Gary performs manually)

**Files:**
- Create: `docs/superpowers/runbooks/2026-04-23-dns-migration.md`

This task creates a documented runbook. The actual DNS work is Gary's hands-on step.

- [ ] **Step 1: Write the runbook**

```md
# DNS migration — GoDaddy → Cloudflare (one-time)

**When:** Before the first Cloudflare Workers deploy of boringbydesign.ca.
**Who:** Gary (manual, outside CI).
**Estimated time:** 15 minutes of active work + up to 1 hour of propagation.

## Steps

1. **Log in to Cloudflare.** Add `boringbydesign.ca` as a site on the Free plan.
2. **Copy the two nameservers** Cloudflare assigns (of the form `xxx.ns.cloudflare.com`).
3. **Log in to GoDaddy → Domain Settings → Nameservers.** Choose "Custom" and replace the existing nameservers with the Cloudflare pair. Save.
4. **Wait for propagation.** Usually under an hour. Verify with:
   ```
   dig boringbydesign.ca NS +short
   ```
   …returns the Cloudflare nameservers.
5. **In Cloudflare → Workers & Pages → your worker → Custom Domains:**
   - Add `boringbydesign.ca`
   - Add `www.boringbydesign.ca` as a redirect-to-apex
6. **SSL/TLS settings:** Full (strict). Enable "Always Use HTTPS" and "Automatic HTTPS Rewrites".
7. **Web Analytics:** Add `boringbydesign.ca` in the Cloudflare dashboard. Copy the token into the GitHub repo secret `PUBLIC_CF_WA_TOKEN`. Astro reads `PUBLIC_*` env vars at **build time** and bakes them into the static output — the workflow in `.github/workflows/deploy.yml` already exposes this secret to the `npm run build` step, so the beacon renders on every production build.

## Secrets to set in the GitHub repo

- `CLOUDFLARE_API_TOKEN` — scoped to just this Workers project (Workers Scripts: Edit; Workers Routes: Edit; Zone: Edit for boringbydesign.ca).
- `CLOUDFLARE_ACCOUNT_ID` — from Cloudflare dashboard.
- `LHCI_GITHUB_APP_TOKEN` — optional; enables Lighthouse CI status on PRs. Install the LHCI GitHub App to generate.
- `PUBLIC_CF_WA_TOKEN` — Web Analytics token (from step 7 above). **Must be passed as an env var to the build step** (already wired in `deploy.yml`). Without it, the analytics beacon will not be included in the built site.

## After the first deploy

- Verify `https://boringbydesign.ca/` serves the site with a valid cert
- `https://www.boringbydesign.ca/` redirects to the apex
- `curl -I https://boringbydesign.ca/` returns `server: cloudflare` and `cf-cache-status: HIT` (after warmup)
```

- [ ] **Step 2: Commit**

```bash
mkdir -p docs/superpowers/runbooks
git add docs/superpowers/runbooks/
git commit -m "Add DNS migration runbook (GoDaddy → Cloudflare nameserver swap)"
```

---

### Task F2: First deploy

This task is a checklist, not code. The executing engineer walks Gary through.

- [ ] **Step 1: Merge the feature branch to main**

Gary opens a PR from `feat/initial-build` → `main` via the GitHub UI. Wait for all CI checks (build, pa11y, Lighthouse, lychee) to pass. Merge.

- [ ] **Step 2: Confirm Cloudflare deploy succeeds**

Watch the `deploy` job in GitHub Actions. On success, it reports the Workers URL (e.g., `https://boringbydesign.<subdomain>.workers.dev`).

- [ ] **Step 3: DNS migration**

Gary executes `docs/superpowers/runbooks/2026-04-23-dns-migration.md` if he hasn't already.

- [ ] **Step 4: Smoke-test the live site**

```bash
curl -I https://boringbydesign.ca/
```

Expected: `HTTP/2 200` and `server: cloudflare`.

Open in a browser. Run through the manual smoke-test checklist from the spec (section 7):

1. Light theme readable
2. Dark theme readable
3. Theme toggle cycles and persists
4. Keyboard-only nav reaches every link
5. 200% zoom — no horizontal scroll
6. Phone viewport renders correctly

- [ ] **Step 5: Close out**

Tag the commit on main:

```bash
git checkout main
git pull
git tag -a v0.1.0 -m "Initial launch"
git push origin v0.1.0
```

---

## Self-review

**Spec coverage (each spec section → task that implements it):**

- §1 Architecture & stack → A2, A3, A4
- §2 Site structure (routes, nav, home composition) → A4, B4, C4, C5, C6, C7, C8
- §3 Content model → C1, C2, and every list/detail page
- §4 Visual system (tokens, typography, theme toggle, view transitions, images) → B1, B2, B3, B5
  - Images: Astro auto-optimization of MD refs works via the `@astrojs/cloudflare` adapter + `astro build` — no extra task. Seed content has no images yet, so this is latent.
- §5 Accessibility & responsive → B1–B6 (focus rings, skip link, landmarks, reduced motion, rem sizing); E3 (AAA verified in CI)
- §6 Build, deploy, observability → A2, A3, A4, D2, D3, E6, F1, F2
- §7 Testing & quality gates → E1, E2, E3, E4, E5, E6
- §8 Open questions — deferred by design; no task needed
- §9 Success criteria → verified during F2

**Placeholder scan:** no "TBD", "add appropriate error handling", or similar in any task. "Placeholder" appears only in seed-content frontmatter bodies, clearly labeled.

**Type consistency:** `ProjectCard` props, `EntryList.Entry`, and `getCollection` filter predicates all use the schema defined in C1. Dates are `Date` throughout (sourced from Zod `z.date()`). `displayYear` is `string | undefined`; when absent we fall back to `startedAt.getFullYear()` — consistent in both index.astro (Task C4) and projects/index.astro (Task C6).

**Known gaps / deferred:**
- OG images, /resume/, search — listed in spec §8 as deferred.
- Real content beyond seed stubs — Gary's ongoing authoring, not an implementation task.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-23-boringbydesign-site.md`.**
