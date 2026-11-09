# Velocity project rules

Maintained by Velocity and replaced on upgrade. Put project-specific rules in `AGENTS.md`.

## Stack

Astro 7 · Tailwind CSS v4 · TypeScript (strict) · React 19 islands · Node ≥22.23.4

## Commands

Examples use npm. Use the package manager this project was installed with.

| Task | Command |
|------|---------|
| Dev server (background, safe for agents) | `npm run dev:bg`, then `npx astro dev status`, `npx astro dev logs`, `npx astro dev stop` |
| Health check | `GET http://localhost:<port>/_astro/status` |
| Full validation | `npm run validate` (lint → check → unit tests → build → agent-ready check) |
| Agent-ready check | `npm run check:agent` after a build; `-- --json` for machine-readable output |
| Unit tests | `npm test` |
| E2E + a11y | `npm run build && npm run test:e2e` |

Get the port from the `dev:bg` output or `npx astro dev status`. If 4321 is taken, Astro uses the next free port, and a request to 4321 may be answered by a different site.

A lockfile prevents duplicate dev servers. Use `astro dev --ignore-lock` only if you deliberately need a second one.

## Where things live

- `src/components/site/`: this site's `SiteHeader` and `SiteFooter`. Every layout renders them, so change the header or footer here, never in `src/layouts/` or `src/components/layout/`.
- `src/styles/theme.css`: picks the active theme. Themes load last, so they can override any token. `--brand-hue` recolours the brand scale.
- `src/views/`: page content. `src/pages/*.astro` are thin wrappers that render a view with a locale, and `src/pages/[lang]/` holds the localized wrappers. The 404 page's content is `src/views/NotFoundView.astro`, so customize it there, not in `src/pages/404.astro`.
- `src/components/ui/`: design-system primitives, one folder per component with a `*.variants.ts` file using CVA. Read `.agents/components.md` before using or building a component: it lists every component Velocity ships with its purpose, props, variants, an example and what to use instead.
- `src/components/patterns/`: compositions of primitives, such as `SearchInput`.
- `src/config/nav.config.ts`: routes (with translated slugs), nav items, and header and footer defaults.
- `src/config/site.config.ts`: site name, URL and metadata, and `defaultTheme` ('system', 'light' or 'dark') for visitors who haven't used the theme toggle.
- `src/i18n/`: enabled locales (`locales.mjs`), your site copy (`translations/<locale>.ts`), and helpers (`useTranslations`, `getLocale`, `localizeRoute`, `localizePath`).
- `src/lib/blog.ts`: the only place that maps posts to URLs (`getPosts`, `getPostUrl`).
- `src/content.config.ts`: Velocity's content collections (Content Layer, `glob()` loaders, Zod from `astro/zod`). Add your own in `src/config/collections.ts`, which is merged in.
- `src/styles/tokens/` and `src/styles/themes/`: design tokens (OKLCH). `src/styles/theme.css` picks the active theme.
- `integrations/`: local Astro integrations for deploy target detection and the Pagefind search index.
- `component-registry.json`: reference list of the components Velocity ships, including ones not installed here. You don't need to add your own components to it.

## The site brief

If `.agents/site.md` exists, read it before changing pages, copy or styles: it records what the site is, the look the user asked for, the facts the user gave, and what's still a placeholder. When you change the site, update its Sitemap, Placeholders and Decisions log. It's the project's file; upgrades never touch it. The `velocity-start-site` skill creates it.

## Who owns which files

`create-velocity-astro upgrade` follows `velocity-manifest.json → files`. Check it before making a change you want to keep.

- **Yours, never overwritten:** `src/components/site/`, `src/styles/theme.css`, `src/config/collections.ts`, `src/views/`, `src/pages/`, `src/content/`, `src/assets/`, `src/config/nav.config.ts`, `src/config/site.config.ts`, `src/components/patterns/`, `src/i18n/translations/`, `src/i18n/locales.mjs`, `src/actions/`, `tests/`, `astro.config.mjs`.
- **Velocity's, overwritten on upgrade:** `src/components/ui/`, `src/components/layout/`, `src/layouts/`, `src/lib/`, `src/styles/tokens/`, `src/styles/themes/`, `src/styles/global.css`, `src/i18n/ui.ts`, `src/content.config.ts`, `integrations/`. Edited files are saved to `.velocity-backup/` first, but the edits must then be reapplied by hand.

`npm run check:agent` warns when a Velocity-owned file differs from `.velocity/baseline.json`, which records those files as scaffolded or last upgraded.

New files you add inside Velocity's folders stay in place. Only files Velocity ships are replaced. The same applies to skills: `velocity-*` skills are replaced on upgrade, so add project-specific skills under a different name. If a task requires editing a Velocity-owned file, tell the user that upgrades will replace the edit.

## Before you say you're done

If the site has a brief, every placeholder `check:agent` lists must be in its Placeholders section. Run `npm run validate`, which ends with `check:agent`, then `npm run build && npm run test:e2e` for accessibility and CSP in a real browser. `check:agent` scans the source and the build for raw translation keys, inline scripts and handlers that CSP blocks, broken internal links and anchors, pages that exist in only one language on a multilingual site, forms still on their stubs, edits to Velocity-owned files, hardcoded user-facing text, remaining placeholders, the scaffold's default identity, and pages with more than one `<h1>`. Each finding prints the file, the rule below that it breaks, and the fix. Errors fail; warnings are worth fixing or explaining to the user, and notices are information only. A file that is deliberately single-language can opt out of the hardcoded-text warning with a `velocity-allow-hardcoded` comment, and a page in `src/pages/` can opt out of the one-language-only warning with a `velocity-single-language` comment.

## Rules

- **No hardcoded user-facing strings.** Use `const t = useTranslations(locale)` in views and `useTranslations(getLocale(Astro))` in components. Add new strings to `src/i18n/translations/<locale>.ts`, not `src/i18n/ui.ts`. Keys in translations override `ui.ts`, and missing keys fall back to English. `ui.ts` only translates en, es and fr, so for any other locale translate its keys into `translations/<locale>.ts` (see the `velocity-add-locale` skill). A key missing from English renders as the raw key; `npm run check:agent` reports it with the file and line.
- **Internal links** go through `localizeRoute` or `localizePath`.
- **Placeholders:** never invent facts: prices, phone numbers, addresses, opening hours, testimonials, client logos, statistics, awards or team members. Where the user hasn't given one, write the marker `[[placeholder: what goes here]]` in the copy, and render images through `MediaSlot`, which shows a labelled placeholder until the photo exists. `check:agent` lists every remaining placeholder (`content/placeholder`) and any scaffold identity left in `site.config.ts` or an unset `SITE_URL` (`config/default-identity`). List them all in your handoff.
- **Colors:** use semantic Tailwind classes (`bg-background`, `text-foreground-muted`, `bg-brand-600`), never raw colors.
- **One `<h1>` per page.** `check:agent` warns when a built page has more (`a11y/multiple-h1`).
- **Static first.** Pages are prerendered. Only Actions, and anything explicitly marked `export const prerender = false`, run on the server. Don't add `output: 'server'`.
- **Markup must be valid HTML.** Astro 7's Rust compiler errors on unclosed tags and won't fix invalid nesting such as `<div>` inside `<p>`. `BaseLayout` owns the only `<main>`.
- **Whitespace:** `compressHTML: true` is deliberate. Don't switch to `'jsx'` without auditing inline text.
- **Imports:** `z` comes from `astro/zod`, never `zod`. Use the `@/` alias for `src/`. Import components by their file path, because category barrels don't exist in every project.
- **No client router.** Velocity uses native cross-document view transitions and `prefetch`. Component scripts call `init()` directly and also listen for `astro:after-swap`, guarded against double init.
- **CSP is on.** Never add `'unsafe-inline'` to script-src or use inline event handlers such as `onclick`. Astro hashes bundled scripts but not `is:inline` ones, so render inline scripts with `<InlineScript code={...} />` (import the source with `?raw`) and pass data through `<script type="application/json">`. For third-party script hosts, call `Astro.csp.insertScriptResource()` in the component that needs them. `npm run test:e2e` fails on any CSP violation.
- **Motion:** respect `prefers-reduced-motion`. The global rule in `global.css` finishes all animations instantly.
- **Share images:** every page gets a generated card in the project's logo and `branding.colors.themeColor`, including collection pages, so don't add routes for them. A custom `image` prop must point at a real file, or the build fails.
- **Search:** only content inside `data-pagefind-body` is indexed. `PageLayout` and `BlogLayout` already set it, so mark any new content layout the same way.
- **Fonts:** register families in `fonts` in `astro.config.mjs`. `BaseLayout` renders every registered family and preloads the first. Don't `@import` font CSS.
- **Accessibility is tested.** Routes in `src/config/nav.config.ts` are picked up by `tests/e2e/site.ts` automatically, and each must pass axe WCAG 2 A/AA with no serious or critical violations. Axe runs on each route's default-locale URL, and every route must load in every enabled locale.
- **Forms:** `ContactForm` and `NewsletterForm` submit to Actions in `src/actions/index.ts`. They forward to `CONTACT_FORM_ENDPOINT` / `NEWSLETTER_ENDPOINT` when set (see `src/lib/form-delivery.ts`); otherwise submissions are discarded and the server logs a warning. The discard path carries a `// @velocity-stub contact|newsletter` line, and `npm run check:agent` warns while it's there and the endpoint isn't set. `FORMS_REQUIRE_DELIVERY=true` makes that path reject submissions with the form's error; recommend it for production. To use a provider SDK instead, follow the `velocity-connect-forms` skill. Never report a form as working without a real send.
- **Secrets** go through `astro:env` (`env.schema` in `astro.config.mjs`), never `import.meta.env` directly.
