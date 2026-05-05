# Snaker page — design spec

**Date:** 2026-05-04
**Status:** Design

## 1. Goal

Host the JavaScript port of `gtritchie/snaker` at `https://boringbydesign.ca/snaker`. The page is a stable, linkable home for the game inside the existing site chrome.

## 2. Non-goals

- Not added to site navigation. (Owner will handle linking in a separate change.)
- Not screen-reader accessible. The game requires sight and real-time keyboard or touch reactions; this is acknowledged and reflected in audit configuration.
- No keyboard-controls block on the page. The game's own start screen shows controls.
- No save/high-score banner. `storage.js` handles localStorage failures internally.
- No audio chrome. The game unlocks audio on first user gesture during its start screen.
- No mobile-only fallback notice. Touch is supported by the engine.

## 3. User-facing behavior

- Visiting `/snaker` loads `BaseLayout` chrome (header, footer, theme toggle, skip link).
- Below the page heading and a one-sentence intro, a sized box (max 768×576 CSS pixels, 4:3 aspect ratio) renders the game.
- The game scales at integer multiples (1×/2×/3×) to fit the box; on viewports ≥768 CSS pixels wide it renders at 3×.
- First keypress or touch on the canvas activates the game and unlocks audio.
- Theme toggle, navigation, and browser scrolling continue to work; key events outside the canvas are not intercepted.

## 4. Architecture

### 4.1 Source integration

A verbatim snapshot of `gtritchie/snaker`'s `src/*.js` files lives at `src/snaker/`. The upstream `LICENSE` (MIT) is copied alongside as `src/snaker/LICENSE` so the MIT attribution travels with the snapshot.

- Vite bundles `src/snaker/main.js` into the page's client script via the Astro page's `<script>` block. The bundler follows the engine's relative imports automatically.
- ESLint, Prettier, and `astro check` skip `src/snaker/**` via ignore globs so the upstream's plain-JS style does not generate lint noise on resync.
- Re-sync is a manual `cp -r path/to/snaker/src/*.js src/snaker/` plus `cp path/to/snaker/LICENSE src/snaker/LICENSE`. Deliberately not automated; resyncs should be reviewed in PRs.

The engine is already container-aware (refactored upstream on 2026-05-04). `boot(canvas, options?)` returns a `destroy()` function. ResizeObserver, key handlers, and styles are all canvas-scoped — no global side effects.

### 4.2 File layout

```
src/
  pages/
    snaker.astro              # new — page wrapper, canvas, boot/destroy
  snaker/                     # new — verbatim snapshot of upstream src/
    main.js
    game.js
    screen.js
    audio.js
    input.js
    storage.js
    glyphs.js
    LICENSE                   # MIT, copied from upstream root
scripts/
  run-pa11y.mjs               # modified — deny-list excludes /snaker
.eslintignore                 # modified — adds src/snaker/**
.prettierignore               # modified — adds src/snaker/**
tsconfig.json                 # modified — excludes src/snaker/**
```

### 4.3 Page structure

`src/pages/snaker.astro` body:

```astro
<BaseLayout
  title="Snaker"
  description="JavaScript port of a snake game I wrote in TRS-80 BASIC in 1983."
>
  <main id="main">
    <div class="snaker-prose">
      <h1>Snaker</h1>
      <p>
        A snake game I wrote on a TRS-80 Color Computer in 1983, ported to JavaScript.
        <a href="https://github.com/gtritchie/snaker">Source on GitHub</a>.
      </p>
    </div>
    <div class="snaker-frame">
      <canvas id="snaker" tabindex="0"></canvas>
    </div>
  </main>
</BaseLayout>
```

Sizing CSS (Astro-scoped):

```css
/* Adventure precedent: the global `main { max-width: var(--page-width) }` is
   72ch sans-serif (~720px). The snaker frame caps at 768px and would overflow.
   Drop the main width-cap on this page and let the prose block / game frame
   impose their own widths. */
main {
  max-width: none;
  padding: var(--sp-8) var(--sp-6);
}
.snaker-prose {
  max-width: var(--reading-width);
  margin: 0 auto var(--sp-6);
}
.snaker-frame {
  width: min(100%, 768px);
  aspect-ratio: 4 / 3;
  margin: 0 auto;
  background: #000;
}
.snaker-frame canvas {
  width: 100%;
  height: 100%;
}
```

`width: min(100%, 768px)` produces integer-scale stepping — 3× at full width, 2× from 512–767 CSS pixels, 1× below 512. `aspect-ratio: 4/3` gives the engine a computable height so it takes the both-dimension scale path (the engine's width-only fallback is for containers without intrinsic height; we don't rely on it). The black background fills the box during scale steps and matches the game's intrinsic palette regardless of site theme.

### 4.4 Lifecycle integration

```ts
import { boot } from "../snaker/main.js";

let destroy: (() => void) | null = null;

document.addEventListener("astro:page-load", () => {
  const canvas = document.getElementById("snaker") as HTMLCanvasElement | null;
  if (!canvas) return;
  destroy = boot(canvas);
});

document.addEventListener("astro:before-swap", () => {
  if (destroy) {
    destroy();
    destroy = null;
  }
});
```

This follows the engine README's recommendation. `astro:before-swap` tears down listeners, observers, and audio before the DOM swaps; `astro:page-load` re-boots after the new DOM is in place. The engine throws on double-boot, so explicit teardown is required for view-transition correctness.

### 4.5 Sitemap and audit configuration

- **Sitemap:** page is included by default. No exclusion needed — it is publicly reachable and indexable, just not linked from navigation.
- **`scripts/run-pa11y.mjs`:** add a deny-list that filters `/snaker` (and `/snaker/`) from the URL list before invoking `pa11y-ci`. The script logs the audit count at startup; the deny-list takes effect when the count drops by one.
- **Search engines:** page is indexable on production. Preview deploys remain `noindex` via the existing `WORKERS_CI_BRANCH` mechanism in `BaseLayout` — nothing additional needed.

## 5. Component & module boundaries

- **`src/pages/snaker.astro`** — Astro page. Owns layout, intro copy, canvas placement, and lifecycle wiring. No game logic.
- **`src/snaker/`** — Third-party engine drop-in. Owns rendering, input, audio, storage, sizing. Untouched by this repo's tooling. Replaced wholesale on resync.
- **`scripts/run-pa11y.mjs`** — Audit runner. Owns the URL deny-list.
- No new shared components, layouts, or library code in `src/lib/`. Adventure-style host glue (`src/lib/adventure/`) is unnecessary because the engine is now self-contained — the entire host integration fits in the page's `<script>` block.

## 6. Constraints

- Node 24+ (existing requirement).
- No new runtime dependencies. Engine is plain ES modules.
- No build-step changes beyond ignore-glob updates.
- Re-sync is a manual `cp` step. Deliberately not automated; the user reviews each snapshot delta in a PR.

## 7. Verification

- `npm run check` — passes. Engine is excluded from typecheck/lint; the page itself is standard Astro.
- `npm run build` — succeeds. Output includes `dist/client/snaker/index.html` and a bundled engine chunk.
- `npm run preview:astro` + open `/snaker` — game boots, scales at integer multiples on window resize, key handlers respond only when the canvas is focused.
- `npm run pa11y` — runs as today against all sitemap URLs *except* `/snaker`. Confirm by counting the URLs logged at startup.
- `npm run link-check` — passes; `https://github.com/gtritchie/snaker` resolves.
- View-transition test: navigate to `/snaker`, then `/about`, then back. Game boots cleanly each time, no console errors, no double-boot throw.

## 8. Out of scope (deferred)

- Promoting the page in navigation, footer, or projects listings.
- Updating `src/content/projects/snaker.md` (currently `draft: true`). Independent of this page.
- Lighthouse budget tuning for the page. Existing budgets apply; revisit only if regressions appear.
