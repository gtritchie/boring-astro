// Single source of truth for the site's canonical origin and the derived
// internal-host set. Imported by astro.config.mjs (for both the `site`
// config value and the rehype plugin options) and by ExternalLink.astro
// (to validate authored hrefs).

export const site = "https://boringbydesign.ca";

const siteHost = new URL(site).host;
export const internalHosts = [siteHost, `www.${siteHost}`];

// Returns true when href is an http(s) URL whose host is not in the internal
// set. Used by .astro templates that render dynamic links from frontmatter
// (e.g. project repo/site/docs URLs) to decide whether to wrap in
// <ExternalLink> or render as a plain <a>.
export function isExternalHttp(href) {
  if (typeof href !== "string" || !/^https?:\/\//i.test(href)) return false;
  try {
    return !internalHosts.includes(new URL(href).host);
  } catch {
    return false;
  }
}
