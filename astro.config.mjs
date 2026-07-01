// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import rehypeExternalLinks from "./src/lib/rehype-external-links.mjs";
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
    // remark/rehype pipeline so our rehype-external-links plugin keeps running.
    // (gfm + smartypants still default to true.) mdx() extends this config by
    // default, so the plugin runs for both .md and .mdx without listing it twice.
    processor: unified({ rehypePlugins: [rehypeOpts] }),
  },
  integrations: [mdx(), sitemap()],
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});
