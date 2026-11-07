---
name: velocity-add-locale
description: Add a language to this Velocity site, with its locale code, a complete translation file including the built-in UI strings, translated URL slugs, content and hreflang checks. Use when asked to add a language or locale, translate the site, or make the site multilingual.
---

# Add a locale

**First, read the Project notes in `AGENTS.md`.** They describe this site's own conventions and take priority over the examples here.

Routing, the language switcher, hreflang, the sitemap, `<html lang>`, the localized 404 page and search all follow from the locale list. Don't build any of them by hand. Adding a locale means listing it, translating every string, and translating the URLs.

The examples add German (`de`).

## 1. Choose the locale code

- Use a lowercase language code such as `de`, `pt` or `ja`. The region for `<html lang>` and hreflang is filled in automatically (`de` becomes `de-DE`). Add a region such as `pt-br` only if the user needs two variants of one language. The E2E suite expects `<html lang>` to start with the code exactly.
- The first URL segment decides the locale, so the code must not equal any `path` or slug in `routes` in `src/config/nav.config.ts`, and no slug may equal the code.
- Right-to-left languages such as Arabic, Hebrew, Persian and Urdu need a `dir` attribute that `BaseLayout` doesn't set. Tell the user before adding one, because `src/layouts/` is replaced on upgrade.
- Don't change `defaultLocale`. That changes every existing URL.

## 2. Enable it

In `src/i18n/locales.mjs`, add the code to the array and to its `@type` comment. The comment defines the `Locale` type, so both must match:

```js
/** @type {readonly ['en', 'es', 'fr', 'de']} */
export const locales = /** @type {const} */ (['en', 'es', 'fr', 'de']);
```

## 3. Translate the site copy

Copy `src/i18n/translations/en.ts` to `src/i18n/translations/<locale>.ts` and translate every value. Keep every key, keep `{placeholders}` such as `{minutes}` unchanged, and keep the file complete. A missing key silently falls back to English. Files in this folder are picked up automatically.

## 4. Translate the built-in UI strings

`src/i18n/ui.ts` holds the strings Velocity's components use, such as the navigation, blog, forms, search and accessibility labels. It only ships `en`, `es` and `fr`, and upgrades replace it, so never add a language there.

**For any locale other than `es` and `fr`**, translate every key of the `en` object in `src/i18n/ui.ts` into the same translations file. Keys in the translations file override `ui.ts`. Type the file with both shapes, so `astro check` reports any key you missed:

```ts
import type { UIStrings } from '../ui';
import type { SiteStrings } from './en';

const de: SiteStrings & UIStrings = {
  site: { tagline: '…' },
  // …every key from en.ts, translated
  a11y: { skipToContent: 'Zum Inhalt springen' /* … */ },
  // …every key from the en object in ui.ts, translated
};

export default de;
```

When a later upgrade adds UI strings, `astro check` fails on this file until you translate the new keys. That is intended. For `es` and `fr`, type the file as `SiteStrings`, because `ui.ts` already translates their UI strings.

## 5. Translate the URLs

In `src/config/nav.config.ts`, add the locale to the `slugs` of each route that should have a translated URL:

```ts
about: { path: 'about', slugs: { es: 'sobre-nosotros', fr: 'a-propos', de: 'ueber-uns' } },
contact: { path: 'contact', slugs: { es: 'contacto', de: 'kontakt' } },
```

- A route without a slug for the locale uses its `path`, so `/de/contact/` works too. Translate the slugs the user expects to see translated.
- Use lowercase ASCII kebab-case, and keep each slug unique within the locale.
- `home` and `blog` live in fixed folders under `src/pages/[lang]/`, so they can't have slugs. The build throws an error if you add one.
- Routes marked `localized: false` exist only in the default locale.

## 6. Translate the content

- Blog posts go in `src/content/blog/<locale>/<slug>.mdx`. Use the same file name as the original post, so the language switcher and hreflang link the two versions. A locale with no posts shows an empty blog.
- Entries in other collections with a `locale` field, such as FAQs, need a copy with `locale` set to the new code.
- Ask the user whether to translate the existing posts or leave the blog empty for now.

## 7. Check that hreflang is automatic

After `npm run build`, open the new locale's home page in the client output folder (`de/index.html`) and a translated page. Each should have a `<link rel="alternate" hreflang="…">` for every enabled locale plus `x-default`, and `<html lang="de-DE">`. If one is missing, the route or post isn't matched. Check its slugs and file names. Don't add hreflang tags by hand.

## 8. Check your work

1. Run `npm run validate`. `astro check` reports missing keys in the new translations file.
2. Run `npm run check:agent`. It scans the source and build output for raw translation keys, CSP problems (inline event handlers, unhashed inline scripts), broken internal links and stubbed forms, and prints the file, the rule and the fix for each. Fix everything it reports.
3. Run `npm run build && npm run test:e2e`. `tests/e2e/i18n.spec.ts` checks every non-default locale automatically, including `<html lang>`, hreflang, nav links, the language switcher and the localized 404. `tests/e2e/site.ts` loads every route in every enabled locale. You don't need to add tests. If Playwright has no browser, run `npx playwright install chromium`.
4. Open `/<locale>/`, a translated page, the contact form and the search dialog. Look for English text that fell back, such as form errors or menu labels.
