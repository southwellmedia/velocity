import { type SVGAttributes, type Ref } from 'react';
import { DynamicIcon, type IconName as LucideIconName } from 'lucide-react/dynamic';
import { cn } from '@/lib/cn';
import { brandIcon, type BrandIconName } from './brand-icons';

/**
 * Icon for React islands: any Lucide icon by its kebab-case name, plus the brand
 * marks in brand-icons.ts. Lucide icons load on demand in the browser, one module
 * per icon, so they don't appear in server-rendered HTML. When an island needs
 * the icon in its first paint, import it by name instead:
 *
 *   import { MapPin } from 'lucide-react';
 */
export type IconName = LucideIconName | BrandIconName;

interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'ref'> {
  ref?: Ref<SVGSVGElement>;
  name: IconName;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  strokeWidth?: number;
}

const sizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

export function Icon({ ref, name, size = 'md', strokeWidth = 2, className, ...rest }: IconProps) {
  const classes = cn(sizes[size], 'shrink-0', className);
  const brand = brandIcon(name);

  if (!brand) {
    return (
      <DynamicIcon
        ref={ref}
        name={name as LucideIconName}
        strokeWidth={strokeWidth}
        className={classes}
        aria-hidden="true"
        {...rest}
      />
    );
  }

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={brand.filled ? 'currentColor' : 'none'}
      stroke={brand.filled ? 'none' : 'currentColor'}
      strokeWidth={brand.filled ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={classes}
      aria-hidden="true"
      {...rest}
    >
      <path d={brand.path} />
    </svg>
  );
}

export default Icon;
