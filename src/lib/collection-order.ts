// src/lib/collection-order.ts — canonical membership and reading order for each
// content collection. Every listing (index pages, tag pages, the RSS feed) and
// the prev/next pagers load entries through listWriting/listProjects/
// listInterests, so drafts are excluded and entries are ordered the same way
// everywhere. A listing and its pager can't drift apart: tightening membership
// here tightens both at once.

import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

export async function listWriting(): Promise<CollectionEntry<"writing">[]> {
  return sortWriting(await getCollection("writing", (p) => !p.data.draft));
}

export async function listProjects(): Promise<CollectionEntry<"projects">[]> {
  return sortProjects(await getCollection("projects", (p) => !p.data.draft));
}

export async function listInterests(): Promise<CollectionEntry<"interests">[]> {
  return sortInterests(await getCollection("interests", (p) => !p.data.draft));
}

// The {href, title} pair EntryPager renders. Neighbours in getStaticPaths are
// `entries[i ± 1]`, undefined at either end of the chain — the guard lives here
// so call sites can pass the indexed access straight through
// (noUncheckedIndexedAccess types it `| undefined`).
//
// The href leans on the routing invariant that /{collection}/{id}/ is every
// entry's URL — routes mirror collection names by design.
export function pagerLink(
  entry: CollectionEntry<"writing" | "projects" | "interests"> | undefined,
): { href: string; title: string } | undefined {
  return entry && { href: `/${entry.collection}/${entry.id}/`, title: entry.data.title };
}

function sortWriting(posts: readonly CollectionEntry<"writing">[]): CollectionEntry<"writing">[] {
  return [...posts].sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

// Explicit `order` wins and sorts ascending; everything else falls back to
// newest-first. Entries carrying an order always precede those without one.
function sortProjects(
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

function sortInterests(
  interests: readonly CollectionEntry<"interests">[],
): CollectionEntry<"interests">[] {
  return [...interests].sort((a, b) => a.data.title.localeCompare(b.data.title));
}
