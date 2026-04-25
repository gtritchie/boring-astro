// src/content.config.ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const writing = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/writing" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.date(),
    updatedAt: z.date().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    status: z.enum(["active", "archived", "experimental"]),
    startedAt: z.date(),
    displayYear: z.string().optional(),
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

const interests = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/interests" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    kind: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writing, projects, interests };
