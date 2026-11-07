# Section recipes

Maintained by Velocity and replaced on upgrade. Working sources for common sections live in `.agents/design/sections/`. They're references: borrow a structure, a detail or the accessible markup, but design the site's sections from its art direction (`.agents/design.md`) rather than assembling a page from these. A page built only from recipes looks like every other site built from them.

To use one, copy it into `src/components/sections/` and change it as much as the design needs. Keep its `@velocity-section` stamp if it stays close to the source, so `check:agent` can tell you when Velocity ships a fix; drop the stamp once it's yours. Each takes its copy as props, and its `@requires` line names the components it needs (restore a missing one with `velocity-add-component`).

## Sections

| Section | Use it for | Layouts | Requires | Data rule |
|---|---|---|---|---|
| `HeroSplit` | Opening band with a real photo of the place, work or people | photo right, `reverse` | button, badge, media-slot | n/a |
| `HeroCentered` | Opening statement for a product or launch, optional wide shot below | `plain`, `media` | button, badge, media-slot | n/a |
| `HeroTypographic` | Opening band with no photo: large type that looks finished | type only | button | n/a |
| `ProofBand` | Evidence right after the hero | `stats`, `avatars` | avatar-group | Real figures and customers only, else leave it out |
| `FeatureGrid` | Services, features, reasons to choose | `columns`, `bento`, `list` (with photos) | section, card, icon, media-slot | n/a |
| `Steps` | How it works, 3 to 5 steps | `horizontal`, `vertical` | section | n/a |
| `Testimonials` | What customers say | `grid`, `single` | section, card, avatar | Placeholders unless supplied |
| `Pricing` | Plans or a single offer | 1 to 4 tiers | section, card, badge, button, icon | Placeholders unless supplied |
| `FAQ` | Questions visitors ask before acting | `single`, `split` | section, accordion | n/a |
| `Team` | The people | `grid` (portraits), `list` | section, media-slot, avatar | Only people the user named |
| `ContactBand` | Contact form beside the ways to get in touch | details, details + map | section, contact-form, icon, google-map | Map only with a real address |
| `LogoCloud` | Client, partner or press logos | `row`, `grid` | none | Real logos only, else leave it out |
| `CTABand` | The closing ask | `invert`, `inline` | cta, button | n/a |
| `HoursAndLocation` | Opening hours, address, phone | `card`, `inline` | section, table, icon | Placeholders unless supplied |

`PageHeader` (inner page titles), `Section` (any section with a heading), `MediaSlot` and `NewsletterForm` in `src/components/patterns/` are used as they are. The components in `src/components/landing/` are Velocity's own marketing; don't use them.

## Page structure

There are no blueprints on purpose: structure comes from the business. Lead with what a visitor most needs to see (the work, the place, the offer, the people), follow with what earns trust, close with the primary action. Vary how sections open, and don't repeat a section shape twice in a row. Inner pages open with `PageHeader` or a page-specific header of your own, so each page keeps one `<h1>`.
