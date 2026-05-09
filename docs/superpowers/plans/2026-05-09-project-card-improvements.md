# Project card improvements — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual project ordering, make the entire `ProjectCard` clickable, and surface an "All projects" link on the home page.

**Architecture:** A new `order` field on the projects collection schema, sorted by a small shared helper used by both project listings. `ProjectCard` uses the standard CSS stretched-link pattern (no JS, no nested anchors) for the whole-card click target. Home page gains a single text link below the featured set.

**Tech Stack:** Astro 6 content collections (Zod schemas), TypeScript, Astro-scoped CSS. No JS runtime work. The repo has no unit test suite — verification is `npm run check`, `npm run build`, and manual browser testing per `CLAUDE.md`.

**Spec:** `docs/superpowers/specs/2026-05-09-project-card-improvements-design.md`

**Branch:** `project-card-improvements` (already created and contains the spec commit).

---

## Task 1: Add `order` to schema and shared sort helper, wire both pages

**Files:**
- Modify: `src/content.config.ts` (projects schema)
- Create: `src/lib/project-sort.ts`
- Modify: `src/pages/index.astro` (replace inline sort)
- Modify: `src/pages/projects/index.astro` (replace inline sort)

### Step 1: Add `order` to the projects schema

In `src/content.config.ts`, add an optional numeric `order` field to the projects collection schema. Insert immediately after `displayYear`:

```ts
const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    status: z.enum(["active", "archived", "experimental"]),
    startedAt: z.date(),
    displayYear: z.string().optional(),
    order: z.number().optional(),
    tags: z.array(z.string()),
    links: z
      .object({
        repo: z.url().optional(),
        site: z.url().optional(),
        docs: z.url().optional(),
      })
      .optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});
```

- [ ] **Step 2: Create the shared sort helper**

Create `src/lib/project-sort.ts` with the agreed sort rule (entries with `order` come first, ascending; entries without `order` follow, by `startedAt` descending; ties on `order` fall back to `startedAt` descending):

```ts
// src/lib/project-sort.ts
type ProjectLike = {
  data: {
    order?: number;
    startedAt: Date;
  };
};

export function sortProjects<T extends ProjectLike>(projects: readonly T[]): T[] {
  return [...projects].sort((a, b) => {
    const aHas = a.data.order !== undefined;
    const bHas = b.data.order !== undefined;

    if (aHas && bHas) {
      const diff = a.data.order! - b.data.order!;
      if (diff !== 0) return diff;
      return b.data.startedAt.getTime() - a.data.startedAt.getTime();
    }
    if (aHas) return -1;
    if (bHas) return 1;
    return b.data.startedAt.getTime() - a.data.startedAt.getTime();
  });
}
```

- [ ] **Step 3: Wire the helper into the home page**

In `src/pages/index.astro`, replace the inline projects sort with `sortProjects`. The full updated block at the top of the frontmatter:

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import ProjectCard from "../components/ProjectCard.astro";
import EntryList from "../components/EntryList.astro";
import { getCollection } from "astro:content";
import { sortProjects } from "../lib/project-sort";

const projects = sortProjects(
  await getCollection("projects", (p) => !p.data.draft && p.data.featured),
).slice(0, 4);

const writing = (await getCollection("writing", (p) => !p.data.draft))
  .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
  .slice(0, 3);

const writingEntries = writing.map((post) => ({
  href: `/writing/${post.id}/`,
  title: post.data.title,
  description: post.data.description,
  date: post.data.publishedAt,
}));
---
```

- [ ] **Step 4: Wire the helper into the projects index**

In `src/pages/projects/index.astro`, replace the inline sort. Updated frontmatter:

```astro
---
// src/pages/projects/index.astro
import BaseLayout from "../../layouts/BaseLayout.astro";
import ProjectCard from "../../components/ProjectCard.astro";
import { getCollection } from "astro:content";
import { sortProjects } from "../../lib/project-sort";

const projects = sortProjects(await getCollection("projects", (p) => !p.data.draft));
---
```

- [ ] **Step 5: Verify type-check, lint, and build**

Run:

```bash
npm run check
npm run build
```

Expected: both succeed cleanly. No new warnings.

- [ ] **Step 6: Manual ordering smoke test**

Temporarily add `order: 1` to the frontmatter of a non-newest featured project (e.g. `src/content/projects/snaker.md`) and run:

```bash
npm run build
```

Open `dist/client/index.html` and confirm Snaker now appears first in the featured list. Then remove the temporary `order` line. (The user will set real `order` values themselves later.)

- [ ] **Step 7: Commit**

```bash
git add src/content.config.ts src/lib/project-sort.ts src/pages/index.astro src/pages/projects/index.astro
git commit -m "Add manual project ordering via order frontmatter field"
```

---

## Task 2: Whole-card click target on `ProjectCard`

**Files:**
- Modify: `src/components/ProjectCard.astro`

### Step 1: Update the card CSS for the stretched-link pattern

In `src/components/ProjectCard.astro`, modify only the `<style>` block. The markup stays exactly as it is (no nested anchors are introduced).

Replace the existing `<style>` block with:

```astro
<style>
  .card {
    position: relative;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: var(--sp-4) var(--sp-5);
    margin-bottom: var(--sp-3);
    transition: border-color 120ms ease;
  }
  .card:hover {
    border-color: var(--border-ui);
  }
  .card h3 {
    font-size: 1.05rem;
    margin: 0 0 var(--sp-2);
  }
  .card h3 a {
    color: var(--fg);
    text-decoration: none;
  }
  .card h3 a::before {
    content: "";
    position: absolute;
    inset: 0;
  }
  .card:hover h3 a {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .summary {
    color: var(--fg-muted);
    font-size: 0.95rem;
    margin: 0 0 var(--sp-3);
    max-width: 60ch;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-3);
  }
  .tags {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .tags li {
    position: relative;
    z-index: 1;
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
  .status {
    font-size: 0.78rem;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
</style>
```

Key changes vs. the existing styles:

- `.card` gets `position: relative` and a hover `border-color` transition.
- `.card h3 a::before` stretches the title link's hit area across the whole card.
- The hover underline on the title now triggers from `.card:hover h3 a` so it fires when the card is hovered, not only the title text.
- `.tags li` gets `position: relative; z-index: 1` so each tag link rises above the stretched hit area.

- [ ] **Step 2: Verify type-check, lint, and build**

Run:

```bash
npm run check
npm run build
```

Expected: both succeed cleanly.

- [ ] **Step 3: Manual click and keyboard verification**

Start the dev server:

```bash
npm run dev
```

Visit `http://localhost:4321/projects/`. Verify:

1. Clicking on the card body (title, summary, empty space) navigates to the project page.
2. Clicking on a tag chip navigates to the corresponding `/tags/<slug>/` page (NOT the project page).
3. Clicking on the status pill (when present) navigates to the project page.
4. Pressing Tab moves focus to the title link first, with a visible focus ring on the title text. Pressing Tab again moves to the first tag link. Order: title → tag 1 → tag 2 → ... → next card's title.
5. Hovering anywhere on the card darkens the border and underlines the title.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProjectCard.astro
git commit -m "Make entire ProjectCard clickable via stretched-link pattern"
```

---

## Task 3: "All projects" link on the home page

**Files:**
- Modify: `src/pages/index.astro`

### Step 1: Add the link below the featured projects

In `src/pages/index.astro`, add a small link element immediately after the `projects.map(...)` block and before the "Recent writing" section. Updated `<main>`:

```astro
<main id="main">
  <h1>Gary's Personal Site</h1>
  <p class="intro">Software projects, interests, and an occasional note.</p>

  <h2 class="section-label">Featured projects</h2>
  {
    projects.map((p) => (
      <ProjectCard
        href={`/projects/${p.id}/`}
        title={p.data.title}
        summary={p.data.summary}
        tags={p.data.tags}
        status={p.data.status}
      />
    ))
  }
  <p class="all-projects-link">
    <a href="/projects/">All projects &rarr;</a>
  </p>

  <h2 class="section-label">Recent writing</h2>
  <EntryList entries={writingEntries} />
</main>
```

### Step 2: Add the styles for the link

In the same file, append a rule to the existing `<style>` block:

```astro
<style>
  .intro {
    font-size: 1.1rem;
    max-width: 42ch;
    margin-bottom: var(--sp-10);
  }
  .section-label {
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
    margin: var(--sp-10) 0 var(--sp-4);
  }
  .all-projects-link {
    margin: var(--sp-2) 0 0;
    font-size: 0.95rem;
  }
  .all-projects-link a {
    color: var(--fg-muted);
    text-decoration: none;
  }
  .all-projects-link a:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
    color: var(--fg);
  }
</style>
```

- [ ] **Step 3: Verify type-check, lint, and build**

Run:

```bash
npm run check
npm run build
```

Expected: both succeed cleanly.

- [ ] **Step 4: Manual verification**

Start the dev server:

```bash
npm run dev
```

Visit `http://localhost:4321/`. Verify:

1. An "All projects →" link appears immediately below the last featured project card and above the "Recent writing" heading.
2. Clicking it navigates to `/projects/`.
3. Hovering it underlines and darkens to `--fg`.
4. The header nav `Projects` link still works and is unchanged.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro
git commit -m "Add All projects link below featured projects on home page"
```

---

## Final verification

After all three tasks are committed, run the full local check suite to make sure nothing regressed:

- [ ] **Step 1: Run check + build + link-check**

```bash
npm run check
npm run link-check
```

Expected: both succeed.

- [ ] **Step 2: Run pa11y against the preview**

In one terminal:

```bash
npm run preview:astro
```

In another terminal:

```bash
npm run pa11y
```

Expected: pa11y reports no AAA violations. Stop the preview server when done.

- [ ] **Step 3: Push the branch and open a PR**

```bash
git push -u origin project-card-improvements
gh pr create --title "Project card improvements" --body "$(cat <<'EOF'
## Summary
- Add optional `order` frontmatter field on projects; ordered entries come first (ascending), then unordered entries by `startedAt` descending. Applies to both the home-page featured list and `/projects/`.
- Make the entire `ProjectCard` clickable via the standard CSS stretched-link pattern. Tag links remain individually clickable. No JS, no nested anchors. Title link is still the only card-level focusable element.
- Add an "All projects →" link below the featured set on the home page.

## Test plan
- [ ] `npm run check` and `npm run build` pass
- [ ] `npm run link-check` passes
- [ ] `npm run pa11y` passes against `npm run preview:astro`
- [ ] Manual: clicking anywhere on a project card except a tag navigates to the project page
- [ ] Manual: clicking a tag navigates to the tag page
- [ ] Manual: keyboard Tab order is title → tag 1 → tag 2 → next card's title
- [ ] Manual: setting `order: 1` on a non-newest featured project moves it to the top
EOF
)"
```
