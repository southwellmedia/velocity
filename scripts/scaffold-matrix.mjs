#!/usr/bin/env node
/**
 * Build every project shape create-velocity-astro can produce.
 *
 *   pnpm test:scaffold                  # 8 combinations: install, astro check, build
 *   pnpm test:scaffold --e2e            # …plus the Playwright suite in each full-component project
 *   pnpm test:scaffold --only=min-i18n  # filter by name (demo|min)-(en|i18n)-(all|none)
 *   pnpm test:scaffold --out=./.matrix  # where projects are created (default: OS temp dir)
 *
 * Projects are produced by scripts/scaffold.mjs, the reference implementation
 * of the contract in variants/README.md, so this is what users get.
 */
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffoldProject } from './scaffold.mjs';
import { findBrokenImports } from './check-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const out = path.resolve(typeof args.out === 'string' ? args.out : path.join(os.tmpdir(), 'velocity-matrix'));

const combos = [true, false]
  .flatMap((demo) =>
    [false, true].flatMap((i18n) =>
      ['all', 'none'].map((components) => ({
        name: `${demo ? 'demo' : 'min'}-${i18n ? 'i18n' : 'en'}-${components}`,
        options: { demo, i18n, components },
      })),
    ),
  )
  .filter((c) => typeof args.only !== 'string' || c.name.includes(args.only));

function run(cmd, cwd, env = {}) {
  const started = Date.now();
  const result = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', env: { ...process.env, ...env } });
  return {
    ok: result.status === 0,
    seconds: ((Date.now() - started) / 1000).toFixed(0),
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

// Run tools with the Node that runs this script (pnpm's shim may pick a different one).
const node = JSON.stringify(process.execPath);
const bin = (pkgBin) => `${node} ${JSON.stringify(path.join('node_modules', pkgBin))}`;

const results = [];
let port = 4400;

for (const { name, options } of combos) {
  const dir = path.join(out, name);
  process.stdout.write(`\n▶ ${name}\n`);
  const { applied } = scaffoldProject(root, dir, options);
  process.stdout.write(`  variants: ${applied.join(', ') || '(none)'}\n`);

  // Steps run lazily, in order; the first failure stops this combination.
  const steps = [
    [
      'imports',
      () => {
        const broken = findBrokenImports(dir);
        return { ok: broken.length === 0, seconds: '0', output: broken.join('\n') };
      },
    ],
    ['install', () => run('pnpm install --frozen-lockfile --prefer-offline', dir, { CI: 'true' })],
    ['check', () => run(`${bin('astro/bin/astro.mjs')} check`, dir)],
    ['build', () => run(`${bin('astro/bin/astro.mjs')} build`, dir, { DEPLOY_TARGET: 'node' })],
  ];
  if (args.e2e && options.components === 'all') {
    const e2ePort = String(port++);
    steps.push([
      'e2e',
      () => run(`${bin('@playwright/test/cli.js')} test --reporter=line`, dir, { CI: 'true', E2E_PORT: e2ePort }),
    ]);
  }

  let failed = false;
  for (const [step, exec] of steps) {
    const r = exec();
    process.stdout.write(`  ${r.ok ? '✓' : '✗'} ${step} (${r.seconds}s)\n`);
    if (!r.ok) {
      failed = true;
      const tail = r.output.split('\n').slice(-40);
      process.stdout.write(tail.map((line) => `    ${line}`).join('\n') + '\n');
      break;
    }
  }
  results.push({ name, ok: !failed });
}

console.log('\nSummary');
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
