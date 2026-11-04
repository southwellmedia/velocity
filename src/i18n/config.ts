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

/** Display names, keyed by locale code. Add an entry when you add a locale. */
export const localeNames: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
  nl: 'Nederlands',
  ja: '日本語',
};

/** BCP 47 tags used for <html lang>, og:locale, hreflang and Intl formatting. */
export const localeTags: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  it: 'it-IT',
  nl: 'nl-NL',
  ja: 'ja-JP',
};

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
  return isValidLocale(astro.currentLocale) ? astro.currentLocale : getLocaleFromPath(astro.url.pathname);
}

/** Path without its locale prefix: `/es/blog` → `/blog`. */
export function stripLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (isValidLocale(segments[0]) && segments[0] !== defaultLocale) segments.shift();
  return '/' + segments.join('/');
}

export function getLocaleTag(locale: string): string {
  return localeTags[locale] ?? locale;
}
