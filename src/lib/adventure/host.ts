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
    if (this.active) {
      throw new Error("AdventureHost.run() called while a game is already active.");
    }
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
