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
  // Expected value comes from the same Intl options the implementation uses,
  // so the assertion holds under any host locale — what's under test is the
  // ≥7-day routing and the timeZone pin, not Intl itself. savedAt sits just
  // after UTC midnight so a local-timezone render shifts to the previous day
  // on any western-hemisphere host, making the pin's removal visible.
  const savedAt = Date.UTC(2026, 0, 20, 0, 30);
  const expected = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(savedAt);
  assert.equal(formatRelativeTime(savedAt, NOW), expected);
});

test("formatScore joins score and max", () => {
  assert.equal(formatScore(42, 350), "42 / 350");
});
