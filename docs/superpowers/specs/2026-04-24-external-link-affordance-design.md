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
- the URL's host is **not** `boringbydesign.ca`

All other hrefs (root-relative paths, fragments, `mailto:`, `tel:`, protocol-relative URLs) are treated as internal and untouched. Same-origin absolute URLs (e.g. `https://boringbydesign.ca/writing/foo/`) are treated as internal.

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

- Visit every `element` node where `tagName === "a"`.
- Skip if `href` is missing, doesn't start with `http://` or `https://`, or its host matches the site host.
- If `properties.target` is set to anything other than `_blank`, leave the node entirely alone (author opt-out).
- Otherwise: set `properties.target = "_blank"`, merge `noopener` and `noreferrer` into `properties.rel` (additive token-list merge that preserves existing tokens), add `has-external-glyph` to `properties.className` (additive), and append two new HAST element nodes as the link's last children: the inline SVG and the visually-hidden span.

The plugin is pure (no I/O, no async). It is exported as a default function that returns a `(tree) => void` transformer, the standard unified shape.

### `src/components/ExternalLink.astro` — new file

A small wrapper component for hand-written external links in `.astro` files.

Responsibilities:

- Accepts `href` (required) and any other `<a>` props as a rest spread.
- Validates at build time that `href` is external (starts with `http://` or `https://` and the host is not `boringbydesign.ca`); throws a clear error otherwise. This prevents the component from being misused on same-site, `mailto:`, or `tel:` links.
- Emits an `<a>` with `target="_blank"`, `rel="noopener noreferrer"` (merged with any author-provided `rel`), the `has-external-glyph` class (merged with any author-provided `class`), the inline SVG glyph, and the visually-hidden span — matching the rehype plugin's output exactly.

### `src/styles/global.css` — modified

Adds:

- `.visually-hidden` utility class using the standard clip-path pattern.
- `.external-glyph` rule controlling size, vertical alignment, and left margin for the inline SVG.

No CSS attribute selector targeting `a[target="_blank"]` is added. Glyph rendering is purely DOM-driven (the plugin and the component both inject a real `<svg>` element), so `currentColor` resolves correctly against the link color in both themes.

### `astro.config.mjs` — modified

Wires the plugin into both pipelines:

```js
import rehypeExternalLinks from "./src/lib/rehype-external-links.mjs";

export default defineConfig({
  // ...
  markdown: {
    rehypePlugins: [rehypeExternalLinks],
  },
  integrations: [mdx({ rehypePlugins: [rehypeExternalLinks] }), sitemap()],
});
```

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
3. **Markdown HTML inspection** — for a content page containing both a Markdown external link and an internal link, confirm the external one has `target="_blank"`, `rel` containing `noopener` and `noreferrer`, the `has-external-glyph` class, the inline SVG, and the visually-hidden span; the internal one is untouched.
4. **`<ExternalLink>` HTML inspection** — use the component once (e.g. a "View source on GitHub" link in `SiteFooter.astro`); confirm the rendered HTML is byte-identical in shape to a Markdown external link.
5. **`<ExternalLink>` misuse check** — temporarily call the component with an internal `href` (e.g. `href="/about/"`) and confirm the build fails with a clear error message; revert.
6. **`rel` merging check** — author a Markdown link with raw HTML in MDX: `<a href="https://example.com" rel="me">…</a>`. Confirm the built HTML has `rel="me noopener noreferrer"` (or equivalent token-set), not `rel="me"` alone and not `rel="noopener noreferrer"` alone.
7. **Author opt-out check** — author raw HTML in MDX: `<a href="https://example.com" target="_self">…</a>`. Confirm the built HTML preserves `target="_self"` and contains no glyph and no visually-hidden span.
8. **`npm run pa11y`** — passes, no new violations. Specifically verify no contrast regressions.
9. **Manual screen-reader spot-check** (VoiceOver) — confirm "(opens in a new tab)" is announced after the link text on both a Markdown link and an `<ExternalLink>`.
10. **Theme check** — toggle light/dark; glyph color tracks link color in both, on both link types.

## Migration / backfill

None. There is no existing external-link content using this pattern; the change is additive. After the plugin lands, all existing Markdown external links pick up the affordance on the next build. No content edits are required.

## Open questions

None remaining at design time.
