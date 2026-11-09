---
name: velocity-add-page
description: Add a new page or route to this Velocity site, with its view, locale wrappers, nav entry and translated copy. Use when asked to create a page such as Pricing, Team or FAQ, or to add a route to the site. To set up or rebuild the whole site, use velocity-start-site.
---

# Add a page

**First, read the Project notes in `AGENTS.md`.** They describe this site's own conventions and take priority over the examples here.

`PageLayout` renders the site's header and footer from `src/components/site/`, so a new page matches the rest of the site. For page content, reach for `Section`, `PageHeader` and `MediaSlot` in `src/components/patterns/` and the sections in `src/components/blocks/` (`PageHero`, `FeatureGrid`, `FeatureSplit`, `Pricing`, `StatsBand`, `LogoCloud`, `Team`, `Timeline`, `ContactSection`, `CtaBand`, `Faq`, `Steps`, `Testimonials`, `Hours`) first.

Before you write page content, read `.agents/components.md`. It lists every component Velocity ships, with import paths, props, variants and examples, so you can compose the page from existing components instead of reading their source or writing new markup. Check that a component's import path exists in this project before using it; to add a missing one, use the `velocity-add-component` skill.

A Velocity page is a view plus thin wrappers, registered in the route config. Creating only `src/pages/<slug>.astro` leaves the page without localized URLs, hreflang links or test coverage.

## Choose the names

For a page called "Pricing Plans":

| Name | Value | Rule |
|------|-------|------|
| Route id | `pricingPlans` | camelCase |
| Slug | `pricing-plans` | kebab-case |
| View | `PricingPlansView` | PascalCase + `View` |
| Copy namespace | `pricingPlansPage` | route id + `Page` |

Check `routes` in `src/config/nav.config.ts` first. The slug must not match an existing route or an enabled locale code in `src/i18n/locales.mjs`.

## Create the files

**1. View: `src/views/PricingPlansView.astro`.** All content goes here.

```astro
---
import PageHeader from '@/components/patterns/PageHeader.astro';
import Section from '@/components/patterns/Section.astro';
import PageLayout from '@/layouts/PageLayout.astro';
import { useTranslations, type Locale } from '@/i18n';

interface Props {
  locale: Locale;
}

const { locale } = Astro.props;
const t = useTranslations(locale);
---

<PageLayout title={t('pricingPlansPage.title')} description={t('pricingPlansPage.description')}>
  <PageHeader title={t('pricingPlansPage.title')} lead={t('pricingPlansPage.description')} />
  <Section>
    <!-- Page content -->
  </Section>
</PageLayout>
```

Don't add a `<main>`, because `BaseLayout` owns it. Use one `<h1>` and don't skip heading levels.

**2. Default-locale wrapper: `src/pages/pricing-plans.astro`.**

```astro
---
import PricingPlansView from '@/views/PricingPlansView.astro';
import { defaultLocale } from '@/i18n';
---

<PricingPlansView locale={defaultLocale} />
```

**3. Localized wrapper: `src/pages/[lang]/[...pricingPlans].astro`.** Add this even on a single-locale site. It generates nothing until another locale is enabled.

```astro
---
import PricingPlansView from '@/views/PricingPlansView.astro';
import { getLocalizedStaticPaths, type Locale } from '@/i18n';

export function getStaticPaths() {
  return getLocalizedStaticPaths('pricingPlans', 'pricingPlans');
}

const { locale } = Astro.props as { locale: Locale };
---

<PricingPlansView locale={locale} />
```

The second argument must match the rest parameter in the file name.

## Register the route

In `src/config/nav.config.ts`, add the page to `routes`:

```ts
pricingPlans: { path: 'pricing-plans' },
```

- Translated URLs: `{ path: 'pricing-plans', slugs: { es: 'precios' } }`.
- Default locale only: `{ path: 'pricing-plans', localized: false }`, and skip step 3.

If the page belongs in the menus, add it to `navItems` with the next `order` value:

```ts
{ label: 'pricingPlansPage.title', route: 'pricingPlans', order: 3 },
```

`navItems` feeds both the header and the default footer. For a link in only one of them, edit `src/components/site/SiteHeader.astro` or `SiteFooter.astro` instead. Check how the footer is built first: `footerConfig.extraLinks` only appears in the `simple` and `stacked` layouts.

## Add the copy

Add a namespace to every file in `src/i18n/translations/`:

```ts
pricingPlansPage: {
  title: 'Pricing Plans',
  description: 'One sentence that also serves as the meta description.',
},
```

The page's social image uses `nav.<routeId>` if it exists, then `title`. For a shorter menu and image label, add `nav: { pricingPlans: 'Pricing' }` and use `nav.pricingPlans` as the `navItems` label.

Translate the copy in non-English files. Don't add page copy to `src/i18n/ui.ts`, because upgrades replace it.

## Link to it

Use `localizeRoute('pricingPlans', locale)` for links in code. `navItems` entries are localized automatically.

## Verify

1. Run `npm run validate`.
2. Run `npm run build && npm run test:e2e`. `tests/e2e/site.ts` adds the route's default-locale URL to the page checks, including axe and console errors. If Playwright has no browser, run `npx playwright install chromium`.
3. `npm test` fails if a literal key such as `t('pricingPlansPage.title')` has no string. Keys built at runtime aren't checked, so open any page that uses them.
4. The e2e suite loads the route in every enabled locale, but runs axe on the default locale only. Open the translated page to check its copy and layout.
