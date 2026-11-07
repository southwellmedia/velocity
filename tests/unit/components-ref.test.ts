/**
 * The component reference agents read in projects (.agents/components.md) must
 * be current and cover every registry component. Regenerate it with
 * `node scripts/generate-components-ref.mjs`.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain JS generator shared with the CLI check
import { generate, OUTPUT } from '../../scripts/generate-components-ref.mjs';

const root = path.resolve(__dirname, '../..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'component-registry.json'), 'utf8'));
const components = Object.entries(registry.components) as [string, { name: string; example: string }][];
const { problems, output } = generate(root) as { problems: string[]; output: string };

describe('component reference', () => {
  it('has a description and an example for every registry component', () => {
    expect(problems).toEqual([]);
  });

  it('is up to date', () => {
    const onDisk = fs.readFileSync(path.join(root, OUTPUT), 'utf8');
    // Fails when the registry or a component's props/variants changed without regenerating
    expect(onDisk === output, `${OUTPUT} is stale. Run: node scripts/generate-components-ref.mjs`).toBe(true);
  });

  it.each(components)('has an entry for %s', (_id, c) => {
    expect(output).toMatch(new RegExp(`^## ${c.name}$`, 'm'));
    expect(output).toContain(`| [${c.name}](#${c.name.toLowerCase()}) |`);
  });

  it('is deterministic', () => {
    expect(generate(root).output).toBe(output);
  });

  it.each(components)('%s example compiles as Astro', async (id, c) => {
    // Astro's own compiler, resolved through astro so the version always matches
    const fromAstro = createRequire(createRequire(path.join(root, 'package.json')).resolve('astro/package.json'));
    const { transform } = await import(fromAstro.resolve('@astrojs/compiler-rs'));
    const { diagnostics = [] } = transform(c.example, { filename: `${id}.astro` });
    expect(diagnostics.filter((d: { severity: string }) => d.severity === 'error')).toEqual([]);
  });
});
