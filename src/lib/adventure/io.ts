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
 * Browser-side GameIO. Print accumulates output into a buffer; the buffer is
 * flushed as a single labeled "turn" element when the next readline begins
 * (or when the host calls flushPendingOutput at game end). Readline resolves
 * on form submit, or with null when host.cancel() is called (treated as EOF).
 *
 * Turn structure exists so screen-reader users navigating backwards through
 * the transcript can distinguish game output from their own input — each turn
 * carries a visually-hidden "Adventure says: " or "You typed: " prefix.
 */
export class BrowserGameIO implements GameIO {
  readonly echoInput = false;

  private cancelResolver: ((value: string | null) => void) | null = null;
  private lastPrompt = "";
  private outputBuffer = "";

  constructor(private readonly opts: BrowserGameIOOptions) {}

  print(msg: string): void {
    this.outputBuffer += msg;
    this.scrollIntoView();
  }

  /**
   * Flush any buffered game output as a labeled turn element. Called
   * automatically before each readline; the host also calls this in its
   * finally block so end-of-game output isn't lost.
   */
  flushPendingOutput(): void {
    if (this.outputBuffer === "") return;
    const turn = document.createElement("span");
    turn.className = "adv-turn adv-turn-game";
    const srLabel = document.createElement("span");
    srLabel.className = "adv-sr-only";
    srLabel.textContent = "Adventure says: ";
    const content = document.createElement("span");
    content.textContent = this.outputBuffer;
    turn.append(srLabel, content);
    this.opts.outputEl.appendChild(turn);
    this.outputBuffer = "";
  }

  async readline(prompt: string): Promise<string | null> {
    this.opts.onBeforeReadline?.();
    this.lastPrompt = prompt;

    // The package's SAVE/RESUME prompts use a leading "\n" (e.g.
    // "\nFile name: ") to put a blank line above the prompt — natural CLI
    // behavior. Embedded in our prompt span (white-space: pre), that newline
    // makes the span two visual lines tall and `align-items: baseline` on the
    // flex input row aligns the single-line input to the prompt's first
    // (empty) baseline, putting the input row above the visible prompt text.
    // Strip leading newlines off the visible prompt and append them to the
    // game-output buffer instead; the visible blank line is preserved and the
    // input row baseline-aligns to "File name: " correctly.
    let i = 0;
    while (i < prompt.length && prompt[i] === "\n") i++;
    const leadingNewlines = prompt.slice(0, i);
    const visiblePrompt = prompt.slice(i);
    if (leadingNewlines.length > 0) {
      this.outputBuffer += leadingNewlines;
    }
    this.flushPendingOutput();

    this.opts.promptEl.textContent = visiblePrompt;
    this.opts.inputRowEl.hidden = false;
    this.updateInputLabel(visiblePrompt);
    this.opts.inputEl.focus();
    this.scrollIntoView();

    return new Promise<string | null>((resolve) => {
      const onSubmit = (e: SubmitEvent) => {
        e.preventDefault();
        cleanup();
        const value = this.opts.inputEl.value;
        this.opts.inputEl.value = "";
        this.opts.inputRowEl.hidden = true;
        this.appendTranscript(visiblePrompt, value);
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
    // Cancel any pending readline so the previous game's submit listener and
    // promise don't leak into the new session.
    this.cancel();
    this.opts.outputEl.replaceChildren();
    this.opts.inputEl.value = "";
    this.opts.inputRowEl.hidden = true;
    this.lastPrompt = "";
    this.outputBuffer = "";
  }

  /**
   * Sync the input's accessible name to the current prompt. The ">" gameplay
   * prompt has no real label content, so fall back to "Game input"; the SAVE
   * flow's "File name:" prompt becomes the label directly.
   */
  private updateInputLabel(visiblePrompt: string): void {
    const trimmed = visiblePrompt.replace(/[\s:>]+$/, "").trim();
    this.opts.inputEl.setAttribute("aria-label", trimmed.length > 0 ? trimmed : "Game input");
  }

  private appendTranscript(prompt: string, value: string): void {
    const line = document.createElement("div");
    line.className = "adv-transcript-line adv-turn adv-turn-input";
    const srLabel = document.createElement("span");
    srLabel.className = "adv-sr-only";
    srLabel.textContent = "You typed: ";
    const promptSpan = document.createElement("span");
    promptSpan.setAttribute("aria-hidden", "true");
    promptSpan.textContent = prompt;
    const valueSpan = document.createElement("span");
    valueSpan.className = "adv-transcript-input";
    valueSpan.textContent = value;
    line.append(srLabel, promptSpan, valueSpan);
    this.opts.outputEl.appendChild(line);
  }

  private scrollIntoView(): void {
    requestAnimationFrame(() => {
      this.opts.inputRowEl.scrollIntoView({ block: "nearest" });
    });
  }
}
