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
