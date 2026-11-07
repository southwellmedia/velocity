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

- **Site details:** `src/config/site.config.ts` (name, description, URL, social links)
- **Logo and favicon:** `src/assets/branding/` and `public/favicon.svg`
- **Navigation:** `src/config/nav.config.ts`
- **Home page:** `src/views/HomeView.astro`
- **Colors and theme:** `src/styles/theme.css`
- **Forms:** set `CONTACT_FORM_ENDPOINT` / `NEWSLETTER_ENDPOINT` in `.env`, or wire your provider in `src/actions/index.ts`. Until you do, submissions are discarded and the server logs a warning.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (includes the search index) |
| `npm run preview` | Preview the production build |
| `npm run check` | Type check |
| `npm run lint` | Lint |
| `npm run test` | Unit tests |
| `npm run validate` | Lint, type check, unit tests and build |

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
