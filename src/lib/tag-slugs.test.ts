import { test } from "node:test";
import assert from "node:assert/strict";
import type { CollectionEntry } from "astro:content";
import { tagToSlug, buildTagIndex } from "./tag-slugs.ts";

test("tagToSlug lowercases and collapses non-alphanumerics to single dashes", () => {
  assert.equal(tagToSlug("Web Components"), "web-components");
  assert.equal(tagToSlug("Node.js"), "node-js");
  assert.equal(tagToSlug("a  &  b"), "a-b");
});

test("tagToSlug trims leading and trailing dashes", () => {
  assert.equal(tagToSlug("(draft)"), "draft");
});

test("tagToSlug routes C++ through its alias while C keeps the default", () => {
  assert.equal(tagToSlug("C++"), "cpp");
  assert.equal(tagToSlug("C"), "c");
});

test("tagToSlug yields the empty string for all-symbol tags", () => {
  assert.equal(tagToSlug("!!!"), "");
});

// Minimal fixtures: buildTagIndex reads only `id` and `data.tags`. The cast
// keeps the fixtures honest enough — if it starts reading more, the tests
// throw rather than silently passing.
function project(id: string, tags: string[]): CollectionEntry<"projects"> {
  return { id, collection: "projects", data: { tags } } as unknown as CollectionEntry<"projects">;
}

function entryIds(index: Map<string, { entries: { id: string }[] }>, slug: string): string[] {
  return index.get(slug)!.entries.map((e) => e.id);
}

test("buildTagIndex groups projects under each tag, preserving input order", () => {
  const index = buildTagIndex([project("alpha", ["Rust", "CLI"]), project("beta", ["Rust"])]);
  assert.deepEqual([...index.keys()].sort(), ["cli", "rust"]);
  assert.equal(index.get("rust")!.displayTag, "Rust");
  assert.deepEqual(entryIds(index, "rust"), ["alpha", "beta"]);
  assert.deepEqual(entryIds(index, "cli"), ["alpha"]);
});

test("buildTagIndex dedupes a repeated tag within one project", () => {
  const index = buildTagIndex([project("alpha", ["Rust", "Rust"])]);
  assert.deepEqual(entryIds(index, "rust"), ["alpha"]);
});

test("buildTagIndex keys aliased tags by their alias slug", () => {
  const index = buildTagIndex([project("alpha", ["C++"]), project("beta", ["C"])]);
  assert.equal(index.get("cpp")!.displayTag, "C++");
  assert.equal(index.get("c")!.displayTag, "C");
});

test("buildTagIndex throws on a tag that slugs to nothing, naming tag and project", () => {
  assert.throws(
    () => buildTagIndex([project("alpha", ["!!!"])]),
    /Tag "!!!" on project "alpha" produces an empty slug/,
  );
});

test("buildTagIndex throws on a slug collision, naming both source tags", () => {
  assert.throws(
    () => buildTagIndex([project("alpha", ["Rust"]), project("beta", ["rust"])]),
    /Tag slug collision: "Rust" and "rust" both produce slug "rust"/,
  );
});

test("buildTagIndex treats the identical tag string as a merge, not a collision", () => {
  const index = buildTagIndex([project("alpha", ["Rust"]), project("beta", ["Rust"])]);
  assert.deepEqual(entryIds(index, "rust"), ["alpha", "beta"]);
});
