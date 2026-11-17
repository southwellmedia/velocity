import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

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

/** Rendered when analytics is configured. Which ones depends on the consent mode. */
export const ANALYTICS_SCRIPTS = ['consent-defaults', 'load-ga', 'load-gtm', 'strict-ga', 'strict-gtm'].map(
  (name) => `src/components/layout/analytics/${name}.js`,
);

/** The hash <InlineScript /> gives a script: SHA-256 of its source with LF line endings. */
export function inlineScriptHash(code) {
  return `sha256-${createHash('sha256').update(code.replace(/\r\n/g, '\n')).digest('base64')}`;
}

/**
 * The variables a build sees, read the way Vite reads them for `astro:env`:
 * the .env files for production, then the process environment on top.
 * (The policy only applies to builds, and builds run in production mode.)
 * @param {URL} root project root
 */
export function readBuildEnv(root) {
  const env = {};
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const file = new URL(name, root);
    if (existsSync(file)) Object.assign(env, parseEnv(readFileSync(file, 'utf8')));
  }
  return { ...env, ...process.env };
}

/**
 * Hashes for `security.csp.scriptDirective.hashes`. The analytics scripts are
 * only listed when Analytics.astro will render them.
 * @param {Record<string, string | undefined>} env
 * @param {URL} [root] project root
 */
export function layoutScriptHashes(env, root = new URL('../', import.meta.url)) {
  const analytics = Boolean(env.PUBLIC_GA_MEASUREMENT_ID || env.PUBLIC_GTM_ID);
  return [THEME_SCRIPT, ...(analytics ? ANALYTICS_SCRIPTS : [])].map((file) =>
    inlineScriptHash(readFileSync(new URL(file, root), 'utf8')),
  );
}
