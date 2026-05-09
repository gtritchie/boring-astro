# Project card improvements — design

Three related improvements to how projects appear and behave across the site:

1. **Manual ordering** of projects via a new optional frontmatter field.
2. **Whole-card click target** on every `ProjectCard`, while preserving tag links and keyboard tab order.
3. **"All projects" discovery link** on the home page beneath the featured set.

## 1. Manual ordering

### Schema

Add an optional numeric field to the `projects` collection in `src/content.config.ts`:

```ts
order: z.number().optional(),
```

### Sort rule

Both project listings (home-page featured set and `/projects/` index) use the same rule:

- Entries with `order` defined come first, sorted ascending by `order` (lower numbers first).
- Entries without `order` follow, sorted by `startedAt` descending (current default).
- Ties between equal `order` values fall back to `startedAt` descending.

This lets a few "pinned" projects be placed deliberately while everything else keeps the chronological default.

### Implementation

Extract the comparator into `src/lib/project-sort.ts` so home and `/projects/` can't drift:

```ts
export function sortProjects<T extends { data: { order?: number; startedAt: Date } }>(
  projects: readonly T[],
): T[] { ... }
```

Both `src/pages/index.astro` and `src/pages/projects/index.astro` call this helper instead of an inline `.sort()`.

The home page continues to slice the first 4 featured projects after sorting.

## 2. Whole-card click target

### Pattern

Standard "stretched link" pattern, no JavaScript, no nested anchors:

- `.card` becomes `position: relative`.
- The title `<a>` gets a `::before` pseudo-element: `content: ""; position: absolute; inset: 0;`. That stretches its hit area to fill the card.
- Tag `<a>` elements get `position: relative; z-index: 1` so they sit above the stretched hit area and keep their own click behaviour.
- The status pill is purely decorative and gets no special treatment.

### Tab order and focus

- The title `<a>` remains the only focusable element representing the card itself (current behaviour — unchanged).
- Tag links remain focusable in their existing order.
- Title link's existing focus-visible style is unchanged.

### Hover

The hover affordance moves up to the whole card so the click target is discoverable from anywhere on it:

- Card border darkens slightly on hover by switching from `--border` to `--border-ui` (both already defined in `tokens.css`) to signal interactivity.
- Title underline-on-hover is preserved and triggered when the card is hovered, not just when the title text is hovered, so the title still feels like the link.

### Accepted tradeoff

Mouse-drag text selection inside the card becomes harder: the stretched link intercepts `mousedown` over most of the card. Browsers still distinguish click from drag via mouseup distance heuristics, so selection is possible but not as smooth as today. This is the standard tradeoff for the pattern and is accepted in exchange for the larger click target.

## 3. "All projects" link on home page

Add a single discovery link directly under the featured cards on the home page, between the project list and the "Recent writing" section.

- Text: `All projects →`
- Element: plain anchor inside a small wrapper, left-aligned with the cards.
- Style: muted (`var(--fg-muted)`), no decoration by default, underline on hover. No new CSS variables needed; reuse existing typography scale.
- Header nav link to `/projects/` is unchanged.

## Out of scope

- Reordering UI or admin tooling — frontmatter is the source of truth.
- Changes to the `/projects/` page layout beyond the new sort.
- Changes to writing or interests collections.
- Animated card transitions.

## Verification

- `npm run check` passes (Astro type check, Prettier, ESLint).
- `npm run build` succeeds with the new `order` field present on at least one project (manual verification entry).
- `npm run pa11y` continues to pass; the stretched-link pattern preserves the existing focusable element and adds no new ARIA.
- Manual: clicking anywhere on a card except a tag navigates to the project page; clicking a tag goes to the tag page; keyboard Tab still lands on the title link first, then each tag in order.
