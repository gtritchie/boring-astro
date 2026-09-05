# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Source for [boringbydesign.ca](https://boringbydesign.ca). Static Astro 7 site deployed to Cloudflare Workers (Workers Assets) via Cloudflare Workers Builds. No client JS beyond the theme toggle and Astro's `ClientRouter` view transitions. See `README.md` for content-authoring and design-token locations.

## Commands

Node 24.16+ required (`.nvmrc` pins `24.18.0`; eslint-plugin-astro needs ≥24.16).

- `npm run dev` — Astro dev server on `:4321`
- `npm run build` — outputs to `dist/client/` (not `dist/` — see below)
- `npm run preview` — `wrangler dev` on `:8787` (real Workers runtime against built output)
- `npm run preview:astro` — builds, then `astro preview` on `127.0.0.1:4321` — pa11y expects this exact origin
- `npm run check` — `astro check` + `prettier --check` + `eslint`
- `npm run format` — `prettier --write .`
- `npm test` — `node --test` over `src/**/*.test.ts` (Node's built-in runner + type stripping; no test framework dependency). The script pins `TZ=America/Edmonton` so UTC-handling regressions fail even on UTC hosts like CI — keep the pin when touching the script.
- `npm run pa11y` — WCAG AAA audit of every sitemap URL; needs `preview:astro` running in another terminal
- `npm run pa11y:full` — same audit, self-contained: builds, starts `astro preview`, audits, tears the server down
- `npm run lighthouse` — builds, then LHCI against budgets in `.lighthouserc.json`. The 9 URLs are one per _rendering shape_, not per route template and not per page — `numberOfRuns` is 3, so every added URL costs three more runs and most pages would re-measure a shape already covered. Covered: the home page; ProseLayout standalone pages (`/about/`, `/uses/` — the largest); the client-JS island page (`/adventure/`); both collection listings (`/projects/`, `/writing/`) and one entry from each; and the tag template. Deliberately omitted: `/reading/` (a simpler ProseLayout page than `/about/`), `/interests/` and `/interests/music/` (the same listing and entry shapes as projects/writing), `/404.html` (not in the sitemap), and `/snaker/` (below). Add a URL when a page introduces a shape nothing in the list covers — a new layout, a client-side island, a materially heavier page — not when a template or content entry is added.
- `npm run link-check` — builds, then lychee across built HTML (requires lychee 0.23.x installed — see `README.md` for install notes; brew ships 0.24+ which is incompatible with this repo's `lychee.toml`)

Unit tests (`node:test`, colocated `*.test.ts` in `src/lib/`) cover the Sätteri plugins end-to-end through the configured processor, each plugin exercised on both of its render paths (Markdown edge cases in depth, MDX for the transform and attribute casing), plus the pure logic in `tag-slugs.ts`, `site.mjs`, and `adventure/format.ts`. Verification in CI is linting, type-checking, the tests, and the build. The pa11y accessibility audit (`npm run pa11y`), Lighthouse (`npm run lighthouse`), and link-check (`npm run link-check`) are all local-only and user-run — pa11y is worth running before merging an accessibility-affecting change and link-check after touching links, but say when a change warrants one rather than running it unprompted.

## Architecture

**Static Astro, no SSR.** `output: "static"` with the Cloudflare adapter. The adapter does _not_ emit `_worker.js` in static mode, so build output lives at `dist/client/` and `wrangler.jsonc`'s `assets.directory` points there. Don't assume `dist/` like typical Astro projects.

**Content is the data model.** All user-visible content lives under `src/content/{writing,projects,interests}/` as Markdown/MDX, validated against Zod schemas in `src/content.config.ts`. Collections use Astro 7's content layer (`loader: glob(...)`). Entries expose `entry.id` (not `slug`); render with `render(entry)` imported from `astro:content`. Adding fields means updating both the schema and any consuming page/component.

**Routing mirrors collections.** `src/pages/{writing,projects,interests}/[...slug].astro` renders individual entries; sibling `index.astro` renders listings. `rss.xml.ts` generates the feed from the `writing` collection. Draft entries (`draft: true`) are excluded from listings, RSS, and the sitemap but still type-check and build.

**Styling flows from tokens.** Every visible style reads from `src/styles/tokens.css` (colors, spacing, typography, light+dark palettes side-by-side). `global.css` imports tokens + `reset.css`. Component `<style>` blocks are Astro-scoped — class names don't collide across components. Warm-neutral palette, AAA contrast required.

**Two layouts.** `BaseLayout.astro` wraps full-chrome pages; `ProseLayout.astro` constrains reading width for articles.

## Gotchas worth remembering

- **`ClientRouter`, not `ViewTransitions`** — renamed in Astro 5+.
- **Markdown uses Sätteri (the Astro 7 default), with custom plugins ported to its visitor API.** Sätteri does not run remark/rehype plugins — it has its own `mdastPlugins`/`hastPlugins` (visitor objects with a `name`, not unified attachers). The site's three plugins live in `src/lib/satteri-*.mjs`; `src/lib/satteri-processor.mjs` assembles them into the `satteri({...})` processor that `astro.config.mjs` and `satteri-plugins.test.ts` both use, and mdx() inherits the same processor for `.md` and `.mdx`. Migrated from the unified pipeline 2026-08-02 with output verified byte-equivalent modulo attribute casing workarounds (below).
- **The processor has two render paths, and `createRenderer()` is not the MDX one.** `markdownProcessor.createRenderer(shared).render(src, opts)` renders Markdown to HTML and ignores the extension in `opts.fileURL` — a `.mdx` URL there still gets you Markdown, silently (`{1 + 1}` stays literal text, which is how to tell). MDX goes through `createMdxRenderer(shared, mdx).process(src, filePath, frontmatter)`, which returns a compiled component module, not HTML. The method arrived with `@astrojs/markdown-satteri` 0.4.0; 0.3.5 had no MDX entry point at all. `satteri-plugins.test.ts` asserts against the emitted module code rather than executing it — the plugins' hast property keys surface there as JSX prop names, so `"stroke-width": "2.2"` in the code is the same invariant as `stroke-width="2.2"` in HTML. It is optional on the `MarkdownProcessor` type, so narrow it by throwing; a silent skip would leave the MDX path unverified.
- **`@astrojs/markdown-satteri` is pinned to an exact version, matching astro's own pin — don't caret it.** Two copies in the tree would let the plugins import `satteriCollectHastText` from the wrong one. When bumping, read `astro`'s `dependencies["@astrojs/markdown-satteri"]` and pin to that exact version. `@astrojs/mdx` 8 moved MDX compilation into the Markdown processor, so `@astrojs/markdown-remark` and `@mdx-js/mdx` — the whole unified/remark/micromark stack — are no longer installed; `mdx()` still inherits `markdown.processor` because `extendMarkdownConfig` defaults to true.
- **Sätteri assigns heading ids AFTER user hast plugins — the reverse of the old rehype order.** `satteri-heading-anchors` therefore slugs headings itself (same github-slugger) and sets the id; Sätteri's built-in heading-ids pass keeps a pre-existing id and records it in headings metadata, so the two agree by construction. The plugin is passed to `hastPlugins` UNCALLED — it's a factory Sätteri invokes once per document to reset slugger state; calling it in the config would mis-suffix duplicate headings across pages. It still runs _before_ `satteri-external-links` (array order), which appends a visually-hidden `" (opens in a new tab)"` inside external links; reversed, a heading containing an external link would fold that into its anchor label. Reordering keeps the build green while output quietly degrades. Known limitation of ids-running-last: a heading containing an external link would get that span's text folded into its `getHeadings()` metadata text (not its slug or anchor label). Accepted — nothing consumes `getHeadings()` and no heading contains a link; fixing it would mean replacing the SR-span affordance with `aria-label` sitewide.
- **SVG presentation attributes are written kebab-case; satteri 0.10 no longer requires it.** satteri 0.9.5 was missing SVG presentation attributes from its name tables, so camelCase `strokeWidth`/`strokeLinecap`/`strokeLinejoin` leaked unconverted into the HTML. [satteri 0.10.0](https://github.com/bruits/satteri/blob/main/packages/satteri/CHANGELOG.md) fixed both halves (f868e26, 5c4cd17), and a probe through the configured processor confirms camelCase now serializes correctly on the .md and .mdx paths alike. The glyph builders in `satteri-external-links.mjs` and `satteri-heading-anchors.mjs` keep their kebab-case keys — those are the spelling the HTML actually uses and they round-trip verbatim under both versions, so there is nothing to migrate. Related hazard, still live: satteri silently ignores unknown visitor keys, so a typo'd `element`/`blockquote` key means the plugin never runs and the build stays green — `satteri-plugins.test.ts` exists largely to turn that (and the other silent failure modes on this list) into red tests.
- **satteri 0.10 made `node.position` opt-in per plugin.** A visitor sees `position: undefined` unless the plugin declares `options: { position: true }`. None of the three plugins read positions — `satteri-alerts.mjs` deliberately keeps its hard-break check shape-based — but a plugin that starts reading spans has to ask for them.
- **The content layer caches rendered `.md` HTML, and neither plugin-code nor config edits bust it.** The cache is effectively content-keyed: after touching `src/lib/satteri-*.mjs` — or even removing a plugin from `astro.config.mjs` — a plain `npm run build` serves stale HTML for unchanged `.md` entries (`.mdx` compiles through Vite and always rebuilds, so the two paths silently diverge). Use `npx astro build --force` when verifying any markdown-pipeline change.
- **UTC dates everywhere.** YAML frontmatter dates parse as UTC midnight. Render with `timeZone: "UTC"` and `getUTCFullYear()` so `2026-04-23` always displays as April 23 regardless of host/reader timezone.
- **pa11y uses Puppeteer's bundled Chrome** at `~/.cache/puppeteer/`. `run-pa11y.mjs` leaves `chromeLaunchConfig.executablePath` unset so pa11y auto-detects it. `run-pa11y.mjs` also rewrites sitemap URLs to the preview origin — don't regress that when touching the script.
- **`preview:astro` is what pa11y targets**, not `wrangler dev`. They listen on different ports.
- **Deploy is Workers Assets only** — no binding to `env.ASSETS`; `wrangler.jsonc` intentionally has no `assets.binding` key (see commit b7ab667).
- **iOS Safari auto-inflates monospace text** in narrow content blocks. `-webkit-text-size-adjust: 100%` on `html` throttles the algorithm but doesn't disable it. Pin `text-size-adjust: none` on the specific element when CSS sizing must win — see `AdventureTerminal.astro` for the worked example.
- **Adventure terminal reserves 72ch, not 70.** The engine emits ≤70-char lines, but rendered mono glyph advance ≠ `1ch` exactly and sub-pixel rounding can push 70-char lines past a 70ch container. The 2-char buffer absorbs the variance.
- **TypeScript is held at `~6.0.3` — don't bump it to 7.x.** TypeScript 7 is `latest` on npm, so `npm outdated` reports it every cycle, but two peers still cap at 6: `typescript-eslint` (`>=4.8.4 <6.1.0`) and `@astrojs/check` (`^5.0.0 || ^6.0.0`). The tilde also blocks 6.1.x for the same typescript-eslint bound. Lift the pin only once both peers publish TS 7 support.
- **`allowScripts` keys are exact `name@version` and go stale on every update.** `npm install` warns when an installed package with lifecycle scripts isn't covered — the entry must be re-keyed to the new version, not left behind. A stale key is dead config that silently stops approving anything; conversely, dropping a package that no longer _has_ install scripts (as `sharp` did at 0.35) is the correct cleanup. A correct re-key survives a clean install — `trash node_modules && npm install` prints no `allow-scripts` warnings.
- **To refresh transitive drift, delete `node_modules` _and_ `package-lock.json` — deleting the lockfile alone is worse than doing nothing.** npm's arborist seeds the ideal tree from whatever is already in `node_modules`, so a transitive dependency that still satisfies its parent's range is kept at the installed version and the drift survives. Worse, `node_modules` only holds this platform's optional binaries, so regenerating from it silently strips every other platform's from the lockfile — a `-1716` line diff that leaves CI's Linux `npm ci` without its rollup/lightningcss/sharp/satteri bindings. `trash node_modules package-lock.json && npm install` is the real refresh; `npm update <pkg>` is the targeted equivalent for one package. Never bare `npm update` — it churns the tree and re-hoists hundreds of packages. Either path is only done when `npm ci` reinstalls cleanly from the new lockfile.
- **Apparent downgrades in a lockfile diff are usually hoisting flips.** When two versions of a package coexist, a refresh can swap which one sits at `node_modules/<pkg>` and which is nested under its dependent. `ajv 8.20.0 -> 6.15.0` in the diff meant eslint's copy got hoisted, not that anything downgraded — both versions were still present. Listing every path for that package in the old and new lockfiles settles it.

## Out of scope unless asked

- Dependency refreshes, lockfile regeneration, and `allowScripts` re-keying are their own task — never a side effect of a content or component change.
- pa11y, Lighthouse, and link-check are user-run. Say when a change warrants one.
- **`/snaker/` is excluded from both audits by design — don't propose adding it back.** It is a real-time keyboard/touch game, so it cannot satisfy AAA contrast or keyboard-navigation checks and its performance profile has nothing to do with the rest of the site. `run-pa11y.mjs` skips it via `PA11Y_DENY_PATHS` (hence 47 audited URLs against 48 in the sitemap); `.lighthouserc.json` is JSON and cannot hold a comment, so the reason lives here. The page stays in the sitemap and is publicly indexable.
- **A test may not require a browser, a component runtime, or a new dependency.** That is the principle; `node:test` plus Node's type stripping is what satisfies it, and the rest of the guardrails are `astro check`, prettier, eslint, and the build. Don't add a framework (vitest, playwright, etc.). Rendering `.astro` components is out — it needs the Container API or a browser, and pa11y and Lighthouse already cover the rendered result end to end. Anything reachable as a plain function call is in, whatever it is called: this used to read "pure logic and the markdown pipeline — no DOM or component testing," written when the MDX compiler could not be driven in-process, and the workaround it forced was a test that asserted on plugin property-key spelling instead of on output. Prefer a slower honest test over a fast proxy for one.

## CI / deploy

`.github/workflows/ci.yml` runs on push/PR to `main`: `check` → `test` → `build`. CI is the quality gate; it does not deploy. pa11y is intentionally not in CI — it needs a browser, and the GitHub runner image ships a broken pre-seeded Puppeteer Chrome cache that defeats both the postinstall download and explicit `puppeteer browsers install`. Run it locally instead.

**Link-check is deliberately not in CI either.** It resolves live external URLs, so third-party rate limits and transient outages fail the build for reasons unrelated to the change under test — a `429` from `thehip.com` broke an otherwise-green run. Dead links on a personal site are worth catching eventually, not worth blocking a merge on, so `npm run link-check` stays a local command run on demand.

**Deploy is Cloudflare Workers Builds.** The `boring-site` Worker is connected to this repo via the Cloudflare dashboard (Settings → Build). On push to `main`, Cloudflare runs `npm run build` then `npx wrangler deploy` against the production Worker. On push to any other branch, Cloudflare runs `npm run build` then `npx wrangler versions upload`, which produces a unique preview URL per build. Node 24 is auto-detected from `.nvmrc`.

**Preview URLs are `noindex`'d.** `BaseLayout.astro` reads `import.meta.env.WORKERS_CI_BRANCH` (auto-set by Workers Builds) at build time and emits `<meta name="robots" content="noindex, nofollow">` whenever the branch isn't `main`. ProseLayout extends BaseLayout, so this covers every page.

**Build env vars** live in Cloudflare → Worker → Settings → Environment variables → Build variables. `PUBLIC_CF_WA_TOKEN` (Cloudflare Web Analytics) goes here if you want analytics on production. There are no longer any deploy-related GitHub Actions secrets.

Lighthouse is not run in CI — run `npm run lighthouse` locally as needed.

Branch protection on `main` — always work on a feature branch and open a PR.

## Reference docs

- Design spec: `docs/superpowers/specs/2026-04-23-boringbydesign-site-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-23-boringbydesign-site.md`
- Content-authoring details and frontmatter schemas: `README.md`
