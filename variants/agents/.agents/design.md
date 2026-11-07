# Designing a Velocity site

Maintained by Velocity and replaced on upgrade. How to design a site that looks like the business it's for, while keeping what Velocity guarantees: accessible contrast in light and dark, translatable copy, CSP and upgrades that don't undo your work.

**Design freely; the guardrails are for correctness, not taste.** Write the CSS the design needs, in the project's own files. The only design rule `check:agent` enforces is that colours are tokens with a dark-mode value.

## Where design lives

| What | Where | Owner |
|---|---|---|
| Pages | `src/views/`, `src/pages/` | Project |
| Sections | `src/components/sections/`, `src/components/site/` (header and footer) | Project |
| The site's own colours, devices and styles | `src/styles/site.css` (loads last, so it wins) | Project |
| Base theme choice and any quick theme | `src/styles/theme.css` | Project |
| Primitives (Button, Card, Accordion, forms…) | `src/components/ui/`, `src/components/patterns/` | Velocity's `ui/`; patterns are yours |
| Tokens and base themes | `src/styles/tokens/`, `src/styles/themes/`, `global.css` | Velocity, replaced on upgrade |

Never edit `src/components/ui/` or `src/components/hero/`: upgrades replace them and `check:agent` reports the edit. Use primitives where they bring behaviour (forms, accordion, dialog, buttons), pass them classes, or write your own markup. A section in `src/components/sections/` can look like anything.

## 1. Art-direct before you build

Write the art direction into `.agents/site.md` → Design before any page is built. Work from the business outwards, not from a template inwards:

- **Subject and feeling.** What it's like to be this business's customer, in a sentence. For example, an auto detailer: "a showroom at night: deep, glossy, precise, the car is the hero".
- **References.** Sites, brands, places or objects that feel right, if the user gave any. Say what to take from each.
- **Ground and palette.** Start from the brand colour and decide how the page is coloured, not just which buttons are. Choose:
  - the ground: warm cream, deep near-black, cool paper, or a tinted mid-tone;
  - one or two accent colours with a job each: a highlight, a tinted surface, labels;
  - where colour lives: bands, photography, type, or small details.
  
  Avoid white plus one brand colour on the buttons: that's what every template does.
- **Type.** A pairing with a clear voice (see Fonts below), a real contrast in scale between display and body (hero headings far larger than body text), and how headings behave: tight and heavy, light and wide, italic accents.
- **Imagery.** Photography-led (how it's cropped, framed, overlapped), illustration (simple inline SVG drawn with your tokens), or type-led. Decide what the page looks like before the photos exist.
- **Motif, the signature.** One or two devices that belong to this business and recur: a gloss highlight across dark panels, a paint-swatch strip, a chalkboard list, oversized numerals, an arch, ruled document lines. Design it; don't pick it from a list.
- **Layout ideas per page.** What leads, what follows, what breaks the grid. Name the sections you'll design, not recipe names.

Show the user the art direction in a few lines with the sitemap, and wait for a go-ahead. In a headless run, write it and proceed.

## 2. Build it

- **Tokens first, in `src/styles/site.css`.** Define the palette, grounds, gradients and device colours as custom properties: a light value on `:root`, a dark value on `.dark`. Then use them everywhere as `var(--site-…)`, in Tailwind arbitrary values (`bg-[var(--site-ground)]`) or in classes you define in `site.css`. You can also override Velocity's semantic tokens there (`--background`, `--foreground`, `--primary`…) so primitives follow the art direction.
- **Design sections for this business** in `src/components/sections/`. Copy arrives as props (the view calls `t()`); take a `class` prop. Write the markup and CSS the design needs: exact sizes, overlaps, layered panels, full-bleed bands, sticky columns, gradients, patterns. Tailwind and `site.css` are both fine.
- **Recipes are references, not a starting point.** `.agents/recipes.md` lists working sources for common sections. Borrow a structure or a detail; don't assemble a page from them.
- **Dark mode is designed, not inverted.** Give every token a dark value that keeps the feeling: a tinted deep ground instead of near-black, accents that still glow, photography that sits well on it.
- **No photos yet?** Design the empty state on purpose: type-led compositions, colour fields, simple SVG illustration with token fills (classes in `site.css` such as `.site-hill { fill: var(--site-hill); }`), or `MediaSlot` placeholders styled to fit. Never stock or generated images unless the user asks.
- **Motion** is welcome where it adds meaning; respect `prefers-reduced-motion` (wrap transitions in `@media (prefers-reduced-motion: no-preference)` or rely on the global rule).

### Composing a section

- **Width:** `max-w-6xl` for most, a reading measure for text, full bleed for bands and imagery that should break the grid.
- **Grid:** split by importance (1/3 + 2/3, 5/7, asymmetric), not evenly; equal thirds only for truly equal items.
- **Alignment:** left-aligned by default; centre only short, standalone statements.
- **Opening:** decide per section whether it needs a heading, an eyebrow or a lead. Varying this is what stops a page reading like a template.
- **Emphasis:** one focal point per section: a photo, a big number, a quote, a button. Use scale and space before colour.
- **Structure:** lists are `ul`/`ol`, quotes `figure` + `blockquote` + `figcaption`, headings in page order (`h2` per section, `h3` inside), one `<h1>` per page. A region that scrolls sideways needs `tabindex="0"`, `role="region"` and a label.

### Avoid the template tells

- every section opening with the same small uppercase eyebrow, heading and lead;
- rows of three equal cards, a 3×2 grid of icon cards, numbered steps in circles, three review cards, then a centred dark CTA band: the default landing page;
- white ground with the brand colour only on buttons;
- small, light body text and timid heading sizes;
- the same section shape twice in a row.

## 3. Verify

- `npm run validate`: lint, types, tests, build and `check:agent`. Fix errors.
- `npm run design -- tokens`: contrast of Velocity's colour pairs in light and dark after your overrides. For your own `site.css` colours, check text against the grounds it sits on (aim for 4.5:1, 3:1 for large text); `npm run build && npm run test:e2e` runs axe on every page and catches what the token check can't see.
- If a browser and screenshots are available, look at each page in light and dark, desktop and mobile, against the art direction. Fix what reads as template.

## Fonts

Register families in `fonts` in `astro.config.mjs` with `fontsourceVariable()` (install `@fontsource-variable/<name>` first; ask the user before installing). Point `--theme-font-sans` and `--theme-font-display` at them in `site.css` or `theme.css`. Use at most two families. `npm run design -- fonts` checks that the package, the config entry and the tokens agree; `-- fonts --fix` stops loading families nothing uses. Choose for voice: a characterful display face with a quiet body face usually beats one neutral family. Avoid the most common defaults (Inter, Roboto, Open Sans) unless the brand uses them.

## Quick themes (optional)

For a user who wants something fast and has no strong look in mind, `npm run design -- direction --base <id> --brand "<hex>"` writes one of five ready-made themes (`--list` shows them) into `theme.css`, with contrast checked. A direction chosen when the project was created is a starting point too: keep its fonts and colour if they fit the art direction, and restyle freely in `site.css`, which loads after it.
