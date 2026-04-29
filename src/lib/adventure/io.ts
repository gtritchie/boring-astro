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

    // The package's SAVE/RESUME prompts use a leading "\n" (e.g.
    // "\nFile name: ") to put a blank line above the prompt — natural CLI
    // behavior. Embedded in our prompt span (white-space: pre), that newline
    // makes the span two visual lines tall and `align-items: baseline` on the
    // flex input row aligns the single-line input to the prompt's first
    // (empty) baseline, putting the input row above the visible prompt text.
    // Strip leading newlines off the visible prompt and emit them as their
    // own text node in the output region; the transcript still shows the
    // blank line, and the input row baseline-aligns to "File name: " correctly.
    let i = 0;
    while (i < prompt.length && prompt[i] === "\n") i++;
    const leadingNewlines = prompt.slice(0, i);
    const visiblePrompt = prompt.slice(i);
    if (leadingNewlines.length > 0) {
      this.opts.outputEl.appendChild(document.createTextNode(leadingNewlines));
    }

    this.opts.promptEl.textContent = visiblePrompt;
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
