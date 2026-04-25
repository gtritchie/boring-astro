# Project tag filtering — design spec

**Date:** 2026-04-25
**Author:** Gary Ritchie
**Status:** Approved — ready for implementation plan

---

## Summary

Tags on project cards (home page, projects index) and project detail pages become clickable. Clicking a tag navigates to a statically-generated `/tags/[slug]/` page that lists every non-draft project carrying that tag. Tag-based browsing for the `writing` collection is out of scope for this spec but the URL structure leaves room to add it later without migration.

## Goals

- Every visible tag on the site is a navigation control: home page project cards, `/projects/` index, and project detail pages.
- Filtered listing pages are real, static, link-checkable, sitemap-indexed routes — no client-side query-string filtering or JavaScript.
- Tag URLs are readable (`/tags/typescript/`, not `/tags/c%2b%2b/`).
- Tag display preserves the original casing from the source frontmatter (`TypeScript`, not `typescript`).
- Slug collisions (e.g. `C++` vs `C#`) fail the build with an actionable error rather than silently mapping two tags to the same page.
- Visual treatment of tags is consistent everywhere they appear (pill style on cards now applies on the detail page too).

## Non-goals

- No tag filtering for `writing` or `interests` collections in this iteration. Writing tags exist in the schema but are not rendered anywhere today; making them clickable is a separate UX decision.
- No `/tags/` index page listing every tag with counts. The site's tag set is small (~6 unique tags across 2 projects); a tag index would feel padded. "← All projects" from each tag page provides the navigation escape.
- No client-side tag-multi-select, search-within-tag, or sort controls on the tag pages.
- No author-facing config knobs beyond the alias map described below.
- No backwards-compatibility for the prior comma-joined tag rendering on the detail page — it's replaced.

## URL structure

- `/tags/[tag]/` — top-level, not nested under `/projects/`. Chosen over `/projects/tags/[tag]/` so the same URL space can later host writing/interest filtering without a redirect.
- The `[tag]` URL segment is always a slug (lowercase, dash-separated, alias-mapped where applicable — see Slugging rules below).
- Unknown tag URLs naturally 404. Only slugs that exist as built paths are generated.

## Slugging rules

A new module `src/lib/tag-slugs.ts` exports:

```ts
export const tagSlugAliases: Record<string, string> = {};

export function tagToSlug(tag: string): string;

export function buildTagIndex(
  projects: CollectionEntry<"projects">[],
): Map<string, { displayTag: string; entries: CollectionEntry<"projects">[] }>;
```

**`tagToSlug(tag)`:**

1. If `tagSlugAliases[tag]` is defined, return it verbatim.
2. Otherwise: lowercase the tag, replace any run of non-`[a-z0-9]` characters with a single `-`, trim leading/trailing dashes.

Examples:

| Source tag                         | Slug          |
| ---------------------------------- | ------------- |
| `TypeScript`                       | `typescript`  |
| `HTML`                             | `html`        |
| `Vue.js`                           | `vue-js`      |
| `Objective-C`                      | `objective-c` |
| `C++` (with alias `"C++": "cpp"`)  | `cpp`         |
| `C#` (with alias `"C#": "csharp"`) | `csharp`      |

The alias map starts **empty** — no current tag needs an override. Entries are added only when a future tag would produce a poor or colliding slug.

**`buildTagIndex(projects)`:**

- Iterates non-draft projects, slugs each tag, accumulates entries by slug.
- For each slug, `displayTag` is taken from the first project (in iteration order) that uses any source tag mapping to that slug.
- Throws if two **distinct** source tags slug to the same value (this includes case-only differences like `JavaScript` vs `javascript` — author must normalize), with a message like:
  ```
  Tag slug collision: "C++" and "C#" both produce slug "c".
  Add an alias in src/lib/tag-slugs.ts (e.g. "C++": "cpp", "C#": "csharp").
  ```
- Same source tag appearing across multiple projects is normal and not a collision.

## Routing & data flow

New file: `src/pages/tags/[tag].astro` (single-segment dynamic route, matching the project's existing convention for non-rest dynamic routes).

```ts
export async function getStaticPaths() {
  const projects = await getCollection("projects", (p) => !p.data.draft);
  const index = buildTagIndex(projects); // throws on collision
  return Array.from(index.entries()).map(([slug, { displayTag, entries }]) => ({
    params: { tag: slug },
    props: {
      displayTag,
      entries: entries.sort((a, b) => b.data.startedAt.getTime() - a.data.startedAt.getTime()),
    },
  }));
}
```

Page renders inside `BaseLayout`:

- `<title>` — `Projects tagged ${displayTag}`
- `<meta name="description">` — `Projects tagged ${displayTag}.`
- `<h1>` — `Tagged: ${displayTag}`
- Count line — e.g. `2 projects` (singular for 1)
- `← All projects` link to `/projects/`
- Reuses `ProjectCard` per entry, sorted by `startedAt` descending (matches `/projects/`)

## Component changes

### `src/components/ProjectCard.astro`

- Imports `tagToSlug` from `src/lib/tag-slugs.ts`.
- Each tag `<li>` becomes `<li><a href={\`/tags/${tagToSlug(tag)}/\`}>{tag}</a></li>`.
- The `displayYear` `<li>` and the status `<span>` stay as plain text.
- Component prop signature is unchanged (`tags: string[]`); slugging is internal.
- Scoped CSS gains:
  ```css
  .tags a {
    color: inherit;
    text-decoration: none;
  }
  .tags a:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  ```
  Focus styling is provided by the global `:focus-visible` rule in `src/styles/reset.css` (`outline: 3px solid var(--focus-ring)`) and applies automatically to the new anchors. No per-component focus rule needed.

### `src/pages/projects/[...slug].astro`

The Tags row in the `<dl>`:

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

Scoped CSS for `.tags` on this page mirrors the card pill rules (small font, monospace, bordered pill, `var(--fg-muted)` color, link-inherit + hover-underline). Rules are duplicated rather than shared because Astro scoping makes cross-component sharing awkward and the rule set is short.

### Pages that stay the same

`src/pages/index.astro` and `src/pages/projects/index.astro` already pass `tags` through to `ProjectCard`. No change needed — link logic is internal to the card.

## Accessibility

- Pill text currently uses `var(--fg-muted)` against `var(--bg-raised)` (cards) and `var(--bg)` (detail page). That contrast was approved for static labels; it must be re-verified for link targets. If it falls short of AAA in either light or dark theme, switch pill link color to `var(--fg)`.
- Hover-underline is supplemented by the pill's existing visual distinctness (border, padding, monospace) plus the standard link cues (cursor, focus ring). pa11y will confirm this is sufficient.
- `npm run pa11y` runs against every sitemap URL; once tag pages are sitemap-indexed they're audited automatically.

## Verification

| Concern                   | Mechanism                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Slug collisions           | `buildTagIndex` throws at build time with both source tags named                                                   |
| Type safety               | `astro check` (part of `npm run check`) covers the new `.ts` module and `.astro` page                              |
| Lint/format               | `eslint` + `prettier --check` (part of `npm run check`)                                                            |
| Internal link health      | `npm run link-check` walks built HTML, including tag pages                                                         |
| Sitemap inclusion         | Astro sitemap integration auto-discovers built routes; verify `/tags/*` URLs appear in `dist/client/sitemap-*.xml` |
| AAA contrast on tag links | `npm run pa11y` against `preview:astro`                                                                            |
| Manual sanity             | `npm run preview` (wrangler) — click a tag from each surface, confirm correct page renders                         |

No unit tests are added. The repo has no unit-test suite; CI verification is lint, types, link-check, and pa11y.

## Out of scope (explicitly noted for future iterations)

- A `/tags/` index page (could be added later if the tag set grows).
- Writing tag rendering and clickability.
- Tag aliasing for "this tag means the same thing as that tag" (e.g. `JS` ≡ `JavaScript`). The current alias map is for slug collision avoidance only; semantic aliasing is a separate problem with separate UX implications.
- Per-tag RSS feeds.
