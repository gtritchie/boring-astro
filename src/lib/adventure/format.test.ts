import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRelativeTime, formatScore } from "./format.ts";

const NOW = Date.UTC(2026, 0, 30, 12, 0, 0); // 2026-01-30T12:00:00Z
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function at(diffMs: number, compact = false): string {
  return formatRelativeTime(NOW - diffMs, NOW, compact);
}

test("under a minute is 'Just now'", () => {
  assert.equal(at(0), "Just now");
  assert.equal(at(59 * 1000), "Just now");
});

test("a future timestamp clamps to 'Just now'", () => {
  assert.equal(formatRelativeTime(NOW + HOUR, NOW), "Just now");
});

test("minutes: singular, plural, and compact forms", () => {
  assert.equal(at(MIN), "1 minute ago");
  assert.equal(at(5 * MIN), "5 minutes ago");
  assert.equal(at(5 * MIN, true), "5m ago");
});

test("hours: singular, plural, and compact forms", () => {
  assert.equal(at(HOUR), "1 hour ago");
  assert.equal(at(23 * HOUR), "23 hours ago");
  assert.equal(at(2 * HOUR, true), "2h ago");
});

test("between one and two days is 'Yesterday'", () => {
  assert.equal(at(DAY), "Yesterday");
  assert.equal(at(2 * DAY - 1), "Yesterday");
});

test("under a week counts days", () => {
  assert.equal(at(3 * DAY), "3 days ago");
  assert.equal(at(3 * DAY, true), "3d ago");
});

test("a week or older renders a short absolute date in UTC", () => {
  // 10 days before NOW is Jan 20 in UTC; a local-timezone render could show
  // the 19th or 21st depending on host offset.
  const out = at(10 * DAY);
  assert.match(out, /20/);
  assert.match(out, /Jan/i);
});

test("formatScore joins score and max", () => {
  assert.equal(formatScore(42, 350), "42 / 350");
});
