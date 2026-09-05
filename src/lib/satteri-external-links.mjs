// Sätteri hast plugin: for each <a> whose href is external (per the
// configured internalHosts set), set target="_blank", merge noopener and
// noreferrer into rel, add the has-external-glyph class, and append an
// inline SVG glyph and a visually-hidden "(opens in a new tab)" span.
//
// Only markdown-syntax links reach this visitor: raw HTML in .md stays a hast
// `raw` node and JSX <a> in MDX is an mdxJsxTextElement, so an author-written
// anchor is never touched (and never gets the affordance) — same as the old
// rehype pipeline, whose "element" visits had the identical blind spot.
//
// rel and class are written as space-joined strings rather than hast-style
// arrays: Sätteri's setProperty carries values over a serialized wire, and a
// plain string round-trips to identical HTML without relying on the
// serializer's list handling.
//
// SVG presentation attributes use literal kebab-case names ("stroke-width"),
// which is the spelling the emitted HTML uses. This began as a workaround:
// satteri 0.9.5's name tables covered className/ariaHidden/viewBox but not SVG
// presentation attributes, so camelCase strokeWidth/strokeLinecap/strokeLinejoin
// leaked into the output unconverted. satteri 0.10 fixed both halves of that
// and now converts either spelling, so kebab-case is a plain style choice
// rather than a constraint. satteri-plugins.test.ts asserts the serialized
// attributes on both the .md and .mdx paths, which is the invariant that
// actually matters if satteri ever regresses.

const HTTP_RE = /^https?:\/\//i;

function getHostSafe(href) {
  try {
    return new URL(href).host;
  } catch {
    return null;
  }
}

function toTokens(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  return [];
}

function withTokens(existing, ...tokens) {
  const set = new Set(toTokens(existing));
  for (const t of tokens) set.add(t);
  return [...set].join(" ");
}

function makeGlyph() {
  return {
    type: "element",
    tagName: "svg",
    properties: {
      className: ["external-glyph"],
      viewBox: "0 0 12 12",
      ariaHidden: "true",
      focusable: "false",
    },
    children: [
      {
        type: "element",
        tagName: "path",
        properties: {
          d: "M4.5 2.5h-2A1 1 0 0 0 1.5 3.5v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        children: [],
      },
      {
        type: "element",
        tagName: "path",
        properties: {
          d: "M7 1.5h3.5V5M10.5 1.5 5.5 6.5",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "1.2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        children: [],
      },
    ],
  };
}

function makeSrSpan() {
  return {
    type: "element",
    tagName: "span",
    properties: { className: ["visually-hidden"] },
    children: [{ type: "text", value: " (opens in a new tab)" }],
  };
}

export default function satteriExternalLinks({ internalHosts = [] } = {}) {
  const internal = new Set(internalHosts);
  return {
    name: "external-links",
    element: {
      filter: ["a"],
      visit(node, ctx) {
        const props = node.properties || {};
        const href = props.href;
        if (typeof href !== "string" || !HTTP_RE.test(href)) return;
        const host = getHostSafe(href);
        if (!host || internal.has(host)) return;

        ctx.setProperty(node, "target", "_blank");
        ctx.setProperty(node, "rel", withTokens(props.rel, "noopener", "noreferrer"));
        ctx.setProperty(node, "className", withTokens(props.className, "has-external-glyph"));
        ctx.appendChild(node, [makeGlyph(), makeSrSpan()]);
      },
    },
  };
}
