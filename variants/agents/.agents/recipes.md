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
| `HeroAsymmetric` | Opening band with one strong photo and a confident line, without the centred badge-and-buttons look | `stacked`, `overlap` | button, media-slot | n/a |
| `ProofBand` | Evidence right after the hero | `stats`, `avatars` | avatar-group | Real figures and customers only, else leave it out |
| `FeatureGrid` | Services, features, reasons to choose | `columns`, `bento`, `list` (with photos), `split` (heading beside the items), `numbered` (no cards) | section, card, icon, media-slot | n/a |
| `Steps` | How it works, 3 to 5 steps | `horizontal`, `vertical` | section | n/a |
| `Testimonials` | What customers say | `grid`, `single`, `wall` (short quotes in columns) | section, card, avatar | Placeholders unless supplied |
| `Pricing` | Plans or a single offer | 1 to 4 tiers | section, card, badge, button, icon | Placeholders unless supplied |
| `FAQ` | Questions visitors ask before acting | `single`, `split` | section, accordion | n/a |
| `Team` | The people | `grid` (portraits), `list` | section, media-slot, avatar | Only people the user named |
| `ContactBand` | Contact form beside the ways to get in touch | details, details + map | section, contact-form, icon, google-map | Map only with a real address |
| `LogoCloud` | Client, partner or press logos | `row`, `grid` | none | Real logos only, else leave it out |
| `CTABand` | The closing ask | `invert`, `inline` | cta, button | n/a |
| `HoursAndLocation` | Opening hours, address, phone | `card`, `inline` | section, table, icon | Placeholders unless supplied |
| `Story` | The business in its own words: origin, what it cares about | `split` (with photo), `quote` (pull quote leads), `columns` (long form) | section, media-slot | Only the user's own story |
| `Values` | What the business stands for, in a few specific statements | `statements` (manifesto), `grid` | section | Specific to the business, never generic |
| `Timeline` | History, project phases, an event programme | `vertical`, `alternating` | section | Only dates the user gave |
| `Gallery` | Photos of the work, place or people | `grid`, `masonry`, `strip` | section, media-slot | Real photos; list missing ones |
| `BeforeAfter` | Results side by side: renovations, gardens, repairs, treatments | `pairs`, `stacked` | section, media-slot | Real photos with permission |
| `PriceList` | A menu, or services with prices | `columns`, `board` (large, menu-board style) | section | Placeholders unless supplied |
| `ComparisonTable` | Plans, packages or "us and the usual way", feature by feature | table with a highlighted option | section, icon | Only facts the user supplied |
| `CaseStudies` | Client work and what changed | `grid`, `feature` (one large), `list` | section, media-slot, icon | Real clients and results only |
| `Announcement` | One timely message above the hero | `brand`, `quiet` | icon | Remove when out of date |
| `NewsletterBand` | Email signup with what subscribers get | `inline`, `card` | newsletter-form | Form stays a stub until connected |

`PageHeader` (inner page titles), `Section` (any section with a heading), `MediaSlot` and `NewsletterForm` in `src/components/patterns/` are used as they are. The components in `src/components/landing/` are Velocity's own marketing; don't use them.

## Page blueprints

Starting points for the home page: two or three section orders per business type, each with when it fits. Choose the one that suits the brief (the photos the user has, the primary action, the voice), then change it: add the brief's signature section, drop what the content can't support, reorder. Record the choice and why in `.agents/site.md` → Design. A blueprint copied unchanged is the fastest way to a site that looks like other Velocity sites.

Whatever the order: alternate `tone="secondary"` and default backgrounds, use at most two invert bands, never put the same section or layout twice in a row, and vary how sections open (not every section needs an eyebrow, a centred heading or a lead).

| Business | Suggested directions | Options |
|---|---|---|
| Local service (trades, salon, cleaner) | `warm-local`, `clinical` | **A, photos of the work:** HeroSplit → FeatureGrid `columns` → Testimonials `wall` → HoursAndLocation `inline` → CTABand `invert`. **B, no photos yet:** HeroTypographic → FeatureGrid `numbered` → Steps → FAQ `split` → ContactBand. **C, one strong photo:** HeroAsymmetric `overlap` → FeatureGrid `split` → Testimonials `single` → HoursAndLocation `card` |
| Restaurant or café | `warm-local`, `editorial` | **A, the place sells it:** HeroAsymmetric `overlap` → signature menu section → HoursAndLocation `card` → Testimonials `single` → CTABand `inline`. **B, the food sells it:** HeroSplit → FeatureGrid `list` → Testimonials `wall` → HoursAndLocation `inline`. **C, no photos:** HeroTypographic → signature menu section → HoursAndLocation `card` → FAQ |
| Professional services (clinic, legal, finance) | `clinical`, `editorial` | **A, trust first:** HeroCentered → ProofBand `stats` (if real) → FeatureGrid `split` → Steps `vertical` → Team → FAQ `split` → ContactBand. **B, people first:** HeroAsymmetric `stacked` → Team → FeatureGrid `numbered` → Testimonials `single` → ContactBand. **C, process first:** HeroTypographic → Steps → FeatureGrid `columns` → FAQ → CTABand `invert` |
| Agency or consultant | `editorial`, `minimal-portfolio` | **A, work first:** HeroTypographic → FeatureGrid `list` (case studies) → Testimonials `single` → CTABand `inline`. **B, point of view first:** HeroAsymmetric `stacked` → FeatureGrid `split` → Steps `vertical` → Testimonials `wall` → CTABand `inline` |
| SaaS or app | `bold-product`, `clinical` | **A, product shot:** HeroCentered `media` → LogoCloud (if real) → FeatureGrid `bento` → Steps → Pricing → FAQ → CTABand `invert`. **B, problem first:** HeroTypographic → FeatureGrid `numbered` → ProofBand `stats` (if real) → Pricing → FAQ `split`. **C, one big stat:** HeroAsymmetric `stacked` → FeatureGrid `split` → Testimonials `wall` → Pricing → CTABand `invert` |
| Portfolio | `minimal-portfolio`, `editorial` | **A, images lead:** HeroAsymmetric `overlap` → FeatureGrid `list` (the work) → CTABand `inline`. **B, words lead:** HeroTypographic → FeatureGrid `numbered` (services) → FeatureGrid `list` (work) → Testimonials `single` |
| Nonprofit or event | `editorial`, `warm-local` | **A, cause first:** HeroSplit → ProofBand `stats` (if real) → FeatureGrid `columns` → Steps → CTABand `invert`. **B, event details first:** HeroTypographic → HoursAndLocation `card` (date and venue) → FeatureGrid `split` (programme) → FAQ `split` → CTABand `inline` |

Inner pages open with `PageHeader`, not a hero, so each page keeps one `<h1>`.
