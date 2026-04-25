// rehype plugin: for each <a> in HAST whose href is external (per the
// configured internalHosts set), set target="_blank", merge noopener and
// noreferrer into rel, add the has-external-glyph class, and append an
// inline SVG glyph and a visually-hidden "(opens in a new tab)" span.
//
// Defensive opt-out: if the author has explicitly set target to anything
// other than "_blank" (e.g. raw HTML in MDX with target="_self"), the
// plugin leaves the link entirely alone — no target/rel/class mutation,
// no glyph, no SR span. This guarantees the affordance never lies about
// the link's actual behavior.

import { visit } from "unist-util-visit";

const HTTP_RE = /^https?:\/\//i;

function getHostSafe(href) {
  try {
    return new URL(href).host;
  } catch {
    return null;
  }
}

function ensureClass(properties, name) {
  const existing = properties.className;
  if (Array.isArray(existing)) {
    if (!existing.includes(name)) existing.push(name);
  } else if (typeof existing === "string" && existing.length > 0) {
    properties.className = [...existing.split(/\s+/).filter(Boolean), name];
  } else {
    properties.className = [name];
  }
}

function mergeRel(properties, ...tokens) {
  const existing = properties.rel;
  let set;
  if (Array.isArray(existing)) {
    set = new Set(existing);
  } else if (typeof existing === "string") {
    set = new Set(existing.split(/\s+/).filter(Boolean));
  } else {
    set = new Set();
  }
  for (const t of tokens) set.add(t);
  properties.rel = [...set];
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
          strokeWidth: "1.2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
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
          strokeWidth: "1.2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
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

export default function rehypeExternalLinks({ internalHosts = [] } = {}) {
  const internal = new Set(internalHosts);
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return;
      const props = node.properties || {};
      const href = props.href;
      if (typeof href !== "string" || !HTTP_RE.test(href)) return;
      const host = getHostSafe(href);
      if (!host || internal.has(host)) return;
      if ("target" in props && props.target !== "_blank") return;

      props.target = "_blank";
      mergeRel(props, "noopener", "noreferrer");
      ensureClass(props, "has-external-glyph");
      node.properties = props;
      node.children = [...node.children, makeGlyph(), makeSrSpan()];
    });
  };
}
