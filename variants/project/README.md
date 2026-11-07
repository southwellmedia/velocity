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

The fastest way: open the project in your AI coding agent (Claude Code, Codex, Cursor, …) and ask it to **"Set up this site for my business"**. Its `velocity-start-site` skill interviews you, writes a brief to `.agents/site.md` that later sessions follow, designs the site for your business (its styles live in `src/styles/site.css`, which upgrades never touch; Velocity's components are optional), and lists anything it couldn't know as a placeholder instead of inventing it.

Want a quick look first? `npm run design -- direction --list` shows five ready-made themes; apply one with `npm run design -- direction --base warm-local --brand "#c2410c"`.

By hand:

- **Site details:** `src/config/site.config.ts` (name, description, social links). Canonical and social-card URLs come from `SITE_URL`, so set it to your production URL in `.env` and in the environment that runs the build.
- **Logo and favicon:** `src/assets/branding/` and `public/favicon.svg`
- **Navigation:** `src/config/nav.config.ts`
- **Home page:** `src/views/HomeView.astro`
- **Colors and theme:** `src/styles/theme.css`
- **Forms:** set `CONTACT_FORM_ENDPOINT` / `NEWSLETTER_ENDPOINT` in `.env`, or wire your provider in `src/actions/index.ts`. Hosting platforms read these from their environment settings. A self-hosted Node server doesn't load `.env` by itself: start it with `node --env-file=.env dist/server/entry.mjs` or set the variables in its environment. Until delivery is configured, submissions are discarded and the server logs a warning.

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
| `npm run design -- tokens` | Design tokens and a contrast check of every colour pair |

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
