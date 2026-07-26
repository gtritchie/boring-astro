// src/lib/collection-order.ts — the canonical reading order for each content
// collection. Every listing (index pages, tag pages, the RSS feed) and the
// prev/next pagers sort through here, so a pager steps through entries in the
// order the listing showed them.
//
// This shares the order, not the membership: each page still applies its own
// `!p.data.draft` filter. Adding a second filtering rule to a listing without
// adding it to the matching [...slug].astro would let the pager walk into a
// page the listing hides — nothing here would catch that.

import type { CollectionEntry } from "astro:content";

export function sortWriting(
  posts: readonly CollectionEntry<"writing">[],
): CollectionEntry<"writing">[] {
  return [...posts].sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

// Explicit `order` wins and sorts ascending; everything else falls back to
// newest-first. Entries carrying an order always precede those without one.
export function sortProjects(
  projects: readonly CollectionEntry<"projects">[],
): CollectionEntry<"projects">[] {
  return [...projects].sort((a, b) => {
    const aOrder = a.data.order;
    const bOrder = b.data.order;

    if (aOrder !== undefined && bOrder !== undefined) {
      const diff = aOrder - bOrder;
      if (diff !== 0) return diff;
      return b.data.startedAt.getTime() - a.data.startedAt.getTime();
    }
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    return b.data.startedAt.getTime() - a.data.startedAt.getTime();
  });
}

export function sortInterests(
  interests: readonly CollectionEntry<"interests">[],
): CollectionEntry<"interests">[] {
  return [...interests].sort((a, b) => a.data.title.localeCompare(b.data.title));
}
