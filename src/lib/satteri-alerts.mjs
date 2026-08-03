// Sätteri mdast plugin. GitHub-style Markdown alerts: a blockquote whose first
// line is a bare `[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` /
// `[!CAUTION]` marker is rewritten into
// `<div class="markdown-alert markdown-alert-<type>">` with a leading
// `<p class="markdown-alert-title">` label. ProseLayout.astro styles the
// result (accent left bar, tinted label, CSS-masked icon). The marker must
// be uppercase and alone on the line, matching GitHub — so an ordinary
// blockquote, a lowercase `[!note]`, or `[!NOTE] trailing text` is left as a
// plain blockquote.
//
// Mutations go through ctx (Sätteri applies them from a command buffer after
// the pass) and target nodes by identity. When the marker's paragraph would
// empty entirely, the paragraph alone is removed — also removing its children
// would issue patches against nodes already gone.

// `[^\S\r\n]*` allows trailing spaces/tabs after the marker; the marker must end
// the line — a newline (inline body on the next line, kept as a soft break in
// the same text node) or the end of the text node (body in a following
// paragraph after a blank `>` line). End-of-node only counts as end-of-line
// when nothing else follows on the marker's line — see the sibling check below.
const MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][^\S\r\n]*(?:\r?\n|$)/;

function titleCase(type) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

const satteriAlerts = {
  name: "alerts",
  blockquote(node, ctx) {
    const firstChild = node.children[0];
    if (!firstChild || firstChild.type !== "paragraph") return;
    const firstText = firstChild.children[0];
    if (!firstText || firstText.type !== "text") return;

    const match = firstText.value.match(MARKER_RE);
    if (!match) return;
    const type = match[1];

    // `$` in MARKER_RE matches the end of the text *node*, not the source
    // line. A match without a newline is only a bare marker if the line truly
    // ended there: the text node must be the paragraph's last inline child, or
    // be followed by a hard break (trailing double-space ends the line).
    // `> [!NOTE] **bold**` parses as text + strong siblings — not an alert.
    const next = firstChild.children[1];
    if (!match[0].endsWith("\n") && next && next.type !== "break") return;

    // Strip the marker (and its trailing newline, when the body follows on the
    // next line) from the body text.
    const stripped = firstText.value.slice(match[0].length);
    if (stripped === "") {
      // Marker alone on its own paragraph: drop the emptied text node, plus the
      // hard break that ended the marker line (it would render a stray leading
      // <br> in the body) — or the whole paragraph, if that empties it.
      const dropped = next?.type === "break" ? 2 : 1;
      if (firstChild.children.length <= dropped) {
        ctx.removeNode(firstChild);
      } else {
        ctx.removeNode(firstText);
        if (next?.type === "break") ctx.removeNode(next);
      }
    } else {
      ctx.setProperty(firstText, "value", stripped);
    }

    // Render the blockquote as the alert container. Spread the existing bag —
    // setProperty replaces `data` wholesale, and clobbering would silently
    // discard anything an earlier plugin put there.
    ctx.setProperty(node, "data", {
      ...node.data,
      hName: "div",
      hProperties: { className: `markdown-alert markdown-alert-${type.toLowerCase()}` },
    });

    // Prepend the title label; its icon is a CSS `::before` mask.
    ctx.prependChild(node, {
      type: "paragraph",
      data: { hProperties: { className: "markdown-alert-title" } },
      children: [{ type: "text", value: titleCase(type) }],
    });
  },
};

export default satteriAlerts;
