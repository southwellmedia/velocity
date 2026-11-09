import { cva, type VariantProps } from 'class-variance-authority';

/** The band every section renders: background tone and vertical padding. */
export const bandVariants = cva('scroll-mt-24', {
  variants: {
    tone: {
      default: '',
      secondary: 'bg-background-secondary',
      /** Dark band; remaps text, border and button tokens (.invert-section in global.css) */
      invert: 'invert-section bg-background',
      /** Brand-filled band with --brand-ink text (.brand-section in global.css) */
      brand: 'brand-section bg-background',
    },
    pad: {
      md: 'py-[var(--space-section-md)]',
      sm: 'py-[var(--space-section-sm)]',
      none: '',
    },
  },
  defaultVariants: { tone: 'default', pad: 'md' },
});

/** The band's inner container. */
export const bandInnerVariants = cva('mx-auto px-6', {
  variants: {
    width: {
      /** Copy, cards and forms */
      default: 'max-w-6xl',
      /** Product grids and wide media */
      wide: 'max-w-[90rem]',
      /** A single column of reading text */
      narrow: 'max-w-3xl',
    },
  },
  defaultVariants: { width: 'default' },
});

export type BandTone = NonNullable<VariantProps<typeof bandVariants>['tone']>;
export type BandPad = NonNullable<VariantProps<typeof bandVariants>['pad']>;
export type BandWidth = NonNullable<VariantProps<typeof bandInnerVariants>['width']>;
