import { visit } from "unist-util-visit";

// GitHub-style Markdown alerts: a blockquote whose first line is a bare
// `[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]` marker is
// rewritten into `<div class="markdown-alert markdown-alert-<type>">` with a
// leading `<p class="markdown-alert-title">` label. ProseLayout.astro styles
// the result (accent left bar, tinted label, CSS-masked icon). The marker must
// be uppercase and alone on the line, matching GitHub — so an ordinary
// blockquote, a lowercase `[!note]`, or `[!NOTE] trailing text` is left as a
// plain blockquote.

// `[^\S\r\n]*` allows trailing spaces/tabs after the marker; the marker must end
// the line — a newline (inline body on the next line, kept as a soft break in
// the same text node) or the end of the text node (body in a following
// paragraph after a blank `>` line).
const MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][^\S\r\n]*(?:\r?\n|$)/;

function titleCase(type) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

export default function remarkAlerts() {
  return (tree) => {
    visit(tree, "blockquote", (node) => {
      const firstChild = node.children[0];
      if (!firstChild || firstChild.type !== "paragraph") return;
      const firstText = firstChild.children[0];
      if (!firstText || firstText.type !== "text") return;

      const match = firstText.value.match(MARKER_RE);
      if (!match) return;
      const type = match[1];

      // Strip the marker (and its trailing newline, when the body follows on the
      // next line) from the body text.
      firstText.value = firstText.value.slice(match[0].length);

      // Marker alone on its own paragraph (body in a later paragraph): the first
      // text node is now empty — drop it, and drop the paragraph if it emptied.
      if (firstText.value === "") {
        firstChild.children.shift();
        if (firstChild.children.length === 0) node.children.shift();
      }

      // Render the blockquote as the alert container.
      const lowerType = type.toLowerCase();
      node.data = node.data || {};
      node.data.hName = "div";
      node.data.hProperties = {
        className: ["markdown-alert", `markdown-alert-${lowerType}`],
      };

      // Prepend the title label; its icon is a CSS `::before` mask.
      node.children.unshift({
        type: "paragraph",
        data: { hProperties: { className: ["markdown-alert-title"] } },
        children: [{ type: "text", value: titleCase(type) }],
      });
    });
  };
}
