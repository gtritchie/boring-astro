# Workers Builds deploy cutover — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hand off `boring-site` deploys from GitHub Actions to Cloudflare Workers Builds. CI keeps running on PRs as the quality gate; Cloudflare watches the repo and deploys on push. Non-`main` branches get preview URLs that include a `noindex` meta tag so they aren't indexed.

**Architecture:** Three independent moving parts, deliverable in one PR.

1. `BaseLayout.astro` reads `WORKERS_CI_BRANCH` (auto-set by Workers Builds) at build time and emits `<meta name="robots" content="noindex, nofollow">` whenever the branch isn't `main`. `ProseLayout.astro` already wraps `BaseLayout`, so the tag covers every page on the site.
2. `.github/workflows/deploy.yml` is renamed to `ci.yml` and the `deploy` job (plus the `Upload dist` artifact step that only fed it) is removed. The remaining `build-and-check` job continues to run `check` → `build` → `link-check` → `pa11y` on PRs and pushes to `main`.
3. Cloudflare Workers Builds is connected to the GitHub repo via the dashboard. `.nvmrc` (24.15.0) is auto-detected, overriding the default 22.16.0. Production branch is `main`; non-production branch builds are enabled and use `wrangler versions upload` (preview URLs).

**Tech Stack:** Astro 6 (existing), Cloudflare Workers Builds (new — replaces `cloudflare/wrangler-action@v3`), no new dependencies.

**Verification model:** No unit tests. Verification is `npm run check`, `npm run build`, HTML inspection of built output, `curl` against preview/production URLs to assert the `noindex` tag is or isn't present, and watching the Cloudflare build log to confirm Node 24 is in use. Per CLAUDE.md, every code task ends with a commit on a feature branch.

**Branch:** `feat/workers-builds-cutover` (create at start of Task 1).

**Reference docs consulted:**

- [Workers Builds — Configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Workers Builds — Build image (Node version detection)](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)
- [Changelog: default env vars in Workers Builds (2025-06-10)](https://developers.cloudflare.com/changelog/2025-06-10-default-env-vars/)

---

## File map

**Modify:**

- `src/layouts/BaseLayout.astro` — read `WORKERS_CI_BRANCH` at build time; emit `<meta name="robots" content="noindex, nofollow">` for non-`main` branches.
- `.github/workflows/deploy.yml` → renamed to `.github/workflows/ci.yml` via `git mv`; rewritten to drop the `deploy` job and the `Upload dist` artifact step.
- `CLAUDE.md` — rewrite the "CI / deploy" section to describe the new model (CI runs checks; Cloudflare deploys; preview URLs are `noindex`'d).
- `README.md` — rewrite the `## Deploy` section. Remove references to `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub secrets. Describe the Workers Builds setup and where build env vars now live.

**Cloudflare-side configuration (no git changes):**

- Connect `gtritchie/boring-astro` to the `boring-site` Worker via Cloudflare dashboard.
- Set production branch = `main`, build command = `npm run build`, leave deploy commands at defaults.
- Enable non-production branch builds (this is the toggle that produces preview URLs).
- Optionally add `PUBLIC_CF_WA_TOKEN` as a Build variable to keep Web Analytics on production.

**GitHub-side cleanup (after cutover is verified):**

- Delete `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets — no longer consumed by any workflow.
- Optionally delete `PUBLIC_CF_WA_TOKEN` repo secret (it was only consumed by the GHA build, which no longer deploys).

---

## Task ordering rationale

The code changes (Tasks 1–4) are individually inert: the `noindex` meta is gated on an env var that nothing currently sets, the renamed workflow still runs on PRs and `main`, and the doc updates describe the target state. Together they prepare the repo for the cutover, but nothing in production changes until Cloudflare is connected.

Cloudflare connection (Task 5) happens **after** the PR is open and CI has gone green, so we can verify preview deploys against the feature branch before merging. The merge moment (Task 6) is the actual cutover: the merge commit has no `deploy` job in CI, so only Cloudflare deploys `main`. No race window.

Cleanup (Task 7) happens after a full production deploy has been verified.

---

### Task 1: Branch and add conditional `noindex` meta to `BaseLayout`

**Files:**

- Modify: `src/layouts/BaseLayout.astro`

This task is a no-op against the current deploy setup — `WORKERS_CI_BRANCH` is undefined in GHA and locally, so `isPreview` is always `false` and no meta tag is emitted. The change becomes load-bearing only after Cloudflare is connected in Task 5.

- [ ] **Step 1: Confirm you are on the feature branch**

The branch was created when the plan itself was committed. Make sure you're on it:

```bash
git checkout feat/workers-builds-cutover
```

If for some reason the branch doesn't exist yet (e.g. fresh clone, or you're starting from `main` after the plan was merged), create it from `main` instead:

```bash
git checkout main && git pull --ff-only && git checkout -b feat/workers-builds-cutover
```

- [ ] **Step 2: Edit `src/layouts/BaseLayout.astro`**

In the frontmatter, after the existing `const canonicalHref = …` line, add:

```ts
const branch = import.meta.env.WORKERS_CI_BRANCH;
const isPreview = Boolean(branch) && branch !== "main";
```

Use `import.meta.env`, not `process.env`. Vite strips `process.env.X` references during the SSR transform of `.astro` files, so `process.env.WORKERS_CI_BRANCH` reads as `undefined` even when the variable is set. `import.meta.env` exposes all build-time env vars to server-side code (it only filters non-`PUBLIC_`-prefixed vars from client bundles). This matches the existing `import.meta.env["PUBLIC_CF_WA_TOKEN"]` pattern further down in the same file.

In the `<head>` block, immediately after the `<meta name="viewport" ... />` line, insert:

```astro
{isPreview && <meta name="robots" content="noindex, nofollow" />}
```

The full updated frontmatter block (lines 1–17) becomes:

```astro
---
import "../styles/global.css";
import SkipLink from "../components/SkipLink.astro";
import SiteHeader from "../components/SiteHeader.astro";
import SiteFooter from "../components/SiteFooter.astro";
import { ClientRouter } from "astro:transitions";

interface Props {
  title: string;
  description?: string;
  canonical?: string;
}

const { title, description, canonical } = Astro.props;
const fullTitle = title === "Boring by Design" ? title : `${title} — Boring by Design`;
const canonicalHref = canonical ?? new URL(Astro.url.pathname, Astro.site).toString();
const branch = import.meta.env.WORKERS_CI_BRANCH;
const isPreview = Boolean(branch) && branch !== "main";
---
```

The full updated `<head>` opening (lines 21–28 in the original; the rest of the `<head>` — script, transition router, etc. — is unchanged) becomes:

```text
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  {isPreview && <meta name="robots" content="noindex, nofollow" />}
  <title>{fullTitle}</title>
  {description && <meta name="description" content={description} />}
  <link rel="canonical" href={canonicalHref} />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="alternate" type="application/rss+xml" title="Boring by Design" href="/rss.xml" />
```

- [ ] **Step 3: Run the project check**

```bash
npm run check
```

Expected: passes. `import.meta.env.WORKERS_CI_BRANCH` is typed as `string | undefined` (or similar) by Astro's Vite shim — no cast needed.

- [ ] **Step 4: Verify behavior locally — `noindex` should NOT appear in a normal build**

```bash
npm run build
grep -l 'noindex' dist/client/**/*.html 2>/dev/null
```

Expected: no output (no files contain `noindex`). Locally, `WORKERS_CI_BRANCH` is unset, so the condition is false.

- [ ] **Step 5: Verify behavior locally — `noindex` SHOULD appear when the env var simulates a preview branch**

```bash
WORKERS_CI_BRANCH=some-feature-branch npm run build
grep -c 'noindex, nofollow' dist/client/index.html
```

Expected: `1` — one occurrence in the home page. Spot-check another page:

```bash
grep -c 'noindex, nofollow' dist/client/about/index.html
```

Expected: `1`. ProseLayout-wrapped pages also work because ProseLayout extends BaseLayout. Spot-check one:

```bash
grep -c 'noindex, nofollow' dist/client/projects/boring-site/index.html
```

Expected: `1`.

- [ ] **Step 6: Restore a clean build (so the next task starts from a known state)**

```bash
npm run build
```

Expected: succeeds. Built HTML no longer contains `noindex` (we removed the env var override).

- [ ] **Step 7: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "Emit noindex meta in BaseLayout for non-main branches"
```

---

### Task 2: Rename the workflow and drop the deploy job

**Files:**

- Rename: `.github/workflows/deploy.yml` → `.github/workflows/ci.yml`
- Modify: `.github/workflows/ci.yml` (remove `deploy` job and `Upload dist` step)

After this task, GitHub Actions only runs the quality gate. Deploys stop until Cloudflare is connected in Task 5. That's why the PR must not merge before Task 5 succeeds.

- [ ] **Step 1: Rename the workflow file via git so history follows**

```bash
git mv .github/workflows/deploy.yml .github/workflows/ci.yml
```

- [ ] **Step 2: Replace the contents of `.github/workflows/ci.yml`**

The new file in full:

```yaml
# .github/workflows/ci.yml
name: ci

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  build-and-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      - name: Lint, format, typecheck
        run: npm run check

      - name: Build
        env:
          PUBLIC_CF_WA_TOKEN: ${{ secrets.PUBLIC_CF_WA_TOKEN }}
        run: npm run build

      - name: Link check
        uses: lycheeverse/lychee-action@v2
        with:
          args: --config lychee.toml 'dist/client/**/*.html'
          fail: true

      - name: Start preview
        run: npx astro preview --host 127.0.0.1 --port 4321 &

      - name: Wait for preview
        run: npx wait-on http://127.0.0.1:4321/ --timeout 60000

      - name: pa11y-ci (AAA, every URL in the sitemap index)
        run: npm run pa11y
```

Compared to the old file: workflow `name` changed from `deploy` to `ci`; concurrency group prefix from `deploy-` to `ci-`; the `Upload dist` step is gone; the entire `deploy:` job (lines 65–93 in the original) is gone.

- [ ] **Step 3: Verify YAML is well-formed**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
```

Expected: no output (no exception). If `python3` isn't available locally, skip — the GitHub Actions parser will reject malformed YAML at PR time, which is also fine.

- [ ] **Step 4: Verify the old file is gone and the new one exists**

```bash
ls .github/workflows/
```

Expected: a single `ci.yml`. No `deploy.yml`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "Rename deploy.yml to ci.yml and drop the deploy job (Cloudflare Workers Builds will deploy)"
```

---

### Task 3: Update `CLAUDE.md`

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the "## CI / deploy" section**

Find the current section (starts at the line `## CI / deploy`, ends just before `## Reference docs`). Replace it with:

```markdown
## CI / deploy

`.github/workflows/ci.yml` runs on push/PR to `main`: `check` → `build` → `link-check` → `pa11y`. CI is the quality gate; it does not deploy.

**Deploy is Cloudflare Workers Builds.** The `boring-site` Worker is connected to this repo via the Cloudflare dashboard (Settings → Build). On push to `main`, Cloudflare runs `npm run build` then `npx wrangler deploy` against the production Worker. On push to any other branch, Cloudflare runs `npm run build` then `npx wrangler versions upload`, which produces a unique preview URL per build. Node 24 is auto-detected from `.nvmrc`.

**Preview URLs are `noindex`'d.** `BaseLayout.astro` reads `WORKERS_CI_BRANCH` (auto-set by Workers Builds) at build time and emits `<meta name="robots" content="noindex, nofollow">` whenever the branch isn't `main`. ProseLayout extends BaseLayout, so this covers every page.

**Build env vars** live in Cloudflare → Worker → Settings → Environment variables → Build variables. `PUBLIC_CF_WA_TOKEN` (Cloudflare Web Analytics) goes here if you want analytics on production. There are no longer any deploy-related GitHub Actions secrets.

Lighthouse is not run in CI — run `npm run lighthouse` locally as needed.

Branch protection on `main` — always work on a feature branch and open a PR.
```

- [ ] **Step 2: Verify formatting**

```bash
npm run check
```

Expected: passes (Prettier accepts the Markdown).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md CI/deploy section for Workers Builds cutover"
```

---

### Task 4: Update `README.md`

**Files:**

- Modify: `README.md` (the `## Deploy` section, currently lines 137–159)

- [ ] **Step 1: Replace the `## Deploy` section**

Replace the entire current section (from `## Deploy` through the line ending `…the GitHub repo settings once the remote is set up.`) with:

```markdown
## Deploy

GitHub Actions runs CI on every push and PR to `main`: `npm run check`, build,
link check, and pa11y. CI is the quality gate; it does not deploy.

Deploys are handled by **Cloudflare Workers Builds**. The `boring-site` Worker
is connected to this repo via the Cloudflare dashboard. On push to `main`,
Cloudflare runs `npm run build` then `npx wrangler deploy`. On push to any
other branch, Cloudflare runs `npm run build` then `npx wrangler versions
upload`, producing a unique preview URL — so every PR gets a working preview
deploy. Node 24 is auto-detected from `.nvmrc` (the Cloudflare default would
otherwise be 22).

Preview URLs are not indexed: `BaseLayout.astro` reads `WORKERS_CI_BRANCH` at
build time and emits `<meta name="robots" content="noindex, nofollow">`
whenever the branch isn't `main`.

**Build env vars** live in Cloudflare → Worker → Settings → Environment
variables → Build variables, not in GitHub secrets:

- `PUBLIC_CF_WA_TOKEN` — Cloudflare Web Analytics site token. When set, Astro
  bakes the beacon into the static output at build time. Optional.

Lighthouse is not run in CI; run `npm run lighthouse` locally when you want a
perf audit.

Day-to-day flow: branch, commit, open PR to `main`, wait for CI, click the
Cloudflare preview URL on the PR, merge. Production deploy is automatic on
merge.

**Never push directly to `main`.** Branch protection should enforce this in
the GitHub repo settings.
```

- [ ] **Step 2: Verify formatting**

```bash
npm run check
```

Expected: passes.

- [ ] **Step 3: Commit the README change**

```bash
git add README.md
git commit -m "Update README Deploy section for Workers Builds cutover"
```

- [ ] **Step 4: Push the branch and open the PR**

```bash
git push -u origin feat/workers-builds-cutover
gh pr create --title "Move deploys to Cloudflare Workers Builds" --body "$(cat <<'EOF'
## Summary
- Drops the `deploy` job from GitHub Actions; CI now runs only the quality gate (`check` → `build` → `link-check` → `pa11y`). Workflow renamed `deploy.yml` → `ci.yml`.
- Adds a build-time `noindex` meta tag to `BaseLayout.astro` for non-`main` branches, gated on `WORKERS_CI_BRANCH` (set by Cloudflare Workers Builds).
- Updates `CLAUDE.md` and `README.md` to describe the new deploy model.

The Cloudflare-side connection happens out of band (via dashboard) once this PR is open. The PR should NOT be merged until preview deploys are verified to work and the production trigger is enabled in Cloudflare.

## Test plan
- [ ] CI on this PR passes (`build-and-check` only; no deploy step exists)
- [ ] After Cloudflare is connected, a push to this branch produces a preview URL
- [ ] `curl -s <preview-url> | grep -c 'noindex, nofollow'` prints `1`
- [ ] After merge, `curl -s https://boringbydesign.ca | grep -c 'noindex, nofollow'` prints `0`
- [ ] Cloudflare build log shows Node 24.15.0
EOF
)"
```

---

### Task 5: Connect Cloudflare Workers Builds to the repo (manual, dashboard)

No git changes. The exact wording of dashboard labels may drift over time; this is the flow as of April 2026.

- [ ] **Step 1: Navigate to the Worker**

In the Cloudflare dashboard: **Workers & Pages → `boring-site`**.

- [ ] **Step 2: Connect Git**

**Settings → Build → Connect**. Authorize the **Cloudflare GitHub app** on the `gtritchie/boring-astro` repo. Scope the app to that single repo, not "All repositories."

- [ ] **Step 3: Configure build settings**

In **Settings → Build**:

- **Production branch:** `main`
- **Build command:** `npm run build`
- **Deploy command:** leave default (`npx wrangler deploy`)
- **Non-production branch deploy command:** leave default (`npx wrangler versions upload`) — this is what produces preview URLs
- **Root directory:** `/` (default)
- **Enable non-production branch builds:** ON (this is the toggle that gives you preview URLs for PR branches)

Save.

- [ ] **Step 4 (optional): Add `PUBLIC_CF_WA_TOKEN` as a Build variable**

If you want to keep Cloudflare Web Analytics on production, in **Settings → Environment variables → Build variables**, add:

- **Name:** `PUBLIC_CF_WA_TOKEN`
- **Value:** the same token currently stored as a GitHub Actions secret of the same name
- **Environment:** Production (and Preview, if you also want analytics on preview deploys)

Without this, production HTML built by Cloudflare won't include the analytics beacon and `boringbydesign.ca` will stop appearing in Web Analytics.

- [ ] **Step 5: Trigger a preview build to verify the wiring**

Push any small no-op commit to `feat/workers-builds-cutover` (e.g. a whitespace change in `README.md`). In the Cloudflare dashboard's **Builds** tab, watch the build log:

- Build should detect Node 24.15.0 (the log line is something like `Using Node.js v24.15.0 (from .nvmrc)`).
- `npm run build` should succeed.
- `npx wrangler versions upload` should succeed and print a preview URL of the form `https://<version-id>-boring-site.<account-subdomain>.workers.dev`.

- [ ] **Step 6: Verify the preview URL is `noindex`'d**

Copy the preview URL from the build log. Then:

```bash
curl -s <preview-url> | grep -c 'noindex, nofollow'
```

Expected: `1`. Spot-check another page:

```bash
curl -s <preview-url>/about/ | grep -c 'noindex, nofollow'
```

Expected: `1`.

If either prints `0`: the env var isn't being read. Check the Cloudflare build log for the actual `WORKERS_CI_BRANCH` value (printable via a temporary `echo` step in the build command), and that BaseLayout's frontmatter actually shipped to the deploy.

---

### Task 6: Cutover (merge the PR, verify production)

- [ ] **Step 1: Merge the PR**

Once Task 5 verification passes, merge the PR via the GitHub UI (squash or merge — Gary's preference; existing repo commits suggest individual commits via PR with merge).

The merge commit hits `main`. Two things happen:

- GitHub Actions runs the **new** `ci.yml` against the merge commit. No deploy job, so it just runs `check`/`build`/`link-check`/`pa11y`.
- Cloudflare Workers Builds sees the push to `main` and runs `npm run build` + `npx wrangler deploy`.

- [ ] **Step 2: Watch the Cloudflare production build**

Cloudflare dashboard → `boring-site` → **Builds**. The build for the merge commit should succeed and trigger a deploy.

- [ ] **Step 3: Verify production**

```bash
curl -sI https://boringbydesign.ca | head -5
curl -s https://boringbydesign.ca | grep -c 'noindex, nofollow'
```

Expected: `200 OK`; `grep -c` prints `0` (production has no `noindex`).

Spot-check a few pages in a browser:

- `https://boringbydesign.ca/` — home loads, theme toggle works, view transitions work
- `https://boringbydesign.ca/writing/` — listing renders
- Any one writing entry — content renders, dates display correctly

- [ ] **Step 4: Verify production is current**

Look for any change recently merged to `main` and confirm it's live. If this PR's only changes were docs and a workflow rename, both invisible to a reader, do a quick "deploy hash" check by pulling the deploy log from Cloudflare and confirming the deployed version's commit SHA matches the merge commit.

---

### Task 7: Clean up unused GitHub secrets

After at least one production deploy via Cloudflare has succeeded.

- [ ] **Step 1: Delete deploy-only GitHub secrets**

GitHub repo → **Settings → Secrets and variables → Actions**. Delete:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

- [ ] **Step 2: Decide on `PUBLIC_CF_WA_TOKEN`**

If Task 5 Step 4 added the same token as a Cloudflare Build variable, you can also delete the GitHub secret of the same name — it's no longer consumed (the GHA build job still references it via `env:`, but the env var being unset is harmless; Astro's `import.meta.env["PUBLIC_CF_WA_TOKEN"]` check just becomes falsy and the analytics beacon isn't injected into the locally-built artifact, which isn't deployed anyway).

If you skipped Task 5 Step 4 because you don't care about analytics right now, the GitHub secret is also moot — leave it or delete it.

- [ ] **Step 3: Revoke the old Cloudflare API token**

If `CLOUDFLARE_API_TOKEN` was a scoped token created specifically for this repo's GHA deploys (per the README's pre-cutover instructions, it should have been), revoke it: Cloudflare dashboard → **My Profile → API Tokens → Roll/Delete**. The Workers Builds integration uses Cloudflare's own GitHub-app auth, not this token.

---

## Self-review notes

**Spec coverage check:** The user requested four things — switch deploy to Cloudflare-side, pin Node 24, `noindex` preview URLs, and instructions for the dashboard. All four are covered:

- Cloudflare-side deploy → Tasks 2, 5, 6 (drop GHA deploy job; connect Cloudflare; verify cutover).
- Pin Node 24 → Task 5 Step 5 verifies that `.nvmrc` is being read by Cloudflare's build image (no code change needed; auto-detected).
- `noindex` preview URLs → Task 1 (BaseLayout edit) + Task 5 Step 6 (verify).
- Dashboard instructions → Task 5.

**Placeholder scan:** No "TBD" / "implement later" / "appropriate" steps. All file paths are explicit; all bash commands are runnable; all code blocks are complete. The one place the plan is genuinely uncertain is the exact wording of Cloudflare dashboard labels (Task 5 Steps 2–3) — flagged as "as of April 2026" with a note that wording may drift.

**Identifier consistency:** `WORKERS_CI_BRANCH` (env var, used in BaseLayout and verified in Task 5), `feat/workers-builds-cutover` (branch, created in Task 1, pushed in Task 4, merged in Task 6), `boring-site` (Worker name, matches `wrangler.jsonc:3`) — spelled identically throughout.

**Things this plan deliberately does not do:**

- Does not disable the `boring-site.<subdomain>.workers.dev` production subdomain. That subdomain has been crawlable since the original deploy and is a separate concern. Out of scope here.
- Does not add a `robots.txt` for preview URLs. The meta tag is sufficient for well-behaved crawlers; a separate `robots.txt` per environment would require either a Worker route or build-time conditional content swap, both of which are heavier than this problem warrants.
- Does not move build env vars wholesale. Only `PUBLIC_CF_WA_TOKEN` is mentioned, and it's optional. There are no other GHA secrets the build currently reads.
