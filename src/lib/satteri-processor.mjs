// The site's configured Sätteri processor — plugins and their load-bearing
// order in one place. astro.config.mjs passes this to `markdown.processor`,
// and satteri-plugins.test.ts renders through it directly, so the tests
// exercise the exact processor the build uses: a plugin added or reordered in
// the config is a plugin added or reordered under test.

import { satteri } from "@astrojs/markdown-satteri";
import satteriAlerts from "./satteri-alerts.mjs";
import satteriExternalLinks from "./satteri-external-links.mjs";
import satteriHeadingAnchors from "./satteri-heading-anchors.mjs";
import { internalHosts } from "./site.mjs";

// Hast order is load-bearing: heading-anchors before external-links — see
// satteri-heading-anchors.mjs for why, and for why it is passed UNCALLED
// (Sätteri instantiates the factory once per document). Sätteri's built-in
// heading-ids pass runs after both, keeps the ids heading-anchors already
// set, and records them as the slugs in headings metadata.
export const markdownProcessor = satteri({
  mdastPlugins: [satteriAlerts],
  hastPlugins: [satteriHeadingAnchors, satteriExternalLinks({ internalHosts })],
});
