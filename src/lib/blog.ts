/**
 * Blog helpers — the one place that knows how posts map to URLs.
 *
 * Posts live in src/content/blog/<locale>/<slug>.mdx and are served at
 * /blog/<slug> (default locale) or /<locale>/blog/<slug>.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { defaultLocale, isValidLocale, type Locale } from '@/i18n/config';
import { localizeRoute } from '@/i18n/paths';
import { getReadingTime } from '@/lib/utils';

export type BlogPost = CollectionEntry<'blog'>;

/** Locale of a post: its folder (en/…), else its frontmatter `locale`. */
export function getPostLocale(post: BlogPost): Locale | string {
  const folder = post.id.split('/')[0];
  return isValidLocale(folder) ? folder : post.data.locale;
}

/** URL slug of a post, without the locale folder: 'en/hello-world' → 'hello-world'. */
export function getPostSlug(post: BlogPost): string {
  const [first, ...rest] = post.id.split('/');
  return rest.length && (isValidLocale(first) || first === post.data.locale) ? rest.join('/') : post.id;
}

export function getPostUrl(post: BlogPost): string {
  return `${localizeRoute('blog', getPostLocale(post))}/${getPostSlug(post)}`;
}

export function getPostReadingTime(post: BlogPost): number {
  return getReadingTime(post.body ?? '');
}

/** Published posts for a locale (drafts are included in dev), newest first. */
export async function getPosts(locale: Locale | string = defaultLocale): Promise<BlogPost[]> {
  const posts = await getCollection(
    'blog',
    (post) => getPostLocale(post) === locale && (import.meta.env.PROD ? post.data.draft !== true : true),
  );
  return posts.sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
}
