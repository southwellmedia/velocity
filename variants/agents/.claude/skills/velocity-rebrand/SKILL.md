---
name: velocity-rebrand
description: Rebrand this Velocity site with a new brand color, theme, fonts, logo, favicon, site name and share-image color. Use when asked to change the brand, colors, typography, logo or site name, or to make the site match a style guide.
---

# Rebrand the site

**First, read the Project notes in `AGENTS.md`.** They describe this site's own conventions and take priority over the examples here.

Make every change in files the project owns: `src/styles/theme.css`, `astro.config.mjs`, `src/config/site.config.ts`, `src/assets/branding/` and `public/favicon.svg`. Upgrades replace `src/styles/themes/` and `src/styles/tokens/`, so don't edit them. Override their tokens in `src/styles/theme.css` instead.

## 1. Pick a theme

`src/styles/theme.css` imports one theme from `src/styles/themes/`. List that folder to see which themes are available. Velocity ships these two:

| Theme | Look |
|-------|------|
| `default.css` | Neutral grays, orange brand (hue 38) |
| `midnight.css` | Purple-tinted surfaces, violet brand (hue 295), designed dark-first |

Change the `@import` line to switch themes. Every theme defines the same semantic tokens, so components keep working.

**Default light or dark:** set `defaultTheme: 'light'` or `'dark'` in `src/config/site.config.ts` to fix the theme for visitors who haven't used the toggle; `'system'` (the default) follows their operating system. Don't edit `src/layouts/theme-script.js`, which upgrades replace.

## 2. Set the brand color

The `brand-50` to `brand-900` scale is computed in OKLCH from `--brand-hue`. Convert the brand's hex color to OKLCH and take its hue (the h value, 0 to 360). Then override it after the import:

```css
@import './themes/default.css';

:root {
  --brand-hue: 250;
  --logo-accent: var(--brand-500);
}
```

- `midnight.css` sets each brand step directly, so `--brand-hue` has no effect there. Override `--brand-50` to `--brand-900` instead, keeping midnight's lightness and chroma and changing only the hue.
- `--logo-accent` colors any part of the logo SVGs that uses `var(--logo-accent, …)`.
- Any other theme token can be overridden the same way, such as `--theme-radius-md`, `--theme-heading-weight`, `--theme-radius-button` or `--theme-button-weight`. Put light-mode values in `:root` and dark-mode values in `.dark`.
- Yellow and lime hues (about 85 to 130) look much lighter at the same OKLCH lightness. Check their contrast in step 7.

## 3. Change the fonts

Font families are registered in `fonts` in `astro.config.mjs` with the `fontsourceVariable()` helper, which self-hosts an installed `@fontsource-variable/*` package. `BaseLayout` renders every registered family and preloads the first one, so put the body font first.

1. Install the package: `npm install @fontsource-variable/inter`. The helper only reads variable packages. For a family with no variable build, use `fontProviders.fontsource()` or `fontProviders.google()`, as the comment above the helper describes.
2. Register it, copying the weight range from `font-weight` in the package's `index.css`:

   ```js
   fonts: [
     fontsourceVariable({ name: 'Inter', pkg: 'inter', cssVariable: '--font-inter', weight: '100 900', fallbacks: ['sans-serif'] }),
     // …the other families
   ],
   ```

3. Point the theme's font tokens at it in `src/styles/theme.css`:

   ```css
   :root {
     --theme-font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
     --theme-font-display: var(--font-inter), var(--theme-font-sans);
   }
   ```

4. Remove any family you stop using from `fonts` and uninstall its package. Themes reference `--font-manrope`, `--font-outfit` and `--font-jetbrains-mono`, so override every token that still names a removed family. Otherwise that whole font stack becomes invalid and the text falls back to the browser default.

Don't `@import` font CSS or add `<link>` tags for font services. CSP only allows styles from the site itself, and the preload depends on the Fonts API.

## 4. Replace the logo and favicon

Replace the files in `src/assets/branding/`, keeping their names:

| File | Used for |
|------|----------|
| `logomark.svg` | Icon on light backgrounds |
| `logomark-dark.svg` | Icon on dark backgrounds, and the logo on generated share images |
| `logo-full.svg`, `logo-full-dark.svg` | Full logo (`<Logo variant="full" />`) |

- The SVGs are rendered inline, so they can use `currentColor` and `var(--logo-accent, #hex)` to follow the theme.
- Keep a `viewBox`, because share images read it for the aspect ratio.
- Use presentation attributes such as `fill="…"`. Remove `<style>` blocks, `<script>` and event attributes, because CSP blocks them in inline markup. Design-tool exports often contain them.
- Share images draw the logo on a near-black card. `currentColor` becomes white and `--logo-accent` becomes the theme color, so make sure `logomark-dark.svg` reads well on black.

Replace `public/favicon.svg` (the path is set in `branding.favicon.svg`) and set `branding.logo.alt` to the brand name.

## 5. Update the site details

In `src/config/site.config.ts`:

- `name`: page titles, the web manifest, structured data, and the title of the home page's share image.
- `description`, `author`, `email`, `phone`, `address`, `socialLinks`, `twitter`: replace the demo values, or remove the optional ones.
- `branding.colors.themeColor` (hex): the browser toolbar color, the manifest, and the accent on every generated share image. Use the brand's main hex color. Near-black colors are drawn as off-white on the card.
- `branding.colors.backgroundColor` (hex): the PWA splash screen.

Then search for leftover demo branding: `grep -rni velocity src/config src/i18n/translations src/components/site`. The header CTA and GitHub icon in `headerConfig` in `src/config/nav.config.ts` point at Velocity's docs and repository. Ask the user before deleting demo blog posts in `src/content/blog/`.

## 6. Use semantic classes

When restyling pages or components, use semantic classes such as `bg-background`, `text-foreground-muted`, `border-border` and `bg-brand-600`. Never use raw colors such as `bg-orange-500`, `#f94c10` or `text-[oklch(…)]`, because they ignore the theme and dark mode. If the design needs a role the theme doesn't have, define a token for it in `src/styles/theme.css` rather than hardcoding the value.

## 7. Check your work

1. Run `npm run validate`.
2. Run `npm run check:agent`. It scans the source and build output for raw translation keys, CSP problems (inline event handlers, unhashed inline scripts), broken internal links and stubbed forms, and prints the file, the rule and the fix for each. Fix everything it reports.
3. Run `npm run build && npm run test:e2e`. Axe fails on brand colors with too little contrast, and the suite fails on any CSP violation. If Playwright has no browser, run `npx playwright install chromium`.
4. Axe runs in light mode. Start the dev server, toggle dark mode and check the brand color, the logo and the fonts there too.
5. Open a generated share image from the build, such as `og/index.png` in the client output folder, and check the logo and accent color.
