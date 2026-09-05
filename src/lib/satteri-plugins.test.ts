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
// Assertions are against the emitted string — HTML for .md, compiled module
// code for .mdx. That couples them to serializer details (attribute order,
// quoting), which is deliberate: the serializer IS part of what a satteri
// upgrade could change out from under the site.

const renderer = await markdownProcessor.createRenderer({});

async function render(src: string) {
  return await renderer.render(src, {});
}

async function renderCode(src: string): Promise<string> {
  return (await render(src)).code;
}

// The .md and .mdx paths are separate entry points on the processor —
// `createRenderer()` renders Markdown to HTML, `createMdxRenderer()` compiles
// MDX to a JS component module. `createRenderer` ignores `fileURL`'s
// extension, so a .mdx *render* is still Markdown; only this compiles MDX.
//
// The compiled module is not executed — that would need Astro's runtime.
// Asserting on the emitted code is enough for what differs between the paths:
// the hast property keys the plugins wrote arrive as JSX prop names, which is
// exactly where a casing leak used to show up as `strokeWidth: "2.2"`.
// Optional on the MarkdownProcessor type. Fail loudly rather than skip: a
// satteri upgrade that drops the method should turn this file red, not
// quietly leave the MDX path unverified.
const { createMdxRenderer } = markdownProcessor;
if (!createMdxRenderer) {
  throw new Error("markdownProcessor exposes no createMdxRenderer — MDX assertions cannot run");
}
const mdxRenderer = await createMdxRenderer.call(
  markdownProcessor,
  { syntaxHighlight: false, shikiConfig: {}, gfm: true, smartypants: true },
  { optimize: false },
);

async function compileMdx(src: string): Promise<string> {
  const { code } = await mdxRenderer.process(src, "/virtual/entry.mdx", {});
  return String(code);
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

// A break from the line below the marker is the author's own hard break — only
// a break that ended the marker's line itself (trailing double-space) may be
// consumed with the marker.
test("a hard break on the line below the marker is preserved", async () => {
  const html = await renderCode("> [!NOTE]\n> \\\n> Body.");
  assert.match(html, /markdown-alert-note/);
  assert.match(html, /<br/);
});

test("an inline sibling on the line below the marker is preserved", async () => {
  const html = await renderCode("> [!NOTE]\n> **Bold** rest.");
  assert.match(html, /markdown-alert-note/);
  assert.match(html, /<strong>Bold<\/strong> rest\./);
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

// Both glyph builders write SVG presentation attributes kebab-case
// ("stroke-width"), the spelling the emitted HTML uses. satteri 0.9.5 left
// camelCase equivalents unconverted, so the kebab-case rule started as a
// workaround; 0.10 fixed the name tables and converts either spelling, so the
// rule now just matches the output. Either way the serialized attribute is
// what matters, so assert on that rather than on the keys the plugins write.
test("glyph SVG presentation attributes serialize kebab-case in rendered HTML", async () => {
  const html = await renderCode("## Head\n\n[out](https://example.com)");
  assert.match(html, /stroke-width="2\.2"/, "heading-anchor glyph");
  assert.match(html, /stroke-width="1\.2"/, "external-link glyph");
  assert.match(html, /stroke-linecap="round"/);
  assert.match(html, /stroke-linejoin="round"/);
  assert.doesNotMatch(html, /strokeWidth|strokeLinecap|strokeLinejoin/);
});

// The same invariant on the MDX path, which reaches the browser through a
// different satteri entry point and has diverged on attribute casing before:
// satteri 0.9.5 converted `strokeWidth` on .md while leaking it here.
test("glyph SVG presentation attributes stay kebab-case in compiled MDX", async () => {
  const code = await compileMdx("## Head\n\n[out](https://example.com)\n");
  assert.match(code, /"stroke-width": "2\.2"/, "heading-anchor glyph");
  assert.match(code, /"stroke-width": "1\.2"/, "external-link glyph");
  assert.match(code, /"stroke-linecap": "round"/);
  assert.match(code, /"stroke-linejoin": "round"/);
  assert.doesNotMatch(code, /strokeWidth|strokeLinecap|strokeLinejoin/);
});

// Guards the two assertions above: they would also pass on a compile that
// produced no glyphs at all, so pin that both plugins actually ran.
test("both plugins run on the MDX path", async () => {
  const code = await compileMdx("## Head\n\n[out](https://example.com)\n");
  assert.match(code, /id: "head"/, "heading id");
  assert.match(code, /class: "heading-anchor"/);
  assert.match(code, /"has-external-glyph"/);
  assert.match(code, /\(opens in a new tab\)/);
});
