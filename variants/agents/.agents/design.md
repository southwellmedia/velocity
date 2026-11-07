# Designing the site

Maintained by Velocity and replaced on upgrade.

Velocity is a starter kit. It handles the foundation (pages and routing, translations, SEO and share images, accessibility, CSP, forms, search, upgrades) so the effort can go into the design. **Nothing about the look is fixed.** Velocity's components, the example sections in `.agents/design/sections/` and the quick themes are there to save time: use them, change them, or ignore them and write your own.

## Design it

Design the site the way a good designer would for this particular business: from who it's for and what it should feel like, not from a template. Avoid the generic landing page (centred hero, rows of equal cards, numbered steps, three testimonials, dark CTA band) unless it's genuinely right. Choose type, colour, layout and imagery that belong to this business, and record the key decisions in `.agents/site.md` → Design so later sessions keep them.

If you have a frontend design skill or similar guidance available, use it. If you can take screenshots, iterate: build, look at each page in light and dark on desktop and mobile, critique it honestly, revise. That loop matters more than anything in this file.

## What keeps it working

These are the only rules, and they're about correctness, not style:

1. **Colours are tokens with a dark value.** Define colours as custom properties in `src/styles/site.css`, with the light value on `:root` and the dark value on `.dark`, and use them as `var(--…)` (or semantic classes such as `bg-background`). `site.css` is yours and loads after everything else, so you can also redefine Velocity's tokens there. Colours written straight into components stay the same in dark mode; `check:agent` warns about them.
2. **Text stays readable.** WCAG AA contrast in light and dark. `npm run design -- tokens` checks Velocity's colour pairs after your changes; `npm run build && npm run test:e2e` runs axe on every page.
3. **Copy is translatable.** Page text goes in `src/i18n/translations/<locale>.ts` and is rendered with `t()`, never written into markup.
4. **Markup is valid and accessible.** One `<h1>` per page, headings in order, real lists and buttons, alt text on meaningful images. No inline event handlers (CSP); see `.agents/velocity.md` for scripts.
5. **Changes survive upgrades.** Upgrades replace Velocity's folders (`src/components/ui/`, `src/components/hero/`, `src/layouts/`, `src/styles/tokens/`, `src/styles/themes/`). To change one of those components, copy it into your own folder (such as `src/components/sections/`) and edit the copy. Everything else, including `src/components/site/` (header and footer), `src/views/`, `src/pages/` and `src/styles/site.css`, is yours.

## Fonts

Install the family (`npm install @fontsource-variable/<name>`; ask the user first), register it in `fonts` in `astro.config.mjs` with `fontsourceVariable()`, and point `--theme-font-sans` and `--theme-font-display` at it in `site.css`. `npm run design -- fonts` checks that the package, the config entry and the tokens agree.

## Quick themes (optional)

`npm run design -- direction --list` shows five ready-made themes, and `-- direction --base <id> --brand "<hex>"` applies one to `theme.css`. They're a fast starting point for someone who doesn't want to design; `site.css` overrides them.
