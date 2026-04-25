# External link affordance — design spec

**Date:** 2026-04-24
**Author:** Gary Ritchie
**Status:** Approved — ready for implementation plan

---

## Summary

External links on boringbydesign.ca should signal that they leave the site and open in a new tab, with both a visual affordance (an "arrow out of box" glyph) and screen-reader text ("opens in a new tab"). The result must work uniformly for links written in Markdown/MDX content and for links hand-written in `.astro` components, in both light and dark themes.

## Goals

- Authors writing Markdown can write `[text](https://example.com)` and get the full treatment automatically — no special syntax or HTML required.
- Hand-written `<a target="_blank">` in `.astro` components gets the same visual glyph automatically; the screen-reader text is added by the author following a documented one-line convention.
- Glyph inherits link color via `currentColor`, themes correctly, and is sharp at any zoom level.
- Screen-reader text is real DOM text (not CSS-generated), for maximum assistive-tech compatibility.
- AAA contrast preserved; pa11y continues to pass.

## Non-goals

- No icon for `mailto:`/`tel:`/fragment/relative links — those don't open new tabs.
- No "you are leaving this site" interstitial.
- No per-link opt-out mechanism in v1. If a same-tab external link is ever needed, we'll add a `data-no-external-glyph` attribute then.
- No author-facing config knobs (URL allowlists, custom glyphs, etc.).

## Definition of "external"

A link is external when:

- `href` matches `^https?://`, AND
- the URL's host is **not** `boringbydesign.ca`

All other hrefs (root-relative paths, fragments, `mailto:`, `tel:`, protocol-relative URLs) are treated as internal and untouched. Same-origin absolute URLs (e.g. `https://boringbydesign.ca/writing/foo/`) are treated as internal.

---

## Architecture

Two cooperating mechanisms, one for each authoring surface:

### 1. Markdown/MDX → custom rehype plugin

A small rehype plugin runs over the rendered HTML AST (HAST) for every `.md` and `.mdx` file. For each `<a>` whose `href` is external it:

1. Sets `target="_blank"` and `rel="noopener noreferrer"` (does not override values the author already set).
2. Adds a class hook `has-external-glyph` to the anchor.
3. Appends an inline SVG glyph as the link's last visible child, marked `aria-hidden="true"`.
4. Appends `<span class="visually-hidden"> (opens in a new tab)</span>` as the very last child, so screen readers announce the new-tab behavior after the link text.

The plugin is custom (not the npm `rehype-external-links` package) because the transform is small (~30–40 lines), produces a very specific HTML shape, and avoids adding a dependency for a one-off site-specific convention.

### 2. `.astro` components → CSS-only fallback

A site-wide CSS rule on `a[target="_blank"]:not(.has-external-glyph)::after` injects the same glyph as a base64-encoded SVG `content:` value. This catches any hand-written `<a target="_blank">` in `.astro` components (e.g. footer "View source on GitHub") without requiring those authors to think about the glyph.

The `:not(.has-external-glyph)` selector ensures the rule does not double-render the glyph on Markdown-derived links (which already have the inline SVG injected by the rehype plugin).

For screen-reader text in `.astro` files, authors include `<span class="visually-hidden"> (opens in a new tab)</span>` manually. This is documented as a one-line convention next to the existing footer-link patterns. CSS-generated content (`::after { content: " (opens in a new tab)" }`) is **not** used for SR text because announcement support is historically inconsistent across browser/AT combinations.

---

## Components

### `src/lib/rehype-external-links.mjs` — new file

A unified plugin in plain ESM, with no runtime dependencies beyond `unist-util-visit` (already transitively present via Astro's Markdown stack; will be added as a direct devDependency for clarity).

Responsibilities:

- Visit every `element` node where `tagName === "a"`.
- Skip if `href` is missing, doesn't start with `http://` or `https://`, or matches the site host.
- Mutate `properties.target`, `properties.rel`, `properties.className` (preserving any existing classes).
- Append two new HAST element nodes as children: the SVG and the visually-hidden span.

The plugin is pure (no I/O, no async). It is exported as a default function that returns a `(tree) => void` transformer, the standard unified shape.

### `src/styles/global.css` — modified

Adds:

- `.visually-hidden` utility class using the standard clip-path pattern.
- `.external-glyph` rule controlling size, vertical alignment, and left margin for the inline SVG injected by the rehype plugin.
- `a[target="_blank"]:not(.has-external-glyph)::after` rule for the CSS-only fallback, using a `content: url("data:image/svg+xml;utf8,…")` value.

The two glyph paths must produce visually identical output so a Markdown link and an Astro-component link sit next to each other indistinguishably.

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

A short note in the content-authoring section: "External links in Markdown/MDX automatically get a new-tab indicator and screen-reader text. In `.astro` components, hand-written `<a target=\"_blank\">` gets the visual glyph automatically; include `<span class=\"visually-hidden\"> (opens in a new tab)</span>` as the link's last child for the screen-reader announcement."

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
Markdown content                       .astro component
  │                                       │
  ▼                                       ▼
 unified pipeline                     direct HTML emission
  │                                       │
  ▼                                       │
 rehype plugin adds:                      │
   target/rel                             │
   class="has-external-glyph"             │
   <svg aria-hidden>                      │
   <span class="visually-hidden">         │
  │                                       │
  └─────────► HTML output ◄────────────────┘
                  │
                  ▼
        Browser CSS applies:
          a[target=_blank]:not(.has-external-glyph)::after { content: SVG }
          a[target=_blank] .external-glyph { size, alignment }
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
3. **HTML inspection** — for a content page containing both a Markdown external link and an internal link, confirm the external one has `target`, `rel`, the inline SVG, and the visually-hidden span; the internal one is untouched.
4. **`.astro` component check** — add (or use existing) `<a target="_blank">` in `SiteFooter.astro` for a "View source" link; build and confirm the CSS-injected glyph appears, and that adding the `visually-hidden` span produces identical SR output to a Markdown link.
5. **`npm run pa11y`** — passes, no new violations. Specifically verify no contrast regressions (the glyph inherits `currentColor`, so it should match link contrast).
6. **Manual screen-reader spot-check** (VoiceOver) — confirm "(opens in a new tab)" is announced after the link text on at least one Markdown link and one Astro link.
7. **Theme check** — toggle light/dark; glyph color tracks link color in both.

## Migration / backfill

None. There is no existing external-link content using this pattern; the change is additive. After the plugin lands, all existing Markdown external links pick up the affordance on the next build. No content edits are required.

## Open questions

None remaining at design time.
