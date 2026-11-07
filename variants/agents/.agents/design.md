# Designing a Velocity site

Maintained by Velocity and replaced on upgrade. How to give a site its own look inside Velocity's tokens and primitives, so it still takes upgrades. Everything here works from code: no browser or screenshots needed.

## The layers

| Layer | Where | Owner |
|---|---|---|
| Pages | `src/views/`, `src/pages/` | Project |
| Sections | `src/components/sections/` and `src/components/site/` | Project |
| Direction | the marked block in `src/styles/theme.css` | Project |
| Primitives | `src/components/ui/`, `src/components/hero/` | Velocity, replaced on upgrade |
| Tokens and base themes | `src/styles/tokens/`, `src/styles/themes/`, `global.css` | Velocity, replaced on upgrade |

The direction sets tokens, sections compose primitives, pages compose sections. Nothing above the line edits anything below it. When a primitive needs a different look, wrap it in a section and pass classes (`Card` and the other primitives merge a `class` prop). Never edit `ui/` or `hero/`: `check:agent` reports it (`ownership/edited`) and the next upgrade discards it. If a primitive can't be bent far enough, tell the user it's a Velocity issue.

## Choose a direction first

Decide the look once, before building pages. List the directions with `npm run design -- direction --list`.

| Direction | Suits | Feel | Fonts | Shape and density |
|---|---|---|---|---|
| `editorial` | Agencies, consultants, writers | Calm, type-led | Fraunces + Source Sans 3 | Tiny radii, airy spacing, almost no shadow |
| `warm-local` | Trades, cafés, salons, bakeries | Friendly, approachable | Nunito | Large radii, pill buttons, warm tinted surfaces, brand invert bands |
| `clinical` | Clinics, legal, finance | Trustworthy, clear | Figtree | Medium radii, cool neutrals, generous whitespace, smaller headings |
| `bold-product` | SaaS, apps, launches | Confident, high contrast | Space Grotesk + Manrope | Medium radii, tight large headings, dense, brand invert bands |
| `minimal-portfolio` | Designers, photographers, freelancers | Quiet, image-led | DM Sans | Square corners, flat, monochrome, wide spacing |

Each direction file (`.agents/design/directions/<id>.json`) also records the section rhythm it favours (`rhythm`) and how it handles images (`imagery`). Read them when planning pages.

Pick from the business type and the three words the user gave for the feel. A direction is where the look starts, not where it ends: see Make it the site's own below.

## Apply it

```bash
npm run design -- direction --base warm-local --brand "#c2410c"
```

- `--brand` takes the user's brand colour. The engine keeps its hue and saturation and fits it to Velocity's lightness scale, so every step stays accessible.
- **Variation:** the engine varies the direction within its bounds (brand hue when no `--brand` is given, neutral tint, radii, heading weight, spacing, type scale, whether buttons and invert bands use the brand), picked by a seed that defaults to the site name. Two sites in the same direction come out different, and the same seed always gives the same result. It prints what it picked. `--seed "<text>"` tries another variation; `--seed preset` gives the plain direction, which is for testing, not for a real site.
- **Fonts:** `--pair 2` or `--pair 3` picks one of the direction's alternative pairings (listed by `-- direction --list`); `--display` and `--body` set any fontsource family (`--display Fraunces --body "Source Sans 3"`). Choose by the brief's voice. Use at most two families.
- The command writes one block marked `@velocity-direction` at the end of `src/styles/theme.css` and registers the fonts in `fonts` in `astro.config.mjs`. Re-running replaces the block; put hand edits after the end marker.
- It checks every text/surface pair in light and dark against WCAG AA, darkens brand steps where needed and says what it changed. If a combination can't pass, it writes nothing.
- **Fonts:** if a font package isn't installed, it prints the install command and writes nothing. Ask the user before installing. If they decline, add `--fallback-fonts` to keep to installed families, and note it in `.agents/site.md`.
- Then set `branding.colors.themeColor` in `src/config/site.config.ts` to the brand colour, so share images match.
- Run `npm run design -- fonts --fix` to stop loading families the new direction no longer uses.

## Read the result without a browser

- `npm run design -- tokens` prints the fonts, theme controls, type scale, every colour token in light and dark, and the contrast matrix. It exits 1 if any pair is below AA. `--json` for machine-readable output.
- `npm run design -- fonts` checks the three places a font lives agree: the package is installed, it's registered in `astro.config.mjs`, and the `--theme-font-*` tokens point at it. A mismatch means text silently falls back to a system font.

The token check covers token pairs only. Text over images and opacity classes such as `bg-brand-500/10` aren't covered, so `npm run build && npm run test:e2e` (axe) stays the final word when a browser is available.

## Theme controls

Set these in `theme.css` on `:root` only (they're computed once there, so a local override has no effect). Directions set them for you.

| Control | Default | Effect |
|---|---|---|
| `--theme-section-space` | `1` | Multiplies the section padding tokens (`--space-section-*`). Below 1 is denser, above 1 airier |
| `--theme-heading-scale` | `1` | Multiplies `text-2xl` to `text-4xl` (section headings) |
| `--theme-display-scale` | `1` | Multiplies `text-5xl` to `text-7xl` (hero and page titles) |
| `--theme-heading-weight`, `--theme-heading-tracking`, `--theme-body-leading` | 700, -0.02em, 1.6 | Heading weight and letter-spacing, body line height |
| `--theme-radius-sm` … `-xl`, `--theme-radius-button` | 4–10px | Every `rounded-*` class and every Button |
| `--theme-shadow-sm` … `-xl` | soft | Every `shadow-*` class |
| `--theme-button-weight` | 600 | Button label weight |

## Build pages from sections

Compose each page from sections in `src/components/sections/`. Start from a recipe: `.agents/recipes.md` indexes the working sources in `.agents/design/sections/` (heroes, feature grids, steps, testimonials, pricing, FAQ, team, contact, hours) and gives a home-page blueprint per business type. Copy a source, keep its `@velocity-section` stamp, and adapt it. When nothing fits, write a new section the same way: props for copy, primitives and tokens only, a `class` prop passed through, and the rules below.

## Make it the site's own

Directions and recipes give every site a sound starting point, which also means a site built only from them looks like other Velocity sites. Before building pages, decide three things and record them in `.agents/site.md` → Design:

1. **Variation:** keep the seed's result or try others until it fits the brief (`--seed`). Record the seed.
2. **Font pairing:** the direction's default, one of its `--pair` options, or the brand's own fonts. Record why.
3. **Signature:** one distinctive treatment that belongs to this business and no other site in the direction, designed from scratch rather than copied from a recipe. Use it on at least two pages and in no more than three places, so it reads as identity rather than decoration. Examples:
   - a bakery: a menu-board section with dotted leaders between item and price, set in the display font;
   - a physiotherapy clinic: oversized step numbers running down the margin of the process section;
   - a law firm: a thin ruled grid and small-caps labels, like a document;
   - a product launch: a full-bleed invert band with a large product stat;
   - a photographer: an asymmetric image grid with captions in the margin.

   A signature follows the same rules as everything else: tokens and the spacing and type scales, AA contrast in light and dark, reduced motion respected. Build it as a section in `src/components/sections/` (no `@velocity-section` stamp, since it's not from a recipe).

Then **adapt every section you copy.** Change its composition (layout prop, alignment, column split, order of elements, which primitives), density or emphasis to fit the brief and the direction. A section left identical to its source gets a `design/section-unmodified` notice from `check:agent`.

**Avoid the template tells:**
- every section centred, or every section a row of three equal cards;
- the same eyebrow, heading and lead block on top of every section (vary it: some sections need no eyebrow, some a heading only);
- every page ending in the same invert CTA band;
- a pill badge above every hero heading;
- decorative gradient blobs or glows that don't come from the brief.

## Rules for pages and sections

- **Colour:** semantic classes only (`bg-background-secondary`, `text-foreground-muted`, `bg-brand-600`, `border-border`). No hex, `rgb()`, `oklch()` or Tailwind palette classes (`bg-blue-500`) in views or sections: they ignore dark mode and the direction.
- **Type:** use the scale (`text-sm` … `text-7xl`), never arbitrary sizes such as `text-[22px]`. One `<h1>` per page, in the Hero or PageHeader. Headings in order. Long text gets a measure (`max-w-prose`).
- **Space:** spacing tokens and Tailwind's scale, never arbitrary values such as `py-[73px]`. Use `Section` for page sections so `--theme-section-space` applies.
- **Rhythm:** alternate backgrounds (`bg-background`, `bg-background-secondary`), at most two `invert-section` contrast bands per page, and no two neighbouring sections with the same layout.
- **Hierarchy:** one primary Button per section. Eyebrow, heading and lead paragraph, in that order.
- **Images:** render every image through `MediaSlot`, so a missing photo shows a labelled placeholder instead of a broken image. Don't put a placeholder in the first screen: a typographic hero looks finished without a photo. Never use stock or generated images unless the user asks.
- **Motion:** respect `prefers-reduced-motion` (the global rule finishes animations instantly; don't override it).
