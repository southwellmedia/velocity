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

---

## What's Included

- **Built for AI coding agents** — project rules and skills for Claude Code, Codex, Cursor and other tools, in every project
- **46 components** — 33 UI primitives in 8 categories, 10 composed patterns, a hero and layout pieces; all accessible, typed, and dark-mode ready
- **Design token system** with OKLCH colors, fluid typography, and two built-in themes
- **SEO toolkit** — meta tags, JSON-LD, sitemap, robots.txt, and auto-generated OG images
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
integrations/     # deploy-target (adapter detection), pagefind (search index)
tests/
  unit/           # Vitest
  e2e/            # Playwright + axe
src/
  actions/        # Astro Actions (contact, newsletter)
  components/
    ui/           # 33 UI components (form, data-display, feedback, overlay, etc.)
    patterns/     # 10 composed patterns (ContactForm, SearchInput, StatCard, etc.)
    layout/       # Header, Footer, ThemeToggle, Analytics
    blog/         # ArticleHero, BlogCard, ShareButtons, RelatedPosts
    landing/      # Credibility, TechStack, FeatureTabs, and more
    seo/          # SEO, JsonLd, Breadcrumbs
  content/        # Blog posts, authors, FAQs
  config/         # Site and navigation config
  styles/         # Global CSS and design tokens
  pages/          # Routes, search, OG image generation
```

---

## Configuration

**Site config**: `src/config/site.config.ts` — name, description, URL, social links

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

## License

MIT — see [LICENSE](LICENSE) for details.

---

**Links**: [Docs](https://docs.deployvelocity.com) | [CLI](https://github.com/southwellmedia/create-velocity-astro) | [Astro](https://docs.astro.build) | [Tailwind v4](https://tailwindcss.com/docs)

**Built by [Southwell Media](https://southwellmedia.com)**
