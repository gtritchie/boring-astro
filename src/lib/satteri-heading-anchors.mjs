// Sätteri hast plugin: slug every heading and append a deep-link anchor to
// each h2–h4, so any section of a content entry can be linked from the address
// bar. Styling — the hover/focus reveal, the always-visible touch fallback —
// lives in ProseLayout.astro under `.heading-anchor`.
//
// Runs on all markdown, which is every content-collection entry: nothing under
// src/pages/ is markdown and nothing imports a .md file, so src/content/ is the
// whole of Astro's markdown pipeline (README.md and docs/ never reach it).
//
// Unlike the unified pipeline, Sätteri assigns heading ids in a built-in pass
// that runs AFTER user hast plugins — too late for an anchor to know its
// target. So this plugin slugs headings itself, with the same github-slugger
// the built-in pass uses; the built-in pass keeps any id that already exists
// and records it as the heading's slug in `headings` metadata, so the two
// passes agree by construction. Slugging covers h1–h6 (matching the built-in
// slugger's input, so duplicate-heading -1/-2 suffixes stay identical) even
// though anchors only go on h2–h4.
//
// This plugin is exported as a factory and passed to `hastPlugins` UNCALLED:
// Sätteri invokes it once per document, which is what resets the slugger's
// duplicate-counter state between files. Calling it in the config would share
// one slugger across every page and mis-suffix repeated headings.
//
// Ordering: this runs before satteri-external-links, which appends a
// visually-hidden " (opens in a new tab)" inside external links — textContent
// would fold that into the label of an anchor that opens nothing. The built-in
// heading-ids pass runs after BOTH, so a heading containing an external link
// would still get that span's text folded into its getHeadings() metadata
// text (not its slug or label) — accepted, see the CLAUDE.md markdown gotcha.
//
// The accessible name is an aria-label rather than the visually-hidden span the
// external-link glyph uses, so nothing is added to the heading's text content:
// copying a heading yields the author's words alone.
//
// h2–h4 is what content uses. h1 is the page title ProseLayout renders, not
// markdown; nothing goes deeper than h4.
//
// The glyph's SVG presentation attributes use literal kebab-case names — see
// satteri-external-links.mjs for the satteri name-mapping gap behind that.

import { satteriCollectHastText } from "@astrojs/markdown-satteri";
import Slugger from "github-slugger";

const ANCHOR_TAGS = new Set(["h2", "h3", "h4"]);

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
      "stroke-width": "2.2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
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

export default function satteriHeadingAnchors() {
  const slugger = new Slugger();
  return {
    name: "heading-anchors",
    element: {
      filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
      visit(node, ctx) {
        // MDX headings can interpolate frontmatter (`## {frontmatter.title}`);
        // slug and label from the resolved value, not the literal expression.
        // Same gate + helper as Astro's built-in heading-ids pass, so the id
        // set here is the one that pass would have computed itself.
        const rawText = ctx.textContent(node);
        const text = rawText.includes("frontmatter")
          ? satteriCollectHastText(node, ctx.data.astro?.frontmatter ?? {})
          : rawText;
        const existingId = node.properties?.id;
        const id = typeof existingId === "string" ? existingId : slugger.slug(text);
        if (id === "") return;
        if (typeof existingId !== "string") ctx.setProperty(node, "id", id);
        if (!ANCHOR_TAGS.has(node.tagName)) return;
        ctx.appendChild(node, makeAnchor(id, text.trim()));
      },
    },
  };
}
