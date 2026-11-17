import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_SCRIPTS,
  THEME_SCRIPT,
  inlineScriptHash,
  layoutScriptHashes,
  readBuildEnv,
} from '../../integrations/layout-csp.mjs';
import localized404 from '../../integrations/localized-404.mjs';

const read = (file: string) => fs.readFileSync(file, 'utf8');

/** Project-relative paths of the scripts a component imports with `?raw`. */
function rawImports(component: string) {
  return [...read(component).matchAll(/from '(\.[^']+)\?raw'/g)].map(([, specifier]) =>
    path.posix.join(path.posix.dirname(component), specifier),
  );
}

/** The hash InlineScript.astro computes, with the same Web Crypto calls. */
async function hashLikeInlineScript(source: string) {
  const code = source.replace(/\r\n/g, '\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return `sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}`;
}

describe('layout CSP', () => {
  it('lists every inline script the layout renders', () => {
    expect(rawImports('src/layouts/BaseLayout.astro')).toEqual([THEME_SCRIPT]);
    expect(rawImports('src/components/layout/Analytics.astro').sort()).toEqual([...ANALYTICS_SCRIPTS].sort());
  });

  it('hashes a script the way InlineScript does, whatever its line endings', async () => {
    const source = read(THEME_SCRIPT).replace(/\r\n/g, '\n');
    const expected = await hashLikeInlineScript(source);
    expect(inlineScriptHash(source)).toBe(expected);
    expect(inlineScriptHash(source.replace(/\n/g, '\r\n'))).toBe(expected);
  });

  it('always lists the theme script, and nothing else without analytics', () => {
    expect(layoutScriptHashes({})).toEqual([inlineScriptHash(read(THEME_SCRIPT))]);
    expect(layoutScriptHashes({ PUBLIC_GA_MEASUREMENT_ID: '' })).toEqual(layoutScriptHashes({}));
  });

  it.each(['PUBLIC_GA_MEASUREMENT_ID', 'PUBLIC_GTM_ID'])('adds the analytics scripts when %s is set', (name) => {
    expect(layoutScriptHashes({ [name]: 'X-TEST' })).toEqual(
      [THEME_SCRIPT, ...ANALYTICS_SCRIPTS].map((file) => inlineScriptHash(read(file))),
    );
  });

  it('reads the production .env files, with the process environment on top', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velocity-env-'));
    try {
      fs.writeFileSync(path.join(dir, '.env'), 'PUBLIC_GTM_ID=GTM-BASE\nLAYOUT_CSP_TEST=file\n');
      fs.writeFileSync(path.join(dir, '.env.development'), 'PUBLIC_GTM_ID=GTM-DEV\n');
      const root = pathToFileURL(dir + path.sep);
      expect(readBuildEnv(root).PUBLIC_GTM_ID).toBe('GTM-BASE');
      fs.writeFileSync(path.join(dir, '.env.production'), 'PUBLIC_GTM_ID=GTM-PROD\n');
      expect(readBuildEnv(root).PUBLIC_GTM_ID).toBe('GTM-PROD');
      process.env.LAYOUT_CSP_TEST = 'process';
      expect(readBuildEnv(root).LAYOUT_CSP_TEST).toBe('process');
    } finally {
      delete process.env.LAYOUT_CSP_TEST;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('localized404', () => {
  const root = pathToFileURL(process.cwd() + path.sep);
  const setup = (csp: boolean | object) => {
    const updates: unknown[] = [];
    localized404().hooks['astro:config:setup']({
      config: { root, security: { csp } },
      updateConfig: (update: unknown) => updates.push(update),
    });
    return updates;
  };

  it("adds the layout's script hashes to the policy", () => {
    const scriptDirective = { hashes: layoutScriptHashes(readBuildEnv(root)) };
    expect(setup({ scriptDirective: { resources: ["'self'"] } })).toEqual([{ security: { csp: { scriptDirective } } }]);
    expect(setup(true)).toEqual([{ security: { csp: { algorithm: 'SHA-256', scriptDirective } } }]);
  });

  it('leaves a project without a CSP alone', () => {
    expect(setup(false)).toEqual([]);
  });
});
