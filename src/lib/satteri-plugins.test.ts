import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownProcessor } from "./satteri-processor.mjs";

// End-to-end: real Markdown through the exact processor astro.config.mjs
// passes to `markdown.processor`. Every documented failure mode of this
// pipeline is silent — a typo'd visitor key means Sätteri never runs the
// plugin, a reorder degrades output, a camelCase SVG attribute leaks invalid
// HTML — and the build stays green through all of them. Rendering through the
// configured processor turns each into a red test instead.
//
// Assertions are against the HTML string. That couples them to serializer
// details (attribute order, quoting), which is deliberate: the serializer IS
// part of what a satteri upgrade could change out from under the site.

const renderer = await markdownProcessor.createRenderer({});

async function render(src: string) {
  return await renderer.render(src, {});
}

async function renderCode(src: string): Promise<string> {
  return (await render(src)).code;
}

// --- alerts (satteri-alerts.mjs) ---

test("each alert marker becomes a classed div with a title-cased label", async () => {
  const cases: [string, string][] = [
    ["NOTE", "Note"],
    ["TIP", "Tip"],
    ["IMPORTANT", "Important"],
    ["WARNING", "Warning"],
    ["CAUTION", "Caution"],
  ];
  for (const [marker, title] of cases) {
    const html = await renderCode(`> [!${marker}]\n> Body.`);
    assert.match(
      html,
      new RegExp(`<div class="markdown-alert markdown-alert-${marker.toLowerCase()}">`),
    );
    assert.match(html, new RegExp(`<p class="markdown-alert-title">${title}</p>`));
    assert.match(html, /<p>Body\.<\/p>/);
    assert.doesNotMatch(html, /<blockquote>/);
  }
});

test("a same-line body converts, with the marker stripped", async () => {
  const html = await renderCode("> [!NOTE] \n> Body text.");
  assert.match(html, /markdown-alert-note/);
  assert.match(html, /Body text\./);
  assert.doesNotMatch(html, /\[!NOTE\]/);
});

test("a lowercase marker is not an alert", async () => {
  const html = await renderCode("> [!note]\n> Body.");
  assert.match(html, /<blockquote>/);
  assert.doesNotMatch(html, /markdown-alert/);
});

test("trailing text on the marker line is not an alert", async () => {
  const html = await renderCode("> [!NOTE] trailing words");
  assert.match(html, /<blockquote>/);
  assert.doesNotMatch(html, /markdown-alert/);
});

test("inline markup after the marker (a sibling node) is not an alert", async () => {
  const html = await renderCode("> [!NOTE] **bold**");
  assert.match(html, /<blockquote>/);
  assert.doesNotMatch(html, /markdown-alert/);
});

test("a marker line ended by a hard break converts without a stray <br>", async () => {
  const html = await renderCode("> [!NOTE]  \n> Body.");
  assert.match(html, /markdown-alert-note/);
  assert.doesNotMatch(html, /<br/);
});

test("an ordinary blockquote is untouched", async () => {
  const html = await renderCode("> Just a quote.");
  assert.match(html, /<blockquote>/);
  assert.doesNotMatch(html, /markdown-alert/);
});

// --- heading anchors (satteri-heading-anchors.mjs) ---

test("h2 gets a slug id and a deep-link anchor with an aria-label", async () => {
  const html = await renderCode("## Hello World");
  assert.match(html, /<h2 id="hello-world">/);
  assert.match(
    html,
    /<a class="heading-anchor" href="#hello-world" aria-label="Link to “Hello World”">/,
  );
});

test("h5/h6 are slugged but get no anchor", async () => {
  const html = await renderCode("##### Deep Section");
  assert.match(html, /<h5 id="deep-section">/);
  assert.doesNotMatch(html, /heading-anchor/);
});

test("duplicate headings in one document get -1/-2 suffixes", async () => {
  const html = await renderCode("## Dup\n\n## Dup\n\n## Dup");
  assert.match(html, /id="dup"/);
  assert.match(html, /id="dup-1"/);
  assert.match(html, /id="dup-2"/);
});

// The factory is passed to hastPlugins UNCALLED so Sätteri instantiates it per
// document, resetting the slugger's duplicate counter. If the config ever
// calls it (one shared slugger), the second document here renders id="dup-1".
test("the slugger resets between documents", async () => {
  const first = await renderCode("## Dup");
  const second = await renderCode("## Dup");
  assert.match(first, /<h2 id="dup">/);
  assert.match(second, /<h2 id="dup">/);
});

test("headings metadata records the same slug the anchor pass assigned", async () => {
  const out = await render("## Hello World");
  const headings = (out as { metadata: { headings: { slug: string; depth: number }[] } }).metadata
    .headings;
  assert.equal(headings.length, 1);
  assert.equal(headings[0]!.slug, "hello-world");
  assert.equal(headings[0]!.depth, 2);
});

// Order contract: heading-anchors runs before external-links, so the anchor's
// label is the author's words — reversed, it would fold in the external link's
// visually-hidden " (opens in a new tab)" span.
test("an anchor label on a heading with an external link excludes the SR-span text", async () => {
  const html = await renderCode("## Hello [world](https://example.com)");
  assert.match(html, /aria-label="Link to “Hello world”"/);
});

// --- external links (satteri-external-links.mjs) ---

test("an external link gets target, rel, class, glyph, and SR span", async () => {
  const html = await renderCode("[out](https://example.com/page)");
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /class="has-external-glyph"/);
  assert.match(html, /<svg class="external-glyph"/);
  assert.match(html, /<span class="visually-hidden"> \(opens in a new tab\)<\/span>/);
});

test("links to the site's own hosts are untouched", async () => {
  for (const host of ["boringbydesign.ca", "www.boringbydesign.ca"]) {
    const html = await renderCode(`[home](https://${host}/writing/)`);
    assert.doesNotMatch(html, /target=/);
    assert.doesNotMatch(html, /external-glyph/);
  }
});

test("relative and mailto links are untouched", async () => {
  for (const href of ["/writing/", "mailto:x@example.com"]) {
    const html = await renderCode(`[link](${href})`);
    assert.doesNotMatch(html, /target=/);
    assert.doesNotMatch(html, /external-glyph/);
  }
});

// satteri 0.9.5's name tables miss SVG presentation attributes: camelCase
// strokeLinecap/strokeLinejoin leak into the HTML unconverted. The glyph
// builders write kebab-case keys; this pins that the output stays valid.
// This renders the .md path only — the cross-path guard for keys satteri
// converts on .md but leaks on .mdx (strokeWidth) is the key-pinning test
// below.
test("glyph SVG presentation attributes serialize kebab-case, not camelCase", async () => {
  const html = await renderCode("## Head\n\n[out](https://example.com)");
  assert.match(html, /stroke-width=/);
  assert.match(html, /stroke-linecap="round"/);
  assert.match(html, /stroke-linejoin="round"/);
  assert.doesNotMatch(html, /strokeWidth|strokeLinecap|strokeLinejoin/);
});

// The .mdx path can't be rendered here without standing up the MDX compiler,
// but it serializes plugin-emitted hast property keys verbatim — so the
// cross-path invariant lives in the keys themselves. Run each plugin's visitor
// against a stub ctx and reject any camelCase key outside the set satteri
// provably converts on both paths (the "write them kebab-case" rule, enforced
// at the source). This is what catches a strokeWidth-only camelCase
// regression, which the .md render above would silently convert.

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
};

const SAFE_CAMEL_KEYS = new Set(["className", "ariaHidden", "ariaLabel", "viewBox"]);

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

function collectAppended(
  visit: (node: HastNode, ctx: unknown) => void,
  node: HastNode,
): HastNode[] {
  const appended: HastNode[] = [];
  visit(node, {
    data: {},
    textContent: textOf,
    setProperty: (n: HastNode, key: string, value: unknown) => {
      (n.properties ??= {})[key] = value;
    },
    appendChild: (_n: HastNode, child: HastNode | HastNode[]) => {
      appended.push(...(Array.isArray(child) ? child : [child]));
    },
  });
  return appended;
}

function elementKeys(nodes: HastNode[]): string[] {
  const keys: string[] = [];
  const walk = (n: HastNode) => {
    if (n.type === "element") keys.push(...Object.keys(n.properties ?? {}));
    (n.children ?? []).forEach(walk);
  };
  nodes.forEach(walk);
  return keys;
}

test("plugins emit no camelCase hast keys beyond satteri's converted set", async () => {
  const { default: satteriHeadingAnchors } = await import("./satteri-heading-anchors.mjs");
  const { default: satteriExternalLinks } = await import("./satteri-external-links.mjs");
  const heading: HastNode = {
    type: "element",
    tagName: "h2",
    properties: {},
    children: [{ type: "text", value: "Head" }],
  };
  const link: HastNode = {
    type: "element",
    tagName: "a",
    properties: { href: "https://example.com" },
    children: [{ type: "text", value: "out" }],
  };
  const appended = [
    ...collectAppended(satteriHeadingAnchors().element.visit, heading),
    ...collectAppended(satteriExternalLinks({ internalHosts: [] }).element.visit, link),
  ];
  // anchor + glyph + SR span at minimum — a silently inert stub proves nothing.
  assert.ok(appended.length >= 3, `visitors appended only ${appended.length} nodes`);
  for (const key of elementKeys(appended)) {
    assert.ok(
      key === key.toLowerCase() || SAFE_CAMEL_KEYS.has(key),
      `camelCase hast key "${key}" would leak unconverted on the .mdx path — write it kebab-case`,
    );
  }
});
