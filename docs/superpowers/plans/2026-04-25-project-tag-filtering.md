# Project tag filtering — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every visible tag on the site a navigation control that leads to a statically-generated `/tags/[slug]/` page listing every non-draft project carrying that tag.

**Architecture:** A small `src/lib/tag-slugs.ts` module owns slug generation (with an alias map for ambiguous cases like `C++`) and tag-index construction (with build-time collision detection). A new dynamic route `src/pages/tags/[tag].astro` calls `getStaticPaths()` to pre-generate one page per slug. `ProjectCard.astro` and the project detail page are updated to render tags as anchors using the same slugger.

**Tech Stack:** Astro 6 (existing), TypeScript (existing), no new dependencies.

**Verification model:** This project has no unit-test suite; verification is `npm run check` (astro check + Prettier + ESLint), `npm run build`, manual checks in `npm run dev` / `npm run preview`, `npm run link-check`, and `npm run pa11y`. Each task ends with the appropriate verification and a commit. Branch `tag-filtering` is already created and the spec commit is on it.

**Spec:** `docs/superpowers/specs/2026-04-25-project-tag-filtering-design.md`

---

## File map

**Create:**

- `src/lib/tag-slugs.ts` — exports `tagSlugAliases` (initially empty), `tagToSlug(tag)`, and `buildTagIndex(projects)`. Pure logic, no I/O. Imported by the new tag page, `ProjectCard.astro`, and `src/pages/projects/[...slug].astro`.
- `src/pages/tags/[tag].astro` — dynamic route. Uses `getStaticPaths()` + `buildTagIndex` to pre-generate one page per slug. Renders inside `BaseLayout`, reuses `ProjectCard`.

**Modify:**

- `src/components/ProjectCard.astro` — wrap tag `<li>` text in anchors to `/tags/${slug}/`. Add scoped CSS for the inherited link styling. No prop changes.
- `src/pages/projects/[...slug].astro` — replace the comma-joined tag string with a `<ul class="tags">` of pill anchors matching the cards.

**Possibly modify (contingent on contrast results):**

- `src/components/ProjectCard.astro` and/or `src/pages/projects/[...slug].astro` — bump pill link color from `var(--fg-muted)` to `var(--fg)` if pa11y flags AAA contrast on the new anchor targets.

---

## Task ordering rationale

The slugger lands first as a self-contained module — no consumers yet, but the tag page in the next task needs it. The tag page lands second so the routes exist before anything links to them; this also catches collision detection early via a real build. Then the two component updates wire up the inbound links. The full-verification pass runs last, when everything is in place to be audited together.

---

### Task 1: Add tag-slugs module

**Files:**

- Create: `src/lib/tag-slugs.ts`

- [ ] **Step 1: Write the module**

Create `src/lib/tag-slugs.ts` with this content:

```ts
import type { CollectionEntry } from "astro:content";

// Explicit slug overrides for tags whose default slug would be poor
// or would collide with another tag. Empty by default — add an entry
// only when buildTagIndex throws, or when a tag would slug to "".
export const tagSlugAliases: Record<string, string> = {};

export function tagToSlug(tag: string): string {
  if (Object.prototype.hasOwnProperty.call(tagSlugAliases, tag)) {
    return tagSlugAliases[tag];
  }
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface TagIndexEntry {
  displayTag: string;
  entries: CollectionEntry<"projects">[];
}

export function buildTagIndex(projects: CollectionEntry<"projects">[]): Map<string, TagIndexEntry> {
  const index = new Map<string, TagIndexEntry>();
  // Tracks the source tag string each slug was first seen with, so that
  // collisions can be reported with both source tags named.
  const slugToSource = new Map<string, string>();

  for (const project of projects) {
    // Deduplicate within a project so a stray duplicate tag in
    // frontmatter doesn't push the same project onto a tag page twice.
    for (const tag of new Set(project.data.tags)) {
      const slug = tagToSlug(tag);
      if (slug === "") {
        throw new Error(
          `Tag "${tag}" on project "${project.id}" produces an empty slug. ` +
            `Add an alias in src/lib/tag-slugs.ts (e.g. "${tag}": "your-slug").`,
        );
      }
      const existingSource = slugToSource.get(slug);
      if (existingSource !== undefined && existingSource !== tag) {
        throw new Error(
          `Tag slug collision: "${existingSource}" and "${tag}" both produce slug "${slug}". ` +
            `Add an alias in src/lib/tag-slugs.ts to disambiguate.`,
        );
      }
      if (existingSource === undefined) {
        slugToSource.set(slug, tag);
        index.set(slug, { displayTag: tag, entries: [project] });
      } else {
        index.get(slug)!.entries.push(project);
      }
    }
  }

  return index;
}
```

- [ ] **Step 2: Verify it type-checks and lints**

Run:

```bash
npm run check
```

Expected: passes. The new file produces no errors or warnings.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tag-slugs.ts
git commit -m "Add tag slug + index module"
```

---

### Task 2: Add the tag listing page

**Files:**

- Create: `src/pages/tags/[tag].astro`

- [ ] **Step 1: Create the directory and page**

Run:

```bash
mkdir -p src/pages/tags
```

Then create `src/pages/tags/[tag].astro` with this content:

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import ProjectCard from "../../components/ProjectCard.astro";
import { getCollection } from "astro:content";
import { buildTagIndex } from "../../lib/tag-slugs";

export async function getStaticPaths() {
  const projects = await getCollection("projects", (p) => !p.data.draft);
  const index = buildTagIndex(projects);
  return Array.from(index.entries()).map(([slug, { displayTag, entries }]) => ({
    params: { tag: slug },
    props: {
      displayTag,
      entries: entries
        .slice()
        .sort((a, b) => b.data.startedAt.getTime() - a.data.startedAt.getTime()),
    },
  }));
}

const { displayTag, entries } = Astro.props;
const count = entries.length;
const countLabel = `${count} ${count === 1 ? "project" : "projects"}`;
---

<BaseLayout title={`Projects tagged ${displayTag}`} description={`Projects tagged ${displayTag}.`}>
  <main id="main">
    <h1>Tagged: {displayTag}</h1>
    <p class="meta">{countLabel}</p>
    <p class="back"><a href="/projects/">← All projects</a></p>
    {
      entries.map((p) => (
        <ProjectCard
          href={`/projects/${p.id}/`}
          title={p.data.title}
          summary={p.data.summary}
          tags={p.data.tags}
          displayYear={p.data.displayYear ?? String(p.data.startedAt.getUTCFullYear())}
          status={p.data.status}
        />
      ))
    }
  </main>
</BaseLayout>

<style>
  .meta {
    color: var(--fg-muted);
    font-size: 0.95rem;
    margin: 0 0 var(--sp-2);
  }
  .back {
    margin: 0 0 var(--sp-6);
  }
</style>
```

- [ ] **Step 2: Verify it type-checks and lints**

Run:

```bash
npm run check
```

Expected: passes.

- [ ] **Step 3: Build and verify routes are generated**

Run:

```bash
npm run build
```

Expected: build succeeds. The output should include directories for the current tags, derived from the two project files (`Astro`, `TypeScript`, `HTML`, `CSS`, `Markdown`, `Personal`, `Obsidian`).

Verify:

```bash
ls dist/client/tags/
```

Expected: directories named `astro`, `typescript`, `html`, `css`, `markdown`, `personal`, `obsidian` (one `index.html` inside each).

- [ ] **Step 4: Sanity-check one page in dev**

Run in one terminal:

```bash
npm run dev
```

In a browser, visit:

- `http://localhost:4321/tags/typescript/`
- `http://localhost:4321/tags/astro/`
- `http://localhost:4321/tags/no-such-tag/` (should 404)

Expected:

- `/tags/typescript/` lists both projects, sorted newest first (boring-site → bulk-properties), with the heading "Tagged: TypeScript" and "2 projects".
- `/tags/astro/` lists only `boring-site`, with the heading "Tagged: Astro" and "1 project" (singular).
- The unknown tag page returns the site's 404.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/pages/tags/[tag].astro
git commit -m "Add /tags/[tag] route generating one page per project tag"
```

---

### Task 3: Make ProjectCard tags clickable

**Files:**

- Modify: `src/components/ProjectCard.astro`

- [ ] **Step 1: Update the component**

Open `src/components/ProjectCard.astro`.

Add the import to the frontmatter (just below the existing `interface Props` / destructure block). The frontmatter becomes:

```astro
---
// src/components/ProjectCard.astro
import { tagToSlug } from "../lib/tag-slugs";
interface Props {
  href: string;
  title: string;
  summary: string;
  tags: string[];
  displayYear: string;
  status: "active" | "archived" | "experimental";
}
const { href, title, summary, tags, displayYear, status } = Astro.props;
---
```

Replace the tags `<ul>` (currently `{tags.map((t) => <li>{t}</li>)}`) so each tag is wrapped in an anchor and the year `<li>` carries a `year` class:

```astro
<ul class="tags">
  {
    tags.map((t) => (
      <li>
        <a href={`/tags/${tagToSlug(t)}/`}>{t}</a>
      </li>
    ))
  }
  <li class="year">{displayYear}</li>
</ul>
```

In the `<style>` block, **replace** the existing `.tags li { ... }` rule with the rules below. The pill chrome (border, padding, font, color) moves from the `<li>` to the anchor (and the `year` class for the non-clickable year item) so the entire visible pill is the click target:

```css
.tags a,
.tags .year {
  display: inline-block;
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--border-ui);
  border-radius: 3px;
  color: var(--fg-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.tags a {
  text-decoration: none;
}
.tags a:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

(Focus styling comes from the global `:focus-visible` rule in `src/styles/reset.css` and applies automatically — and now lights up the entire pill since the focus target is the anchor, which is the pill.)

- [ ] **Step 2: Verify it type-checks, lints, and formats**

Run:

```bash
npm run check
```

Expected: passes.

- [ ] **Step 3: Sanity-check in dev**

Run in one terminal:

```bash
npm run dev
```

In a browser:

- Visit `http://localhost:4321/`. Click each tag pill on the featured project cards. Each click should navigate to the corresponding `/tags/<slug>/` page.
- Visit `http://localhost:4321/projects/`. Repeat: every tag pill on every card should link to the right tag page.
- Hover any tag pill: cursor changes to pointer over the entire pill (including the padding/border area, not just the text), and the text gets an underline.
- Click on the padding/border edge of a pill (not the text): navigation should still happen — the whole pill is the click target.
- Tab to a tag pill: the focus ring should outline the entire pill, not just the text.
- The `displayYear` pill (e.g. `2026`) is not interactive — no hover state, no focus ring, no cursor change.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProjectCard.astro
git commit -m "Make ProjectCard tags clickable links to tag pages"
```

---

### Task 4: Convert project detail page tags to pill row

**Files:**

- Modify: `src/pages/projects/[...slug].astro`

- [ ] **Step 1: Update the page**

Open `src/pages/projects/[...slug].astro`.

Add the import to the frontmatter. The imports block becomes:

```astro
---
// src/pages/projects/[...slug].astro
import ProseLayout from "../../layouts/ProseLayout.astro";
import ExternalLink from "../../components/ExternalLink.astro";
import { isExternalHttp } from "../../lib/site.mjs";
import { tagToSlug } from "../../lib/tag-slugs";
import { getCollection, render } from "astro:content";
---
```

(The rest of the frontmatter is unchanged.)

Replace the Tags row in the `<dl>`. The current line:

```astro
<div><dt>Tags</dt><dd>{data.tags.join(", ")}</dd></div>
```

becomes:

```astro
<div>
  <dt>Tags</dt>
  <dd>
    <ul class="tags">
      {
        data.tags.map((t) => (
          <li>
            <a href={`/tags/${tagToSlug(t)}/`}>{t}</a>
          </li>
        ))
      }
    </ul>
  </dd>
</div>
```

In the `<style>` block, add these rules after the existing `.facts dd` rule. The pill chrome lives on the anchor so the entire visible pill is the click target (matching the card treatment from Task 3):

```css
.tags {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.tags a {
  display: inline-block;
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--border-ui);
  border-radius: 3px;
  color: var(--fg-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  text-decoration: none;
}
.tags a:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

(These rules mirror the card pill styling. Astro's scoped CSS keeps them isolated to this page; the rules are short enough that duplication is preferable to a shared partial.)

- [ ] **Step 2: Verify it type-checks, lints, and formats**

Run:

```bash
npm run check
```

Expected: passes.

- [ ] **Step 3: Sanity-check in dev**

Run in one terminal:

```bash
npm run dev
```

In a browser:

- Visit `http://localhost:4321/projects/boring-site/`. The Tags row in the facts list should now show pill-styled anchors instead of comma-joined text.
- Click any pill — it should navigate to the corresponding tag page.
- Click on the padding/border edge of a pill (not the text): navigation should still happen — the whole pill is the click target.
- Tab to a pill: the focus ring should outline the entire pill.
- Visit `http://localhost:4321/projects/bulk-properties/`. Same expectations.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/projects/[...slug].astro
git commit -m "Render project detail page tags as clickable pill row"
```

---

### Task 5: Full verification pass

**Files:**

- May modify (contingent on contrast results): `src/components/ProjectCard.astro`, `src/pages/projects/[...slug].astro`

- [ ] **Step 1: Build and verify sitemap inclusion**

Run:

```bash
npm run build
```

Expected: build succeeds.

Then:

```bash
grep -o "<loc>[^<]*</loc>" dist/client/sitemap-*.xml | grep "/tags/"
```

Expected: one `<loc>` line per generated tag page (e.g. `/tags/typescript/`, `/tags/astro/`, etc.). The set should match what was in `dist/client/tags/` from Task 2 step 3.

- [ ] **Step 2: Run link-check across built HTML**

Run:

```bash
npm run link-check
```

Expected: passes. All `/tags/<slug>/` links from the home page, projects index, project detail pages, and the tag pages themselves resolve to real built files.

- [ ] **Step 3: Run pa11y in a fresh terminal**

In one terminal:

```bash
npm run preview:astro
```

(Wait for `astro preview` to report it's listening on `127.0.0.1:4321`.)

In another terminal:

```bash
npm run pa11y
```

Expected: passes for every URL in the sitemap, including the new `/tags/<slug>/` pages.

If pa11y reports a contrast failure on `.tags a` (i.e. the tag-pill anchors fall short of AAA against `--bg-raised` or `--bg`), proceed to Step 4. Otherwise skip to Step 5.

Stop the `preview:astro` server.

- [ ] **Step 4 (contingent): Fix contrast by switching tag link color to `--fg`**

If and only if pa11y flagged `.tags a` contrast in Step 3:

In `src/components/ProjectCard.astro`, the chrome rule from Task 3 reads:

```css
.tags a,
.tags .year {
  display: inline-block;
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--border-ui);
  border-radius: 3px;
  color: var(--fg-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

Split it so the anchor uses `var(--fg)` while the static year stays `var(--fg-muted)`:

```css
.tags a,
.tags .year {
  display: inline-block;
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--border-ui);
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.tags a {
  color: var(--fg);
}
.tags .year {
  color: var(--fg-muted);
}
```

In `src/pages/projects/[...slug].astro`, change the chrome rule's `color: var(--fg-muted)` line to `color: var(--fg)` (no shared selector to split there since the detail page has only anchors).

Re-run pa11y (Step 3) until it passes.

Commit:

```bash
git add src/components/ProjectCard.astro src/pages/projects/[...slug].astro
git commit -m "Bump tag link color to --fg for AAA contrast"
```

- [ ] **Step 5: Manual collision-detection sanity check (optional, recommended)**

Temporarily edit `src/content/projects/boring-site.md` and add a tag that collides with `TypeScript` — e.g. change `tags: [Astro, TypeScript, ...]` to `tags: [Astro, TypeScript, typescript, ...]`.

Run:

```bash
npm run build
```

Expected: build fails with an error message naming both source tags and the slug, e.g.:

```
Tag slug collision: "TypeScript" and "typescript" both produce slug "typescript".
Add an alias in src/lib/tag-slugs.ts to disambiguate.
```

Revert the change to the project frontmatter (do not commit it).

```bash
git checkout -- src/content/projects/boring-site.md
```

Confirm with:

```bash
git status
```

Expected: clean working tree (or only the contingent contrast commit from Step 4, already committed).

- [ ] **Step 6: Open the PR**

Push the branch and open a PR:

```bash
git push -u origin tag-filtering
gh pr create --title "Add clickable project tags with /tags/[slug]/ filter pages" --body "$(cat <<'EOF'
## Summary

- Tags on project cards (home, `/projects/`) and project detail pages are now anchors that navigate to a per-tag listing.
- New static route `/tags/[tag]/` pre-generates one page per slug; collision detection runs at build time.
- Detail page tag rendering changes from comma-joined text to a pill row matching the cards.

## Test plan

- [ ] `npm run check` passes
- [ ] `npm run build` succeeds; `dist/client/tags/<slug>/index.html` exists for each tag
- [ ] `npm run link-check` passes
- [ ] `npm run pa11y` passes (preview:astro running)
- [ ] Manual: clicking a tag from home, `/projects/`, and a project detail page lands on the correct `/tags/<slug>/` page
- [ ] Sitemap (`dist/client/sitemap-*.xml`) includes the new tag URLs
EOF
)"
```

---

## Spec coverage check

Mapping each spec section to the task that implements it:

| Spec section                                                                         | Implemented by                                                                                                              |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/tags/[tag]/` top-level route                                                       | Task 2                                                                                                                      |
| Slug rule (lowercase, non-alphanumeric → dash)                                       | Task 1                                                                                                                      |
| `tagSlugAliases` map (initially empty)                                               | Task 1                                                                                                                      |
| `tagToSlug(tag)`                                                                     | Task 1                                                                                                                      |
| `buildTagIndex(projects)` with collision detection                                   | Task 1                                                                                                                      |
| `displayTag` from first source tag in iteration order                                | Task 1                                                                                                                      |
| Page heading "Tagged: ${displayTag}", count, "← All projects"                        | Task 2                                                                                                                      |
| Sorted by `startedAt` desc                                                           | Task 2                                                                                                                      |
| `ProjectCard` tag pills become anchors; styling preserved                            | Task 3                                                                                                                      |
| Project detail page tags become pill row                                             | Task 4                                                                                                                      |
| Home and projects index pass through unchanged                                       | Confirmed (Task 3 — no edits to those pages)                                                                                |
| Sitemap includes tag pages                                                           | Task 5 step 1                                                                                                               |
| Link-check covers tag pages                                                          | Task 5 step 2                                                                                                               |
| pa11y / AAA contrast on tag-link anchors                                             | Task 5 steps 3–4                                                                                                            |
| Build-time collision error message                                                   | Task 5 step 5                                                                                                               |
| Empty-slug protection (e.g. tag `"+"` → empty)                                       | Task 1 (extra guard, not in spec but matches the fail-loud principle)                                                       |
| Dedup tags within a single project's frontmatter                                     | Task 1 (extra resilience, not in spec — prevents duplicate tag entries from rendering the same project twice on a tag page) |
| Pill chrome on `<a>` not `<li>` so the entire visible pill is the click/focus target | Tasks 3 and 4                                                                                                               |
