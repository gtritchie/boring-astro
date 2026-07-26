// src/lib/collection-order.ts — the canonical reading order for each content
// collection. Listing pages and the prev/next pagers both sort through here,
// so a pager can never disagree with the list the reader arrived from.

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
