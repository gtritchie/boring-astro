// src/pages/rss.xml.ts
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const posts = (await getCollection("writing", p => !p.data.draft))
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());

  return rss({
    title: "Boring by Design",
    description: "Writing from Gary Ritchie.",
    site: context.site!.toString(),
    items: posts.map(p => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.publishedAt,
      link: `/writing/${p.id}/`,
    })),
    customData: "<language>en-ca</language>",
  });
}
