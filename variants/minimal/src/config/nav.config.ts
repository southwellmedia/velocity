/**
 * Navigation & route configuration
 *
 * - `routes`: every static page and its URL slug, per locale. Used to build
 *   localized links, hreflang alternates and the [lang] pages.
 * - `navItems`: what appears in the header and footer nav, in order.
 * - `headerConfig` / `footerConfig`: header CTA and actions, footer extra links.
 *
 * Labels may be translation keys ('nav.blog') or plain text ('Pricing').
 * Astro still routes from the filesystem. This file only controls links and menus.
 * `npm create velocity-astro --pages` adds entries here for you.
 */

export interface RouteDefinition {
  /** URL path for the default locale, without slashes ('' = home). */
  path: string;
  /**
   * Translated slugs for other locales, e.g. { es: 'sobre-nosotros' }. Falls back to `path`.
   * Not available for `blog`, whose pages live in a fixed folder.
   */
  slugs?: Partial<Record<string, string>>;
  /** Set false for pages that only exist in the default locale. */
  localized?: boolean;
}

export const routes = {
  home: { path: '' },
  blog: { path: 'blog' },
  search: { path: 'search', slugs: { es: 'buscar', fr: 'recherche' } },
} satisfies Record<string, RouteDefinition>;

export type RouteId = keyof typeof routes;

export interface NavItem {
  /** Translation key or plain text */
  label: string;
  order: number;
  /** Internal route (localized automatically) */
  route?: RouteId;
  /** Any other link: an absolute path, a #hash or an external URL */
  href?: string;
  external?: boolean;
}

export const navItems: NavItem[] = [
  { label: 'nav.blog', route: 'blog', order: 1 },
  { label: 'nav.search', route: 'search', order: 2 },
];

export interface HeaderAction {
  icon: string;
  href: string;
  /** Translation key or plain text (used as the accessible name) */
  label: string;
  iconOnly?: boolean;
  target?: string;
}

/** Defaults for <Header />. Props passed to Header still win. */
export const headerConfig: {
  cta?: { label: string; href: string };
  actions: HeaderAction[];
  /** Extra items shown before the nav, e.g. landing-page anchors */
  extraNav: NavItem[];
} = {
  actions: [],
  extraNav: [],
};

/** Defaults for <Footer />. */
export const footerConfig: { extraLinks: NavItem[] } = {
  extraLinks: [],
};

/** Navigation items sorted by order. */
export function getNavItems(): NavItem[] {
  return [...navItems].sort((a, b) => a.order - b.order);
}
