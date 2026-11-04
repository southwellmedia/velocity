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
  about: { path: 'about', slugs: { es: 'sobre-nosotros', fr: 'a-propos' } },
  contact: { path: 'contact', slugs: { es: 'contacto' } },
  search: { path: 'search', slugs: { es: 'buscar', fr: 'recherche' } },
  components: { path: 'components', localized: false },
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
  { label: 'nav.components', route: 'components', order: 1 },
  { label: 'nav.blog', route: 'blog', order: 2 },
  { label: 'nav.about', route: 'about', order: 3 },
  { label: 'nav.contact', route: 'contact', order: 4 },
  { label: 'nav.search', route: 'search', order: 5 },
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
  cta: { label: 'nav.docs', href: 'https://docs.deployvelocity.com' },
  actions: [
    {
      icon: 'github',
      href: 'https://github.com/southwellmedia/velocity',
      label: 'nav.github',
      iconOnly: true,
      target: '_blank',
    },
  ],
  extraNav: [{ label: 'nav.features', href: '/#features', order: 0 }],
};

/** Defaults for <Footer />. */
export const footerConfig: { extraLinks: NavItem[] } = {
  extraLinks: [
    { label: 'GitHub', href: 'https://github.com/southwellmedia/velocity', external: true, order: 100 },
    { label: 'License', href: 'https://github.com/southwellmedia/velocity/blob/main/LICENSE', external: true, order: 101 },
  ],
};

/** Navigation items sorted by order. */
export function getNavItems(): NavItem[] {
  return [...navItems].sort((a, b) => a.order - b.order);
}
