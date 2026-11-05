import { renderCard } from '../../integrations/og-images.mjs';
import siteConfig from '@/config/site.config';

export interface OGImageOptions {
  title: string;
  description?: string;
  type?: 'website' | 'article';
}

/** A share card in the project's own logo and theme color. See integrations/og-images.mjs. */
export function generateOGImage({ title, description }: OGImageOptions): Promise<Buffer> {
  return renderCard({
    title,
    description,
    siteName: siteConfig.name,
    hostname: new URL(siteConfig.url).hostname,
    themeColor: siteConfig.branding.colors.themeColor,
  });
}
