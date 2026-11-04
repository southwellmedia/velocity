/**
 * i18n configuration and locale helpers.
 *
 * Enabled locales come from ./locales.mjs. With a single locale, everything here
 * still works: [lang] routes generate no pages and the language switcher hides.
 */
import { defaultLocale as defaultLocaleValue, locales as localesValue } from './locales.mjs';

export type Locale = (typeof localesValue)[number];

export const locales: readonly Locale[] = localesValue;
export const defaultLocale: Locale = defaultLocaleValue;

/** True when more than one locale is enabled. */
export const isMultilingual = locales.length > 1;

export function isValidLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Locale from a URL path: `/es/blog` → `es`, `/blog` → default locale. */
export function getLocaleFromPath(pathname: string): Locale {
  const first = pathname.split('/').filter(Boolean)[0];
  return isValidLocale(first) ? first : defaultLocale;
}

/**
 * Locale for the page being rendered. Use in any component:
 * `const locale = getLocale(Astro);`
 */
export function getLocale(astro: { currentLocale?: string; url: URL }): Locale {
  // The URL comes first: on a 404, currentLocale is always the default locale
  const first = astro.url.pathname.split('/').filter(Boolean)[0];
  if (isValidLocale(first)) return first;
  return isValidLocale(astro.currentLocale) ? astro.currentLocale : defaultLocale;
}

/** Path without its locale prefix: `/es/blog` → `/blog`. */
export function stripLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (isValidLocale(segments[0]) && segments[0] !== defaultLocale) segments.shift();
  return '/' + segments.join('/');
}

/**
 * BCP 47 tag used for <html lang>, og:locale, hreflang and Intl formatting:
 * `es` → `es-ES`, `pt` → `pt-BR`. A locale that already has a region keeps it.
 */
export function getLocaleTag(locale: string): string {
  const { language, region } = new Intl.Locale(locale).maximize();
  return region ? `${language}-${region}` : locale;
}

/** A language's name in that language: `es` → `Español`, `ja` → `日本語`. */
export function getLocaleName(locale: string): string {
  const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}
