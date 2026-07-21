// rehype plugin: append a deep-link anchor to every h2–h4 that carries an id,
// so any section of a content entry can be linked from the address bar.
// Styling — the hover/focus reveal, the always-visible touch fallback — lives
// in ProseLayout.astro under `.heading-anchor`.
//
// Runs on all markdown, which is every content-collection entry: nothing under
// src/pages/ is markdown and nothing imports a .md file, so src/content/ is the
// whole of Astro's markdown pipeline (README.md and docs/ never reach it).
//
// Two preconditions, both enforced by plugin order in astro.config.mjs:
//   - heading ids exist — rehypeHeadingIds is pinned ahead of this plugin.
//   - rehype-external-links has NOT run yet. It appends a visually-hidden
//     " (opens in a new tab)" inside external links, and toText would fold that
//     into the label of an anchor that opens nothing.
//
// The accessible name is an aria-label rather than the visually-hidden span the
// external-link glyph uses, so nothing is added to the heading's text content:
// copying a heading yields the author's words alone.
//
// h2–h4 is what content uses. h1 is the page title ProseLayout renders, not
// markdown; nothing goes deeper than h4.

import { visit } from "unist-util-visit";

const HEADING_TAGS = new Set(["h2", "h3", "h4"]);

function toText(node) {
  if (node.type === "text") return node.value;
  return (node.children ?? []).map(toText).join("");
}

function makeIcon() {
  const path = (d) => ({ type: "element", tagName: "path", properties: { d }, children: [] });
  return {
    type: "element",
    tagName: "svg",
    properties: {
      className: ["heading-anchor-glyph"],
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ariaHidden: "true",
      focusable: "false",
    },
    children: [
      path("M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"),
      path("M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"),
    ],
  };
}

function makeAnchor(id, headingText) {
  return {
    type: "element",
    tagName: "a",
    properties: {
      className: ["heading-anchor"],
      href: `#${id}`,
      ariaLabel: headingText ? `Link to “${headingText}”` : "Link to this section",
    },
    children: [makeIcon()],
  };
}

export default function rehypeHeadingAnchors() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (!HEADING_TAGS.has(node.tagName)) return;
      const id = node.properties?.id;
      if (typeof id !== "string" || id === "") return;
      node.children = [...node.children, makeAnchor(id, toText(node).trim())];
    });
  };
}
