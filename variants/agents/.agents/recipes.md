# Section recipes

Maintained by Velocity and replaced on upgrade. Working section sources live in `.agents/design/sections/`. To use one, copy it into `src/components/sections/` (create the folder if needed), keep its `@velocity-section` stamp, and adapt its layout, density and copy to the site's direction. The copy is yours: upgrades never touch it, and `check:agent` prints a `design/section-outdated` notice when Velocity ships a newer version, with what changed.

Recipes are worked examples, not a closed catalogue. When nothing fits (a menu board, a case-study strip, a booking widget), write a new section the same way, following `.agents/design.md`.

Every section takes its copy as props. The view calls `t()` with keys from `src/i18n/translations/<locale>.ts` and passes the strings in. Each source lists the components it needs on its `@requires` line; if one isn't installed, restore it with the `velocity-add-component` skill.

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

## Page blueprints

Starting points for the home page, as section lists. The brief's section rhythm (`.agents/site.md` → Design) wins. Alternate `tone="secondary"` and default backgrounds, use at most two invert bands, and never put the same section or layout twice in a row.

| Business | Direction | Home page |
|---|---|---|
| Local service (trades, salon, cleaner) | `warm-local` | HeroSplit → HoursAndLocation (`inline`) → FeatureGrid (`columns`) → Testimonials → FAQ → CTABand (`invert`) |
| Restaurant or café | `warm-local` | HeroSplit → FeatureGrid (`list`, the menu highlights) → HoursAndLocation (`card`) → Testimonials (`single`) → CTABand (`inline`) |
| Professional services (clinic, legal, finance) | `clinical` | HeroCentered → ProofBand (`stats`, if real) → FeatureGrid (`columns`) → Steps → Team → FAQ (`split`) → ContactBand |
| Agency or consultant | `editorial` | HeroTypographic → FeatureGrid (`list`) → Testimonials (`single`) → Steps (`vertical`) → CTABand (`inline`) |
| SaaS or app | `bold-product` | HeroCentered (`media`) → LogoCloud (if real) → FeatureGrid (`bento`) → Steps → Pricing → FAQ → CTABand (`invert`) |
| Portfolio | `minimal-portfolio` | HeroTypographic → FeatureGrid (`list`, the work) → Testimonials (`single`) → CTABand (`inline`) |
| Nonprofit or event | `editorial` or `warm-local` | HeroSplit → ProofBand (`stats`, if real) → FeatureGrid (`columns`) → Steps → FAQ → CTABand (`invert`) |

Inner pages open with `PageHeader`, not a hero, so each page keeps one `<h1>`.
