<p align="center">
  <img src="src/assets/branding/logo-full.svg" alt="Velocity" width="370" />
</p>

<p align="center">
  <strong>Astro 7 Starter Kit</strong> — production-ready, built on Astro 7 and Tailwind CSS v4, with first-class support for AI coding agents.
</p>

<p align="center">
  <a href="https://astro.build"><img src="https://img.shields.io/badge/Astro-7.4-bc52ee?logo=astro&logoColor=white" alt="Astro" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind-4.3-38bdf8?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-22c55e" alt="License" /></a>
</p>

![velocity — an Astro 7 starter kit with 70 components, theming and AI agent tooling built in](https://raw.githubusercontent.com/yasirwhite/opendemo-media/main/southwellmedia-velocity/velocity-demo.gif)

---

## What's Included

- **Built for AI coding agents** — project rules and skills for Claude Code, Codex, Cursor and other tools, in every project
- **70 components** — 41 UI primitives in 8 categories, 10 composed patterns, 15 page sections (PageHero, features, pricing, stats, logos, team, timeline, contact, CTA band, FAQ, steps, testimonials, hours and the band they sit in), breadcrumbs, a hero and layout pieces; all accessible, typed, and dark-mode ready. Icons: all 2,000+ Lucide icons by name
- **Design token system** with OKLCH colors, fluid typography, and two built-in themes
- **SEO toolkit** — meta tags, JSON-LD helpers (organization, local business with opening hours, product, blog post, breadcrumbs, FAQ), sitemap, robots.txt, and auto-generated OG images
- **Content collections** — type-safe blog, pages, authors, and FAQs with Zod validation
- **React islands** — optional client-side interactivity where needed
- **Astro Actions** — type-safe contact and newsletter forms with server-side validation, forwarded to an endpoint you configure
- **Deploy anywhere** — adapter auto-detected for Vercel, Netlify, Cloudflare, or Node; pages stay static
- **Route caching** — Astro 7 cache providers wired to Vercel/Netlify CDNs, in-memory elsewhere
- **Site search** — Pagefind index built on every production build, no search server
- **Fonts API** — self-hosted, preloaded fonts with metric-matched fallbacks
- **Strict CSP by default** — hash-based Content Security Policy, native view transitions (no client router)
- **Tested** — Vitest unit tests plus Playwright E2E and axe accessibility checks in CI
- **Built-in i18n** — every component is locale-aware; add languages by listing them in one file (UI strings ship in English, Spanish and French)

---

## Live demo

[demo.deployvelocity.com](https://demo.deployvelocity.com) is this repository deployed as it is, the same project you get from `npm create velocity-astro@latest -- --demo`. Its home page shows build figures for that deploy: versions, component count, JavaScript on the page and build time.

The demo's name, author, address and contact details are placeholders. Replace them in the files under [Configuration](#configuration), or create a project without `--demo` to start from a minimal home page instead.

---

## Quick Start

```bash
# Clone
git clone https://github.com/southwellmedia/velocity.git my-project
cd my-project

# Install (requires Node 22.23.4+, Node 24 LTS recommended)
pnpm install

# Configure
cp .env.example .env

# Develop
pnpm dev
```

Or use the CLI for the full experience including i18n:

```bash
pnpm create velocity-astro my-project
```

---

## AI Coding Agents

Every project created with `create-velocity-astro` includes instructions for AI coding agents:

| File | Purpose | On upgrade |
|------|---------|------------|
| `AGENTS.md` | Your project's rules, plus a pointer to Velocity's | Left alone |
| `.agents/velocity.md` | Velocity's stack, commands, rules and file ownership | Replaced |
| `.agents/skills/`, `.claude/skills/` | `velocity-add-page` and `velocity-add-component` skills | Velocity's are replaced, yours stay |

Ask your agent to add a page or component, and it can follow the same steps Velocity's own code does. See the [AI agents guide](https://docs.deployvelocity.com/getting-started/ai-agents/).

The `AGENTS.md` in this repo is for contributors to Velocity itself.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm dev:bg` | Start dev server in the background (`astro dev status` / `logs` / `stop`) |
| `pnpm build` | Production build (+ Pagefind search index) |
| `pnpm preview` | Preview production build |
| `pnpm check` | Astro type checker |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E + accessibility (run `pnpm build` first) |
| `pnpm validate` | Lint, type check, unit tests, build |

---

## Project Structure

```
integrations/     # deploy-target (adapter detection), pagefind (search index), build-receipt (demo figures)
tests/
  unit/           # Vitest
  e2e/            # Playwright + axe
src/
  actions/        # Astro Actions (contact, newsletter)
  components/
    ui/           # 41 UI components (form, data-display, feedback, overlay, etc.)
    patterns/     # 10 composed patterns (ContactForm, SearchInput, StatCard, etc.)
    blocks/       # 15 page sections (PageHero, FeatureGrid, FeatureSplit, Pricing, StatsBand, LogoCloud, Team, Timeline, ContactSection, CtaBand, Faq, Steps, Testimonials, Hours, Band)
    layout/       # Header, Footer, ThemeToggle, Analytics
    blog/         # ArticleHero, BlogCard, ShareButtons, RelatedPosts
    landing/      # The demo home page: BuildReceipt, WhatsNew, SpecimenWall, GetStarted
    seo/          # SEO, JsonLd, Breadcrumbs
    site/         # SiteHeader, SiteFooter (yours to edit)
  views/          # Page content; src/pages/*.astro render a view per locale
  i18n/           # Locales, UI strings and your site copy (translations/en.ts)
  content/        # Blog posts, authors, FAQs
  config/         # Site and navigation config
  styles/         # Global CSS and design tokens
  pages/          # Routes, search, OG image generation
```

---

## Configuration

**Site config**: `src/config/site.config.ts` — name, description, URL, contact details, social links

**Navigation**: `src/config/nav.config.ts` — routes, header links and buttons, footer links

**Copy**: `src/i18n/translations/en.ts` — every line of page text, one file per language

**Pages**: `src/views/` — what each page shows; add one with the `velocity-add-page` agent skill or copy an existing view

**Brand**: `src/assets/branding/` for the logo, and `--brand-hue` in `src/styles/themes/default.css` to recolor the brand scale

**Design tokens**: `src/styles/tokens/` — colors, typography, spacing

**Themes**: `src/styles/themes/` — switch between `default` and `midnight`, or create your own

**Environment**: `.env` — see `.env.example` for available variables

View all components at `/components` in development.

---

## Languages

Velocity is multilingual out of the box and single-language by default.

1. List locales in `src/i18n/locales.mjs`: `export const locales = ['en', 'es', 'fr'];`
2. Add site copy per locale in `src/i18n/translations/<locale>.ts` (typed against `en.ts`, so missing keys are type errors).
3. That's it. `/es/…` pages, the language switcher, `hreflang` alternates, a localized sitemap, per-language search and localized OG images are generated automatically. Translated URL slugs are optional (`routes` in `src/config/nav.config.ts`).

Built-in UI strings (navigation, blog, forms, search) live in `src/i18n/ui.ts` for en, es and fr. Override any of them in your translations file. Blog posts go in `src/content/blog/<locale>/`, and a post with the same file name in two locales is linked as a translation. `npm create velocity-astro --i18n` sets up English, Spanish and French for you.

---

## Forms

The contact and newsletter forms validate on the server with Astro Actions. Delivery is up to you:

- Set `CONTACT_FORM_ENDPOINT` and/or `NEWSLETTER_ENDPOINT` in `.env` to forward each submission as JSON to your own endpoint (a webhook, serverless function, Zapier, Formspree…). `NEWSLETTER_API_KEY`, when set, is sent as a Bearer token. If the endpoint fails, the form shows its error message.
- Or replace the forwarding in `src/actions/index.ts` with your provider's SDK (Resend, Postmark, Mailchimp, a CRM).

Until one of these is set up, submissions are discarded and the server logs a warning, so a missing setup is easy to spot.

---

## Analytics

Set `PUBLIC_GA_MEASUREMENT_ID` (GA4) or `PUBLIC_GTM_ID` (Tag Manager) and every page loads it. `PUBLIC_CONSENT_ENABLED=true` adds the consent banner, wired to Google Consent Mode v2. Pick the mode in `src/config/consent.config.ts`:

- `consent_mode_v2` (opt-in): Google loads with tracking denied and sends cookieless pings until the visitor accepts.
- `strict` (opt-in): nothing loads until the visitor accepts.
- `opt_out`: categories start as `defaultEnabled` says, with an opt-out button instead of a banner. Visitors in `optInRegions` (default: the EEA, the UK and Switzerland) start denied and see the banner, and a Global Privacy Control signal opts the visitor out. Check what your visitors' laws require before you use it.

**Events:** add `data-track="event_name"` to a link or button and a click sends that event, with each `data-track-*` attribute as a parameter (`data-track-link-location="hero"` becomes `link_location: 'hero'`). `item_id`, `item_name` and `price` go into an `items` array, so ecommerce events such as `begin_checkout` reach GA4's ecommerce reports. From code, call `track()` from `src/lib/analytics.ts`. Register custom parameters in GA4 (Admin → Custom definitions) to see them in reports.

---

## Deployment

Every page is prerendered. A server adapter is still included because Astro Actions (the contact and newsletter forms) run on demand. `integrations/deploy-target.mjs` picks it for you:

| Host | Detected by | Adapter | Route cache provider |
|------|-------------|---------|----------------------|
| Vercel | `VERCEL` | `@astrojs/vercel` | Vercel CDN (`cacheVercel`) |
| Netlify | `NETLIFY` | `@astrojs/netlify` | Netlify CDN (`cacheNetlify`) |
| Cloudflare | `CF_PAGES` / `WORKERS_CI` | `@astrojs/cloudflare` (`pnpm add` it first) | Cloudflare (`cacheCloudflare`) |
| Anything else | — | `@astrojs/node` (standalone) | In-memory |

Force a target with `DEPLOY_TARGET=node|vercel|netlify|cloudflare`. With the Node adapter, run the server with `node dist/server/entry.mjs`.

To add caching to an on-demand route, use `Astro.cache.set({ maxAge: 300, swr: 60, tags: ['products'] })` or add a pattern to `routeRules` in `astro.config.mjs`.

---

## Content Security Policy

Velocity ships with Astro's hash-based CSP **enabled** (`security.csp` in `astro.config.mjs`). Every page gets a `<meta http-equiv="content-security-policy">` where:

- `script-src` is `'self'` plus a SHA-256 hash for each inline script. No `'unsafe-inline'`.
- `style-src-elem` is `'self'` plus hashes. `style-src-attr 'unsafe-inline'` is allowed only so Shiki can colour code blocks through `style=""` attributes (Astro 7.1+ directive scoping). Inline style attributes can't run script. Astro still logs a generic Shiki/CSP warning at build time.
- Pages declare extra sources they need at render time with `Astro.csp.insertScriptResource()`. `Analytics.astro` adds the Google hosts only when GA/GTM is configured, and `/search` adds `'wasm-unsafe-eval'` for Pagefind.
- A page rendered on demand (the 404 on a multilingual site, or a page you mark `prerender = false`) gets the policy as a `Content-Security-Policy` header instead, sent before the page has rendered, so a hash `<InlineScript />` adds while rendering doesn't reach it. `integrations/layout-csp.mjs` therefore puts the hashes of the layout's inline scripts in the config: the theme script, the opt-in speculation rules and the analytics scripts (listed whether or not GA/GTM is set: a hash admits only that exact script). For your own inline script on such a page, add its hash to `security.csp.scriptDirective.hashes`.

Some directives (`frame-ancestors`, `report-uri`) are ignored in a `<meta>` CSP. Velocity sends `X-Frame-Options: DENY` from `vercel.json` and `netlify.toml` instead. CSP is not applied in `astro dev`. Test it with `pnpm build && pnpm preview`.

**Third-party scripts:** add their hosts with `Astro.csp.insertScriptResource('https://cdn.example.com')` in the component that loads them, or globally under `security.csp.scriptDirective.resources`.

**Want `<ClientRouter />` back?** Astro's CSP doesn't support it, so set `security.csp: false` before adding it. Velocity's components re-initialise on `astro:after-swap`, so they keep working.

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Ensure `pnpm validate` and `pnpm test:e2e` pass
4. Open a PR

---

## Releasing

Releases are cut from pull requests. Add one label to the PR: `release: patch`, `release: minor` or `release: major`. The Release workflow (`.github/workflows/release.yml`) then:

1. Commits the version bump (`package.json`, `velocity-manifest.json`) and the upgrade note to the PR, so you review them with the change. The note is the PR's **Upgrade note** section, or "Nothing needs doing." if it's empty.
2. When the PR merges, tags the merge commit `v<version>` and publishes the GitHub release. The release notes come from the PR's **Release notes** section. `create-velocity-astro upgrade` picks it up from there.
3. Comments on the PR with what's left: the docs changelog, and the marketing site.

PRs without a label merge without a release, so small changes can wait on `main` for the next one.

## License

MIT — see [LICENSE](LICENSE) for details.

---

**Links**: [Docs](https://docs.deployvelocity.com) | [CLI](https://github.com/southwellmedia/create-velocity-astro) | [Astro](https://docs.astro.build) | [Tailwind v4](https://tailwindcss.com/docs)

**Built by [Southwell Media](https://southwellmedia.com)**
