/**
 * Locale-aware URLs.
 *
 *   localizeRoute('about', 'es')      → '/es/sobre-nosotros'
 *   localizePath('/blog/my-post', 'es') → '/es/blog/my-post'
 *   getLocalizedStaticPaths('about', 'about') → params for src/pages/[lang]/[...about].astro
 */
import { routes, type RouteId, type RouteDefinition } from '@/config/nav.config';
import { defaultLocale, getLocaleFromPath, locales, stripLocale, type Locale } from './config';

const ROUTES: Record<string, RouteDefinition> = routes;

function slugFor(route: RouteDefinition, locale: string): string {
  return route.slugs?.[locale] ?? route.path;
}

function join(locale: string, slug: string): string {
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  const path = `${prefix}/${slug}`.replace(/\/+$/, '');
  return path || '/';
}

/** Pages build to directories, so their canonical URLs end in a slash. */
export function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/** URL of a route in a locale. Routes marked `localized: false` always use the default locale. */
export function localizeRoute(id: RouteId, locale: Locale | string): string {
  const route = ROUTES[id];
  if (!route) throw new Error(`[i18n] Unknown route "${id}". Add it to routes in src/config/nav.config.ts.`);
  if (route.localized === false) return join(defaultLocale, route.path);
  return join(locale, slugFor(route, locale));
}

/** Find which route a pathname belongs to (any locale). */
export function matchRoute(pathname: string): RouteId | undefined {
  const locale = getLocaleFromPath(pathname);
  const rest = stripLocale(pathname).replace(/^\/|\/$/g, '');
  return (Object.keys(ROUTES) as RouteId[]).find((id) => slugFor(ROUTES[id], locale) === rest);
}

/**
 * Localize an internal href. Known routes get their translated slug, other
 * absolute paths get the locale prefix, and #hashes or external URLs are left alone.
 */
export function localizePath(href: string, locale: Locale | string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const [path, hash = ''] = href.split('#');
  const suffix = hash ? `#${hash}` : '';
  const route = matchRoute(path);
  if (route) return localizeRoute(route, locale) + suffix;
  if (locale === defaultLocale) return href;
  return join(locale, stripLocale(path).replace(/^\//, '')) + suffix;
}

/**
 * hreflang alternates for the current page, or [] when the page isn't a known
 * route or only one locale is enabled. Pages such as blog posts can pass their own.
 */
export function getAlternates(pathname: string): { locale: Locale; href: string }[] {
  if (locales.length < 2) return [];
  const route = matchRoute(pathname);
  if (!route || ROUTES[route].localized === false) return [];
  return locales.map((locale) => ({ locale, href: localizeRoute(route, locale) }));
}

/**
 * getStaticPaths() for a page under src/pages/[lang]/: one entry per
 * non-default locale. `param` is the rest-parameter name in the file name,
 * e.g. [...about].astro → 'about'. Pass `null` when there is no slug param.
 */
export function getLocalizedStaticPaths(id: RouteId, param: string | null) {
  const route = ROUTES[id];
  if (route.localized === false) return [];
  if (param === null && route.path && route.slugs) {
    throw new Error(
      `[i18n] Route "${id}" has translated slugs, but src/pages/[lang]/${route.path}/ is a fixed folder. Remove its slugs in src/config/nav.config.ts.`,
    );
  }
  return locales
    .filter((locale) => locale !== defaultLocale)
    .map((lang) => ({
      params: param ? { lang, [param]: slugFor(route, lang) || undefined } : { lang },
      props: { locale: lang },
    }));
}
