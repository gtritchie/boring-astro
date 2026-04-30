# Adventure (in-browser Colossal Cave) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/adventure/` page that hosts an in-browser port of _Colossal Cave Adventure_, powered by the published `@open-adventure/core` package, with `localStorage`-backed save/restore and a launcher UI. Add an **Adventure** entry to the site footer.

**Architecture:** The page renders a static launcher shell (intro, "Start new game" CTA, saves table) and a hidden game-view shell (output region, input form, post-game action bar). A page-scoped client script wires both up: a `LocalStorageSaveStorage` implements the package's `SaveStorage` interface; a `BrowserGameIO` implements `GameIO`; an `AdventureHost` orchestrates `runGame()` calls, autosave-on-navigation, and post-exit UX. No additional UI framework — vanilla TS + DOM.

**Tech Stack:** Astro 6 (existing site), `@open-adventure/core` (published to npm), TypeScript, `localStorage`, Astro `ClientRouter` events (`astro:page-load`, `astro:before-preparation`).

**Spec:** `docs/superpowers/specs/2026-04-26-adventure-design.md`

**Project conventions worth knowing before starting:**

- Repo intentionally has no unit-test suite (per `CLAUDE.md`). Verification is `npm run check` (astro check + prettier + eslint), `npm run pa11y` against the sitemap, `npm run link-check`, plus a manual smoke checklist. Do not introduce vitest just for this feature.
- Branch: this plan was prepared on `adventure-design-spec`. The implementation should land on the same branch (or a child of it). Never commit to `main`.
- Astro static output: build artifacts live under `dist/client/` (not `dist/`).
- Use `import.meta.env`, never `process.env`, in any `.astro` file.
- Tokens (`src/styles/tokens.css`) define `--bg`, `--fg`, `--fg-muted`, `--border`, `--border-ui`, `--btn-bg`, `--accent`, `--focus-ring`, `--font-mono`, `--font-sans`, `--reading-width`, spacing scale `--sp-1` … `--sp-16`.
- `src/components/ThemeToggle.astro` shows the working pattern for client scripts that survive `ClientRouter`: register listeners on `document` once, refresh on `astro:page-load`. Follow that pattern.

---

## File Structure

| Path                                     | Purpose                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `package.json`                           | Add `@open-adventure/core` dependency                                                               |
| `src/lib/adventure/format.ts`            | Pure formatting helpers (relative time, score, summary-row mapping)                                 |
| `src/lib/adventure/storage.ts`           | `LocalStorageSaveStorage` (implements package `SaveStorage`); namespace constants; quota error type |
| `src/lib/adventure/io.ts`                | `BrowserGameIO` (implements package `GameIO`); DOM-bound print/readline                             |
| `src/lib/adventure/host.ts`              | `AdventureHost` orchestrator; nav-handler registration; exit-reason classification                  |
| `src/lib/adventure/launcher.ts`          | DOM bootstrap; saves-table render; row action wiring; mount/unmount of game view                    |
| `src/components/AdventureLauncher.astro` | Static markup for launcher (intro, button, table shell, storage banner)                             |
| `src/components/AdventureTerminal.astro` | Static markup for game view (output, input form, post-game bar, error panel)                        |
| `src/pages/adventure/index.astro`        | Page shell using `BaseLayout`; imports both components; embeds bootstrap `<script>`                 |
| `src/components/SiteFooter.astro`        | Add `Adventure` link before `Toolkit`                                                               |

No new top-level dependencies beyond `@open-adventure/core`.

---

## Task 1: Add `@open-adventure/core` dependency

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json` (auto)

**Prerequisite (Gary's task, not the agent's):** `@open-adventure/core` is published to npm. Confirm with `npm view @open-adventure/core version` before starting.

- [ ] **Step 1: Confirm the package is published**

Run: `npm view @open-adventure/core version`
Expected: prints a version string (e.g., `1.0.1`). If `E404`, stop and ask Gary to publish before continuing.

- [ ] **Step 2: Install the package**

Run: `npm install @open-adventure/core`
Expected: `package.json` gains a `dependencies` entry; `package-lock.json` updated; no peer-dep warnings.

- [ ] **Step 3: Verify the install**

Run: `node -e "import('@open-adventure/core').then(m => console.log(Object.keys(m).sort().join(', ')))"`
Expected: prints a list including `runGame`, `createGameState`, `serializeGame`, `summarizeSave`, `TerminateError`.

- [ ] **Step 4: Run formatter and checker**

Run: `npm run check`
Expected: passes (no source changes yet to break anything).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add @open-adventure/core dependency"
```

---

## Task 2: Pure formatting helpers (`format.ts`)

**Files:**

- Create: `src/lib/adventure/format.ts`

- [ ] **Step 1: Create the file**

```ts
// src/lib/adventure/format.ts
// Pure formatting helpers for the Adventure launcher. No DOM, no storage.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Render an absolute epoch as a friendly relative time. The `compact` form is
 * used in the mobile breakpoint where horizontal space is tight.
 */
export function formatRelativeTime(
  savedAt: number,
  now: number = Date.now(),
  compact: boolean = false,
): string {
  const diff = Math.max(0, now - savedAt);
  if (diff < MINUTE_MS) return "Just now";
  if (diff < HOUR_MS) {
    const m = Math.floor(diff / MINUTE_MS);
    return compact ? `${m}m ago` : `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < DAY_MS) {
    const h = Math.floor(diff / HOUR_MS);
    return compact ? `${h}h ago` : `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diff < 2 * DAY_MS) return "Yesterday";
  if (diff < 7 * DAY_MS) {
    const d = Math.floor(diff / DAY_MS);
    return compact ? `${d}d ago` : `${d} days ago`;
  }
  // Older: short absolute date in UTC (project convention — see CLAUDE.md).
  const date = new Date(savedAt);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatScore(score: number, max: number): string {
  return `${score} / ${max}`;
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/adventure/format.ts
git commit -m "Add adventure formatting helpers"
```

---

## Task 3: `LocalStorageSaveStorage` (`storage.ts`)

**Files:**

- Create: `src/lib/adventure/storage.ts`

This implements the package's `SaveStorage` interface plus host-only autosave methods. Per the spec, save data lives at `adventure:save:<name>` and metadata at `adventure:meta:<name>` — distinct top-level prefixes so user names cannot collide with metadata keys.

- [ ] **Step 1: Create the file**

```ts
// src/lib/adventure/storage.ts
import type { SaveStorage } from "@open-adventure/core";

const SAVE_PREFIX = "adventure:save:";
const META_PREFIX = "adventure:meta:";
const AUTOSAVE_KEY = "adventure:autosave";
const AUTOSAVE_META_KEY = "adventure:autosave-meta";

/** Reserved name shown by the launcher for the autosave row. */
export const AUTOSAVE_DISPLAY_NAME = "[Last session]";
const RESERVED_NAMES: ReadonlySet<string> = new Set([AUTOSAVE_DISPLAY_NAME]);

const MAX_NAME_LEN = 60;

export interface SaveMeta {
  savedAt: number;
}

export class SaveQuotaError extends Error {
  constructor() {
    super("Save storage is full.");
    this.name = "SaveQuotaError";
  }
}

export class InvalidSaveNameError extends Error {
  constructor(reason: string) {
    super(`Invalid save name: ${reason}`);
    this.name = "InvalidSaveNameError";
  }
}

/**
 * Implements the package's SaveStorage over window.localStorage. The four
 * SaveStorage methods (read/write/list/delete) are async per the package
 * contract; backing storage is synchronous.
 *
 * Autosave methods live alongside but are not part of SaveStorage — the
 * package never sees the autosave key, so in-game RESUME cannot accidentally
 * load it.
 */
export class LocalStorageSaveStorage implements SaveStorage {
  async read(name: string): Promise<string | null> {
    try {
      return localStorage.getItem(SAVE_PREFIX + name);
    } catch {
      return null;
    }
  }

  async write(name: string, data: string): Promise<void> {
    validateName(name);
    try {
      localStorage.setItem(SAVE_PREFIX + name, data);
      localStorage.setItem(
        META_PREFIX + name,
        JSON.stringify({ savedAt: Date.now() } satisfies SaveMeta),
      );
    } catch (err) {
      if (isQuotaError(err)) throw new SaveQuotaError();
      throw err;
    }
  }

  async list(): Promise<string[]> {
    // Mirrors read() / writeAutosave(): localStorage access can throw entirely
    // (privacy mode, sandboxed iframes). Return an empty list rather than
    // letting the launcher's render path crash.
    try {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null && key.startsWith(SAVE_PREFIX)) {
          out.push(key.slice(SAVE_PREFIX.length));
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  async delete(name: string): Promise<void> {
    localStorage.removeItem(SAVE_PREFIX + name);
    localStorage.removeItem(META_PREFIX + name);
  }

  readMeta(name: string): SaveMeta | null {
    return parseMeta(localStorage.getItem(META_PREFIX + name));
  }

  readAutosave(): string | null {
    try {
      return localStorage.getItem(AUTOSAVE_KEY);
    } catch {
      return null;
    }
  }

  /** Best-effort write; never throws. Quota failures during autosave are ignored. */
  writeAutosave(data: string): void {
    try {
      localStorage.setItem(AUTOSAVE_KEY, data);
      localStorage.setItem(
        AUTOSAVE_META_KEY,
        JSON.stringify({ savedAt: Date.now() } satisfies SaveMeta),
      );
    } catch {
      // Autosave is best-effort; never disrupt gameplay.
    }
  }

  clearAutosave(): void {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(AUTOSAVE_META_KEY);
  }

  readAutosaveMeta(): SaveMeta | null {
    return parseMeta(localStorage.getItem(AUTOSAVE_META_KEY));
  }
}

function validateName(name: string): void {
  if (name.length === 0) throw new InvalidSaveNameError("name cannot be empty");
  if (name.length > MAX_NAME_LEN) {
    throw new InvalidSaveNameError(`name longer than ${MAX_NAME_LEN} characters`);
  }
  if (RESERVED_NAMES.has(name)) {
    throw new InvalidSaveNameError(`'${name}' is reserved`);
  }
}

function parseMeta(raw: string | null): SaveMeta | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "savedAt" in parsed &&
      typeof (parsed as { savedAt: unknown }).savedAt === "number"
    ) {
      return { savedAt: (parsed as { savedAt: number }).savedAt };
    }
    return null;
  } catch {
    return null;
  }
}

function isQuotaError(err: unknown): boolean {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return err.name === "QuotaExceededError" || err.code === 22;
  }
  return err instanceof Error && err.name === "QuotaExceededError";
}

/**
 * Probe localStorage availability without persisting state. Mirrors the
 * pattern in src/components/ThemeToggle.astro.
 */
export function isStorageAvailable(): boolean {
  try {
    const probe = "adventure:__probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Manual smoke check (browser DevTools)**

Run: `npm run dev` (in another terminal). Open `http://localhost:4321/`. In DevTools console:

```js
const m = await import("/src/lib/adventure/storage.ts");
const s = new m.LocalStorageSaveStorage();
await s.write("smoke", JSON.stringify({ hello: "world" }));
console.log(await s.list()); // ["smoke"]
console.log(await s.read("smoke")); // '{"hello":"world"}'
console.log(s.readMeta("smoke")); // { savedAt: <epoch> }
await s.delete("smoke");
console.log(await s.list()); // []
```

Expected: each line prints the indicated value; no errors. Then clean up: stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/lib/adventure/storage.ts
git commit -m "Add LocalStorageSaveStorage with separate save/meta namespaces"
```

---

## Task 4: `BrowserGameIO` (`io.ts`)

**Files:**

- Create: `src/lib/adventure/io.ts`

The IO is constructed with element references and an optional `onBeforeReadline` hook (used by the host for autosave). `print` appends text nodes (preserving newlines via `white-space: pre-wrap` in CSS); `readline` shows the prompt, focuses the input, and resolves a Promise on form submit.

- [ ] **Step 1: Create the file**

```ts
// src/lib/adventure/io.ts
import type { GameIO } from "@open-adventure/core";

export interface BrowserGameIOOptions {
  outputEl: HTMLElement;
  inputEl: HTMLInputElement;
  formEl: HTMLFormElement;
  promptEl: HTMLElement;
  inputRowEl: HTMLElement;
  onBeforeReadline?: () => void;
}

/**
 * Browser-side GameIO. Print appends text nodes to the output region; readline
 * resolves on form submit (or with null when host.cancel() is called, which the
 * package treats as EOF).
 */
export class BrowserGameIO implements GameIO {
  readonly echoInput = false;

  private cancelResolver: ((value: string | null) => void) | null = null;
  private lastPrompt = "";

  constructor(private readonly opts: BrowserGameIOOptions) {}

  print(msg: string): void {
    this.opts.outputEl.appendChild(document.createTextNode(msg));
    this.scrollIntoView();
  }

  async readline(prompt: string): Promise<string | null> {
    this.opts.onBeforeReadline?.();
    this.lastPrompt = prompt;
    this.opts.promptEl.textContent = prompt;
    this.opts.inputRowEl.hidden = false;
    this.opts.inputEl.focus();
    this.scrollIntoView();

    return new Promise<string | null>((resolve) => {
      const onSubmit = (e: SubmitEvent) => {
        e.preventDefault();
        cleanup();
        const value = this.opts.inputEl.value;
        this.opts.inputEl.value = "";
        this.opts.inputRowEl.hidden = true;
        this.appendTranscript(prompt, value);
        this.scrollIntoView();
        resolve(value);
      };
      const cleanup = () => {
        this.opts.formEl.removeEventListener("submit", onSubmit);
        this.cancelResolver = null;
      };
      this.cancelResolver = (val) => {
        cleanup();
        resolve(val);
      };
      this.opts.formEl.addEventListener("submit", onSubmit);
    });
  }

  /** Resolve any pending readline with null (EOF). Used on navigation away. */
  cancel(): void {
    this.cancelResolver?.(null);
  }

  /** The package's SAVE flow prompts "\nFile name: " — exit-reason hint. */
  getLastPrompt(): string {
    return this.lastPrompt;
  }

  /** Wipe transcript and reset state. Called when starting/resuming a game. */
  reset(): void {
    this.opts.outputEl.replaceChildren();
    this.opts.inputEl.value = "";
    this.opts.inputRowEl.hidden = true;
    this.lastPrompt = "";
  }

  private appendTranscript(prompt: string, value: string): void {
    const line = document.createElement("div");
    line.className = "adv-transcript-line";
    const promptSpan = document.createElement("span");
    promptSpan.setAttribute("aria-hidden", "true");
    promptSpan.textContent = prompt;
    const valueSpan = document.createElement("span");
    valueSpan.className = "adv-transcript-input";
    valueSpan.textContent = value;
    line.appendChild(promptSpan);
    line.appendChild(valueSpan);
    this.opts.outputEl.appendChild(line);
  }

  private scrollIntoView(): void {
    requestAnimationFrame(() => {
      this.opts.inputRowEl.scrollIntoView({ block: "nearest" });
    });
  }
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/adventure/io.ts
git commit -m "Add BrowserGameIO for the adventure terminal"
```

---

## Task 5: `AdventureHost` orchestrator (`host.ts`)

**Files:**

- Create: `src/lib/adventure/host.ts`

The host owns one game session at a time. It calls `runGame()`, registers navigation handlers (so the game autosaves and cancels cleanly when the player leaves), and classifies the exit reason for the launcher.

- [ ] **Step 1: Create the file**

```ts
// src/lib/adventure/host.ts
import { runGame, createGameState, serializeGame, type GameState } from "@open-adventure/core";
import type { BrowserGameIO } from "./io.js";
import type { LocalStorageSaveStorage } from "./storage.js";

export type ExitReason = "save" | "terminal" | "cancelled" | "error";

export interface AdventureHostOptions {
  io: BrowserGameIO;
  storage: LocalStorageSaveStorage;
  onExit: (reason: ExitReason, error?: Error) => void;
}

/** The package's SAVE flow prompts exactly this string before terminating. */
const SAVE_FILE_PROMPT = "\nFile name: ";

interface NavHandler {
  target: EventTarget;
  type: string;
  fn: EventListener;
}

export class AdventureHost {
  private state: GameState | null = null;
  private active = false;
  private cancelled = false;
  private navHandlers: NavHandler[] = [];

  constructor(private readonly opts: AdventureHostOptions) {}

  isActive(): boolean {
    return this.active;
  }

  async startNew(): Promise<void> {
    await this.run();
  }

  async resume(name: string): Promise<void> {
    const data = await this.opts.storage.read(name);
    if (data === null) {
      throw new Error(`Save '${name}' not found.`);
    }
    await this.run(data);
  }

  async resumeAutosave(): Promise<void> {
    const data = this.opts.storage.readAutosave();
    if (data === null) {
      throw new Error("No autosave to resume.");
    }
    await this.run(data);
  }

  /** Snapshot current state to autosave. Safe to call during a game or not. */
  snapshotAutosave(): void {
    if (this.state === null) return;
    try {
      this.opts.storage.writeAutosave(serializeGame(this.state));
    } catch {
      // Best-effort; never disrupt.
    }
  }

  /**
   * Cancel the running game. Snapshots autosave, then resolves the pending
   * readline with null so the package terminates cleanly.
   */
  cancel(): void {
    if (!this.active) return;
    this.cancelled = true;
    this.snapshotAutosave();
    this.opts.io.cancel();
  }

  private async run(initialSave?: string): Promise<void> {
    this.opts.io.reset();
    this.state = createGameState();
    this.active = true;
    this.cancelled = false;
    this.registerNavHandlers();

    let error: Error | undefined;
    try {
      await runGame({
        io: this.opts.io,
        storage: this.opts.storage,
        state: this.state,
        ...(initialSave !== undefined ? { initialSave } : {}),
      });
    } catch (e) {
      // runGame catches TerminateError internally and resolves with the exit
      // code. Anything that escapes is a real error from the engine.
      error = e instanceof Error ? e : new Error(String(e));
    } finally {
      this.unregisterNavHandlers();
      const reason = this.classifyExit(error);
      this.active = false;
      this.state = null;
      this.opts.onExit(reason, error);
    }
  }

  private classifyExit(error: Error | undefined): ExitReason {
    if (this.cancelled) return "cancelled";
    if (error !== undefined) return "error";
    if (this.opts.io.getLastPrompt() === SAVE_FILE_PROMPT) return "save";
    return "terminal";
  }

  private registerNavHandlers(): void {
    const onLeave: EventListener = () => this.cancel();
    this.addHandler(document, "astro:before-preparation", onLeave);
    this.addHandler(window, "pagehide", onLeave);
  }

  private addHandler(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.navHandlers.push({ target, type, fn });
  }

  private unregisterNavHandlers(): void {
    for (const h of this.navHandlers) {
      h.target.removeEventListener(h.type, h.fn);
    }
    this.navHandlers = [];
  }
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/adventure/host.ts
git commit -m "Add AdventureHost orchestrator with autosave-on-navigation"
```

---

## Task 6: Launcher static markup (`AdventureLauncher.astro`)

**Files:**

- Create: `src/components/AdventureLauncher.astro`

Static markup, fully styled. JS only injects `<tr>` rows and toggles visibility. Element IDs are stable so `launcher.ts` can find them. Includes the empty-state and storage-unavailable banner up-front (both `hidden` by default).

- [ ] **Step 1: Create the file**

```astro
---
// src/components/AdventureLauncher.astro
---

<section id="adventure-launcher" class="adv-launcher" aria-labelledby="adv-launcher-h1">
  <h1 id="adv-launcher-h1">Adventure</h1>
  <p class="adv-intro">
    A browser port of <em>Colossal Cave Adventure</em> — Crowther &amp; Woods's 1977 text adventure, the
    original of its kind. Runs entirely in your browser; saves stay on this device.
  </p>

  <div id="adv-storage-banner" class="adv-banner" hidden>
    Your browser blocks local storage; saves won't persist this session.
  </div>

  <button id="adv-start-new" class="adv-cta" type="button">Start new game</button>

  <section id="adv-saves-section" class="adv-saves" aria-labelledby="adv-saves-h2" hidden>
    <h2 id="adv-saves-h2">Saved games</h2>
    <table class="adv-saves-table">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Score</th>
          <th scope="col">Location</th>
          <th scope="col">Saved</th>
          <th scope="col"><span class="adv-sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody id="adv-saves-tbody"></tbody>
    </table>
  </section>

  <p id="adv-saves-empty" class="adv-saves-empty">No saved games yet.</p>
</section>

<style>
  .adv-launcher {
    max-width: var(--reading-width);
    margin: 0 auto;
    padding: var(--sp-8) var(--sp-6) var(--sp-12);
  }
  .adv-launcher h1 {
    margin: 0 0 var(--sp-2);
    line-height: var(--lh-heading);
  }
  .adv-intro {
    color: var(--fg-muted);
    margin: 0 0 var(--sp-6);
    line-height: var(--lh-body);
  }
  .adv-banner {
    background: var(--accent-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    padding: var(--sp-3) var(--sp-4);
    margin: 0 0 var(--sp-5);
    font-size: var(--fs-sm);
  }
  .adv-cta {
    background: var(--fg);
    color: var(--bg);
    border: 1px solid var(--fg);
    padding: var(--sp-3) var(--sp-5);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .adv-cta:hover {
    background: var(--accent);
    border-color: var(--accent);
  }
  .adv-cta:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .adv-saves {
    margin-top: var(--sp-10);
  }
  .adv-saves h2 {
    font-size: var(--fs-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-muted);
    font-weight: 600;
    margin: 0 0 var(--sp-3);
  }
  .adv-saves-empty {
    margin-top: var(--sp-10);
    color: var(--fg-muted);
    font-size: var(--fs-sm);
  }

  .adv-saves-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }
  .adv-saves-table thead th {
    text-align: left;
    font-weight: 500;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-muted);
    border-bottom: 1px solid var(--border);
    padding: var(--sp-2) var(--sp-3) var(--sp-2) 0;
  }
  .adv-saves-table thead th:last-child {
    text-align: right;
    padding-right: 0;
  }
  .adv-saves-table tbody td {
    padding: var(--sp-3) var(--sp-3) var(--sp-3) 0;
    border-bottom: 1px solid var(--border);
    vertical-align: baseline;
  }
  .adv-saves-table tbody td:last-child {
    padding-right: 0;
    text-align: right;
    white-space: nowrap;
  }
  .adv-saves-table .name {
    font-weight: 600;
  }
  .adv-saves-table .score {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .adv-saves-table .when {
    color: var(--fg-muted);
    font-size: 0.82rem;
    white-space: nowrap;
  }
  .adv-saves-table .actions button {
    margin-left: var(--sp-3);
    color: var(--fg);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
  }
  .adv-saves-table .actions button:first-child {
    margin-left: 0;
  }
  .adv-saves-table .actions button.danger {
    color: var(--accent);
  }
  .adv-saves-table .actions button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .adv-saves-table tr.autosave .name {
    font-style: italic;
    color: var(--fg-muted);
    font-weight: 500;
  }
  .adv-saves-table tr.incompat .name {
    color: var(--fg-muted);
    text-decoration: line-through;
  }
  .adv-saves-table tr.incompat .loc {
    color: var(--fg-muted);
  }

  .adv-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Phone breakpoint — collapse each row to a 3-line grid that maps the
     existing <td> cells (.name, .score, .loc, .when, .actions) into named
     areas. No row-builder changes needed; the same DOM renders both ways. */
  @media (max-width: 600px) {
    .adv-saves-table {
      display: block;
    }
    .adv-saves-table thead {
      display: none;
    }
    .adv-saves-table tbody {
      display: block;
    }
    .adv-saves-table tbody tr {
      display: grid;
      grid-template-columns: auto 1fr auto;
      grid-template-areas:
        "name name when"
        "score loc loc"
        "actions actions actions";
      column-gap: var(--sp-3);
      row-gap: var(--sp-1);
      padding: var(--sp-3) 0;
      border-bottom: 1px solid var(--border);
    }
    .adv-saves-table tbody td {
      padding: 0;
      border: 0;
    }
    .adv-saves-table tbody td.name {
      grid-area: name;
    }
    .adv-saves-table tbody td.when {
      grid-area: when;
      text-align: right;
      font-size: 0.82rem;
    }
    .adv-saves-table tbody td.score {
      grid-area: score;
      font-size: 0.82rem;
    }
    .adv-saves-table tbody td.loc {
      grid-area: loc;
      font-size: 0.82rem;
      color: var(--fg-muted);
    }
    .adv-saves-table tbody td.actions {
      grid-area: actions;
      text-align: left;
      margin-top: var(--sp-2);
    }
  }
</style>
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdventureLauncher.astro
git commit -m "Add AdventureLauncher static markup and styles"
```

---

## Task 7: Terminal static markup (`AdventureTerminal.astro`)

**Files:**

- Create: `src/components/AdventureTerminal.astro`

The terminal is hidden by default. Output region uses `role="log" aria-live="polite"` so screen readers announce each `print()` call. Input has all autocorrect/autocapitalize/spellcheck disabled — text adventures fight these viciously. Post-game action bar and error panel both live in the markup, hidden until needed.

- [ ] **Step 1: Create the file**

```astro
---
// src/components/AdventureTerminal.astro
---

<section id="adventure-terminal" class="adv-terminal" hidden aria-labelledby="adv-terminal-heading">
  <h1 id="adv-terminal-heading" class="adv-sr-only">Adventure — game in progress</h1>

  <div id="adv-output" class="adv-output" role="log" aria-live="polite"></div>

  <form id="adv-input-row" class="adv-input-row" hidden autocomplete="off">
    <span id="adv-prompt" class="adv-prompt" aria-hidden="true">&gt; </span>
    <input
      id="adv-input"
      class="adv-input"
      type="text"
      autocapitalize="off"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      inputmode="text"
      aria-label="Game input"
    />
  </form>

  <div id="adv-post-game" class="adv-post-game" hidden>
    <button id="adv-back-to-launcher" type="button">Back to launcher</button>
    <button id="adv-new-game" type="button">New game</button>
  </div>

  <div id="adv-error-panel" class="adv-error-panel" hidden role="alert">
    <p>The game crashed. Your last session is saved.</p>
    <details>
      <summary>Details</summary>
      <pre id="adv-error-message"></pre>
    </details>
    <button id="adv-error-back" type="button">Back to launcher</button>
  </div>
</section>

<style>
  .adv-terminal {
    max-width: var(--reading-width);
    margin: 0 auto;
    padding: var(--sp-6);
    font-family: var(--font-mono);
    font-size: 1rem;
    line-height: var(--lh-body);
    color: var(--fg);
    background: var(--bg);
  }
  .adv-output,
  .adv-input-row {
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .adv-output {
    /* Each print() call appends a text node; transcript lines are <div>s. */
  }
  .adv-input-row {
    display: flex;
    align-items: baseline;
    gap: 0;
    margin: 0;
  }
  .adv-prompt {
    color: var(--fg-muted);
    user-select: none;
    flex-shrink: 0;
    white-space: pre;
  }
  .adv-input {
    flex: 1;
    background: transparent;
    border: 0;
    color: var(--fg);
    font: inherit;
    padding: 0;
    outline: none;
    caret-color: var(--fg);
    min-width: 0;
  }
  .adv-input:focus {
    outline: none;
  }

  .adv-output .adv-transcript-line {
    /* Player's submitted line — visually identical to package output. */
    color: var(--fg);
  }
  .adv-output .adv-transcript-input {
    /* Slight italic to distinguish player input from package output without
       making it stand out. */
    font-style: italic;
  }

  .adv-post-game,
  .adv-error-panel {
    margin-top: var(--sp-6);
    padding-top: var(--sp-4);
    border-top: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
    align-items: center;
  }
  .adv-error-panel {
    flex-direction: column;
    align-items: flex-start;
  }
  .adv-error-panel pre {
    background: var(--btn-bg);
    padding: var(--sp-3);
    overflow-x: auto;
    max-width: 100%;
    font-size: var(--fs-sm);
  }
  .adv-post-game button,
  .adv-error-panel button {
    background: var(--btn-bg);
    border: 1px solid var(--border-ui);
    color: var(--fg);
    padding: var(--sp-2) var(--sp-4);
    font: inherit;
    cursor: pointer;
  }
  .adv-post-game button:hover,
  .adv-error-panel button:hover {
    background: var(--border);
  }
  .adv-post-game button:focus-visible,
  .adv-error-panel button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .adv-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdventureTerminal.astro
git commit -m "Add AdventureTerminal static markup and styles"
```

---

## Task 8: Launcher logic (`launcher.ts`)

**Files:**

- Create: `src/lib/adventure/launcher.ts`

Bootstraps the launcher on page load: collects DOM references, instantiates storage / IO / host, renders the saves table, wires button handlers, mounts/unmounts the terminal in response to host exit reasons.

- [ ] **Step 1: Create the file**

```ts
// src/lib/adventure/launcher.ts
import { summarizeSave, type SaveSummary } from "@open-adventure/core";
import {
  AUTOSAVE_DISPLAY_NAME,
  LocalStorageSaveStorage,
  isStorageAvailable,
  type SaveMeta,
} from "./storage.js";
import { BrowserGameIO } from "./io.js";
import { AdventureHost, type ExitReason } from "./host.js";
import { formatRelativeTime, formatScore } from "./format.js";

interface DOM {
  launcherEl: HTMLElement;
  terminalEl: HTMLElement;
  startBtn: HTMLButtonElement;
  savesSection: HTMLElement;
  savesEmpty: HTMLElement;
  savesTbody: HTMLElement;
  storageBanner: HTMLElement;
  outputEl: HTMLElement;
  inputEl: HTMLInputElement;
  formEl: HTMLFormElement;
  promptEl: HTMLElement;
  inputRowEl: HTMLElement;
  postGame: HTMLElement;
  backToLauncherBtn: HTMLButtonElement;
  newGameBtn: HTMLButtonElement;
  errorPanel: HTMLElement;
  errorMessage: HTMLElement;
  errorBackBtn: HTMLButtonElement;
}

let bootstrappedFor: HTMLElement | null = null;

/**
 * Bootstrap on every astro:page-load that lands on the adventure page.
 * Idempotent: if the launcher root has not changed since last bootstrap
 * (i.e., we're being called for a different page), bail.
 */
export function bootstrap(): void {
  const dom = collectDOM();
  if (dom === null) {
    bootstrappedFor = null;
    return;
  }
  if (bootstrappedFor === dom.launcherEl) return;
  bootstrappedFor = dom.launcherEl;

  const storage = new LocalStorageSaveStorage();

  const host = new AdventureHost({
    io: undefined as unknown as BrowserGameIO, // patched below
    storage,
    onExit: (reason, error) => onExit(dom, reason, error, storage, host),
  });

  const io = new BrowserGameIO({
    outputEl: dom.outputEl,
    inputEl: dom.inputEl,
    formEl: dom.formEl,
    promptEl: dom.promptEl,
    inputRowEl: dom.inputRowEl,
    onBeforeReadline: () => host.snapshotAutosave(),
  });
  // Inject IO post-construction so io and host can reference each other.
  (host as unknown as { opts: { io: BrowserGameIO } }).opts.io = io;

  if (!isStorageAvailable()) {
    dom.storageBanner.hidden = false;
  }

  dom.startBtn.addEventListener("click", () => {
    showTerminal(dom);
    void host.startNew();
  });
  dom.backToLauncherBtn.addEventListener("click", () => {
    showLauncher(dom, storage);
    dom.startBtn.focus();
  });
  dom.newGameBtn.addEventListener("click", () => {
    hidePostGame(dom);
    void host.startNew();
  });
  dom.errorBackBtn.addEventListener("click", () => {
    showLauncher(dom, storage);
    dom.startBtn.focus();
  });

  // Click anywhere in the output region focuses the input — prevents iOS
  // taps from trapping the user without a way to summon the keyboard.
  dom.outputEl.addEventListener("click", () => {
    if (!dom.inputRowEl.hidden) dom.inputEl.focus();
  });

  void renderSaves(dom, storage, host);
}

function collectDOM(): DOM | null {
  const $ = <T extends HTMLElement>(id: string): T | null =>
    document.getElementById(id) as T | null;
  const launcherEl = $("adventure-launcher");
  const terminalEl = $("adventure-terminal");
  const startBtn = $<HTMLButtonElement>("adv-start-new");
  const savesSection = $("adv-saves-section");
  const savesEmpty = $("adv-saves-empty");
  const savesTbody = $("adv-saves-tbody");
  const storageBanner = $("adv-storage-banner");
  const outputEl = $("adv-output");
  const inputEl = $<HTMLInputElement>("adv-input");
  const formEl = document.getElementById("adv-input-row") as HTMLFormElement | null;
  const promptEl = $("adv-prompt");
  const inputRowEl = $("adv-input-row");
  const postGame = $("adv-post-game");
  const backToLauncherBtn = $<HTMLButtonElement>("adv-back-to-launcher");
  const newGameBtn = $<HTMLButtonElement>("adv-new-game");
  const errorPanel = $("adv-error-panel");
  const errorMessage = $("adv-error-message");
  const errorBackBtn = $<HTMLButtonElement>("adv-error-back");

  if (
    !launcherEl ||
    !terminalEl ||
    !startBtn ||
    !savesSection ||
    !savesEmpty ||
    !savesTbody ||
    !storageBanner ||
    !outputEl ||
    !inputEl ||
    !formEl ||
    !promptEl ||
    !inputRowEl ||
    !postGame ||
    !backToLauncherBtn ||
    !newGameBtn ||
    !errorPanel ||
    !errorMessage ||
    !errorBackBtn
  ) {
    return null;
  }
  return {
    launcherEl,
    terminalEl,
    startBtn,
    savesSection,
    savesEmpty,
    savesTbody,
    storageBanner,
    outputEl,
    inputEl,
    formEl,
    promptEl,
    inputRowEl,
    postGame,
    backToLauncherBtn,
    newGameBtn,
    errorPanel,
    errorMessage,
    errorBackBtn,
  };
}

function showTerminal(dom: DOM): void {
  dom.launcherEl.hidden = true;
  dom.terminalEl.hidden = false;
  dom.postGame.hidden = true;
  dom.errorPanel.hidden = true;
}

function showLauncher(dom: DOM, storage: LocalStorageSaveStorage): void {
  dom.terminalEl.hidden = true;
  dom.launcherEl.hidden = false;
  dom.postGame.hidden = true;
  dom.errorPanel.hidden = true;
  void renderSaves(dom, storage, null);
}

function hidePostGame(dom: DOM): void {
  dom.postGame.hidden = true;
  dom.errorPanel.hidden = true;
}

function showPostGame(dom: DOM): void {
  dom.postGame.hidden = false;
  dom.backToLauncherBtn.focus();
}

function showError(dom: DOM, message: string): void {
  dom.errorMessage.textContent = message;
  dom.errorPanel.hidden = false;
  dom.errorBackBtn.focus();
}

function onExit(
  dom: DOM,
  reason: ExitReason,
  error: Error | undefined,
  storage: LocalStorageSaveStorage,
  _host: AdventureHost,
): void {
  switch (reason) {
    case "save":
      showLauncher(dom, storage);
      break;
    case "terminal":
      showPostGame(dom);
      break;
    case "error":
      showError(dom, error?.message ?? "Unknown error.");
      break;
    case "cancelled":
      // Page is leaving; nothing to render.
      break;
  }
}

async function renderSaves(
  dom: DOM,
  storage: LocalStorageSaveStorage,
  _host: AdventureHost | null,
): Promise<void> {
  dom.savesTbody.replaceChildren();
  let count = 0;

  // Autosave row (if present).
  const autosaveData = storage.readAutosave();
  if (autosaveData !== null) {
    const summary = summarizeSave(autosaveData);
    const meta = storage.readAutosaveMeta();
    const savedAt = meta?.savedAt ?? Date.now();
    if (isError(summary) || !summary.compatible) {
      // Even a stale/incompatible autosave deserves a Clear option.
      dom.savesTbody.appendChild(
        buildAutosaveCorruptRow(savedAt, () => {
          if (window.confirm("Clear last session? You won't be able to resume it.")) {
            storage.clearAutosave();
            void renderSaves(dom, storage, null);
          }
        }),
      );
    } else {
      dom.savesTbody.appendChild(
        buildAutosaveRow(summary, savedAt, {
          onResume: () => {
            showTerminal(dom);
            // host is created fresh per bootstrap; resume via stored data.
            const data = storage.readAutosave();
            if (data === null) return;
            // Closure capture: the outer bootstrap created exactly one host.
            // Reach it via the document — simpler, since we don't have it here.
            dispatchAdventureCommand("resume-autosave");
          },
          onClear: () => {
            if (window.confirm("Clear last session? You won't be able to resume it.")) {
              storage.clearAutosave();
              void renderSaves(dom, storage, null);
            }
          },
        }),
      );
    }
    count++;
  }

  // User saves.
  const names = await storage.list();
  names.sort((a, b) => a.localeCompare(b));
  for (const name of names) {
    const data = await storage.read(name);
    if (data === null) continue;
    const summary = summarizeSave(data);
    const meta = storage.readMeta(name);
    const savedAt = meta?.savedAt ?? Date.now();
    if (isError(summary)) {
      dom.savesTbody.appendChild(
        buildIncompatRow(name, savedAt, () => {
          confirmAndDelete(name, dom, storage);
        }),
      );
    } else if (!summary.compatible) {
      dom.savesTbody.appendChild(
        buildIncompatRow(name, savedAt, () => {
          confirmAndDelete(name, dom, storage);
        }),
      );
    } else {
      dom.savesTbody.appendChild(
        buildSaveRow(name, summary, savedAt, {
          onResume: () => {
            showTerminal(dom);
            dispatchAdventureCommand("resume", name);
          },
          onDelete: () => confirmAndDelete(name, dom, storage),
        }),
      );
    }
    count++;
  }

  dom.savesSection.hidden = count === 0;
  dom.savesEmpty.hidden = count !== 0;
}

function confirmAndDelete(name: string, dom: DOM, storage: LocalStorageSaveStorage): void {
  if (!window.confirm(`Delete '${name}'? This cannot be undone.`)) return;
  void storage.delete(name).then(() => renderSaves(dom, storage, null));
}

function isError<T>(value: T | { error: string }): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

interface RowActions {
  onResume?: () => void;
  onClear?: () => void;
  onDelete?: () => void;
}

function buildSaveRow(
  name: string,
  summary: SaveSummary,
  savedAt: number,
  actions: RowActions,
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.appendChild(td("name", name));
  tr.appendChild(td("score", formatScore(summary.score, summary.maxScore)));
  tr.appendChild(td("loc", summary.locationName));
  tr.appendChild(td("when", formatRelativeTime(savedAt)));
  const actionsTd = td("actions", "");
  if (actions.onResume) actionsTd.appendChild(linkButton("Resume", actions.onResume));
  if (actions.onDelete) actionsTd.appendChild(linkButton("Delete", actions.onDelete, true));
  tr.appendChild(actionsTd);
  return tr;
}

function buildAutosaveRow(
  summary: SaveSummary,
  savedAt: number,
  actions: RowActions,
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.classList.add("autosave");
  tr.appendChild(td("name", AUTOSAVE_DISPLAY_NAME));
  tr.appendChild(td("score", formatScore(summary.score, summary.maxScore)));
  tr.appendChild(td("loc", summary.locationName));
  tr.appendChild(td("when", formatRelativeTime(savedAt)));
  const actionsTd = td("actions", "");
  if (actions.onResume) actionsTd.appendChild(linkButton("Resume", actions.onResume));
  if (actions.onClear) actionsTd.appendChild(linkButton("Clear", actions.onClear, true));
  tr.appendChild(actionsTd);
  return tr;
}

function buildAutosaveCorruptRow(savedAt: number, onClear: () => void): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.classList.add("autosave", "incompat");
  tr.appendChild(td("name", AUTOSAVE_DISPLAY_NAME));
  tr.appendChild(td("score", "—"));
  tr.appendChild(td("loc", "Save format outdated"));
  tr.appendChild(td("when", formatRelativeTime(savedAt)));
  const actionsTd = td("actions", "");
  actionsTd.appendChild(linkButton("Clear", onClear, true));
  tr.appendChild(actionsTd);
  return tr;
}

function buildIncompatRow(
  name: string,
  savedAt: number,
  onDelete: () => void,
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.classList.add("incompat");
  tr.appendChild(td("name", name));
  tr.appendChild(td("score", "—"));
  tr.appendChild(td("loc", "Save format outdated"));
  tr.appendChild(td("when", formatRelativeTime(savedAt)));
  const actionsTd = td("actions", "");
  actionsTd.appendChild(linkButton("Delete", onDelete, true));
  tr.appendChild(actionsTd);
  return tr;
}

function td(className: string, text: string): HTMLTableCellElement {
  const c = document.createElement("td");
  c.className = className;
  c.textContent = text;
  return c;
}

function linkButton(
  label: string,
  onClick: () => void,
  danger: boolean = false,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  if (danger) b.classList.add("danger");
  b.addEventListener("click", onClick);
  return b;
}

/**
 * Resume actions need access to the host instance, but the DOM-row callbacks
 * don't have it in scope. Dispatch an event the bootstrap-level closure listens
 * for; that closure has both the host and the DOM.
 */
function dispatchAdventureCommand(command: "resume" | "resume-autosave", arg?: string): void {
  document.dispatchEvent(new CustomEvent("adventure:command", { detail: { command, arg } }));
}
```

The host wiring above uses one private hack (`(host as unknown as ...).opts.io`) and an `adventure:command` custom event for row → host plumbing. Both are deliberate compromises to keep `host.ts` and `launcher.ts` decoupled. We tighten this in Step 2.

- [ ] **Step 2: Refactor host wiring to remove the cast and the custom event**

Replace the wiring block in `bootstrap()` with proper construction order. Update `host.ts` to accept IO via a setter or move construction order so IO is available first.

Cleaner approach: build IO first, then host (host already takes IO in its options). The previous draft required IO's `onBeforeReadline` to call `host.snapshotAutosave`, which made it look circular — but `onBeforeReadline` runs lazily, so we can capture `host` in a closure.

```ts
// In src/lib/adventure/launcher.ts — replace the construction block:

const storage = new LocalStorageSaveStorage();

// Forward declaration via a holder; the closure reads .ref at call time.
const hostRef: { current: AdventureHost | null } = { current: null };

const io = new BrowserGameIO({
  outputEl: dom.outputEl,
  inputEl: dom.inputEl,
  formEl: dom.formEl,
  promptEl: dom.promptEl,
  inputRowEl: dom.inputRowEl,
  onBeforeReadline: () => hostRef.current?.snapshotAutosave(),
});

const host = new AdventureHost({
  io,
  storage,
  onExit: (reason, error) => onExit(dom, reason, error, storage),
});
hostRef.current = host;
```

And replace the `dispatchAdventureCommand` mechanism with direct closures that capture `host`. Pass `host` into `renderSaves` and into the row builders' `onResume` handlers. Remove the custom-event indirection entirely.

Update `renderSaves` signature to accept the host:

```ts
async function renderSaves(
  dom: DOM,
  storage: LocalStorageSaveStorage,
  host: AdventureHost,
): Promise<void> {
  // ... in the autosave row's onResume:
  onResume: () => {
    showTerminal(dom);
    void host.resumeAutosave();
  },
  // ... in the user-save row's onResume:
  onResume: () => {
    showTerminal(dom);
    void host.resume(name);
  },
```

Update the `onExit` "save" branch to re-render saves: `showLauncher(dom, storage, host)`. Add `host` to `showLauncher` signature.

Final `bootstrap` call: `void renderSaves(dom, storage, host);`

Delete the `dispatchAdventureCommand` function and its usages.

- [ ] **Step 3: Type-check and lint**

Run: `npm run check`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/adventure/launcher.ts
git commit -m "Add adventure launcher logic with save list rendering"
```

---

## Task 9: Adventure page (`/adventure/index.astro`)

**Files:**

- Create: `src/pages/adventure/index.astro`

The page imports both components, embeds a client-side `<script>` that calls `bootstrap()` on every `astro:page-load` (mirrors `ThemeToggle.astro`'s pattern for ClientRouter survival), and uses `BaseLayout`.

- [ ] **Step 1: Create the file**

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import AdventureLauncher from "../../components/AdventureLauncher.astro";
import AdventureTerminal from "../../components/AdventureTerminal.astro";
---

<BaseLayout
  title="Adventure"
  description="Play Colossal Cave Adventure in your browser. Saves stay on your device."
>
  <main id="main">
    <AdventureLauncher />
    <AdventureTerminal />
  </main>
</BaseLayout>

<script>
  import { bootstrap } from "../../lib/adventure/launcher";

  // ClientRouter swaps body content without reloading the document. Re-run
  // bootstrap on every page-load so navigating into /adventure/ reinitializes
  // (mirrors ThemeToggle.astro). Bootstrap is idempotent — safe to call twice.
  document.addEventListener("astro:page-load", () => {
    bootstrap();
  });
</script>
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Manual smoke check (dev server)**

Run: `npm run dev` (in another terminal). Visit `http://localhost:4321/adventure/`.

Checks:

- Launcher renders with H1 "Adventure", intro paragraph, "Start new game" button.
- "No saved games yet." message appears.
- Click "Start new game" — terminal appears; the package's welcome flow runs ("Welcome to Adventure!! …", asks if you want instructions).
- Type `n` (no) and Enter — game proceeds to "You are standing at the end of a road…".
- Type `quit` and confirm — post-game action bar appears with **Back to launcher** and **New game**.
- Click **Back to launcher** — returns to launcher view.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/adventure/index.astro
git commit -m "Add /adventure/ page wiring launcher and terminal"
```

---

## Task 10: Footer link

**Files:**

- Modify: `src/components/SiteFooter.astro:11-16` (the secondary nav `<ul>`)

- [ ] **Step 1: Add the Adventure entry before Toolkit**

Replace the secondary-nav `<ul>` block in `src/components/SiteFooter.astro`:

```astro
<ul>
  <li><a href="/adventure/">Adventure</a></li>
  <li><a href="/uses/">Toolkit</a></li>
  <li><a href="/reading/">Reading</a></li>
  <li><ExternalLink href="https://github.com/gtritchie" rel="me">GitHub</ExternalLink></li>
  <li><a href="mailto:kitty.dwell3q@icloud.com">Email</a></li>
</ul>
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`. Visit `http://localhost:4321/`. Confirm the footer shows **Adventure | Toolkit | Reading | GitHub | Email** in that order. Click **Adventure** — lands at `/adventure/`. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/SiteFooter.astro
git commit -m "Add Adventure link to site footer"
```

---

## Task 11: Full verification

This task runs the project's CI gates locally and walks the manual checklist from the spec.

- [ ] **Step 1: Build and type-check**

Run: `npm run check`
Expected: zero errors, zero warnings.

- [ ] **Step 2: Build production output**

Run: `npm run build`
Expected: builds to `dist/client/`. No errors.

- [ ] **Step 3: Inspect Adventure-page bundle size**

Run:

```bash
ls -lhS dist/client/_astro/*.js | head -20
```

Identify the chunk(s) loaded by `/adventure/` (Astro names them after the page script — look for files referenced by `dist/client/adventure/index.html`):

```bash
grep -oE 'src="[^"]*\.js"' dist/client/adventure/index.html
```

For each chunk, check gzipped size:

```bash
gzip -c dist/client/_astro/<chunk>.js | wc -c
```

Sum the chunks. Expected: under 65 KB total gzipped. The bulk is the engine itself (~55 KB gzipped) — Adventure's full dungeon, vocabulary, hints, and message strings don't tree-shake away. If the total goes well over 65 KB, the likely culprit is a non-side-effect-free import pulling in extra code, not the engine getting fatter.

- [ ] **Step 4: Link check**

Run: `npm run link-check`
Expected: passes. Verifies the new footer link resolves and the `/adventure/` page itself.

- [ ] **Step 5: Pa11y (AAA accessibility)**

Open two terminals.

Terminal A: `npm run preview:astro`
Terminal B (after Terminal A reports it's serving): `npm run pa11y`

Expected: passes. `/adventure/` should be among the audited URLs (visible in pa11y output).

Stop the preview server (`Ctrl-C` in Terminal A).

- [ ] **Step 6: Manual smoke test — golden path**

Run `npm run dev`. Walk these steps in order, verifying each:

1. Footer on every page shows **Adventure | Toolkit | Reading | GitHub | Email** in that order.
2. `/adventure/` shows H1 + intro + "Start new game" + "No saved games yet."
3. Click **Start new game** — welcome flow runs. Answer `n` to instructions.
4. Type `enter`, `take keys`, `take lamp` — game responds normally.
5. Type `save`. At "File name:" prompt, type `golden`. Game returns to launcher silently. New row "golden" with score (e.g., "32 / 430"), location "Inside building", "Just now".
6. Click **Resume** on the golden row. Game resumes inside the building, lamp + keys still in inventory.
7. Click footer **Reading** mid-game. Navigate back to **Adventure** — `[Last session]` row appears at the top of the saves list.
8. Click **Resume** on `[Last session]` — game resumes from the autosave point.
9. Click **Clear** on `[Last session]` — confirm dialog appears; click OK; row disappears.
10. Click **Delete** on the `golden` row — confirm dialog appears; click OK; row disappears.
11. Click **Start new game**. Type `quit`, then `y` to confirm. Post-game action bar appears with **Back to launcher** and **New game**. Final score visible above.
12. Click **New game** — fresh welcome flow. Click **Back to launcher** at this point won't work mid-flow, but the next QUIT will surface the action bar; click **Back to launcher** there. Lands on launcher.
13. Refresh the page. Launcher renders correctly.

Stop the dev server.

- [ ] **Step 7: Manual smoke test — theme toggle and mobile**

Run `npm run dev`. In the browser:

1. Start a new game; reach the well-house. Click the theme toggle in the header. Verify the game view's colors swap. Verify the input still has focus and accepts input.
2. Open DevTools → device emulation → set viewport to 375 × 667 (iPhone SE). Visit `/adventure/`. Saves table should collapse: each save renders as a stacked row (name + when on top, score + location below, actions at bottom). No horizontal scroll.
3. Tap the **Start new game** button. Game view appears. Tap into the input field; Safari/Chrome shows a virtual keyboard. The input row scrolls into view above the keyboard.

Stop the dev server.

- [ ] **Step 8: Manual smoke test — error paths**

Run `npm run dev`. Open DevTools console.

1. **Quota error.** Fill localStorage:
   ```js
   try {
     for (let i = 0; i < 10000; i++) {
       localStorage.setItem("__pad__" + i, "x".repeat(10000));
     }
   } catch {}
   ```
   Then start a new game and try to `save` with a name. The package's "Can't open file …, try again." message should appear. Type a different name — same. Cancel out (Ctrl-D / Cmd-D won't help; just QUIT).
   Clean up: `for (let i = 0; i < 10000; i++) localStorage.removeItem("__pad__" + i);`
2. **Synthetic incompatible save.** Create a save with a wrong version:
   ```js
   localStorage.setItem(
     "adventure:save:bad-version",
     JSON.stringify({
       magic: "open-adventure\n",
       canary: 2317,
       version: 1,
       game: {},
     }),
   );
   localStorage.setItem("adventure:meta:bad-version", JSON.stringify({ savedAt: Date.now() }));
   ```
   Reload `/adventure/`. The `bad-version` row renders gray, with "Save format outdated", and only a **Delete** action.
   Clean up: delete the row using its **Delete** button.
3. **Storage unavailable.** Open `/adventure/` in a private/incognito window where localStorage is partitioned. Verify the storage banner appears and "Start new game" still works.

Stop the dev server.

- [ ] **Step 9: Optional — Lighthouse**

Run `npm run lighthouse`. Expected: passes the budgets in `.lighthouserc.json`. The `url` array in `.lighthouserc.json` does not currently include `/adventure/` — that's fine (Lighthouse runs a sample of pages). If Gary wants Adventure included, add `"http://localhost/adventure/"` to that array; otherwise skip.

- [ ] **Step 10: Final commit if anything was tweaked**

If verification surfaced fixes, commit them as small follow-up commits. Otherwise no commit.

```bash
git status   # confirm clean
```

---

## Self-Review

I checked the spec against this plan with fresh eyes:

**Spec coverage check:**

- Goals (footer entry, all-client, package unmodified, autosave, AAA): tasks 10, 1–9, all use the package via its public API, host registers nav handlers (5), styles use tokens (6, 7).
- Non-goals (no multi-tab, no server, no SW, no xterm.js, no save-format changes): plan doesn't introduce any of those.
- Package consumption: task 1.
- Public package surface used: tasks 5 (runGame, createGameState, serializeGame, TerminateError), 8 (summarizeSave). All listed.
- Route and footer: tasks 9, 10.
- File layout: matches exactly.
- Component/data flow design: tasks 3 (storage), 4 (io), 5 (host), 8 (launcher).
- Save timestamps via metadata sidecar in separate namespace: task 3 implements `META_PREFIX` and the `readMeta` / `readAutosaveMeta` paths.
- Visual design (launcher density, terminal monospace, post-game bar, theme): tasks 6, 7.
- Save lifecycle table: covered across 3, 5, 8.
- Naming rules (60 chars, reject `[Last session]`): task 3 `validateName`.
- Error handling matrix: covered in 5 (non-`TerminateError` → "error" exit), 3 (quota), 8 (incompatible saves render-only).
- Lifecycle and navigation events: task 5 registers `astro:before-preparation` + `pagehide`; task 9 wires `astro:page-load`.
- Bundle and perf: task 11 step 3.
- Verification (CI + manual checklist): task 11 covers all 16 manual items from the spec.

**Placeholder scan:** No "TBD", no "implement later", no "appropriate error handling" — all code is complete. The one place the plan asks the engineer to "investigate" is task 11 step 3 if bundle size exceeds budget, which is a real fork in the road, not a placeholder.

**Type/name consistency:**

- `LocalStorageSaveStorage` used in tasks 3, 5, 8 ✓
- `BrowserGameIO` used in tasks 4, 5, 8 ✓
- `AdventureHost` exposed methods (`startNew`, `resume`, `resumeAutosave`, `cancel`, `snapshotAutosave`, `isActive`) used consistently in tasks 5, 8 ✓
- Element IDs (`adventure-launcher`, `adventure-terminal`, `adv-start-new`, `adv-saves-tbody`, …) consistent between tasks 6, 7, 8 ✓
- `AUTOSAVE_DISPLAY_NAME` defined in 3, used in 8 ✓
- `formatRelativeTime`, `formatScore` defined in 2, used in 8 ✓
- `ExitReason` union (`save`, `terminal`, `cancelled`, `error`) defined in 5, used in 8 ✓
- `astro:before-preparation` (Astro 6 ClientRouter event) used in 5 ✓

One latent issue caught and fixed inline: task 8 originally constructed the host with a placeholder cast and used a custom event to signal resume actions. Replaced with a forward-reference holder pattern (`hostRef.current`) and direct closures over `host`. The custom-event indirection was deleted.

No outstanding gaps.
