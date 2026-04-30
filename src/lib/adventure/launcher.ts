// src/lib/adventure/launcher.ts
import { summarizeSave, type SaveSummary } from "@open-adventure/core";
import { AUTOSAVE_DISPLAY_NAME, LocalStorageSaveStorage, isStorageAvailable } from "./storage.js";
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
 * Idempotent: re-entering with the same launcher root is a no-op.
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

  // Forward declaration: io needs to call host.snapshotAutosave on every
  // readline, but host needs io in its options. The holder pattern keeps
  // construction linear without a post-construction patch.
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
    onExit: (reason, error) => onExit(dom, reason, error, storage, host),
  });
  hostRef.current = host;

  if (!isStorageAvailable()) {
    dom.storageBanner.hidden = false;
  }

  dom.startBtn.addEventListener("click", () => {
    showTerminal(dom);
    void host.startNew();
  });
  dom.backToLauncherBtn.addEventListener("click", () => {
    showLauncher(dom, storage, host);
    dom.startBtn.focus();
  });
  dom.newGameBtn.addEventListener("click", () => {
    showTerminal(dom);
    void host.startNew();
  });
  dom.errorBackBtn.addEventListener("click", () => {
    showLauncher(dom, storage, host);
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

function showLauncher(dom: DOM, storage: LocalStorageSaveStorage, host: AdventureHost): void {
  dom.terminalEl.hidden = true;
  dom.launcherEl.hidden = false;
  dom.postGame.hidden = true;
  dom.errorPanel.hidden = true;
  void renderSaves(dom, storage, host);
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
  host: AdventureHost,
): void {
  switch (reason) {
    case "save":
      showLauncher(dom, storage, host);
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
  host: AdventureHost,
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
            void renderSaves(dom, storage, host);
          }
        }),
      );
    } else {
      dom.savesTbody.appendChild(
        buildAutosaveRow(summary, savedAt, {
          onResume: () => {
            showTerminal(dom);
            host.resumeAutosave().catch(() => {
              showLauncher(dom, storage, host);
            });
          },
          onClear: () => {
            if (window.confirm("Clear last session? You won't be able to resume it.")) {
              storage.clearAutosave();
              void renderSaves(dom, storage, host);
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
    if (isError(summary) || !summary.compatible) {
      dom.savesTbody.appendChild(
        buildIncompatRow(name, savedAt, () => {
          confirmAndDelete(name, dom, storage, host);
        }),
      );
    } else {
      dom.savesTbody.appendChild(
        buildSaveRow(name, summary, savedAt, {
          onResume: () => {
            showTerminal(dom);
            host.resume(name).catch(() => {
              showLauncher(dom, storage, host);
            });
          },
          onDelete: () => confirmAndDelete(name, dom, storage, host),
        }),
      );
    }
    count++;
  }

  dom.savesSection.hidden = count === 0;
  dom.savesEmpty.hidden = count !== 0;
}

function confirmAndDelete(
  name: string,
  dom: DOM,
  storage: LocalStorageSaveStorage,
  host: AdventureHost,
): void {
  if (!window.confirm(`Delete '${name}'? This cannot be undone.`)) return;
  void storage.delete(name).then(() => renderSaves(dom, storage, host));
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
