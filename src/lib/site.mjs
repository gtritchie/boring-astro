// Single source of truth for the site's canonical origin and the derived
// internal-host set. Imported by astro.config.mjs (for both the `site`
// config value and the rehype plugin options) and by ExternalLink.astro
// (to validate authored hrefs).

export const site = "https://boringbydesign.ca";

const siteHost = new URL(site).host;
export const internalHosts = [siteHost, `www.${siteHost}`];
