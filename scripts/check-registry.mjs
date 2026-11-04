#!/usr/bin/env node
/**
 * Guards for the component registry that create-velocity-astro relies on.
 *
 *   node scripts/check-registry.mjs   # exits 1 on problems
 *
 * 1. Every file in an optional component directory belongs to a registry entry
 *    (unregistered files are deleted when users pick a subset of components).
 * 2. Every import between registered components (aliased or relative) is
 *    declared in that component's `dependencies.components`.
 * 3. findBrokenImports(dir): in a scaffolded project, every import of a
 *    component file resolves to a file that still exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXTENSIONS = ['', '.astro', '.ts', '.tsx', '/index.ts'];

/**
 * Aggregate files (category barrels, shared type re-exports) can't stay valid
 * when only some components are installed, so partial installs remove them.
 * Nothing in Velocity imports them; they're conveniences for full installs.
 */
export const AGGREGATES = /^src\/components\/ui\/(index\.ts|types\.ts|[a-z-]+\/index\.ts)$/;

function walk(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const child = `${rel}/${e.name}`;
    return e.isDirectory() ? walk(root, child) : [child];
  });
}

function isFile(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isFile();
}

/** Resolve an import specifier to a project-relative file, or undefined. */
function resolveImport(root, spec, fromFile) {
  const target = spec.startsWith('@/')
    ? `src/${spec.slice(2)}`
    : path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  return EXTENSIONS.map((ext) => target + ext).find((f) => isFile(root, f));
}

/** Code regions of a file: .astro frontmatter and <script> blocks, or the whole file. */
function codeOf(source, file) {
  if (!file.endsWith('.astro')) return source;
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return [frontmatter, ...scripts].join('\n');
}

/**
 * Component-file import specifiers in a file. Uses TypeScript's import scanner,
 * so code samples inside strings (e.g. FeatureTabs' demo snippets) are ignored.
 */
function importsOf(root, file) {
  const code = codeOf(fs.readFileSync(path.join(root, file), 'utf8'), file);
  return ts
    .preProcessFile(code, true, true)
    .importedFiles.map((f) => f.fileName.split('?')[0])
    .filter((spec) => spec.startsWith('@/components/') || /^\.\.?\//.test(spec));
}

const isComponentPath = (spec, file) =>
  spec.startsWith('@/components/') ||
  path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)).startsWith('src/components/');

/** Imports of component files in a project that point at missing files. */
export function findBrokenImports(root) {
  const broken = [];
  for (const file of walk(root, 'src')) {
    if (!/\.(astro|ts|tsx|mjs|js)$/.test(file)) continue;
    for (const spec of importsOf(root, file)) {
      if (isComponentPath(spec, file) && !resolveImport(root, spec, file)) broken.push(`${file} → ${spec}`);
    }
  }
  return broken;
}

export function checkRegistry(root = repoRoot) {
  const problems = [];
  const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
  const registry = read('component-registry.json');
  const { optionalDirs } = read('velocity-manifest.json').scaffold.components;

  const fileToId = new Map();
  for (const [id, c] of Object.entries(registry.components)) {
    for (const f of c.files) {
      if (!isFile(root, f)) problems.push(`registry "${id}" lists missing file ${f}`);
      fileToId.set(f, id);
    }
  }

  // 1. No unregistered files in optional directories
  for (const dir of optionalDirs) {
    for (const file of walk(root, dir)) {
      if (!fileToId.has(file) && !AGGREGATES.test(file)) {
        problems.push(`${file} is not in component-registry.json (it would be deleted on partial installs)`);
      }
    }
  }

  // 2. Declared dependencies match imports
  for (const [id, c] of Object.entries(registry.components)) {
    const declared = new Set(c.dependencies?.components ?? []);
    for (const file of c.files) {
      if (!/\.(astro|ts|tsx)$/.test(file) || !isFile(root, file)) continue;
      for (const spec of importsOf(root, file)) {
        const dep = fileToId.get(resolveImport(root, spec, file) ?? '');
        if (dep && dep !== id && !declared.has(dep)) {
          problems.push(`registry "${id}" imports "${dep}" (${file}) but doesn't list it in dependencies.components`);
        }
      }
    }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkRegistry();
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('✓ component registry is consistent');
}
