import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_SCRIPTS,
  SPECULATION_RULES,
  THEME_SCRIPT,
  inlineScriptHash,
  layoutScriptHashes,
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
    expect(rawImports('src/layouts/BaseLayout.astro')).toEqual([THEME_SCRIPT, SPECULATION_RULES]);
    expect(rawImports('src/components/layout/Analytics.astro').sort()).toEqual([...ANALYTICS_SCRIPTS].sort());
  });

  it('hashes a script the way InlineScript does, whatever its line endings', async () => {
    const source = read(THEME_SCRIPT).replace(/\r\n/g, '\n');
    const expected = await hashLikeInlineScript(source);
    expect(inlineScriptHash(source)).toBe(expected);
    expect(inlineScriptHash(source.replace(/\n/g, '\r\n'))).toBe(expected);
  });

  it('lists every script the layout can render, analytics included', () => {
    // Analytics hashes are listed even without GA/GTM: which .env a build reads
    // depends on its mode and envDir, and an unused hash admits nothing else.
    expect(layoutScriptHashes()).toEqual(
      [THEME_SCRIPT, SPECULATION_RULES, ...ANALYTICS_SCRIPTS].map((file) => inlineScriptHash(read(file))),
    );
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
    const scriptDirective = { hashes: layoutScriptHashes(root) };
    expect(setup({ scriptDirective: { resources: ["'self'"] } })).toEqual([{ security: { csp: { scriptDirective } } }]);
    expect(setup(true)).toEqual([{ security: { csp: { algorithm: 'SHA-256', scriptDirective } } }]);
  });

  it('leaves a project without a CSP alone', () => {
    expect(setup(false)).toEqual([]);
  });
});
