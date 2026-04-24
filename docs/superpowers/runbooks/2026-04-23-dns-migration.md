# Cloudflare Worker cutover for boringbydesign.ca (one-time)

**When:** Before the first Cloudflare Workers deploy of boringbydesign.ca.
**Who:** Gary (manual, outside CI).
**Estimated time:** 5 minutes.

DNS is already on Cloudflare (moved from GoDaddy during an earlier Svelte
experiment). A Worker named `boring-site` from that experiment still exists
in the account, with `boringbydesign.ca` and `www.boringbydesign.ca` bound
to it as custom domains.

`wrangler.jsonc` is set to `name: "boring-site"` so the first CI deploy
overwrites that Worker in place. The custom-domain bindings stay as-is,
no unbind/rebind dance needed.

## Pre-flight verification

Run these once before merging the first PR to confirm the world matches
this runbook's assumptions.

1. **Worker name matches.** Cloudflare → Workers & Pages → confirm a
   Worker named `boring-site` exists.
2. **Custom domains still bound.** On that Worker, Custom Domains tab
   should list both `boringbydesign.ca` and `www.boringbydesign.ca`.
3. **GitHub integration disconnected.** Settings → Build → no connected
   repo. (If anything is still connected, disconnect it so CI's
   wrangler deploy is the only thing publishing.)
4. **SSL/TLS settings.** Confirm Full (strict), Always Use HTTPS on,
   Automatic HTTPS Rewrites on. These should already be set from the
   Svelte run.

## After the first CI deploy

1. **Smoke-test the live site:**
   - `curl -I https://boringbydesign.ca/` → `HTTP/2 200`, `server: cloudflare`
   - `curl -I https://www.boringbydesign.ca/` → 301/308 redirect to the apex
   - `cf-cache-status: HIT` after a few page views (edge warming)
2. **Web Analytics (optional).** Only if you want traffic stats: add
   `boringbydesign.ca` in the Cloudflare dashboard
   (Analytics & Logs → Web Analytics → Add a site), copy the site token,
   and set it as `PUBLIC_CF_WA_TOKEN` in the GitHub repo secrets. The
   deploy works fine without this — the beacon just isn't shipped. If
   you set it, trigger a redeploy so the beacon gets baked in, then
   confirm traffic shows up in the Cloudflare dashboard after a few
   page views.

## Secrets to set in the GitHub repo

Configure under Settings → Secrets and variables → Actions before the first
push to `main` triggers the deploy workflow.

### Required (for a working deploy)

| Secret                  | Used by                        | Scope                                                                                                                                                                                                    |
| ----------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `deploy` job (wrangler-action) | Minimum: **Workers Scripts: Edit** (for deploying to the existing Worker). No Workers Routes or Zone permissions — route/custom-domain setup is manual in this runbook. Do **not** use a global API key. |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy` job (wrangler-action) | Cloudflare dashboard → right sidebar (on any zone).                                                                                                                                                      |

### Optional

| Secret                  | Used by                                                     | Scope                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_CF_WA_TOKEN`    | `build-and-check` job build step (baked into static output) | Web Analytics token from the optional step above. When set, Astro inlines the Cloudflare Web Analytics beacon at build time. When unset, the build still succeeds and the beacon simply isn't rendered — set this only if you want traffic data flowing to the Cloudflare dashboard.                                                                |
| `LHCI_GITHUB_APP_TOKEN` | `build-and-check` job LHCI step                             | Install the Lighthouse CI GitHub App on the repo; the install flow emits this token. Enables LHCI to post per-PR status checks. Builds succeed without it; LHCI just won't annotate PRs.                                                                                                                                                             |

If the deploy workflow ever starts managing Worker routes or DNS programmatically,
widen `CLOUDFLARE_API_TOKEN` to include **Workers Routes: Edit** and **Zone: Edit
for `boringbydesign.ca`** at that time.

## Rollback

If the deploy breaks the site:

1. In the GitHub Actions "deploy" run, trigger a re-run of the previous
   successful deploy (the artifact retention is 1 day, so this works
   within 24 hours).
2. If the artifact is gone, check out the prior good commit locally and
   `npx wrangler deploy` from there.
3. If you need to revert to an earlier Worker version directly:
   Cloudflare dashboard → `boring-site` Worker → Deployments → promote
   an earlier deployment.

Cloudflare keeps the last 100 Workers deployments per project on the free tier.
