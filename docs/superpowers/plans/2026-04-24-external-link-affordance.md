# External link affordance — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** External links on boringbydesign.ca render with an "arrow out of box" glyph and screen-reader text "(opens in a new tab)" — automatically for Markdown/MDX content via a rehype plugin, and via an `<ExternalLink>` component for hand-written links in `.astro` files.

**Architecture:** A custom rehype plugin transforms external `<a>` nodes during the unified pipeline that processes `.md` and `.mdx` files. A small `<ExternalLink>` Astro component produces the same HTML shape for `.astro` authors. Both share an internal-host set computed once from the `site` value in `astro.config.mjs`, so the apex and `www.` variants are correctly classified as internal.

**Tech Stack:** Astro 6 (existing), `unist-util-visit` (new devDependency, used by the rehype plugin to walk HAST), no other new dependencies.

**Verification model:** This project has no unit-test suite; verification is `npm run check` (astro check + Prettier + ESLint), `npm run build`, HTML inspection of built output under `dist/client/`, and `npm run pa11y`. Each task ends with the appropriate verification step. Per CLAUDE.md, every task ends with a commit. The branch is `feat/external-link-affordance`, already created.

**Spec:** `docs/superpowers/specs/2026-04-24-external-link-affordance-design.md`

---

## File map

**Create:**

- `src/lib/site.mjs` — single source of truth for the site origin and the derived internal-host set (apex + `www`). Exports both `site` (the canonical origin string) and `internalHosts` (the array used by the plugin and the component). Imported by `astro.config.mjs` (for both the `site` config value and the plugin options) and by `ExternalLink.astro` (for host validation).
- `src/lib/rehype-external-links.mjs` — the unified plugin. Pure ESM, no I/O. Default-exports a configurable plugin function.
- `src/components/ExternalLink.astro` — wrapper component for hand-written external links in `.astro` files. Owns `target`/`rel` behavior; rejects misuse with build-time errors.

**Modify:**

- `package.json` / `package-lock.json` — add `unist-util-visit` as a devDependency.
- `src/styles/global.css` — add `.visually-hidden` and `.external-glyph` rules.
- `astro.config.mjs` — wire the rehype plugin into both the Markdown and MDX pipelines, configured with the shared internal-host set.
- `src/components/SiteFooter.astro` — convert the raw external `<a>` on line 13 to `<ExternalLink>`.
- `src/pages/about.astro` — convert the raw external `<a>` on line 21 to `<ExternalLink>`.
- `README.md` — add a short "External links" subsection under "Adding content".

---

## Task ordering rationale

CSS rules ship before the markup that depends on them, so no commit produces a temporary visual glitch. Plugin code is created in isolation and wired into the config in a separate commit so the activation moment is reviewable on its own. The `<ExternalLink>` component lands before the migration that uses it.

---

### Task 1: Add `unist-util-visit` devDependency

**Files:**

- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the dependency at current stable**

Run:

```bash
npm install --save-dev unist-util-visit@latest
```

- [ ] **Step 2: Verify install**

Run:

```bash
npm ls unist-util-visit
```

Expected output: a single top-level entry under `devDependencies`, e.g. `unist-util-visit@5.x.x`. If the version printed is < 5, stop and investigate — Astro's HAST tooling expects v5+.

- [ ] **Step 3: Confirm nothing broke**

Run:

```bash
npm run check
```

Expected: passes (no astro/prettier/eslint errors). The check is fast on this repo (~10s).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add unist-util-visit devDependency for rehype plugin"
```

---

### Task 2: Create `src/lib/site.mjs`

**Files:**

- Create: `src/lib/site.mjs`

This module is the single source of truth for the site's canonical origin. `astro.config.mjs` imports `site` from here for its top-level `site` config, and the plugin and component both consume `internalHosts` derived from the same value — so the three cannot drift.

- [ ] **Step 1: Create the directory if needed**

Run:

```bash
ls src/lib 2>/dev/null || mkdir src/lib
```

- [ ] **Step 2: Write the file**

Contents of `src/lib/site.mjs`:

```js
// Single source of truth for the site's canonical origin and the derived
// internal-host set. Imported by astro.config.mjs (for both the `site`
// config value and the rehype plugin options) and by ExternalLink.astro
// (to validate authored hrefs).

export const site = "https://boringbydesign.ca";

const siteHost = new URL(site).host;
export const internalHosts = [siteHost, `www.${siteHost}`];
```

- [ ] **Step 3: Verify it parses**

Run:

```bash
node -e 'import("./src/lib/site.mjs").then(m => console.log(m.site, m.internalHosts))'
```

Expected output: `https://boringbydesign.ca [ 'boringbydesign.ca', 'www.boringbydesign.ca' ]`

- [ ] **Step 4: Run the project check**

Run:

```bash
npm run check
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/site.mjs
git commit -m "Add site module exporting canonical origin and internal hosts"
```

---

### Task 3: Add `.visually-hidden` and `.external-glyph` CSS rules

**Files:**

- Modify: `src/styles/global.css` (append at end)

These rules are inert until DOM elements with the matching classes appear. Adding them now means later commits don't introduce a temporary visual glitch.

- [ ] **Step 1: Append to `src/styles/global.css`**

Append the following block to the end of `src/styles/global.css`:

```css
.visually-hidden {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

.external-glyph {
  display: inline-block;
  width: 0.75em;
  height: 0.75em;
  margin-left: 0.2em;
  vertical-align: -0.05em;
}
```

- [ ] **Step 2: Verify**

Run:

```bash
npm run check
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "Add .visually-hidden and .external-glyph CSS utilities"
```

---

### Task 4: Create the rehype plugin

**Files:**

- Create: `src/lib/rehype-external-links.mjs`

The plugin is created in isolation. It is not wired into the build until Task 5, so this commit changes nothing about the rendered output — it only adds new code.

- [ ] **Step 1: Write the plugin**

Contents of `src/lib/rehype-external-links.mjs`:

```js
// rehype plugin: for each <a> in HAST whose href is external (per the
// configured internalHosts set), set target="_blank", merge noopener and
// noreferrer into rel, add the has-external-glyph class, and append an
// inline SVG glyph and a visually-hidden "(opens in a new tab)" span.
//
// Defensive opt-out: if the author has explicitly set target to anything
// other than "_blank" (e.g. raw HTML in MDX with target="_self"), the
// plugin leaves the link entirely alone — no target/rel/class mutation,
// no glyph, no SR span. This guarantees the affordance never lies about
// the link's actual behavior.

import { visit } from "unist-util-visit";

const HTTP_RE = /^https?:\/\//i;

function getHostSafe(href) {
  try {
    return new URL(href).host;
  } catch {
    return null;
  }
}

function ensureClass(properties, name) {
  const existing = properties.className;
  if (Array.isArray(existing)) {
    if (!existing.includes(name)) existing.push(name);
  } else if (typeof existing === "string" && existing.length > 0) {
    properties.className = [...existing.split(/\s+/).filter(Boolean), name];
  } else {
    properties.className = [name];
  }
}

function mergeRel(properties, ...tokens) {
  const existing = properties.rel;
  let set;
  if (Array.isArray(existing)) {
    set = new Set(existing);
  } else if (typeof existing === "string") {
    set = new Set(existing.split(/\s+/).filter(Boolean));
  } else {
    set = new Set();
  }
  for (const t of tokens) set.add(t);
  properties.rel = [...set];
}

function makeGlyph() {
  return {
    type: "element",
    tagName: "svg",
    properties: {
      className: ["external-glyph"],
      viewBox: "0 0 12 12",
      ariaHidden: "true",
      focusable: "false",
    },
    children: [
      {
        type: "element",
        tagName: "path",
        properties: {
          d: "M4.5 2.5h-2A1 1 0 0 0 1.5 3.5v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        children: [],
      },
      {
        type: "element",
        tagName: "path",
        properties: {
          d: "M7 1.5h3.5V5M10.5 1.5 5.5 6.5",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        children: [],
      },
    ],
  };
}

function makeSrSpan() {
  return {
    type: "element",
    tagName: "span",
    properties: { className: ["visually-hidden"] },
    children: [{ type: "text", value: " (opens in a new tab)" }],
  };
}

export default function rehypeExternalLinks({ internalHosts = [] } = {}) {
  const internal = new Set(internalHosts);
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return;
      const props = node.properties || {};
      const href = props.href;
      if (typeof href !== "string" || !HTTP_RE.test(href)) return;
      const host = getHostSafe(href);
      if (!host || internal.has(host)) return;
      if ("target" in props && props.target !== "_blank") return;

      props.target = "_blank";
      mergeRel(props, "noopener", "noreferrer");
      ensureClass(props, "has-external-glyph");
      node.properties = props;
      node.children = [...node.children, makeGlyph(), makeSrSpan()];
    });
  };
}
```

- [ ] **Step 2: Smoke-test the plugin in isolation**

Run:

```bash
node -e '
import("./src/lib/rehype-external-links.mjs").then(({ default: plugin }) => {
  const tree = {
    type: "root",
    children: [
      { type: "element", tagName: "a",
        properties: { href: "https://example.com", rel: "me" },
        children: [{ type: "text", value: "Example" }] },
      { type: "element", tagName: "a",
        properties: { href: "https://boringbydesign.ca/about/" },
        children: [{ type: "text", value: "About" }] },
      { type: "element", tagName: "a",
        properties: { href: "https://example.com", target: "_self" },
        children: [{ type: "text", value: "Same-tab opt-out" }] },
    ],
  };
  plugin({ internalHosts: ["boringbydesign.ca", "www.boringbydesign.ca"] })(tree);
  console.log(JSON.stringify(tree, null, 2));
});
'
```

Expected: the first `<a>` has `target: "_blank"`, `rel: ["me", "noopener", "noreferrer"]`, `className: ["has-external-glyph"]`, and two appended children (svg + span). The second `<a>` is unchanged. The third `<a>` is unchanged (target=\_self opt-out).

- [ ] **Step 3: Run the project check**

Run:

```bash
npm run check
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rehype-external-links.mjs
git commit -m "Add rehype-external-links plugin for Markdown/MDX"
```

---

### Task 5: Wire the plugin into `astro.config.mjs`

**Files:**

- Modify: `astro.config.mjs`

This is the activation commit. After this lands, every external link in `src/content/**/*.{md,mdx}` will get the affordance on the next build.

- [ ] **Step 1: Replace the contents of `astro.config.mjs`**

The full new file. Note: `site` is now imported from `src/lib/site.mjs` rather than written as a literal — this keeps the canonical origin in one place, so the `site` config and the plugin's `internalHosts` cannot drift.

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import rehypeExternalLinks from "./src/lib/rehype-external-links.mjs";
import { site, internalHosts } from "./src/lib/site.mjs";

const rehypeOpts = [rehypeExternalLinks, { internalHosts }];

export default defineConfig({
  site,
  output: "static",
  // imageService: "compile" optimizes images at build time and emits direct
  // /_astro/*.webp URLs. The adapter's default routes through a runtime /_image
  // endpoint, which 404s on this Workers Assets-only deploy (no _worker.js).
  adapter: cloudflare({ imageService: "compile" }),
  markdown: {
    rehypePlugins: [rehypeOpts],
  },
  integrations: [mdx({ rehypePlugins: [rehypeOpts] }), sitemap()],
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});
```

- [ ] **Step 2: Build the site**

Run:

```bash
npm run build
```

Expected: build succeeds. `dist/client/` is regenerated.

- [ ] **Step 3: Verify a known external link in built HTML**

There are existing external links in `src/content/projects/boring-site.md`, `src/content/interests/music.md`, and `src/content/projects/bulk-properties.md`. Inspect the built HTML for one of them:

```bash
grep -E 'target="_blank"|external-glyph|visually-hidden' dist/client/projects/boring-site/index.html | head -20
```

Expected: lines containing `target="_blank"`, `class="has-external-glyph"` (or similar; HAST may serialize as `class="..."` with multiple tokens), `<svg ... class="external-glyph"`, and `<span class="visually-hidden"> (opens in a new tab)</span>`.

- [ ] **Step 4: Verify an internal-host link is NOT transformed**

Build output should not slap the affordance onto same-site links. If any content links to `https://boringbydesign.ca/...` or `https://www.boringbydesign.ca/...`, they should remain plain `<a>` tags. Quick spot-check:

```bash
grep -RE 'href="https://(www\.)?boringbydesign\.ca' dist/client/ | grep -E 'target="_blank"' | head
```

Expected: no output (no internal-host links got `target="_blank"`).

- [ ] **Step 5: Commit**

```bash
git add astro.config.mjs
git commit -m "Wire rehype-external-links into Markdown and MDX pipelines"
```

---

### Task 6: Create `<ExternalLink>` component

**Files:**

- Create: `src/components/ExternalLink.astro`

The component is created in isolation. It is not used by any caller until Task 7.

- [ ] **Step 1: Write the component**

Contents of `src/components/ExternalLink.astro`:

```astro
---
// ExternalLink: wraps an <a> for confirmed-external links written in .astro
// files. Owns target/rel behavior; throws at build time if misused.
//
// Allowed props: href (required), class, rel, id, title, plus any
// aria-* and data-* attribute. Anything else (including target) is
// rejected with a clear error naming the offending prop.

import { internalHosts } from "../lib/site.mjs";

interface Props {
  href: string;
  class?: string;
  rel?: string;
  id?: string;
  title?: string;
  [key: `aria-${string}`]: string | undefined;
  [key: `data-${string}`]: string | undefined;
}

const ALLOWED_NAMED = new Set(["href", "class", "rel", "id", "title"]);

const props = Astro.props as Record<string, unknown>;
const href = props.href;
const className = typeof props.class === "string" ? props.class : undefined;
const rel = typeof props.rel === "string" ? props.rel : undefined;

if (typeof href !== "string") {
  throw new Error("ExternalLink: 'href' is required and must be a string");
}
if ("target" in props) {
  throw new Error('ExternalLink: do not pass "target" — the component sets target="_blank"');
}
for (const key of Object.keys(props)) {
  if (ALLOWED_NAMED.has(key)) continue;
  if (key.startsWith("aria-") || key.startsWith("data-")) continue;
  throw new Error(`ExternalLink: prop '${key}' is not allowed`);
}

let parsed: URL;
try {
  parsed = new URL(href);
} catch {
  throw new Error(`ExternalLink: 'href' is not a valid URL: ${href}`);
}
if (!/^https?:$/.test(parsed.protocol)) {
  throw new Error(`ExternalLink: 'href' must use http(s); got '${parsed.protocol}' in ${href}`);
}
if (internalHosts.includes(parsed.host)) {
  throw new Error(`ExternalLink: host '${parsed.host}' is internal; use a regular <a> instead`);
}

const relTokens = new Set(typeof rel === "string" ? rel.split(/\s+/).filter(Boolean) : []);
relTokens.add("noopener");
relTokens.add("noreferrer");
const relValue = [...relTokens].join(" ");

const classTokens = typeof className === "string" ? className.split(/\s+/).filter(Boolean) : [];
if (!classTokens.includes("has-external-glyph")) {
  classTokens.push("has-external-glyph");
}
const classValue = classTokens.join(" ");

const passthrough: Record<string, unknown> = {};
for (const key of Object.keys(props)) {
  if (key === "id" || key === "title" || key.startsWith("aria-") || key.startsWith("data-")) {
    passthrough[key] = props[key];
  }
}
---

<a href={href} target="_blank" rel={relValue} class={classValue} {...passthrough}>
  <slot />
  <svg class="external-glyph" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path
      d="M4.5 2.5h-2A1 1 0 0 0 1.5 3.5v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2"
      fill="none"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
      stroke-linejoin="round"></path>
    <path
      d="M7 1.5h3.5V5M10.5 1.5 5.5 6.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
      stroke-linejoin="round"></path>
  </svg>
  <span class="visually-hidden"> (opens in a new tab)</span>
</a>
```

- [ ] **Step 2: Verify it parses and type-checks**

Run:

```bash
npm run check
```

Expected: passes. The component has no callers yet, so any rejection paths are dormant; this only confirms the file is well-formed.

- [ ] **Step 3: Commit**

```bash
git add src/components/ExternalLink.astro
git commit -m "Add ExternalLink component for hand-written external links"
```

---

### Task 7: Migrate raw external `<a>` in `.astro` files to `<ExternalLink>`

**Files:**

- Modify: `src/components/SiteFooter.astro`
- Modify: `src/pages/about.astro`

Both files have the same external GitHub link. Both also have `mailto:` links and same-site links — those stay as raw `<a>` (mailto is not http(s); same-site is internal).

- [ ] **Step 1: Update `src/components/SiteFooter.astro`**

In the frontmatter (between the `---` fences at the top), add the import:

```astro
---
// src/components/SiteFooter.astro
import ExternalLink from "./ExternalLink.astro";
const year = new Date().getFullYear();
---
```

Then replace line 13 — change:

```astro
<li><a href="https://github.com/gtritchie" rel="me">GitHub</a></li>
```

to:

```astro
<li><ExternalLink href="https://github.com/gtritchie" rel="me">GitHub</ExternalLink></li>
```

- [ ] **Step 2: Update `src/pages/about.astro`**

In the frontmatter, add the import:

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import ExternalLink from "../components/ExternalLink.astro";
---
```

Then change the GitHub link on line 21 (the second `<a>` in the final `<p>`). Change:

```astro
on <a href="https://github.com/gtritchie" rel="me">GitHub</a>.
```

to:

```astro
on <ExternalLink href="https://github.com/gtritchie" rel="me">GitHub</ExternalLink>.
```

The `mailto:` link on the same line stays as a raw `<a>` — it's not external per the spec.

- [ ] **Step 3: Build the site**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Verify the migrated link's HTML shape**

Inspect the footer (which appears on every page) in a built page:

```bash
grep -A2 'github.com/gtritchie' dist/client/about/index.html | head -20
```

Expected: the rendered `<a>` should have `target="_blank"`, `rel="me noopener noreferrer"` (token order may vary; all three tokens must be present), `class="has-external-glyph"` (plus any other class), an inline `<svg class="external-glyph" ...>`, and a `<span class="visually-hidden"> (opens in a new tab)</span>`.

- [ ] **Step 5: Verify no raw external `<a>` remains in `.astro`**

Run:

```bash
git grep -E '<a [^>]*href="https?://' src/ | grep -v 'src/content/' | grep -v 'ExternalLink.astro'
```

Expected: no output (the only matches should be inside Markdown/MDX content under `src/content/`, which is handled by the rehype plugin, and the documentation/example inside `ExternalLink.astro` itself if any — there shouldn't be).

- [ ] **Step 6: Commit**

```bash
git add src/components/SiteFooter.astro src/pages/about.astro
git commit -m "Migrate raw external <a> in .astro files to <ExternalLink>"
```

---

### Task 8: Document the convention in `README.md`

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Add a new subsection under "Adding content"**

In `README.md`, after the existing `### Images` subsection (which ends around line 104) and before the `## Editing design` heading (which starts around line 106), insert:

```markdown
### External links

External links in Markdown/MDX get a "leaves the site" glyph and a
screen-reader "(opens in a new tab)" announcement automatically — write
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
```

- [ ] **Step 2: Verify formatting**

Run:

```bash
npm run check
```

Expected: passes (Prettier will accept the Markdown edit; if it doesn't, run `npm run format` and re-stage).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document external-link affordance in README"
```

---

### Task 9: Final verification

No code changes, no commit. This is the gate before opening a pull request. If any step fails, fix the underlying issue and create a new commit (do not amend).

- [ ] **Step 1: Lint and type-check**

```bash
npm run check
```

Expected: passes.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: succeeds, no warnings about the plugin or component.

- [ ] **Step 3: Run pa11y in a separate terminal**

In one terminal:

```bash
npm run preview:astro
```

In another terminal, once the preview is up on `127.0.0.1:4321`:

```bash
npm run pa11y
```

Expected: passes with no new violations. The visually-hidden span should not introduce any contrast or landmark issues.

- [ ] **Step 4: Manual screen-reader spot-check (optional but recommended)**

In Safari with VoiceOver enabled, navigate to `/about/` (preview origin) and arrow through links. The GitHub link should announce something like "GitHub, opens in a new tab, link." Repeat for a Markdown external link inside one of the project pages.

- [ ] **Step 5: Theme spot-check**

In any browser, visit the preview origin, find a page with at least one external link (e.g. `/projects/boring-site/`), toggle the theme via the header control, and confirm the external-link glyph color tracks the link color in both light and dark themes.

- [ ] **Step 6: Push and open a pull request**

```bash
git push -u origin feat/external-link-affordance
gh pr create --title "Add external-link affordance for Markdown and .astro" --body "$(cat <<'EOF'
## Summary
- Adds a custom rehype plugin that transforms external `<a>` tags in Markdown/MDX content: sets `target="_blank"`, additively merges `noopener noreferrer` into `rel`, appends an inline-SVG "arrow out of box" glyph, and appends a visually-hidden "(opens in a new tab)" span.
- Adds an `<ExternalLink>` Astro component that produces the same HTML shape for hand-written links in `.astro` files; rejects `target` and any non-allowlisted prop with a build-time error.
- Migrates the two existing raw external `<a>` tags in `SiteFooter.astro` and `about.astro` to use the component.
- Plugin and component share an internal-host set derived from the site config (apex + `www`), so same-site links are correctly treated as internal.

## Test plan
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds; built HTML for an existing Markdown external link contains `target="_blank"`, merged `rel`, the SVG, and the SR span
- [ ] Footer/about GitHub link renders the same shape with `rel="me noopener noreferrer"`
- [ ] Same-site links (apex and `www`) get no affordance
- [ ] `npm run pa11y` passes with no new violations
- [ ] VoiceOver announces "(opens in a new tab)" on both Markdown and component links
- [ ] Glyph color tracks link color in both light and dark themes
EOF
)"
```

---

## Self-review notes

Spec coverage check (skimmed the spec section by section):

- **Definition of external** → Task 2 + Task 5 (host set computed from config and passed to plugin) ✓
- **Rehype plugin behavior** (steps 1–6 in the spec's Architecture §1) → Task 4 implements all six, including the `target=_self` opt-out and the additive `rel` merge ✓
- **`<ExternalLink>` component** (allowlist, rejections, host validation) → Task 6 ✓
- **CSS rules** (.visually-hidden + .external-glyph, no attribute selector) → Task 3 ✓
- **astro.config.mjs wiring** with shared internal-hosts → Task 5 ✓
- **README note** → Task 8 ✓
- **Migration of two `.astro` files** → Task 7, with verification step 5 enforcing the `git grep` invariant from the spec ✓
- **Verification matrix** (build, HTML inspection, internal-host check, pa11y, theme, SR) → Task 9 covers steps 1, 2, 8, 11, 12 from the spec; Tasks 5/7 cover steps 3, 4, 5, 6 inline at the moment they become testable ✓

Spec verification step 7 (`<ExternalLink>` misuse rejection paths) and step 9 (`rel` merge with raw HTML in MDX) and step 9-equivalent (author opt-out via `target=_self`) are covered by the Task 4 smoke-test (which exercises the opt-out) and by the component's design itself, but they are not run as ad-hoc checks during execution. Acceptable: the rejection logic is straightforward and the smoke-test provides confidence; if anything regresses the build will fail loudly because of `throw new Error`.

No placeholders found; type/identifier names match across tasks (`internalHosts`, `has-external-glyph`, `external-glyph`, `visually-hidden` are spelled identically everywhere).
