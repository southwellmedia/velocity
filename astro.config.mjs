import { defineConfig, envField, fontProviders, memoryCache } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import pagefind from './integrations/pagefind.mjs';
import localized404 from './integrations/localized-404.mjs';
import { resolveDeployTarget } from './integrations/deploy-target.mjs';
import { defaultLocale, locales } from './src/i18n/locales.mjs';
import { routes } from './src/config/nav.config.ts';

/**
 * Deploy target: auto-detected from the build environment (Vercel, Netlify,
 * Cloudflare), or forced with DEPLOY_TARGET=node|vercel|netlify|cloudflare.
 * Pages stay prerendered (static) by default — the adapter only powers
 * on-demand routes such as Astro Actions (contact + newsletter forms).
 */
const target = await resolveDeployTarget();

/**
 * Register an installed @fontsource-variable package with the Fonts API using
 * the local provider. Every subset the package ships is registered, so languages
 * such as Russian or Vietnamese work; browsers only download the ones a page
 * uses. Latin comes first because BaseLayout preloads the first face.
 * Swap in fontProviders.google() or fontProviders.fontsource() if you prefer to
 * fetch fonts at build time.
 */
function fontsourceVariable({ name, pkg, cssVariable, weight, fallbacks }) {
  const dir = `./node_modules/@fontsource-variable/${pkg}`;
  const css = readFileSync(`${dir}/index.css`, 'utf8');
  const faces = [...css.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)[\s\S]*?unicode-range:\s*([^;]+);/g)]
    .map(([, file, range]) => ({ file, range }))
    .sort((a, b) => Number(b.file.includes('-latin-wght')) - Number(a.file.includes('-latin-wght')));

  return {
    provider: fontProviders.local(),
    name,
    cssVariable,
    fallbacks,
    options: {
      variants: faces.map(({ file, range }) => ({
        src: [`${dir}/files/${file}`],
        weight,
        style: 'normal',
        unicodeRange: range.split(',').map((r) => r.trim()),
      })),
    },
  };
}

// Search results are noindex, so keep them out of the sitemap in every language
const searchPages = new Set(
  locales.map((locale) => {
    const slug = routes.search?.slugs?.[locale] ?? routes.search?.path ?? 'search';
    return locale === defaultLocale ? `/${slug}/` : `/${locale}/${slug}/`;
  }),
);

export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',

  // Locales come from src/i18n/locales.mjs (one list for routing, UI and sitemap).
  // The default locale has no URL prefix; others live under /<locale>/.
  i18n: {
    defaultLocale,
    locales: [...locales],
    routing: { prefixDefaultLocale: false },
  },

  adapter: target.adapter,

  // Velocity doesn't use Astro sessions. Opting out (Astro 7.2+) stops adapters
  // from provisioning session storage. Remove this line to use Astro.session.
  session: false,

  // Astro 7 defaults to 'jsx', which strips whitespace between inline elements
  // (e.g. `<a>Docs</a> <a>Blog</a>` renders as "DocsBlog"). Velocity's components
  // are authored with HTML whitespace semantics, so we keep the Astro 6 behavior.
  compressHTML: true,

  env: {
    schema: {
      SITE_URL: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_GA_MEASUREMENT_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_GTM_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      CONTACT_FORM_ENDPOINT: envField.string({ context: 'server', access: 'secret', optional: true }),
      NEWSLETTER_ENDPOINT: envField.string({ context: 'server', access: 'secret', optional: true }),
      NEWSLETTER_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_SITE_VERIFICATION: envField.string({ context: 'server', access: 'public', optional: true }),
      BING_SITE_VERIFICATION: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_GOOGLE_MAPS_API_KEY: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
      PUBLIC_CONSENT_ENABLED: envField.boolean({ context: 'client', access: 'public', optional: true, default: false }),
      PUBLIC_PRIVACY_POLICY_URL: envField.string({ context: 'client', access: 'public', optional: true, default: '' }),
    },
  },

  // Astro Fonts API — self-hosted from the installed @fontsource-variable
  // packages (no network at build time), with preload links and
  // metric-matched fallbacks to minimise layout shift.
  fonts: [
    fontsourceVariable({ name: 'Manrope', pkg: 'manrope', cssVariable: '--font-manrope', weight: '200 800', fallbacks: ['sans-serif'] }),
    fontsourceVariable({ name: 'Outfit', pkg: 'outfit', cssVariable: '--font-outfit', weight: '100 900', fallbacks: ['sans-serif'] }),
    fontsourceVariable({ name: 'JetBrains Mono', pkg: 'jetbrains-mono', cssVariable: '--font-jetbrains-mono', weight: '100 800', fallbacks: ['monospace'] }),
  ],

  // Route caching (stable in Astro 7). Applies to on-demand routes; prerendered
  // pages are already static. On Vercel/Netlify the provider writes CDN cache
  // headers and supports tag invalidation; elsewhere an in-memory LRU is used.
  cache: {
    provider: target.cacheProvider ?? memoryCache(),
  },

  // Prefetch every internal link on hover. This used to come implicitly with
  // <ClientRouter />; native view transitions + prefetch give the same snappy
  // navigation without a client-side router.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },

  image: {
    layout: 'constrained',
  },

  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => !searchPages.has(new URL(page).pathname),
      ...(locales.length > 1
        ? { i18n: { defaultLocale, locales: Object.fromEntries(locales.map((l) => [l, l])) } }
        : {}),
    }),
    pagefind(),
    localized404(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  security: {
    checkOrigin: true,
    // Content Security Policy: Astro hashes every script and style it emits and
    // adds a <meta http-equiv="content-security-policy"> to each page.
    // Components that load third-party scripts declare their hosts at render
    // time (see Analytics.astro → Astro.csp.insertScriptResource).
    csp: {
      scriptDirective: {
        resources: ["'self'"],
      },
      styleDirective: {
        resources: [
          // `resources` replaces Astro's defaults, so 'self' must be re-added.
          { resource: "'self'", kind: 'element' },
          // Shiki colours code blocks with style="" attributes. Astro 7.1+ can
          // scope 'unsafe-inline' to attributes only: <style> elements stay
          // hash-locked and no script execution is allowed.
          { resource: "'unsafe-inline'", kind: 'attribute' },
        ],
      },
      directives: ["object-src 'none'", "base-uri 'self'", "form-action 'self'"],
    },
  },

  markdown: {
    shikiConfig: {
      // github-dark-default: same GitHub look as github-dark, but its comment colour
      // passes WCAG AA (github-dark's #6a737d comments are 3.0:1).
      theme: 'github-dark-default',
      wrap: true,
    },
  },
});
