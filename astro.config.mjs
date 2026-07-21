// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified, rehypeHeadingIds } from "@astrojs/markdown-remark";
import rehypeExternalLinks from "./src/lib/rehype-external-links.mjs";
import rehypeHeadingAnchors from "./src/lib/rehype-heading-anchors.mjs";
import remarkAlerts from "./src/lib/remark-alerts.mjs";
import { site, internalHosts } from "./src/lib/site.mjs";

const rehypeOpts = [rehypeExternalLinks, { internalHosts }];

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
    // Astro 7 defaults to the Sätteri pipeline; unified() opts back into the
    // remark/rehype pipeline so our remark/rehype plugins keep running.
    // (gfm + smartypants still default to true.) mdx() extends this config by
    // default, so the plugins run for both .md and .mdx without listing twice.
    // Rehype order is load-bearing twice over. rehypeHeadingIds is pinned first
    // so ids exist for rehypeHeadingAnchors, and so ids and headings metadata
    // are slugged from the author's heading text rather than from post-plugin
    // markup. Astro appends its own rehypeHeadingIds after every custom plugin,
    // but unified dedupes attachers by identity, so that call folds into this
    // one and the pass runs exactly once, here. Anchors then run ahead of
    // rehype-external-links — see rehype-heading-anchors.mjs for why.
    // No heading in src/content/ contains a link today, so pinning left every
    // existing slug untouched; one that did would now slug from its own text.
    processor: unified({
      remarkPlugins: [remarkAlerts],
      rehypePlugins: [rehypeHeadingIds, rehypeHeadingAnchors, rehypeOpts],
    }),
  },
  integrations: [mdx(), sitemap()],
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});
