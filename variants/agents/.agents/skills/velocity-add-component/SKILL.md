---
name: velocity-add-component
description: Add, restore or customize a UI component in this Velocity site, following its CVA variants, design tokens, i18n and upgrade rules. Use when asked to create a component, add a reusable UI element, or use a Velocity component that isn't installed.
---

# Add a component

**First, read the Project notes in `AGENTS.md`.** They describe this site's own conventions and take priority over the examples here.

## 1. Check whether it already exists

Read `.agents/components.md` first, before reading component source or creating anything. It lists every component Velocity ships, with its import path, props, variants, slots, an example, and notes on which component to use instead. Search it for `## <ComponentName>`. Then check whether the component's files are on disk.

- **Installed:** use it, following its entry in `.agents/components.md`. Read the source only if the entry doesn't answer your question.
- **Listed but missing:** the project was scaffolded without it, so restore it (step 2).
- **Not listed:** build it (steps 3 onward).

Import components by file path, such as `@/components/ui/data-display/Badge/Badge.astro`. Category barrels like `ui/index.ts` are removed from partial installs.

## 2. Restore a Velocity component

1. Read `version` from `.velocity.json`.
2. Find the component in `component-registry.json`, follow its `dependencies.components` recursively, and collect every entry that's missing from the project.
3. Download each file in those entries, keeping its path:
   `https://raw.githubusercontent.com/southwellmedia/velocity/v<version>/<file>`
4. Check `dependencies.utilities` against the registry's `utilities` section. Add any missing `files`, and install any missing `npm` packages.
5. Skip to step 6.

Upgrades won't update a restored component, because the project's `.velocity.json` doesn't list it. Don't edit `.velocity.json` to change that.

## 3. Choose where it goes

| What you're building | Location | On upgrade |
|----------------------|----------|------------|
| A composition of existing components | `src/components/patterns/Name.astro` | Never touched |
| A new standalone element with variants | `src/components/ui/<subcategory>/Name/` | New files stay |
| A change to a Velocity component | Wrap it in `patterns/` | Never touched |

A component built from existing components belongs in `patterns/`, even if it has props. Velocity components accept `class`, so a wrapper can usually restyle one without editing it. A direct edit to a shipped file is replaced on upgrade after being saved to `.velocity-backup/`, so tell the user if an edit is unavoidable.

Subcategories are listed under `categories.ui.subcategories` in the registry. You don't need to add your own components to the registry.

## 4. Write a primitive

Create these files in `src/components/ui/<subcategory>/Name/`. Add `Name.tsx` only if the component must run in a React island. Astro is the default.

The folder and component use PascalCase, and the variants file uses camelCase: `PriceTag/priceTag.variants.ts`.

`name.variants.ts`:

```ts
import { cva, type VariantProps } from 'class-variance-authority';

export const nameVariants = cva('inline-flex items-center rounded-md border', {
  variants: {
    variant: {
      default: 'bg-secondary text-secondary-foreground border-border',
      brand: 'bg-brand-600 text-background border-transparent',
    },
    size: {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-3 py-1 text-sm',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});

export type NameVariants = VariantProps<typeof nameVariants>;
```

`Name.astro`:

```astro
---
import type { HTMLAttributes } from 'astro/types';
import { cn } from '@/lib/cn';
import { nameVariants, type NameVariants } from './name.variants';

interface Props extends HTMLAttributes<'div'>, NameVariants {}

const { variant, size, class: className, ...attrs } = Astro.props;
---

<div class={cn(nameVariants({ variant, size }), className)} {...attrs}>
  <slot />
</div>
```

Use a `<span>` root, with `HTMLAttributes<'span'>`, for anything that can appear inside text or a `<p>`.

`index.ts`:

```ts
export { default } from './Name.astro';
export { nameVariants, type NameVariants } from './name.variants';
```

## 5. Follow the project rules

- **Styling:** use semantic classes and tokens, never raw colors. Always merge `class` through `cn()` and spread `...attrs` onto the root element.
- **Strings:** use `const t = useTranslations(getLocale(Astro))`, with `useTranslations` and `getLocale` imported from `@/i18n`. Prefer props or slots for content. Add fixed strings such as `aria-label` text to `src/i18n/translations/<locale>.ts`, not `src/i18n/ui.ts`.
- **Links:** pass internal URLs through `localizePath`.
- **Scripts:** a bundled `<script>` is safe under CSP. Never use `onclick` or similar attributes. Guard against double init, call `init()` directly, and also listen for `astro:after-swap`.
- **Accessibility:** use native elements first. Interactive parts need an accessible name, keyboard support and a visible focus ring (`focus-visible:ring-2 focus-visible:ring-ring`).
- **Motion:** use CSS transitions and animations so the global `prefers-reduced-motion` rule covers them. Check the media query in any JavaScript animation.

## 6. Verify

1. Use the component on a real page. Unused components aren't tested.
2. Run `npm run validate`.
3. Run `npm run build && npm run test:e2e`, which catches axe and CSP failures. If Playwright has no browser, run `npx playwright install chromium`.
