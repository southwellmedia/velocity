---
name: velocity-start-site
description: Set up or rebuild this whole Velocity site for a real business, from a brief to designed, written, accessible pages, replacing the demo or starter content. Use when asked to set up, build or start the site, make it about a business, replace the demo, make the site look like something, or on a first request in a project still named "My Site". For one new page use velocity-add-page; for only a new logo, colour or font use velocity-rebrand.
---

# Set up the site

**First, read the Project notes in `AGENTS.md`.** They take priority over the defaults here.

This skill turns a fresh or demo project into the user's own site in seven steps. Detail lives elsewhere: `.agents/design.md` (designing freely, and the few rules that keep it working), and the other `velocity-*` skills (pages, content, locales, forms, brand assets). Decisions go into `.agents/site.md`, the brief, so later sessions build on them.

**Rules for the whole run**
- Never invent facts: prices, phone numbers, addresses, hours, testimonials, client logos, statistics, awards or team members. Use `[[placeholder: what goes here]]` and list it.
- Don't edit Velocity-owned files (`src/components/ui/`, `src/components/hero/`, `src/styles/tokens/`, `src/styles/themes/`, `src/layouts/`, `.agents/` except `.agents/site.md`): upgrades replace them. To change one, copy it into your own folder and edit the copy. Velocity's components are optional; build whatever the design needs.
- Never delete files outside the demo list in step 3 without listing them and getting a yes.
- Never install packages or browsers without asking. Never commit or deploy.

## 0. Detect the starting state

Read the files; don't ask. Check in this order and take the first match.

| State | Signals | What to do |
|---|---|---|
| Brief exists | `.agents/site.md` exists and its `Status:` isn't `seeded by CLI` | Resume. Compare the brief with the site, then continue the Sitemap or apply what the user asked, and update the brief |
| Brief seeded | `.agents/site.md` says `Status: seeded by CLI` | As Minimal. The interview skips what the brief already answers; a quick theme it names is only a starting point |
| Demo | `src/pages/components.astro` exists, or `src/views/HomeView.astro` imports from `@/components/landing/` | Plan, remove the demo (step 3), build |
| Minimal | `src/views/HomeView.astro` contains `Home page (starter)` | Plan, build. Its translation files still hold the demo's `landing`, `about` and `contact` copy; delete those namespaces in step 5 |
| Customized | none of the above | Re-target inside the existing design: keep `src/styles/theme.css` and `src/components/sections/` unless the user asks for a new look. Ask before removing any page |

## 1. Interview

One message, at most seven questions, skipping any the request or brief already answers:

1. What is the business and what does it do?
2. Who is the site for?
3. What is the one thing a visitor should do (book, call, buy, sign up)?
4. Which pages? Suggest a short set that suits the business (usually Home, a services or menu page, About and Contact), and let the user change it.
5. Which languages? They must match `src/i18n/locales.mjs`; to add one, use `velocity-add-locale` in step 4.
6. Brand and feel: logo, colours, fonts, three words for the feel, a site they like the look of, a folder of their own photos, or "pick for me".
7. An existing site or document to take facts from?

If the user says "just do it", or nobody is there to answer (a headless run), use sensible defaults for the business type and record every one under Assumptions.

## 2. Write the brief and decide the look

Copy `.agents/skills/velocity-start-site/brief-template.md` to `.agents/site.md` (or update the seeded one) and fill every heading. Under **Design**, decide how this site should look and feel for this business, and write down the key decisions: the feeling, palette, type, imagery and anything distinctive (`.agents/design.md`). A quick theme chosen when the project was created is only a starting point. Set `Status: planned`.

Show the user the sitemap and the design idea in a few lines. Wait for a go-ahead. In a headless run, continue and flag the assumptions in the handoff.

## 3. Prepare

**Demo state only: remove the demo.** Delete exactly these paths (a test keeps this list equal to the demo's own list):

<!-- demo-paths:start -->
- `src/components/landing`
- `src/views/AboutView.astro`
- `src/views/ContactView.astro`
- `src/pages/about.astro`
- `src/pages/contact.astro`
- `src/pages/components.astro`
- `src/pages/[lang]/[...about].astro`
- `src/pages/[lang]/[...contact].astro`
- `src/content/blog/en/velocity-2-astro-7.mdx`
- `src/content/blog/en/velocity-2-1-ai-agents.mdx`
- `src/content/faqs/general-en.json`
- `src/content/authors/team.json`
- `public/avatars`
<!-- demo-paths:end -->

If the brief keeps About or Contact, leave that page's three files (view, page, `[lang]` wrapper) and rewrite the view in step 4. Then:
- in `src/config/nav.config.ts`, delete the `components` route and the routes of removed pages, their `navItems`, and the demo's header `cta`, `actions` (the GitHub link) and `extraNav` (`/#features`); replace the footer's Velocity GitHub and License links;
- in every `src/i18n/translations/<locale>.ts`, delete the `landing`, `home` and removed pages' namespaces (`about`, `contact`) and their `meta` entries; step 5 writes new copy;
- leave `src/components/ui/` alone: unused primitives cost nothing.

**Every state:**
- Set `name`, `description`, `author` and `email` in `src/config/site.config.ts` from facts the user gave; ask for any that are missing, never invent them. `SITE_URL` goes in `.env` and the host's build settings.
- Set up the look: colours as tokens in `src/styles/site.css` (light and dark), and fonts (`.agents/design.md`; ask before installing packages).
- Set `branding.colors.themeColor` in `site.config.ts` to the brand colour. For a logo or favicon, follow `velocity-rebrand` step 4.
- **Photos:** copy the user's photos into `src/assets/photos/` with descriptive file names and use them through `MediaSlot`'s `photo` prop, which optimizes them. Write alt text from what each photo shows; decorative images get `alt=""`. Never use stock or generated images unless the user asks. With no photos, design the first screen so it works without them rather than leading with a placeholder.

## 4. Build

- For each page in the Sitemap, follow `velocity-add-page` for the routing and translations, and design the page however it needs. Velocity's components and the example sections in `.agents/design/sections/` are optional. The home page replaces `src/views/HomeView.astro`. One `<h1>` per page.
- Blog, case studies, team or similar collections: `velocity-add-content`. New language: `velocity-add-locale`. On a single-language site nothing links to missing locales.
- Forms: `velocity-connect-forms` only if the user gave a provider and key; otherwise leave the stubs and say so.
- Update `src/config/nav.config.ts`: nav items for the brief's pages, the header `cta` pointing at the primary action, and the footer links.

## 5. Write the copy

Real, specific copy in the brief's voice, in `src/i18n/translations/<locale>.ts` for every enabled locale, passed to sections as props. No lorem ipsum. Anything you don't know is `[[placeholder: …]]`, never a plausible guess.

## 6. Verify and hand off

1. `npm run validate` (lint, `astro check`, unit tests, build, `check:agent`). Fix every error. Fix the colour warnings by moving colours into tokens in `src/styles/site.css`.
2. If you can take screenshots, look at every page in light and dark, desktop and mobile, critique it honestly against the brief, and revise. Repeat until it looks designed for this business rather than assembled. Otherwise reread each view against the brief's Design decisions.
3. Only if a Playwright browser is already installed (`npx playwright --version` works and a test run doesn't ask for a download): `npm run build && npm run test:e2e` for axe and CSP. Otherwise skip it and say so, with the command; `npx playwright install chromium` is a download of about 150 MB the user may choose to run.
4. Update the brief: Sitemap statuses, Placeholders (from `check:agent`'s `content/placeholder` findings), Assumptions, Decisions log, and `Status: built`.

End with a handoff: what was built, the design decisions and why, every placeholder by page, the forms status, the assumptions to confirm, what was skipped and how to run it, and next steps (real photos, `SITE_URL`, connecting forms, `npm run check:agent -- --strict` before launch).
