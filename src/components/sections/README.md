# Sections

This site's page sections: the hero, services, testimonials, pricing, contact band and so on. Views in `src/views/` compose pages from them.

- **Yours.** Upgrades never touch this folder.
- **Start from a recipe.** Velocity ships working section sources in `.agents/design/sections/`, indexed in `.agents/recipes.md`. Copy one here and adapt its layout and copy. When nothing fits, write a new section the same way.
- **Build from primitives.** Use the components in `src/components/ui/` and `src/components/patterns/`, semantic token classes and the spacing scale. Wrap a primitive and pass classes when it needs a different look; never edit `src/components/ui/` (upgrades replace it).
- **Copy comes in as props.** The view calls `t()` and passes the strings in, so a section never depends on translation keys.

Rules: `.agents/design.md`.
