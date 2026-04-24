# Cloudflare Worker cutover for boringbydesign.ca (one-time)

**When:** Before the first Cloudflare Workers deploy of boringbydesign.ca.
**Who:** Gary (manual, outside CI).
**Estimated time:** 10 minutes.

DNS is already on Cloudflare (moved from GoDaddy during an earlier Svelte
experiment). An old Worker from that experiment still exists in the account.
The work here is swapping the custom domain from the old Worker to the new
`boringbydesign` Worker that CI will deploy.

## Pre-flight audit

Do this before merging the first PR so you know what state the zone is in.

1. **Cloudflare → Workers & Pages.** Note the old Worker's name. Check its
   Custom Domains / Triggers tab — is `boringbydesign.ca` or
   `www.boringbydesign.ca` bound to it? Confirm Settings → Build shows no
   connected GitHub repo (integration should already be disconnected).
2. **Cloudflare → DNS.** Note any records at `@` and `www`. These may be
   auto-created CNAMEs pointing at the old Worker.
3. **Name collision check.** `wrangler.jsonc` sets `name: "boringbydesign"`.
   If the old Worker has the same name, the first deploy overwrites it.
   If it has a different name, the first deploy creates a second Worker
   alongside it and the cutover steps below apply.

## Cutover steps

Run these after the first deploy lands the new Worker on its
`*.workers.dev` URL and you've confirmed it serves correctly.

1. **Unbind the old Worker.** Cloudflare → old Worker → Custom Domains →
   remove `boringbydesign.ca` and `www.boringbydesign.ca` if present.
2. **Bind the new Worker.** Cloudflare → `boringbydesign` Worker →
   Custom Domains:
   - Add `boringbydesign.ca`
   - Add `www.boringbydesign.ca` as a redirect-to-apex

   Cloudflare creates/updates the DNS records automatically. There's a
   brief window (seconds) between unbind and rebind where the apex
   resolves to nothing — don't do this while someone's reading the site.
3. **Verify SSL/TLS settings** (should already be set from the Svelte run,
   just confirm): Full (strict), Always Use HTTPS on, Automatic HTTPS
   Rewrites on.
4. **Delete the old Worker** once the new one is serving cleanly.
5. **Web Analytics (optional).** Only if you want traffic stats: add
   `boringbydesign.ca` in the Cloudflare dashboard
   (Analytics & Logs → Web Analytics → Add a site), copy the site token,
   and set it as `PUBLIC_CF_WA_TOKEN` in the GitHub repo secrets. The
   deploy works fine without this — the beacon just isn't shipped.

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
| `PUBLIC_CF_WA_TOKEN`    | `build-and-check` job build step (baked into static output) | Web Analytics token from step 5 above. When set, Astro inlines the Cloudflare Web Analytics beacon at build time. When unset, the build still succeeds and the beacon simply isn't rendered — set this only if you want traffic data flowing to the Cloudflare dashboard. Required for the first-deploy smoke test of "Web Analytics shows traffic". |
| `LHCI_GITHUB_APP_TOKEN` | `build-and-check` job LHCI step                             | Install the Lighthouse CI GitHub App on the repo; the install flow emits this token. Enables LHCI to post per-PR status checks. Builds succeed without it; LHCI just won't annotate PRs.                                                                                                                                                             |

If the deploy workflow ever starts managing Worker routes or DNS programmatically,
widen `CLOUDFLARE_API_TOKEN` to include **Workers Routes: Edit** and **Zone: Edit
for `boringbydesign.ca`** at that time.

## After the first deploy

- `curl -I https://boringbydesign.ca/` → `HTTP/2 200`, `server: cloudflare`
- `curl -I https://www.boringbydesign.ca/` → 301/308 redirect to the apex
- `cf-cache-status: HIT` after a few page views (edge warming)
- If `PUBLIC_CF_WA_TOKEN` was configured (step 5): Cloudflare dashboard →
  Web Analytics → see traffic flowing. Skip this check otherwise.

## Rollback

If the deploy breaks the site:

1. In the GitHub Actions "deploy" run, trigger a re-run of the previous
   successful deploy (the artifact retention is 1 day, so this works
   within 24 hours).
2. If the artifact is gone, check out the prior good commit locally and
   `npx wrangler deploy` from there.
3. If Cloudflare routes need to be manually reverted: Cloudflare dashboard
   → the Worker → Deployments → promote an earlier deployment.

Cloudflare keeps the last 100 Workers deployments per project on the free tier.
