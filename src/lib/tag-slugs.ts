import type { CollectionEntry } from "astro:content";

// Explicit slug overrides for tags whose default slug would be poor
// or would collide with another tag. Empty by default — add an entry
// only when buildTagIndex throws, or when a tag would slug to "".
export const tagSlugAliases: Record<string, string> = {
  // "C" and "C++" both default-slug to "c"; route C++ to the conventional
  // "cpp" so plain C keeps the "c" slug.
  "C++": "cpp",
};

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
