import type { APIRoute, GetStaticPaths } from 'astro';
import { generateOGImage } from '@/lib/og';
import siteConfig from '@/config/site.config';
import { routes, type RouteId, type RouteDefinition } from '@/config/nav.config';
import { defaultLocale, isValidLocale, locales, localizeRoute, translate } from '@/i18n';
import { getPosts, getPostUrl } from '@/lib/blog';

/**
 * Open Graph images, generated at build time for every page URL:
 * /og/index.png, /og/about.png, /og/es/index.png, /og/es/sobre-nosotros.png,
 * /og/blog/<slug>.png …
 *
 * SEO.astro points og:image at /og/<page path>.png (or /og/<locale>/index.png
 * for a locale's home page), so this route and SEO.astro must stay in sync.
 */

/** OG slug for a page path: '/' → 'index', '/es' → 'es/index', '/es/blog' → 'es/blog' */
function ogSlug(path: string): string {
  const clean = path.replace(/^\/|\/$/g, '');
  if (!clean) return 'index';
  return isValidLocale(clean) ? `${clean}/index` : clean;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const routeDefs: Record<string, RouteDefinition> = routes;

  const pagePaths = locales.flatMap((locale) =>
    (Object.keys(routes) as RouteId[])
      .filter((id) => locale === defaultLocale || routeDefs[id].localized !== false)
      .map((id) => ({
        params: { slug: ogSlug(localizeRoute(id, locale)) },
        props: {
          title: id === 'home' ? siteConfig.name : translate(locale, `nav.${id}`),
          description: id === 'home' ? siteConfig.description : translate(locale, 'site.tagline'),
          type: 'website' as const,
        },
      })),
  );

  const posts = (await Promise.all(locales.map((locale) => getPosts(locale)))).flat();
  const postPaths = posts.map((post) => ({
    params: { slug: ogSlug(getPostUrl(post)) },
    props: { title: post.data.title, description: post.data.description, type: 'article' as const },
  }));

  // A slug can only be generated once
  const seen = new Set<string>();
  return [...pagePaths, ...postPaths].filter((p) => {
    if (seen.has(p.params.slug)) return false;
    seen.add(p.params.slug);
    return true;
  });
};

export const GET: APIRoute = async ({ props }) => {
  const { title, description, type } = props as {
    title: string;
    description?: string;
    type: 'website' | 'article';
  };

  const png = await generateOGImage({
    title,
    description,
    type,
  });

  // Convert Buffer to Uint8Array for Response compatibility
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
