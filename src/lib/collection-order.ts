// src/lib/collection-order.ts — the canonical reading order for each content
// collection. Listing pages and the prev/next pagers both sort through here, so
// a pager steps through entries in the order the listing showed them.
//
// This shares the order, not the membership: each page still applies its own
// `!p.data.draft` filter. Adding a second filtering rule to a listing without
// adding it to the matching [...slug].astro would let the pager walk into a
// page the listing hides — nothing here would catch that.

type WritingLike = {
  data: {
    publishedAt: Date;
  };
};

type ProjectLike = {
  data: {
    order?: number;
    startedAt: Date;
  };
};

type InterestLike = {
  data: {
    title: string;
  };
};

export function sortWriting<T extends WritingLike>(posts: readonly T[]): T[] {
  return [...posts].sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

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

export function sortInterests<T extends InterestLike>(interests: readonly T[]): T[] {
  return [...interests].sort((a, b) => a.data.title.localeCompare(b.data.title));
}
