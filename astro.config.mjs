// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { markdownProcessor } from "./src/lib/satteri-processor.mjs";
import { site } from "./src/lib/site.mjs";

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
    // listing twice. The processor lives in src/lib/satteri-processor.mjs so
    // the plugin tests render through the same instance the build uses.
    processor: markdownProcessor,
  },
  integrations: [mdx(), sitemap()],
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});
