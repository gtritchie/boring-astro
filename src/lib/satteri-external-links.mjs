// Sätteri hast plugin: for each <a> whose href is external (per the
// configured internalHosts set), set target="_blank", merge noopener and
// noreferrer into rel, add the has-external-glyph class, and append an
// inline SVG glyph and a visually-hidden "(opens in a new tab)" span.
//
// Defensive opt-out: if the author has explicitly set target to anything
// other than "_blank" (e.g. raw HTML in MDX with target="_self"), the
// plugin leaves the link entirely alone — no target/rel/class mutation,
// no glyph, no SR span. This guarantees the affordance never lies about
// the link's actual behavior.
//
// rel and class are written as space-joined strings rather than hast-style
// arrays: Sätteri's setProperty carries values over a serialized wire, and a
// plain string round-trips to identical HTML without relying on the
// serializer's list handling.
//
// SVG presentation attributes are shaped around two satteri 0.9.5 name-mapping
// bugs (className/ariaHidden/viewBox map fine; SVG presentation attributes
// don't):
//   - stroke-width is written as a literal kebab-case name, not hast camelCase
//     (strokeWidth): the name is absent from satteri's tables, so it passes
//     through verbatim — camelCase would leak into the HTML and be ignored.
//   - stroke-linecap/-linejoin are NOT set here at all: satteri canonicalizes
//     either spelling to camelCase on input but never maps it back on output,
//     so no spelling survives. They live in CSS instead (.external-glyph in
//     global.css) — stroke properties inherit from the svg to its paths.

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
        if ("target" in props && props.target !== "_blank") return;

        ctx.setProperty(node, "target", "_blank");
        ctx.setProperty(node, "rel", withTokens(props.rel, "noopener", "noreferrer"));
        ctx.setProperty(node, "className", withTokens(props.className, "has-external-glyph"));
        ctx.appendChild(node, [makeGlyph(), makeSrSpan()]);
      },
    },
  };
}
