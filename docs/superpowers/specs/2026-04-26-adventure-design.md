# Adventure (in-browser Colossal Cave) — design spec

**Date:** 2026-04-26
**Author:** Gary Ritchie
**Status:** Approved — ready for implementation plan

---

## Summary

A new `/adventure/` page on boringbydesign.ca hosts an in-browser port of *Colossal Cave Adventure*. The game engine is `@open-adventure/core` — Gary's TypeScript port of the public-domain Crowther & Woods code, packaged for distribution. The site embeds the engine, supplies a browser-side `GameIO` and `SaveStorage`, and presents a small launcher UI for starting new games and resuming saves. Saved games persist in `localStorage`; nothing executes server-side.

A new **Adventure** link in the site footer (immediately to the left of the existing **Toolkit** link) is the entry point.

## Goals

- Authentic text-adventure UX: line-in / line-out, no fake terminal chrome, monospace, AAA contrast in both light and dark themes.
- All game logic runs in the user's browser; saves stay on-device in `localStorage`.
- The package stays unmodified — the site implements only `GameIO` and `SaveStorage` against its public interfaces.
- Auto-save on navigation away (reserved `[Last session]` slot) so a stray footer click never destroys progress.
- Launcher matches the site's existing density and palette; works on phone-sized viewports.
- Launcher is statically pre-rendered, hydrated client-side; the game view is the same page mutated in place — no second route, no SPA takeover.
- Bundle stays small enough to leave the existing Lighthouse perf budget intact.

## Non-goals

- No multi-tab synchronization. Each tab has its own JS module instance; if two tabs both write `[Last session]`, last write wins.
- No server-side persistence, account system, or cross-device sync.
- No service worker / offline mode in this iteration.
- No use of `xterm.js` or any terminal emulator library — Adventure emits plain text only, no escape sequences, so a full VT emulator is unnecessary weight.
- No web-side modifications to the package's save format.
- No leaderboards, achievements, or anything beyond the package's own scoring.

## Package consumption

Before implementation begins, `@open-adventure/core` is published to npm under that scoped name. Site dependency:

```json
"@open-adventure/core": "^1.0.1"
```

The package is ESM-only, ships a `dist/` of compiled JS + types, declares `sideEffects: false`, and has no runtime dependencies. Vite bundles it into the Adventure page chunk only.

## Public package surface used

From the package's `index.ts`:

- `runGame(opts: RunGameOptions): Promise<number>` — session entry; resolves with exit code.
- `createGameState()`, `createSettings()` — fresh state and default settings (we hold the state object so we can autosave from outside the loop).
- `serializeGame(state)` — JSON-encodes a `GameState` for our autosave pathway.
- `summarizeSave(json)` — returns `SaveSummary` with `locationName`, `score`, `maxScore`, `phase`, `compatible`, etc.; used to populate launcher rows.
- `TerminateError` — recognized so the host can distinguish ordinary engine exits from real errors.

Package types consumed: `GameIO`, `SaveStorage`, `GameState`, `SaveSummary`, `RestoreResult`, `RunGameOptions`.

## Route and footer

- New route: `src/pages/adventure/index.astro`. Wraps `BaseLayout`. Renders launcher and terminal markup; terminal `hidden` by default.
- `src/components/SiteFooter.astro` gets an `<a href="/adventure/">Adventure</a>` list item inserted immediately before the existing **Toolkit** entry.
- The page is included in `sitemap.xml` and pa11y's URL list. It is **not** marked `noindex`.

## File layout

```
src/pages/adventure/index.astro       # Page shell; imports launcher + terminal
src/components/AdventureLauncher.astro # Static launcher markup (intro, button, table shell)
src/components/AdventureTerminal.astro # Static terminal markup (output region, input form, action bar)
src/lib/adventure/storage.ts           # SaveStorage implementation over localStorage
src/lib/adventure/io.ts                # GameIO bound to a DOM root
src/lib/adventure/host.ts              # Orchestrator: starts/cancels games, autosave hooks
src/lib/adventure/launcher.ts          # Populates table, handles row actions, mounts terminal
src/lib/adventure/format.ts            # formatRelativeTime, formatScore, getSummaryRow
```

No new top-level dependencies beyond `@open-adventure/core`.

## Component & data-flow design

### `LocalStorageSaveStorage` (`storage.ts`)

Implements the package's `SaveStorage`:

Storage keys live in four distinct top-level namespaces so user-supplied names cannot collide with metadata keys regardless of what characters they contain:

| Key | Contents |
|---|---|
| `adventure:save:<name>` | User-save JSON payload |
| `adventure:meta:<name>` | User-save metadata (sidecar — see "Save timestamps") |
| `adventure:autosave` | Autosave JSON payload |
| `adventure:autosave-meta` | Autosave metadata |

Methods:

- `read(name)`: returns `localStorage.getItem("adventure:save:" + name)` or `null`. Never throws for missing-file.
- `write(name, json)`: writes both `adventure:save:<name>` and `adventure:meta:<name>`. Catches `QuotaExceededError`, rethrows as a typed `SaveQuotaError` so the package's existing retry loop can handle it.
- `list()`: enumerates keys with the `adventure:save:` prefix and returns the substring after the prefix. Because metadata lives under a separate `adventure:meta:` prefix, no filtering of suffixes is needed; any user name (including names containing `:` or ending with `:meta`) is safe.
- `delete(name)`: removes both `adventure:save:<name>` and `adventure:meta:<name>`.

Plus host-only methods (not part of `SaveStorage`):

- `readAutosave()`, `writeAutosave(json)`, `clearAutosave()` — operate on `adventure:autosave` and `adventure:autosave-meta`. Autosave is not visible to `list()` so the package can't see it via in-game `RESUME`.

Reserved name validation: when in-game `SAVE` writes, we reject the literal name `[Last session]` (case-sensitive) — the launcher's display name for the autosave row. No other name restrictions are needed because the namespace layout above eliminates structural collisions; the only enforced character cap is the 60-char length limit.

#### Save timestamps

The package's save JSON does not carry a timestamp. We store a sidecar key per save under the `adventure:meta:` namespace containing `{ "savedAt": <epoch_ms> }`. Written during every `write()` call; removed during `delete()`. The autosave's metadata is at `adventure:autosave-meta` for symmetry.

Rationale: keeps the package format untouched, keeps the meta separate from the engine-validated payload, requires no migration if the engine adds save metadata later. Using a distinct top-level prefix for metadata (rather than a suffix on the save key) means user-supplied save names can contain any characters without risk of colliding with the metadata namespace.

### `BrowserGameIO` (`io.ts`)

Constructor: `new BrowserGameIO({ outputEl, inputEl, promptEl, onCancel })`.

- `print(msg)`: appends a text node to `outputEl` (preserving newlines via `white-space: pre-wrap`); calls `scrollIntoView({ block: "nearest" })` on the input row so the player always sees the prompt.
- `readline(prompt)`:
  1. Sets `promptEl.textContent = prompt`.
  2. Reveals the input row, focuses `inputEl`.
  3. Returns a Promise resolved by the form's submit handler. On submit: append a transcript line `<div>&gt; <em>{value}</em></div>` to `outputEl`, clear the input, hide the input row, resolve with the trimmed value.
  4. If `host.cancel()` is called (player navigated away from `/adventure/` mid-prompt), resolves with `null` — the package treats `null` as EOF.
- `echoInput`: `false`. The visible input field already shows what the player typed.

### `AdventureHost` (`host.ts`)

Owns at most one active game session.

```ts
class AdventureHost {
  startNew(): Promise<void>;
  resume(name: string): Promise<void>;
  resumeAutosave(): Promise<void>;
  cancel(): void;
}
```

Internally:

- Holds the current `GameState`, the running `runGame()` promise, the `BrowserGameIO`, and an exit-reason tag (`"save" | "terminal" | "cancelled" | "error"`).
- After every successful `readline`, calls `storage.writeAutosave(serializeGame(state))`. This is cheap (sub-millisecond `JSON.stringify` + sync `setItem`) and gives the autosave per-turn granularity.
- Registers `astro:before-preparation` and `pagehide` listeners while a game is active; both fire `storage.writeAutosave(serializeGame(state))` synchronously and then `host.cancel()`.
- When `runGame()` resolves, branches on the exit reason:
  - `"save"` — silently unmount the terminal, re-render the launcher (player ran in-game `SAVE`, intent is "leave").
  - `"terminal"` — leave the transcript visible, replace the input row with a post-game action bar containing **Back to launcher** and **New game**. Focus moves to **Back to launcher**.
  - `"cancelled"` — used by mid-game navigation; nothing further to do because the page is leaving anyway.
  - `"error"` — replace the input row with an error panel showing the error message + a **Back to launcher** button. Autosave is preserved.

How exit reasons are determined: `runGame()` itself doesn't tell us why it returned. We infer:

- If the host's `cancel()` was the cause, exit reason is `"cancelled"`.
- If `runGame()` throws a non-`TerminateError`, the host's catch block tags `"error"`.
- Otherwise (normal `TerminateError` resolution): `BrowserGameIO` tracks the most recent `readline` prompt. The package's SAVE flow is the only path that prompts `"\nFile name: "` immediately before termination, so last-prompt-was-`File name:` → `"save"`; anything else (QUIT, death, victory) → `"terminal"`.

### `Launcher` (`launcher.ts`)

Pure DOM + storage orchestration; no framework.

On `astro:page-load` for `/adventure/`:

1. Read the autosave (if present) and call `summarizeSave()` to render the `[Last session]` row.
2. `storage.list()` → for each name, `storage.read()` + `summarizeSave()` → render row.
3. Wire **Start new game** → `host.startNew()`; per-row **Resume**, **Delete**, **Clear** handlers.

Delete confirmation: `window.confirm("Delete '<name>'? This cannot be undone.")`. Clear confirmation: `window.confirm("Clear last session? You won't be able to resume it.")`. We use native confirm rather than custom modals for keyboard accessibility and brevity; CLAUDE.md's "no client JS" ethos means a small native prompt beats a styled modal we'd otherwise own.

Incompatible saves (`summary.compatible === false`) render with a struck-through name, "Save format outdated" in the location column, and only a **Delete** action.

If `localStorage` is unavailable (privacy mode, sandboxed iframe), the launcher renders a banner — "Your browser blocks local storage; saves won't persist this session" — and disables Resume / list rendering. **Start new game** still works; in-game `SAVE` will print "Saves aren't available in this browser." The detection mirrors `ThemeToggle.astro`'s existing pattern of `try { localStorage.setItem("__probe__", "1"); localStorage.removeItem("__probe__"); }`.

## Visual design

### Launcher

- Single-column, capped at `--reading-width` (68 ch).
- H1 "Adventure"; intro paragraph (one sentence, 60 ch wide, with a short "what is this?" line and a link to the Wikipedia article).
- Primary CTA: **Start new game** — solid `--fg` background, `--bg` text, generous padding.
- Section heading "Saved games" in muted small caps.
- Saves rendered as a `<table>` with columns: Name, Score, Location, Saved, (actions). Tabular-numeric font feature on the score column.
- `[Last session]` row uses italic muted name; only **Resume** and **Clear** actions.
- Below ~600px, the table collapses to stacked rows: name + saved-time on line 1, score + location on line 2, actions on line 3. No content hidden; timestamps shrink to compact form ("3h ago").

### Terminal (game view)

- `<main>` with a single `<div role="log" aria-live="polite">` for output and a `<form>` containing a visible prompt span (`> `) plus an `<input type="text">`. Reading width capped at `--reading-width`.
- Typography: `--font-mono`, 1rem, line-height 1.55, `white-space: pre-wrap`. Output uses `--fg` on `--bg`; the prompt span uses `--fg-muted`. Player's submitted lines render as transcript items in `--fg`.
- No fake blinking cursor — the real `<input>`'s system caret is the cursor.
- Input attributes: `autocapitalize="off"`, `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`, `inputmode="text"`, `aria-label="Game input"`. The prompt `>` is in a `<span aria-hidden="true">` so screen readers don't read "greater than" before every input.
- Focus management:
  - On launcher → game transition, focus moves to the input.
  - After every `readline`, focus returns to the input.
  - Clicking anywhere in the output region focuses the input (so a stray tap on iOS doesn't trap the user).
  - On game → launcher transition, focus moves to **Start new game**.
- Scrollback: no cap. After each `print()`, the input row scrolls into view.
- Mobile: iOS keyboard appears on focus; we trigger `inputRow.scrollIntoView({ block: "nearest" })` after layout settles so the input stays above the keyboard.

### Post-game action bar

When `runGame()` resolves with exit reason `"terminal"`, the input row is replaced by a button row: **Back to launcher** and **New game**. The transcript and final score remain visible. Same behavior on `"error"`, with an error panel above the buttons.

### Theme

The game view reads `--bg`, `--fg`, `--fg-muted` directly. The existing `ThemeToggle` component continues to work unchanged; toggling theme during a game updates colors in place.

## Save lifecycle

| Event | Storage call | UX |
|---|---|---|
| In-game `SAVE` (player-typed) | `storage.write(name, json)` | Silent overwrite; package terminates; host returns to launcher silently |
| In-game `RESUME` | `storage.read(name)` | Standard package flow; bad / missing → package's existing message |
| Per-turn autosave | `storage.writeAutosave(json)` | Invisible; runs after every `readline` |
| Navigation away mid-game | `storage.writeAutosave(json)` | Synchronous on `astro:before-preparation` / `pagehide` |
| Launcher Resume | `storage.read(name)` → `runGame({ initialSave })` | If `compatible === false`, button is disabled and row is grayed out |
| Launcher Delete | `storage.delete(name)` after confirm | Row removed |
| Launcher Clear last session | `storage.clearAutosave()` after confirm | Autosave row removed |

### Naming rules

- Free-form text from the in-game `SAVE` prompt.
- Trimmed; empty rejected (package already enforces).
- Cap at 60 characters (we enforce; package does not).
- Reject the literal name `[Last session]` (case-sensitive) — that's the launcher's display label for the autosave row.
- All other characters allowed. Save data and metadata live in separate top-level namespaces (`adventure:save:` vs `adventure:meta:`), so names containing `:` or ending with `:meta` cannot collide with the metadata key for any other save.

## Error handling

| Source | Handling |
|---|---|
| Package throws non-`TerminateError` | Host catches; replaces input row with error panel (message + collapsed details); preserves autosave; offers **Back to launcher**; no silent `console.error` |
| `QuotaExceededError` during in-game `SAVE` | Wrapped as `SaveQuotaError`; package's existing `try { write } catch { print "Can't open file …, try again." }` loop handles it |
| `QuotaExceededError` during autosave | `console.warn` only; player not blocked |
| Resume of corrupt save (bad JSON, tampering) | Package's `restore()` returns `RestoreResult` with reason; package emits its `BAD_SAVE` message and continues from initial state (its documented browser behavior). Launcher row stays — player can delete |
| Resume of incompatible save | `summarizeSave()` returns `compatible: false`; launcher never offers Resume; row shows delete-only |
| `localStorage` unavailable | Launcher banner; play allowed without save; in-game `SAVE` prints unavailability message |

## Lifecycle and navigation

- Bootstrap on `astro:page-load` (fires for both hard navigation and ClientRouter swap into `/adventure/`).
- Mid-game outbound navigation handlers: `astro:before-preparation` (ClientRouter) + `pagehide` (close, refresh, back to a non-`/adventure/` page). Both:
  1. Call `storage.writeAutosave(serializeGame(state))` synchronously.
  2. Call `host.cancel()` to settle the pending `readline`.
  3. Both handlers are idempotent — being called once or twice is fine.
- Browser back from `/adventure/`: navigates per browser history; autosave fires; no in-page intercept.
- The launcher and the terminal are the same URL — the back button does not swap between them. Returning to the launcher mid-game is via header/footer link (with autosave) or via post-game **Back to launcher** button.

## Bundle and performance

- `@open-adventure/core` is `sideEffects: false`, so Vite tree-shakes unused exports. The Adventure page only imports `runGame`, `createGameState`, `createSettings`, `serializeGame`, `summarizeSave`, `TerminateError`, plus types — types vanish at compile time.
- Target: Adventure-page-only bundle under 50 KB gzipped (engine + our code combined). Verified via `dist/client/_astro/*adventure*.js` size after `npm run build`.
- The site's other pages do not load any Adventure code. Astro's per-page `<script>` bundling guarantees this.
- Initial page render is static HTML — launcher's intro, button, and table shell are pre-rendered. JS only injects save rows + wires handlers. No layout shift on hydrate.

## Verification

The repo intentionally has no unit-test suite (per `CLAUDE.md`). Verification is the existing CI gates plus a manual checklist run before merge.

### Automated (CI gates)

- `npm run check` — `astro check` (TS), prettier, eslint. Must be clean. Adventure modules use full TypeScript annotations; package types flow through.
- `npm run pa11y` — `/adventure/` is sitemap-indexed. Initial-load markup (launcher + empty terminal shell) must pass AAA. The `role="log" aria-live="polite"` pattern is canonical and pa11y-clean.
- `npm run link-check` — the new footer link plus any in-page links must resolve.
- `npm run lighthouse` (local) — must not regress perf budgets in `.lighthouserc.json`. Bundle-size rule: Adventure-page chunk under 50 KB gzipped.

### Manual checklist

1. Footer shows **Adventure** to the left of **Toolkit** on every page; clicking lands at `/adventure/`.
2. Empty-state launcher: no `[Last session]`, no saves, just the **Start new game** button.
3. New game shows welcome flow; novice y/n prompt works; game enters at the well-house.
4. In-game `SAVE` prompts "File name:"; entering a name writes the save; player returns to launcher silently; new row appears with correct score, location, "Just now"; can be deleted with confirm.
5. Launcher Resume drops the player back exactly where they were.
6. Mid-game footer click: autosave fires; navigating back to `/adventure/` shows `[Last session]`; resuming works.
7. `[Last session]` survives tab close + reopen, browser back from another page, hard refresh.
8. **Clear last session** removes the autosave row after confirm.
9. QUIT mid-game: action bar appears with **Back to launcher** and **New game**; transcript stays visible.
10. Death in a pit: same frozen + action bar UX as QUIT.
11. Theme toggle while a game is in progress: colors swap; input keeps focus; transcript intact.
12. iOS Safari: input has no autocorrect / autocapitalize / spell-check; keyboard doesn't cover the input.
13. Quota error: synthesize by filling localStorage; in-game `SAVE` shows "Can't open file …, try again."
14. Synthetic incompatible save (manually written localStorage entry with old `version`): launcher row renders gray + delete-only.
15. Light + dark mode both visually pass for AAA contrast on the game view (eyeball; Lighthouse a11y score sanity-checks).
16. Run `npm run build` and check `dist/client/_astro/*adventure*.js` size; under 50 KB gzipped.

## Open questions

None at design time. Anything that surfaces during implementation goes into the implementation plan.
