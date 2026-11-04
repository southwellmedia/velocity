/**
 * Enabled locales — the single source of truth for routing, the language
 * switcher, hreflang, the sitemap and Astro's `i18n` config.
 *
 * Plain JS (not TS) so astro.config.mjs can import it too.
 *
 * To add a language, list it here. Routes, the language switcher, hreflang,
 * search and content `locale` values all follow from this list. Translate it by
 * adding src/i18n/translations/<locale>.ts: built-in UI strings ship for en, es
 * and fr, and anything untranslated falls back to the default locale.
 * `npm create velocity-astro@latest -- --i18n` sets up es and fr for you.
 */

/** @type {'en'} */
export const defaultLocale = 'en';

/** @type {readonly ['en']} */
export const locales = /** @type {const} */ (['en']);
