import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Content Security Policy hashes for the scripts BaseLayout renders inline.
 *
 * <InlineScript /> adds a script's hash to the policy while the page renders.
 * That is enough for a prerendered page, whose policy is a <meta> written after
 * the render. A page rendered on demand (the 404 when there are several
 * locales, or any page with `prerender = false`) sends its policy as a header
 * before the layout has rendered, so the hash arrives too late and the browser
 * blocks the script. Listing the same hashes in the config puts them in every
 * policy.
 *
 * Keep these lists in step with the `?raw` imports in BaseLayout.astro and
 * Analytics.astro. tests/unit/layout-csp.test.ts fails when they drift.
 */

/** Rendered on every page. */
export const THEME_SCRIPT = 'src/layouts/theme-script.js';

/**
 * Rendered when site.config.ts sets `speculation: 'prerender'`. Listed either
 * way: the setting lives in a TypeScript file this integration can't import,
 * and the hash only admits these exact rules, so listing it unused is harmless.
 */
export const SPECULATION_RULES = 'src/layouts/speculation-rules.json';

/** Rendered when GA or GTM is configured. Which ones depends on the consent mode. */
export const ANALYTICS_SCRIPTS = ['consent-defaults', 'load-ga', 'load-gtm', 'strict-ga', 'strict-gtm'].map(
  (name) => `src/components/layout/analytics/${name}.js`,
);

/** The hash <InlineScript /> gives a script: SHA-256 of its source with LF line endings. */
export function inlineScriptHash(code) {
  return `sha256-${createHash('sha256').update(code.replace(/\r\n/g, '\n')).digest('base64')}`;
}

/**
 * Hashes for `security.csp.scriptDirective.hashes`: every script the layout can
 * render inline. The analytics scripts are listed whether or not GA or GTM is
 * configured. Which .env file a build reads depends on its mode and envDir, so
 * guessing here could leave them out of a build that renders them; a hash only
 * admits that exact script, so listing one that never renders is harmless.
 * @param {URL} [root] project root
 */
export function layoutScriptHashes(root = new URL('../', import.meta.url)) {
  return [THEME_SCRIPT, SPECULATION_RULES, ...ANALYTICS_SCRIPTS].map((file) =>
    inlineScriptHash(readFileSync(new URL(file, root), 'utf8')),
  );
}
