/**
 * What this project contains, derived from its own config and content, so the
 * E2E suite works in every scaffolded variant (demo, minimal, i18n) and keeps
 * working as you add pages and posts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { routes } from '../../src/config/nav.config';
import { defaultLocale, locales } from '../../src/i18n/locales.mjs';

// Playwright runs from the project root (where playwright.config.ts lives)
const root = process.cwd();
const routeDefs: Record<
  string,
  { path: string; slugs?: Record<string, string>; localized?: boolean }
> = routes;

export const hasRoute = (id: string) => id in routeDefs;

/** Default-locale blog post slugs (non-drafts). */
export const posts = (() => {
  const dir = path.join(root, 'src/content/blog', defaultLocale);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f))
    .filter((f) => !/^draft:\s*true/m.test(fs.readFileSync(path.join(dir, f), 'utf8')))
    .map((f) => f.replace(/\.mdx?$/, ''));
})();

/**
 * Pages to smoke-test: every route except the component showcase, plus every
 * blog post. The showcase is a large demo with its own CSP and dialog tests.
 */
export const PAGES = [
  ...Object.entries(routeDefs)
    .filter(([id]) => id !== 'components')
    .map(([, r]) => `/${r.path}`),
  ...posts.map((slug) => `/blog/${slug}`),
];

/** Every page, for checks that apply everywhere. */
export const ALL_PAGES = [...PAGES, ...(hasRoute('components') ? ['/components'] : [])];

/** Every route in every enabled locale, with its translated slug. */
export const LOCALIZED_PAGES = Object.entries(routeDefs)
  .filter(([id, route]) => id !== 'components' && route.localized !== false)
  .flatMap(([, route]) =>
    (locales as readonly string[]).map((locale) => {
      const slug = route.slugs?.[locale] ?? route.path;
      const parts = locale === defaultLocale ? [slug] : [locale, slug];
      return `/${parts.filter(Boolean).join('/')}/`.replace('//', '/');
    })
  );
