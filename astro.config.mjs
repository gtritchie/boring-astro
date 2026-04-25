// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
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
  markdown: {
    rehypePlugins: [rehypeOpts],
  },
  integrations: [mdx({ rehypePlugins: [rehypeOpts] }), sitemap()],
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});
