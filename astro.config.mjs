// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { satteri } from "@astrojs/markdown-satteri";
import satteriAlerts from "./src/lib/satteri-alerts.mjs";
import satteriExternalLinks from "./src/lib/satteri-external-links.mjs";
import satteriHeadingAnchors from "./src/lib/satteri-heading-anchors.mjs";
import { site, internalHosts } from "./src/lib/site.mjs";

export default defineConfig({
  site,
  output: "static",
  // imageService: "compile" optimizes images at build time and emits direct
  // /_astro/*.webp URLs. The adapter's default routes through a runtime /_image
  // endpoint, which 404s on this Workers Assets-only deploy (no _worker.js).
  adapter: cloudflare({ imageService: "compile" }),
  image: {
    // Site-wide default: <Image> and markdown images emit srcset/sizes and
    // responsive styles (aspect-ratio box, object-fit) to prevent layout shift.
    layout: "constrained",
    responsiveStyles: true,
  },
  markdown: {
    // Astro 7's default Sätteri pipeline, made explicit so our plugins can be
    // attached. (gfm + smartypants still default to true.) mdx() extends this
    // config by default, so the plugins run for both .md and .mdx without
    // listing twice.
    // Hast order is load-bearing: heading-anchors before external-links — see
    // satteri-heading-anchors.mjs for why, and for why it is passed UNCALLED
    // (Sätteri instantiates the factory once per document). Sätteri's built-in
    // heading-ids pass runs after both, keeps the ids heading-anchors already
    // set, and records them as the slugs in headings metadata.
    processor: satteri({
      mdastPlugins: [satteriAlerts],
      hastPlugins: [satteriHeadingAnchors, satteriExternalLinks({ internalHosts })],
    }),
  },
  integrations: [mdx(), sitemap()],
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});
