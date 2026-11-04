/**
 * Scaffold contract tests (see variants/README.md).
 *
 * Applies every variant combination the CLI can produce to a temp copy of the
 * repo and checks the result is coherent. Fast; the full install + build of
 * each combination runs in `pnpm test:scaffold` (scripts/scaffold-matrix.mjs).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain JS helpers shared with the CI matrix
import { scaffoldProject } from '../../scripts/scaffold.mjs';
// @ts-expect-error -- plain JS helpers shared with the CI matrix
import { checkRegistry, findBrokenImports } from '../../scripts/check-registry.mjs';

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'velocity-manifest.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'velocity-scaffold-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const combos = [true, false].flatMap((demo) =>
  [false, true].flatMap((i18n) => (['all', 'none'] as const).map((components) => ({ demo, i18n, components }))),
);

describe('manifest migrations', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'velocity-manifest.json'), 'utf8'));

  it.each(manifest.migrations.filter((m: { pattern?: string }) => m.pattern).map((m: { title: string; pattern: string }) => [m.title, m.pattern]))(
    '%s has a valid pattern',
    (_title, pattern) => {
      expect(() => new RegExp(pattern as string)).not.toThrow();
    },
  );

  it('seeds only protected paths', () => {
    for (const seed of manifest.files.seed) {
      const covered = manifest.files.protected.some((p: string) => seed === p || seed.startsWith(p));
      expect(covered, seed).toBe(true);
    }
  });
});

describe('component registry', () => {
  it('is consistent with the files on disk', () => {
    expect(checkRegistry(root)).toEqual([]);
  });
});

describe('manifest scaffold section', () => {
  it('points at overlays and paths that exist', () => {
    for (const variant of manifest.scaffold.variants) {
      if (variant.overlay) expect(fs.existsSync(path.join(root, variant.overlay)), variant.overlay).toBe(true);
      for (const rel of variant.remove ?? []) expect(fs.existsSync(path.join(root, rel)), rel).toBe(true);
    }
  });

  it('only overlays files that make sense to replace', () => {
    // Overlay files must either replace a core file or be new; never overlay generated output.
    for (const variant of manifest.scaffold.variants.filter((v: { overlay?: string }) => v.overlay)) {
      const files = fs.readdirSync(path.join(root, variant.overlay), { recursive: true }) as string[];
      expect(files.some((f) => /node_modules|dist[\\/]/.test(f))).toBe(false);
    }
  });
});

describe.each(combos)('scaffold demo=$demo i18n=$i18n components=$components', (options) => {
  const dir = path.join(tmp, `${options.demo ? 'demo' : 'min'}-${options.i18n ? 'i18n' : 'en'}-${options.components}`);
  const { applied } = scaffoldProject(root, dir, options);

  it('applies the expected variants', () => {
    expect(applied.includes('i18n')).toBe(options.i18n);
    expect(applied.includes('minimal')).toBe(!options.demo);
  });

  it('has no imports pointing at removed files', () => {
    expect(findBrokenImports(dir)).toEqual([]);
  });

  it('removes scaffold-only files', () => {
    for (const rel of manifest.scaffold.cleanup) expect(fs.existsSync(path.join(dir, rel)), rel).toBe(false);
  });

  it('enables the right locales', () => {
    const locales = fs.readFileSync(path.join(dir, 'src/i18n/locales.mjs'), 'utf8');
    expect(locales.includes("'es'")).toBe(options.i18n);
  });
});
