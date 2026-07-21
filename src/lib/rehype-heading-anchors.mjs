// rehype plugin: append a deep-link anchor to every h2–h4 that carries an id,
// so any section of a content entry can be linked from the address bar. The
// anchor is a chain-link glyph in the heading's own color, revealed on hover
// or keyboard focus — styling lives in ProseLayout.astro under
// `.heading-anchor`.
//
// Applies to all markdown, which on this site means every entry in every
// content collection (writing, projects, interests); there is no markdown
// outside src/content/.
//
// Requires heading ids to already exist: Astro injects its own rehypeHeadingIds
// AFTER every custom rehype plugin, so astro.config.mjs pins that plugin ahead
// of this one. Astro's later pass keeps the ids it finds but re-collects each
// heading's text for render(entry).headings — which is why the anchor's
// accessible name is an aria-label rather than the visually-hidden span the
// external-link glyph uses. A text node added here would leak into that
// metadata as "HeadingLink to “Heading”".
//
// h2–h4 only: h1 is the page title rendered by ProseLayout, not markdown.

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
