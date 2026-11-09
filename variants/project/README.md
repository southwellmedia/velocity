# My Site

Built with [Velocity](https://deployvelocity.com), an Astro 7 and Tailwind CSS v4 starter by [Southwell Media](https://southwellmedia.com).

## Getting started

```bash
npm install      # or pnpm install
cp .env.example .env
npm run dev
```

The site runs at http://localhost:4321.

## Make it yours

The fastest way: open the project in your AI coding agent (Claude Code, Codex, Cursor, …) and ask it to **"Set up this site for my business"**. Its `velocity-start-site` skill interviews you, writes a brief to `.agents/site.md` that later sessions follow, builds your pages and lists anything it couldn't know as a placeholder instead of inventing it.

By hand:

- **Site details:** `src/config/site.config.ts` (name, description, social links). Canonical and social-card URLs come from `SITE_URL`, so set it to your production URL in `.env` and in the environment that runs the build.
- **Logo and favicon:** `src/assets/branding/` and `public/favicon.svg`
- **Navigation:** `src/config/nav.config.ts`
- **Home page:** `src/views/HomeView.astro`
- **Colors and theme:** `src/styles/theme.css`
- **Forms:** set `CONTACT_FORM_ENDPOINT` / `NEWSLETTER_ENDPOINT` in `.env`, or wire your provider in `src/actions/index.ts`. Hosting platforms read these from their environment settings. A self-hosted Node server doesn't load `.env` by itself: start it with `node --env-file=.env dist/server/entry.mjs` or set the variables in its environment. Until delivery is configured, submissions are discarded and the server logs a warning; set `FORMS_REQUIRE_DELIVERY=true` in production to reject them with the form's error instead.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (includes the search index) |
| `npm run preview` | Preview the production build |
| `npm run check` | Type check |
| `npm run lint` | Lint |
| `npm run test` | Unit tests |
| `npm run validate` | Lint, type check, unit tests, build and agent-ready check |

## Upgrading Velocity

```bash
npx create-velocity-astro upgrade --dry-run   # see what would change
npx create-velocity-astro upgrade
```

Upgrades never overwrite your config, pages, content or site components.

## Docs

- [Velocity docs](https://docs.deployvelocity.com)
- [Astro docs](https://docs.astro.build)
- [Tailwind CSS docs](https://tailwindcss.com/docs)
