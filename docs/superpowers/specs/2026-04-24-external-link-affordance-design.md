# External link affordance — design spec

**Date:** 2026-04-24
**Author:** Gary Ritchie
**Status:** Approved — ready for implementation plan

---

## Summary

External links on boringbydesign.ca should signal that they leave the site and open in a new tab, with both a visual affordance (an "arrow out of box" glyph) and screen-reader text ("opens in a new tab"). The result must work uniformly for links written in Markdown/MDX content and for links hand-written in `.astro` components, in both light and dark themes.

## Goals

- Authors writing Markdown can write `[text](https://example.com)` and get the full treatment automatically — no special syntax or HTML required.
- Authors writing `.astro` components have a single component (`<ExternalLink>`) that produces the same HTML shape the Markdown pipeline produces, so the two paths render identically.
- The affordance signals "this opens in a new tab on a different site" specifically — it must not appear on same-site, `mailto:`, `tel:`, fragment, or root-relative links, even when those happen to use `target="_blank"`.
- Glyph inherits link color via `currentColor`, themes correctly, and is sharp at any zoom level.
- Screen-reader text is real DOM text (not CSS-generated), for maximum assistive-tech compatibility.
- AAA contrast preserved; pa11y continues to pass.

## Non-goals

- No icon for `mailto:`/`tel:`/fragment/relative links — those don't open new tabs.
- No "you are leaving this site" interstitial.
- No per-link opt-out or override mechanism in v1. The auto-by-domain rule applies uniformly. Same-tab external links and internal new-tab links are not supported authoring features in v1; if either need arises, it becomes a deliberate scope change in a future spec.
- No author-facing config knobs (URL allowlists, custom glyphs, etc.).

## Definition of "external"

A link is external when:

- `href` matches `^https?://`, AND
- the URL's host is **not in the internal-host set**

The internal-host set is derived from the configured site origin in `astro.config.mjs` (`site: "https://boringbydesign.ca"`): the apex host plus its `www.` variant. Concretely, for this site: `{"boringbydesign.ca", "www.boringbydesign.ca"}`. The set is computed once and passed as an option to the rehype plugin and the `<ExternalLink>` component, so neither hard-codes hostnames. If the site origin in config ever changes, both code paths pick up the new internal-host set without further edits.

All other hrefs (root-relative paths, fragments, `mailto:`, `tel:`, protocol-relative URLs) are treated as internal and untouched.

---

## Architecture

Two cooperating mechanisms, one for each authoring surface. Both produce the same HTML shape.

### 1. Markdown/MDX → custom rehype plugin

A small rehype plugin runs over the rendered HTML AST (HAST) for every `.md` and `.mdx` file. For each `<a>` whose `href` is external (per the definition above) it:

1. If the author has explicitly set `target` to anything other than `_blank` (e.g. raw HTML in `.mdx` with `target="_self"`), the plugin treats this as an opt-out and leaves the link entirely alone — no `target` mutation, no `rel` mutation, no glyph, no SR span. This is defensive plugin behavior, not a documented authoring feature.
2. Otherwise, sets `target="_blank"`.
3. Merges `noopener` and `noreferrer` into the link's `rel` token list (additive: existing tokens like `me` or `nofollow` are preserved).
4. Adds the class `has-external-glyph` to the anchor (additive to any existing classes).
5. Appends an inline SVG glyph as the link's last visible child, marked `aria-hidden="true"` and classed `external-glyph`.
6. Appends `<span class="visually-hidden"> (opens in a new tab)</span>` as the very last child.

Steps 4–6 (glyph and SR span injection) only run when the link will end up with `target="_blank"`. This guarantees the affordance never lies about the link's actual behavior.

The plugin is custom (not the npm `rehype-external-links` package) because the transform is small (~40–60 lines), produces a very specific HTML shape, and avoids adding a dependency for a one-off site-specific convention.

### 2. `.astro` components → `<ExternalLink>` component

A small Astro component, `src/components/ExternalLink.astro`, emits the same HTML shape the rehype plugin produces. Authors hand-writing external links in `.astro` files use this component instead of writing `<a>` directly:

```astro
<ExternalLink href="https://github.com/garyritchie/boring-astro">View source</ExternalLink>
```

The component sets `target="_blank"`, the merged `rel`, the `has-external-glyph` class, and emits the inline SVG and visually-hidden span. The component does its own external-host check on the `href` and throws a build-time error if called with a non-external URL — this prevents misuse (false affordances on same-site or `mailto:` links) at the source rather than relying on author discipline.

There is no CSS-only fallback for raw `<a target="_blank">` in `.astro` files. Authors are expected to use the component. CSS attribute selectors on `target="_blank"` were rejected because they cannot inspect the URL host, so they cannot distinguish "external new-tab" from "internal new-tab" or "mailto in new tab," producing false affordances. CSS-generated `content: url(svg)` was also rejected because SVGs loaded as image content do not inherit `currentColor` from their parent element, breaking theme support.

---

## Components

### `src/lib/rehype-external-links.mjs` — new file

A unified plugin in plain ESM. Uses `unist-util-visit` to walk the HAST tree (added as a direct devDependency for clarity, even though it is transitively present via Astro's Markdown stack).

Responsibilities:

- Accept a single options argument: `{ internalHosts: string[] }`. Caller passes the set computed from the site config; the plugin does not read config itself.
- Visit every `element` node where `tagName === "a"`.
- Skip if `href` is missing, doesn't start with `http://` or `https://`, or its host is in `internalHosts`.
- If `properties.target` is set to anything other than `_blank`, leave the node entirely alone (author opt-out).
- Otherwise: set `properties.target = "_blank"`, merge `noopener` and `noreferrer` into `properties.rel` (additive token-list merge that preserves existing tokens), add `has-external-glyph` to `properties.className` (additive), and append two new HAST element nodes as the link's last children: the inline SVG and the visually-hidden span.

The plugin is pure (no I/O, no async). It is exported as a default function that returns a `(tree) => void` transformer, the standard unified shape.

### `src/components/ExternalLink.astro` — new file

A small wrapper component for hand-written external links in `.astro` files.

Responsibilities:

- Accepts `href` (required, string).
- Accepts a small explicit allowlist of additional props: `class` (string, merged additively), `rel` (string, merged additively), `id`, `title`, `aria-label`, `aria-describedby`, and any `data-*` attribute. These are forwarded to the underlying `<a>`.
- **Rejects `target` entirely.** If an author passes `target`, the component throws a build-time error: "ExternalLink owns target behavior; do not pass target as a prop." This removes any ambiguity about whether the prop overrides the component's `target="_blank"` invariant.
- **Rejects any other prop not in the allowlist** — including `href` lookalikes, event handlers, etc. — with an error naming the offending prop. This keeps the component's contract narrow and prevents future drift.
- Validates at build time that `href` is external (starts with `http://` or `https://` and the host is not in the internal-host set); throws a clear error otherwise. This prevents misuse on same-site, `mailto:`, or `tel:` links.
- Emits an `<a>` with `target="_blank"`, `rel="noopener noreferrer"` (merged with any author-provided `rel`), the `has-external-glyph` class (merged with any author-provided `class`), the inline SVG glyph, and the visually-hidden span — matching the rehype plugin's output exactly.

### `src/styles/global.css` — modified

Adds:

- `.visually-hidden` utility class using the standard clip-path pattern.
- `.external-glyph` rule controlling size, vertical alignment, and left margin for the inline SVG.

No CSS attribute selector targeting `a[target="_blank"]` is added. Glyph rendering is purely DOM-driven (the plugin and the component both inject a real `<svg>` element), so `currentColor` resolves correctly against the link color in both themes.

### `astro.config.mjs` — modified

Computes the internal-host set from the `site` config and wires the plugin (configured) into both pipelines:

```js
import rehypeExternalLinks from "./src/lib/rehype-external-links.mjs";

const SITE = "https://boringbydesign.ca";
const siteHost = new URL(SITE).host;
const internalHosts = [siteHost, `www.${siteHost}`];
const rehypeOpts = [rehypeExternalLinks, { internalHosts }];

export default defineConfig({
  site: SITE,
  // ...
  markdown: {
    rehypePlugins: [rehypeOpts],
  },
  integrations: [mdx({ rehypePlugins: [rehypeOpts] }), sitemap()],
});
```

The same `internalHosts` array is also exported for `<ExternalLink>` to import (e.g. via a small `src/lib/internal-hosts.mjs` shared module), keeping plugin and component in lockstep.

### `README.md` — modified

A short note in the content-authoring section: "External links in Markdown/MDX automatically get a new-tab indicator and screen-reader text. In `.astro` components, use the `<ExternalLink href=\"…\">…</ExternalLink>` component for external links — do not write raw `<a target=\"_blank\">` for external destinations."

---

## Glyph

A 12×12 viewBox SVG, "arrow out of box":

- `stroke="currentColor"`, `stroke-width="1.5"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`
- Two paths: the box outline (with the top-right corner gapped) and the diagonal arrow with its head
- Sized at `0.75em` to scale with surrounding text
- `vertical-align: -0.05em` and `margin-left: 0.2em` for clean alignment next to the text baseline
- `aria-hidden="true"` on the inline SVG so screen readers don't announce the path data

Inherits link color in both themes via `currentColor`.

## Data flow

```
Markdown / MDX content              .astro component
  │                                    │
  ▼                                    ▼
 unified pipeline                  <ExternalLink href="...">
  │                                    │
  ▼                                    ▼
 rehype plugin emits:              component emits:
   <a target=_blank                  <a target=_blank
      rel="... noopener noreferrer"    rel="... noopener noreferrer"
      class="... has-external-glyph">  class="... has-external-glyph">
     {link text}                        {link text}
     <svg class="external-glyph"        <svg class="external-glyph"
          aria-hidden="true">…</svg>      aria-hidden="true">…</svg>
     <span class="visually-hidden">     <span class="visually-hidden">
       (opens in a new tab)               (opens in a new tab)
     </span>                            </span>
   </a>                              </a>
  │                                    │
  └────────────► identical HTML ◄──────┘
                       │
                       ▼
             Browser CSS applies:
               .external-glyph { size, alignment }
               .visually-hidden { clipped off-screen }
```

## Error handling

The plugin is defensive but quiet:

- A malformed `href` (anything that fails `URL` construction beyond the simple regex prefix check) is treated as not-external and left alone.
- A missing `href` attribute is left alone.
- The plugin does not throw on unexpected node shapes; it simply skips nodes it doesn't understand.

This matches the project's "fail fast on real errors, but never block a build over content" stance — a typo in a Markdown link should still produce HTML, just without the affordance.

## Testing & verification

No unit tests (the project has no unit-test suite). Verification is:

1. **`npm run check`** — `astro check` + Prettier + ESLint pass.
2. **`npm run build`** — produces `dist/client/` with no errors.
3. **Migration completion check** — `git grep -E '<a [^>]*href="https?://' src/` returns no `.astro` matches. The two existing matches in `SiteFooter.astro` and `about.astro` are converted to `<ExternalLink>` as part of this work.
4. **Markdown HTML inspection** — for a content page containing both a Markdown external link and an internal link, confirm the external one has `target="_blank"`, `rel` containing `noopener` and `noreferrer`, the `has-external-glyph` class, the inline SVG, and the visually-hidden span; the internal one is untouched.
5. **`<ExternalLink>` HTML inspection** — confirm the converted footer/about GitHub links render HTML byte-identical in shape to a Markdown external link, including the merged `rel="me noopener noreferrer"`.
6. **Internal-host check** — author a Markdown link to `https://www.boringbydesign.ca/about/` and confirm it is treated as internal (no glyph, no `target`, no `rel` mutation). Same for `https://boringbydesign.ca/about/`.
7. **`<ExternalLink>` misuse checks** — temporarily exercise each rejection path and confirm the build fails with a clear, prop-naming error message, then revert: (a) internal `href` like `href="/about/"`; (b) `https://www.boringbydesign.ca/...` `href` (must be rejected as internal, not slipped through as external); (c) explicit `target="_self"` prop; (d) any prop not in the allowlist (e.g. `onclick`).
8. **`rel` merging check (Markdown path)** — author a Markdown link with raw HTML in MDX: `<a href="https://example.com" rel="me">…</a>`. Confirm the built HTML has `rel="me noopener noreferrer"` (or equivalent token-set), not `rel="me"` alone and not `rel="noopener noreferrer"` alone.
9. **Author opt-out check** — author raw HTML in MDX: `<a href="https://example.com" target="_self">…</a>`. Confirm the built HTML preserves `target="_self"` and contains no glyph and no visually-hidden span.
10. **`npm run pa11y`** — passes, no new violations. Specifically verify no contrast regressions.
11. **Manual screen-reader spot-check** (VoiceOver) — confirm "(opens in a new tab)" is announced after the link text on both a Markdown link and an `<ExternalLink>`.
12. **Theme check** — toggle light/dark; glyph color tracks link color in both, on both link types.

## Migration / backfill

Markdown/MDX content needs no edits — the rehype plugin transforms existing external links automatically on the next build.

`.astro` files **do** need edits. The repo currently has two raw external `<a>` tags that must be converted to `<ExternalLink>` for the site chrome to follow the new rule:

- `src/components/SiteFooter.astro:13` — `<a href="https://github.com/gtritchie" rel="me">GitHub</a>` → `<ExternalLink href="https://github.com/gtritchie" rel="me">GitHub</ExternalLink>`
- `src/pages/about.astro:21` — same conversion for the same GitHub link

Both happen to use `rel="me"`, which exercises the additive `rel`-merging behavior — the rendered HTML should end up with `rel` containing `me`, `noopener`, and `noreferrer`.

The footer and about page also contain `mailto:` and same-site links; those are not external and require no change.

Future-proofing this rule (e.g. a lint check that flags raw external `<a>` in `.astro`) is out of scope for v1. With only two `.astro` files needing migration today, manual diligence plus the verification steps below are sufficient.

## Open questions

None remaining at design time.
