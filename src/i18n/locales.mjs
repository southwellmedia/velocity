/**
 * Enabled locales — the single source of truth for routing, the language
 * switcher, hreflang, the sitemap and Astro's `i18n` config.
 *
 * Plain JS (not TS) so astro.config.mjs can import it too.
 *
 * To add languages, list them here and add a site-copy file per locale in
 * src/i18n/translations/ (UI strings for en, es and fr ship in src/i18n/ui.ts).
 * `npm create velocity-astro --i18n` does this for you.
 */

/** @type {'en'} */
export const defaultLocale = 'en';

/** @type {readonly ['en']} */
export const locales = /** @type {const} */ (['en']);
