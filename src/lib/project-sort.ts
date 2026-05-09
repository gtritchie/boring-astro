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
