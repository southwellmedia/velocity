/**
 * Translation runtime.
 *
 *   const locale = getLocale(Astro);
 *   const t = useTranslations(locale);
 *   t('blog.minRead', { minutes: 5 });
 *
 * Lookup order: your translations[locale] → built-in ui[locale] →
 * your translations[default] → built-in ui[default] → the key itself.
 * Because the key is the last fallback, plain text such as a nav label
 * ('Pricing') can be passed to t() and comes back unchanged.
 */
import { defaultLocale, type Locale } from './config';
import { ui, type UIStrings } from './ui';
import type { SiteStrings } from './translations/en';

export * from './config';
export { localizePath, localizeRoute, getAlternates, getLocalizedStaticPaths } from './paths';

type Dict = Record<string, unknown>;

// Every src/i18n/translations/<locale>.ts is picked up automatically.
const modules = import.meta.glob<{ default: Dict }>('./translations/*.ts', { eager: true });
const site: Record<string, Dict> = {};
for (const [path, mod] of Object.entries(modules)) {
  const locale = path.match(/\/([\w-]+)\.ts$/)?.[1];
  if (locale && mod.default) site[locale] = mod.default;
}

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Known keys get autocomplete; any other string is returned as-is when missing. */
export type TranslationKey = Leaves<UIStrings> | Leaves<SiteStrings> | (string & {});
export type TranslationParams = Record<string, string | number>;

function lookup(dict: Dict | undefined, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Dict)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function translate(locale: string, key: TranslationKey, params?: TranslationParams): string {
  const text =
    lookup(site[locale], key) ??
    lookup(ui[locale] as Dict, key) ??
    lookup(site[defaultLocale], key) ??
    lookup(ui[defaultLocale] as Dict, key) ??
    key;
  return interpolate(text, params);
}

export function useTranslations(locale: Locale | string) {
  return (key: TranslationKey, params?: TranslationParams) => translate(locale, key, params);
}

/** True if a key resolves to a string for this locale (without falling back to the key). */
export function hasTranslation(locale: string, key: string): boolean {
  return translate(locale, key) !== key;
}
