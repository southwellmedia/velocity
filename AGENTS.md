# Velocity — Agent Guide

Instructions for AI coding agents (Claude Code, Codex, Cursor, etc.) working in this repo. Scaffolded projects get their own guide and skills from `variants/agents/`.

## Stack

Astro 7 · Tailwind CSS v4 · TypeScript (strict) · React 19 islands · Node ≥22.23.4 (24 LTS recommended) · pnpm 10

## Commands

| Task | Command |
|------|---------|
| Dev server (background, safe for agents) | `pnpm dev:bg`, then `pnpm astro dev status`, `pnpm astro dev logs`, `pnpm astro dev stop` |
| Health check | `GET http://localhost:4321/_astro/status` |
| Full validation | `pnpm validate` (lint → check → unit tests → build → agent-ready check) |
| Agent-ready check | `pnpm check:agent` (after a build): raw translation keys, CSP, broken links, stubbed forms, Velocity-owned edits, hardcoded strings |
| Unit tests | `pnpm test` |
| E2E + a11y | `pnpm build && pnpm test:e2e` |
| Agent benchmark | `pnpm bench:selftest` (no model calls); `pnpm bench --model <id>` for real runs, see `benchmark/README.md` |

When Astro 7 detects an agent it switches `astro dev` to JSON logs and, on supported platforms, to background mode; a lockfile prevents duplicate servers. Use `astro dev --ignore-lock` only if you need a second server deliberately. Structured logs: `astro dev --json`.

## Where things live

- `src/components/ui/` — design-system primitives (one folder per component, with `*.variants.ts` using CVA). Catalogued in `component-registry.json`; keep the registry in sync when adding, renaming, or changing a component's file dependencies. Each entry has a hand-written `description`, `example` and optional `useInstead`, which `pnpm generate:components` turns into `variants/agents/.agents/components.md` for user projects. A stale file fails `pnpm test`.
- `src/components/patterns/` — compositions of primitives (ContactForm, NewsletterForm, SearchInput…).
- `src/components/site/` — `SiteHeader` and `SiteFooter`, owned by the project. Every layout renders them. Don't render `Header` or `Footer` from a layout directly.
- `src/views/` — page content. `src/pages/*.astro` are thin wrappers that render a view with a locale; `src/pages/[lang]/` holds the localized wrappers.
- `src/i18n/` — locales (`locales.mjs`), built-in UI strings (`ui.ts`, Velocity-owned), site copy (`translations/<locale>.ts`, user-owned), helpers (`useTranslations`, `getLocale`, `localizeRoute`, `localizePath`).
- `src/config/nav.config.ts` — routes (with translated slugs), nav items, header/footer defaults (CTA, actions, extra links).
- `src/lib/blog.ts` — the only place that maps posts to URLs (`getPosts`, `getPostUrl`).
- `src/actions/index.ts` — Astro Actions. Form schemas live in `src/lib/forms.ts` so tests can import them.
- `src/content.config.ts` — content collections (Content Layer, `glob()` loaders, Zod from `astro/zod`). Project-specific collections go in `src/config/collections.ts`, which upgrades leave alone.
- `src/styles/tokens/` and `src/styles/themes/` — design tokens (OKLCH). Use semantic Tailwind classes (`bg-background`, `text-foreground-muted`, `bg-brand-600`), never raw colors. `src/styles/theme.css` picks the active theme and upgrades leave it alone.
- `integrations/` — local Astro integrations: `deploy-target.mjs` (adapter + cache provider detection), `pagefind.mjs` (search index).
- `velocity-manifest.json` — consumed by `create-velocity-astro` to upgrade user projects. Breaking changes need a migration entry with `fromVersion`/`toVersion`.

## Rules

- **No hardcoded user-facing strings in core components.** Use `const t = useTranslations(getLocale(Astro))`. New UI strings go in `src/i18n/ui.ts` (en, es, fr); page copy goes in `src/i18n/translations/en.ts`. Internal links go through `localizeRoute`/`localizePath`.
- **Registry discipline.** Any file added under `src/components/{ui,patterns,hero}` must belong to an entry in `component-registry.json`, which must list every component it imports. Run `pnpm check:registry`.
- **Scaffold variants** (`variants/`, `velocity-manifest.json → scaffold`) are what the CLI builds projects from. Read `variants/README.md` before touching them, and run `pnpm test:scaffold` after changing views, config or i18n.
- **Agent-ready check.** `scripts/check-agent.mjs` ships to projects (`files.safe`). Every rule needs a failing fixture in `tests/unit/check-agent.test.ts`, and every finding must name the file, the `velocity.md` rule and the fix.
- **Agent files.** `variants/agents/` holds the `AGENTS.md`, rules and skills that user projects receive. When a rule here changes, update `variants/agents/.agents/velocity.md` too. User projects differ from this repo: `src/i18n/ui.ts` is replaced on upgrade, and registry and scaffold tooling is removed. Keep skills identical in `.agents/skills/` and `.claude/skills/`.

- **Static first.** Pages are prerendered. Only Actions (and anything you explicitly mark `export const prerender = false`) run on the server. Don't add `output: 'server'`.
- **Markup must be valid HTML.** Astro 7's Rust compiler errors on unclosed tags and won't fix invalid nesting (`<div>` inside `<p>`). `BaseLayout` owns the only `<main>`.
- **Whitespace:** `compressHTML: true` is set deliberately (see astro.config.mjs). Don't switch to `'jsx'` without auditing inline text.
- **Imports:** `z` comes from `astro/zod`, never `zod`. Use the `@/` alias for `src/`.
- **No client router.** Velocity uses native cross-document view transitions (CSS `@view-transition`) and `prefetch`. Component scripts call their `init()` directly and also listen for `astro:after-swap` (guarded against double init), so they still work if a project re-adds `<ClientRouter />`.
- **CSP is on.** Never add `'unsafe-inline'` to script-src, and don't use inline event handlers such as `onclick`. Astro hashes bundled scripts but not `is:inline` ones, so render inline scripts with `<InlineScript code={...} />` (import the source with `?raw`) and pass data via `<script type="application/json">`. Third-party script hosts: `Astro.csp.insertScriptResource()` in the component that needs them. `pnpm test:e2e` fails on any CSP violation.
- **Motion:** respect `prefers-reduced-motion`. The global rule in `global.css` finishes all animations instantly.
- **Share images:** every prerendered page gets a card from `integrations/og-images.mjs`, using the project's logo and `branding.colors.themeColor`. A custom `image` must exist, or the build fails.
- **Search:** only content inside `data-pagefind-body` is indexed. Mark new content layouts accordingly.
- **Fonts:** register families in `fonts` (astro.config.mjs). `BaseLayout` renders every registered family and preloads the first. Don't `@import` font CSS.
- **Accessibility is tested.** Every page in `tests/e2e/pages.spec.ts` must pass axe WCAG 2 A/AA with no serious or critical violations. Add new routes to that list.
- **Secrets** go through `astro:env` (`env.schema` in astro.config.mjs), never `import.meta.env` directly.
