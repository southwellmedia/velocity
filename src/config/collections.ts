/**
 * Project-specific content, merged into src/content.config.ts.
 *
 * Add collections here rather than in content.config.ts, which upgrades replace.
 * Upgrades never overwrite this file.
 *
 *   siteCollections  your own collections, by name
 *   blogFields       extra frontmatter fields for Velocity's blog, e.g.
 *
 *     import { z } from 'astro/zod';
 *     import type { SchemaContext } from 'astro:content';
 *     export const blogFields = ({ image }: SchemaContext) => ({
 *       category: z.enum(['guide', 'news']).default('news'),
 *       cover: image().optional(),
 *     });
 */
export const siteCollections = {};
