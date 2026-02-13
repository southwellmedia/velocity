import { defineConfig, envField } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',

  env: {
    schema: {
      SITE_URL: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_GA_MEASUREMENT_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_GTM_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      CONTACT_FORM_ENDPOINT: envField.string({ context: 'server', access: 'secret', optional: true }),
      NEWSLETTER_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_SITE_VERIFICATION: envField.string({ context: 'server', access: 'public', optional: true }),
      BING_SITE_VERIFICATION: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_CONSENT_ENABLED: envField.boolean({ context: 'client', access: 'public', optional: true, default: false }),
    },
  },

  integrations: [
    react(),
    mdx(),
    sitemap(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  security: {
    checkOrigin: true,
    csp: {
      scriptDirective: {
        resources: [
          "'self'",
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
        ],
      },
      styleDirective: {
        resources: [
          "'self'",
        ],
      },
      directives: [
        "font-src 'self'",
        "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com",
        "img-src 'self' data: https://www.googletagmanager.com https://i.pravatar.cc https://www.southwellmedia.com",
      ],
    },
  },

  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
