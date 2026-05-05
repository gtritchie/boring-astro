# Snaker Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/snaker` page that hosts the `gtritchie/snaker` JavaScript game inside the existing site chrome, excluded from a11y audits because the game requires sight and real-time reactions.

**Architecture:** Snapshot the upstream engine source into `src/snaker/` as a third-party drop-in — bundled by Vite when imported, but excluded from this repo's lint/format/typecheck pipelines so upstream resyncs travel cleanly. The Astro page at `src/pages/snaker.astro` renders a sized canvas inside `BaseLayout` and wires the engine's `boot`/`destroy` API to Astro's view-transition lifecycle. A targeted deny-list in `scripts/run-pa11y.mjs` filters `/snaker` from the audit URL list while keeping the page in the sitemap.

**Tech Stack:** Astro 6 (static output), Vite (bundles engine on import), plain ES modules (engine code), pa11y-ci (audit runner). No new runtime dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-04-snaker-page-design.md`

---

## Task 1: Snapshot the snaker engine and isolate from tooling

**Files:**

- Create: `src/snaker/main.js`, `src/snaker/game.js`, `src/snaker/screen.js`, `src/snaker/audio.js`, `src/snaker/input.js`, `src/snaker/storage.js`, `src/snaker/glyphs.js`, `src/snaker/LICENSE`
- Modify: `eslint.config.js`, `.prettierignore`, `tsconfig.json`

**Context:** The engine is a third-party drop-in. Vite bundles it once we import it from a page; running this repo's linters/formatters/typechecker against it would generate noise on every upstream resync. The verifications confirm tooling skips the directory cleanly without breaking the build.

- [ ] **Step 1: Verify the working branch is not main**

Run: `git branch --show-current`
Expected: a feature branch (e.g., `snaker-page-spec` from the spec PR, or a new `snaker-page` branch). If `main`, run `git checkout -b snaker-page` before proceeding. CLAUDE.md prohibits direct commits to main.

- [ ] **Step 2: Clone the upstream snaker repo to a scratch location**

Run:

```bash
rm -rf /tmp/snaker-snapshot && \
  gh repo clone gtritchie/snaker /tmp/snaker-snapshot
```

If `gh` is unavailable or unauthenticated, fall back to:

```bash
rm -rf /tmp/snaker-snapshot && \
  git clone https://github.com/gtritchie/snaker.git /tmp/snaker-snapshot
```

Expected: clone succeeds; `/tmp/snaker-snapshot/src/main.js` exists.

- [ ] **Step 3: Capture the upstream commit SHA**

Run:

```bash
( cd /tmp/snaker-snapshot && git rev-parse --short HEAD )
```

Save the short SHA — it goes in the commit message in Step 11.

- [ ] **Step 4: Copy engine source and license into `src/snaker/`**

Run:

```bash
mkdir -p src/snaker && \
  cp /tmp/snaker-snapshot/src/*.js src/snaker/ && \
  cp /tmp/snaker-snapshot/LICENSE src/snaker/LICENSE
```

- [ ] **Step 5: Verify the snapshot contents**

Run: `ls src/snaker/`

Expected output (alphabetical):

```
LICENSE
audio.js
game.js
glyphs.js
input.js
main.js
screen.js
storage.js
```

Run: `head -1 src/snaker/LICENSE`
Expected: `MIT License` (or similar — confirms the license file copied correctly, not an empty stub).

- [ ] **Step 6: Add ESLint ignore for `src/snaker/`**

Edit `eslint.config.js`. The current `ignores` block (line 4) reads:

```js
{ ignores: ["dist/**", "node_modules/**", ".astro/**", ".wrangler/**", "public/**"] },
```

Change it to:

```js
{ ignores: ["dist/**", "node_modules/**", ".astro/**", ".wrangler/**", "public/**", "src/snaker/**"] },
```

- [ ] **Step 7: Add Prettier ignore for `src/snaker/`**

Edit `.prettierignore`. Append a new line at the end:

```
src/snaker/
```

Verify:

```bash
grep "^src/snaker/$" .prettierignore
```

Expected: matches.

- [ ] **Step 8: Add tsconfig exclude for `src/snaker`**

Edit `tsconfig.json`. The current `exclude` array reads:

```json
"exclude": ["dist/**/*", "node_modules/**/*"]
```

Change it to:

```json
"exclude": ["dist/**/*", "node_modules/**/*", "src/snaker/**/*"]
```

- [ ] **Step 9: Run `npm run check` and confirm no lint/format/typecheck noise from `src/snaker/`**

Run: `npm run check`

Expected: passes. If any reported error references a path under `src/snaker/`, the ignore globs are not taking effect — recheck Steps 6, 7, 8.

If the run reports a pre-existing error unrelated to `src/snaker/`, treat it as a separate problem and surface it before proceeding (do not proceed with a broken `check`).

- [ ] **Step 10: Run `npm run build` to confirm Vite + Astro tolerate the new directory**

Run: `npm run build`

Expected: passes. The engine is not yet imported by any page, so it won't appear in `dist/` — this step verifies that the files existing on disk doesn't break the build pipeline.

- [ ] **Step 11: Commit the snapshot + tooling excludes**

Run:

```bash
git add src/snaker/ eslint.config.js .prettierignore tsconfig.json
git status --short
```

Expected: 8 new files under `src/snaker/`, plus the three modified config files.

Run (substitute the SHA captured in Step 3 for `<SHA>`):

```bash
git commit -m "$(cat <<'EOF'
Snapshot snaker engine and isolate from tooling

Adds verbatim copy of gtritchie/snaker src/ at <SHA> under src/snaker/,
with the upstream MIT LICENSE alongside. Excludes the directory from
ESLint, Prettier, and astro check so upstream resyncs travel through the
build pipeline without generating lint noise.

The engine is not yet imported by any page; this commit lands the
third-party drop-in. The /snaker page lands in a follow-up.
EOF
)"
```

---

## Task 2: Add the `/snaker` page and wire the embed

**Files:**

- Create: `src/pages/snaker.astro`

**Context:** `BaseLayout` provides the page chrome (header, footer, theme toggle, skip link, dark/light tokens). Like `/adventure`, this page overrides the global `main { max-width: var(--page-width) }` cap because the 768px game frame is wider than the 72ch (~720px) sans-serif default. The engine's `boot(canvas)` returns a `destroy()` function; per the engine README, `destroy` runs on `astro:before-swap` (before view-transition DOM swap) and `boot` runs on `astro:page-load` (after new DOM is in place). The engine throws on double-boot without explicit teardown, so this lifecycle wiring is required for back/forward navigation.

- [ ] **Step 1: Read the adventure precedent**

Run: `cat src/pages/adventure/index.astro`

Note the patterns: `import BaseLayout from "../../layouts/BaseLayout.astro"`, the `main { max-width: none }` override, and the top-level `<script>` block that wires `astro:page-load`. The snaker page mirrors this shape but is simpler — single canvas, no launcher component, no save UI.

- [ ] **Step 2: Create the page file**

Create `src/pages/snaker.astro` with this exact content:

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---

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

<style>
  /* The global `main { max-width: var(--page-width) }` rule caps content at
     72ch sans-serif (~720px). The game frame is 768px and would overflow.
     Drop the cap on this page; the prose block and game frame impose their
     own widths. Mirrors src/pages/adventure/index.astro. */
  main {
    max-width: none;
    padding: var(--sp-8) var(--sp-6);
  }
  .snaker-prose {
    max-width: var(--reading-width);
    margin: 0 auto var(--sp-6);
  }
  .snaker-prose h1 {
    margin: 0 0 var(--sp-2);
    line-height: var(--lh-heading);
  }
  .snaker-prose p {
    color: var(--fg-muted);
    margin: 0;
    line-height: var(--lh-body);
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
</style>

<script>
  import { boot } from "../snaker/main.js";

  let destroy: (() => void) | null = null;

  // ClientRouter swaps body content without reloading. boot() throws on
  // double-init, so explicitly destroy on before-swap and re-boot on
  // page-load. Mirrors the integration sample in the engine README.
  document.addEventListener("astro:page-load", () => {
    const canvas = document.getElementById("snaker");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    destroy = boot(canvas);
  });

  document.addEventListener("astro:before-swap", () => {
    if (destroy) {
      destroy();
      destroy = null;
    }
  });
</script>
```

- [ ] **Step 3: Run `npm run check`**

Run: `npm run check`

Expected: passes. If TypeScript flags the `import { boot } from "../snaker/main.js"` line because the engine has no `.d.ts`, the cause is Astro's strict tsconfig. The fix is to add `// @ts-expect-error - engine is plain JS, no types shipped` immediately above the import. Re-run `check` to confirm green.

- [ ] **Step 4: Run `npm run build`**

Run: `npm run build`

Expected: passes. Verify the output:

```bash
ls dist/client/snaker/
```

Expected: `index.html` exists.

```bash
ls dist/client/_astro/ | grep -E "\.js$" | head -5
```

Expected: hashed JS chunks present (one of them is the bundled engine, but Vite's hashing means the filename isn't predictable).

- [ ] **Step 5: Smoke-test in the local preview**

Open two terminals.

Terminal A:

```bash
npm run preview:astro
```

Wait for "ready in" / "Local: http://127.0.0.1:4321" output.

Terminal B:

```bash
curl -s http://127.0.0.1:4321/snaker | grep -E "(snaker-frame|<canvas|>Snaker<)"
```

Expected: matches each of those substrings.

Then in a browser at `http://127.0.0.1:4321/snaker`, confirm:

- The page renders with `<h1>Snaker</h1>` and the intro paragraph above the canvas.
- The canvas is centered and capped at 768 CSS pixels wide on a desktop viewport.
- Resizing the window from >768px down through 512px and below shows the game scaling at integer steps (3× → 2× → 1×); no fractional/blurred scaling.
- Pressing a key past the start screen begins the game; audio plays on first keypress.
- Theme toggle (top-right header) still works; the canvas background stays black regardless of theme.
- Navigate to `/about`, then back to `/snaker` (use browser back). Open DevTools Console: no errors, no `boot()` double-init throw.
- Tab away from the browser to another window and back: game pauses while hidden and resumes.

Stop the preview server (Ctrl-C in Terminal A).

- [ ] **Step 6: Run `npm run link-check`**

Prerequisite: `lychee` installed (`brew install lychee` if not — see `README.md`).

Run: `npm run link-check`

Expected: passes. The new `https://github.com/gtritchie/snaker` link in the intro must resolve.

- [ ] **Step 7: Commit the page**

Run:

```bash
git add src/pages/snaker.astro
git commit -m "$(cat <<'EOF'
Add /snaker page hosting the snake game

Renders the snaker engine inside BaseLayout: a sized canvas frame
(max 768x576 CSS pixels, 4:3) below a one-sentence intro and source
link. Overrides main's width cap (mirroring /adventure) so the frame
fits without horizontal overflow. Lifecycle follows the engine README:
destroy on astro:before-swap, boot on astro:page-load.
EOF
)"
```

---

## Task 3: Exclude `/snaker` from pa11y audits

**Files:**

- Modify: `scripts/run-pa11y.mjs`

**Context:** The pa11y runner walks the sitemap and audits every URL. The `/snaker` page is in the sitemap (we want it indexable and linkable) but the game itself requires sight and real-time keyboard/touch reactions; it cannot satisfy AAA contrast or keyboard-navigation checks. A targeted deny-list keeps the page sitemap-visible while skipping the audit. Astro emits trailing-slash URLs in static mode by default, so the deny-list matches both forms defensively.

- [ ] **Step 1: Add a top-level deny-list constant**

Edit `scripts/run-pa11y.mjs`. After the `const base = ...` line (currently line 16) and before the `async function fetchText` definition, insert:

```js
// URLs to skip. /snaker hosts a real-time keyboard/touch game; it cannot
// satisfy AAA contrast or keyboard-navigation audits and is excluded by
// design. The page stays in the sitemap and is publicly indexable.
const PA11Y_DENY_PATHS = new Set(["/snaker", "/snaker/"]);
```

- [ ] **Step 2: Apply the filter and report skipped URLs**

Still in `scripts/run-pa11y.mjs`, find the line:

```js
cfg.urls = pageUrls;
```

Replace it with:

```js
const filteredUrls = pageUrls.filter((url) => !PA11Y_DENY_PATHS.has(new URL(url).pathname));
const skipped = pageUrls.length - filteredUrls.length;
cfg.urls = filteredUrls;
```

Then update the existing log line a few lines below:

```js
console.log(
  `pa11y-ci: auditing ${pageUrls.length} URL(s) via ${shardUrls.length} sitemap shard(s) at ${base}`,
);
```

Replace it with:

```js
console.log(
  `pa11y-ci: auditing ${filteredUrls.length} URL(s) via ${shardUrls.length} sitemap shard(s) at ${base}` +
    (skipped > 0 ? ` (skipped ${skipped} per deny-list: ${[...PA11Y_DENY_PATHS].join(", ")})` : ""),
);
```

- [ ] **Step 3: Verify the deny-list takes effect**

Open two terminals.

Terminal A: `npm run preview:astro` (wait for "ready" output).

Terminal B: `npm run pa11y`

Expected output: the startup line includes `(skipped 1 per deny-list: /snaker, /snaker/)`. The audit count is one less than the total sitemap URL count.

The audit itself should pass — existing pages already pass.

If `/snaker` still appears in the audit:

- Check the exact path Astro emits in the sitemap with `curl -s http://127.0.0.1:4321/sitemap-0.xml | grep snaker`. The path should be `/snaker/` (trailing slash) by default — the deny-list covers both forms, but if Astro emits something else (e.g., `/snaker.html`), add that form to `PA11Y_DENY_PATHS`.

Stop the preview server.

- [ ] **Step 4: Commit the deny-list**

Run:

```bash
git add scripts/run-pa11y.mjs
git commit -m "$(cat <<'EOF'
Exclude /snaker from pa11y audits

The snaker page hosts a real-time keyboard/touch game that cannot
satisfy AAA contrast or keyboard-navigation requirements. It stays
in the sitemap (publicly reachable, indexable) but is filtered from
the URL list before pa11y-ci runs. The startup log reports the
skipped count for visibility.
EOF
)"
```

---

## Final verification

Before opening a PR:

- [ ] `npm run check` — passes
- [ ] `npm run build` — passes
- [ ] `npm run preview:astro` + manual `/snaker` test — game plays, scales, navigates cleanly
- [ ] `npm run pa11y` — passes; startup line reports `/snaker, /snaker/` skipped
- [ ] `npm run link-check` — passes
- [ ] All three commits land on the feature branch in order

Then push the branch and open a PR.

---

## Spec coverage

Each section of `docs/superpowers/specs/2026-05-04-snaker-page-design.md` maps to a task:

- §3 User-facing behavior → Task 2 Step 5 (manual smoke test)
- §4.1 Source integration → Task 1
- §4.2 File layout → Tasks 1, 2, 3
- §4.3 Page structure → Task 2 Step 2
- §4.4 Lifecycle integration → Task 2 Step 2 (the `<script>` block)
- §4.5 Sitemap and audit configuration → Task 3
- §6 Constraints → respected by all tasks (no new deps, manual snapshot, Node 24 unchanged)
- §7 Verification → Task 1 Steps 9–10, Task 2 Steps 3–6, Task 3 Step 3, Final verification block
- §8 Out of scope (deferred) → not implemented in this plan, per spec
