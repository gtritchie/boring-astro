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
  return (
    ((typeof DOMException !== "undefined" && err instanceof DOMException) ||
      err instanceof Error) &&
    (err as { name?: string }).name === "QuotaExceededError"
  );
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
