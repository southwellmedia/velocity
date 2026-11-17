/**
 * Site configuration — this file is yours. Velocity upgrades never overwrite it.
 *
 * Built with Velocity by Southwell Media: https://github.com/southwellmedia/velocity
 */
import { SITE_URL, GOOGLE_SITE_VERIFICATION, BING_SITE_VERIFICATION } from 'astro:env/server';

export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  author: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  socialLinks: string[];
  twitter?: {
    site: string;
    creator: string;
  };
  verification?: {
    google?: string;
    bing?: string;
  };
  /**
   * Branding configuration
   * Logo files: Replace SVGs in src/assets/branding/
   * Favicon: Replace in public/favicon.svg
   */
  /**
   * Theme for visitors who haven't chosen one with the toggle: 'system' follows
   * their operating system (the default), 'light' or 'dark' fixes it.
   */
  defaultTheme?: 'system' | 'light' | 'dark';
  /**
   * Prerender a same-site page in Chromium when a visitor hovers or presses a
   * link to it (speculation rules), so it opens instantly. Off by default:
   * prerendered pages run their scripts before anyone sees them. Google
   * Analytics and Tag Manager wait until the page is shown, but other
   * analytics, ad pixels and call-tracking tags may count a visit that never
   * happened. Check the tags your site loads before turning this on. Astro's
   * hover prefetch stays on either way. Mark a link with data-no-prerender to
   * leave it out.
   */
  speculation?: 'off' | 'prerender';
  branding: {
    /** Logo alt text for accessibility */
    logo: {
      alt: string;
    };
    /** Favicon path (lives in public/) */
    favicon: {
      svg: string;
    };
    /** Theme colors for manifest and browser UI */
    colors: {
      /** Browser toolbar color (hex) */
      themeColor: string;
      /** PWA splash screen background (hex) */
      backgroundColor: string;
    };
  };
}

const siteConfig: SiteConfig = {
  // Your site's identity. Used in page titles, metadata, structured data,
  // the web manifest and share images.
  name: 'My Site',
  description: 'A website built with Astro and Tailwind CSS',
  url: SITE_URL || 'https://example.com',
  author: 'Your Name',
  email: 'hello@example.com',
  // Optional business details, used in structured data and the GoogleMap component:
  // phone: '+1 (555) 123-4567',
  // address: {
  //   street: '123 Main St',
  //   city: 'Your City',
  //   state: 'ST',
  //   zip: '00000',
  //   country: 'US',
  // },
  // Your profiles (GitHub, LinkedIn, X...). Listed as `sameAs` in structured data.
  socialLinks: [],
  // twitter: {
  //   site: '@yourhandle',
  //   creator: '@yourhandle',
  // },
  verification: {
    google: GOOGLE_SITE_VERIFICATION,
    bing: BING_SITE_VERIFICATION,
  },
  // Branding: logo files live in src/assets/branding/.
  // Replace the SVG files there with your own.
  branding: {
    logo: {
      alt: 'My Site',
    },
    favicon: {
      svg: '/favicon.svg',
    },
    colors: {
      themeColor: '#F94C10',
      backgroundColor: '#ffffff',
    },
  },
};

export default siteConfig;
