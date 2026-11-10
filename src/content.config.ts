import { defineCollection, type SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { defaultLocale, locales } from './i18n/locales.mjs';
import * as site from './config/collections';

const locale = z.enum(locales).default(defaultLocale);

// src/config/collections.ts is the project's own file, which upgrades leave alone.
// It can export siteCollections (extra collections) and blogFields (extra fields
// for the blog's frontmatter, merged into the schema below). Both are optional.
type BlogFields = typeof site extends { blogFields: (context: SchemaContext) => infer Shape extends z.ZodRawShape }
  ? Shape
  : Record<never, never>;
// The project's collections keep their own types: widening them to a generic
// record would turn every entry's `data` into `unknown`.
type SiteCollections = typeof site extends { siteCollections: infer Collections } ? Collections : Record<never, never>;
const optional = site as { siteCollections?: unknown; blogFields?: (context: SchemaContext) => BlogFields };
const siteCollections = (optional.siteCollections ?? {}) as SiteCollections;
const blogFields = optional.blogFields;

// Blog collection with Content Layer API
const blog = defineCollection({
  // deferRender (Astro 7.1): render Markdown/MDX on demand instead of during
  // content sync — keeps memory flat as the blog grows.
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog', deferRender: true }),
  schema: (context) =>
    z.object({
      title: z.string().max(100),
      description: z.string().max(200),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      author: z.string().default('Team'),
      image: context.image().optional(),
      imageAlt: z.string().optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
      locale,
      ...(blogFields?.(context) ?? ({} as BlogFields)),
    }),
});

// Pages collection for static pages
const pages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updatedAt: z.coerce.date().optional(),
    locale,
  }),
});

// Authors collection
const authors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/authors' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      bio: z.string(),
      avatar: image().optional(),
      social: z
        .object({
          twitter: z.string().optional(),
          github: z.string().optional(),
          linkedin: z.string().optional(),
        })
        .optional(),
    }),
});

// FAQs collection (for JSON-LD FAQ schema)
const faqs = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/faqs' }),
  schema: z.object({
    question: z.string(),
    answer: z.string(),
    category: z.string().optional(),
    order: z.number().default(0),
    locale,
  }),
});

export const collections = {
  blog,
  pages,
  authors,
  faqs,
  ...siteCollections,
};
