// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://boringbydesign.ca',
  output: 'static',
  adapter: cloudflare(),
  integrations: [mdx(), sitemap()],
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
