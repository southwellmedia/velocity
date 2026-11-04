/**
 * What this project contains, derived from its own config and content, so the
 * E2E suite works in every scaffolded variant (demo, minimal, i18n) and keeps
 * working as you add pages and posts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { routes } from '../../src/config/nav.config';
import { defaultLocale } from '../../src/i18n/locales.mjs';

// Playwright runs from the project root (where playwright.config.ts lives)
const root = process.cwd();
const routeDefs: Record<string, { path: string; localized?: boolean }> = routes;

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
 * Pages to smoke-test: every route except the component showcase (a large demo
 * of every component, covered by its own checks) plus every blog post.
 */
export const PAGES = [
  ...Object.entries(routeDefs)
    .filter(([id]) => id !== 'components')
    .map(([, r]) => `/${r.path}`),
  ...posts.map((slug) => `/blog/${slug}`),
];
