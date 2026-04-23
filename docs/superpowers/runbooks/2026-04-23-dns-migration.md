# DNS migration — GoDaddy → Cloudflare (one-time)

**When:** Before the first Cloudflare Workers deploy of boringbydesign.ca.
**Who:** Gary (manual, outside CI).
**Estimated time:** 15 minutes of active work + up to 1 hour of propagation.

## Steps

1. **Log in to Cloudflare.** Add `boringbydesign.ca` as a site on the Free plan.
2. **Copy the two nameservers** Cloudflare assigns (of the form `xxx.ns.cloudflare.com`).
3. **Log in to GoDaddy → Domain Settings → Nameservers.** Choose "Custom" and
   replace the existing nameservers with the Cloudflare pair. Save. (Keep the
   domain registration at GoDaddy — no transfer needed.)
4. **Wait for propagation.** Usually under an hour. Verify with:
   ```
   dig boringbydesign.ca NS +short
   ```
   …returns the Cloudflare nameservers.
5. **In Cloudflare → Workers & Pages → your worker → Custom Domains:**
   - Add `boringbydesign.ca`
   - Add `www.boringbydesign.ca` as a redirect-to-apex
6. **SSL/TLS settings:** Full (strict). Enable "Always Use HTTPS" and
   "Automatic HTTPS Rewrites".
7. **Web Analytics:** Add `boringbydesign.ca` in the Cloudflare dashboard
   (Analytics & Logs → Web Analytics → Add a site). Copy the site token.

## Secrets to set in the GitHub repo

All four must be configured under Settings → Secrets and variables → Actions
before the first push to `main` triggers the deploy workflow.

| Secret                  | Used by                                                     | Scope                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | `deploy` job (wrangler-action)                              | Workers Scripts: Edit + Workers Routes: Edit + Zone: Edit for `boringbydesign.ca`. Do **not** use a global API key.                                                                              |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy` job (wrangler-action)                              | Cloudflare dashboard → right sidebar (on any zone).                                                                                                                                              |
| `PUBLIC_CF_WA_TOKEN`    | `build-and-check` job build step (baked into static output) | Web Analytics token from step 7 above. Astro reads `PUBLIC_*` env vars at build time and inlines them — without this, the analytics beacon does not ship.                                        |
| `LHCI_GITHUB_APP_TOKEN` | `build-and-check` job LHCI step                             | Install the Lighthouse CI GitHub App on the repo; the install flow emits this token. Enables LHCI to post per-PR status checks. Optional — builds work without it; LHCI just won't annotate PRs. |

## After the first deploy

- `curl -I https://boringbydesign.ca/` → `HTTP/2 200`, `server: cloudflare`
- `curl -I https://www.boringbydesign.ca/` → 301/308 redirect to the apex
- `cf-cache-status: HIT` after a few page views (edge warming)
- Cloudflare dashboard → Web Analytics → see traffic flowing

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
