/**
 * Reference implementation of the scaffold contract (variants/README.md).
 *
 * create-velocity-astro implements the same semantics. This copy lets Velocity's
 * own tests and CI build every variant combination without the CLI, so a change
 * that breaks a variant fails in this repo first.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeBaseline } from './check-agent.mjs';

const SKIP = new Set(['node_modules', 'dist', '.git', '.astro', '.vercel', '.netlify', 'test-results', 'playwright-report']);

function copyDir(src, dest, stop = path.resolve(dest)) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    // The output folder may be inside the source, e.g. --out=./.matrix
    if (stop === path.resolve(from) || stop.startsWith(path.resolve(from) + path.sep)) continue;
    if (entry.isDirectory()) copyDir(from, to, stop);
    else fs.copyFileSync(from, to);
  }
}

function readJson(dir, file) {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
}

function matches(when = {}, options) {
  return Object.entries(when).every(([key, value]) => options[key] === value);
}

/** Registry ids plus all transitive component dependencies. */
export function resolveComponents(registry, ids) {
  const out = new Set();
  const visit = (id) => {
    if (out.has(id) || !registry.components[id]) return;
    out.add(id);
    for (const dep of registry.components[id].dependencies?.components ?? []) visit(dep);
  };
  ids.forEach(visit);
  return out;
}

/**
 * Apply the manifest's scaffold steps to `dir` in place.
 * @param {string} dir project directory (a fresh copy of the repo)
 * @param {{ demo: boolean, i18n: boolean, components: 'all' | 'none' | string[] }} options
 * @returns {{ applied: string[], kept: Set<string> | 'all' }}
 */
export function applyScaffold(dir, options) {
  const { scaffold } = readJson(dir, 'velocity-manifest.json');
  const registry = readJson(dir, 'component-registry.json');
  const applied = [];
  const alwaysInclude = [...scaffold.components.alwaysInclude];

  for (const variant of scaffold.variants) {
    if (!matches(variant.when, options)) continue;
    applied.push(variant.id);
    if (variant.overlay) copyDir(path.join(dir, variant.overlay), dir);
    for (const rel of variant.remove ?? []) fs.rmSync(path.join(dir, rel), { recursive: true, force: true });
    alwaysInclude.push(...(variant.alwaysInclude ?? []));
  }

  let kept = 'all';
  if (options.components !== 'all' && !alwaysInclude.includes('*')) {
    const selected = options.components === 'none' ? [] : options.components;
    kept = resolveComponents(registry, [...selected, ...alwaysInclude]);
    const keepFiles = new Set([...kept].flatMap((id) => registry.components[id].files));
    for (const optionalDir of scaffold.components.optionalDirs) {
      pruneDir(dir, optionalDir, keepFiles);
    }
  }

  for (const rel of scaffold.cleanup ?? []) fs.rmSync(path.join(dir, rel), { recursive: true, force: true });

  if (scaffold.cleanupScripts?.length) {
    const pkgPath = path.join(dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    for (const name of scaffold.cleanupScripts) delete pkg.scripts?.[name];
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  // Record Velocity-owned files as shipped, so check:agent can spot later edits.
  if (scaffold.baseline !== false) writeBaseline(dir);
  return { applied, kept };
}

function pruneDir(root, rel, keepFiles) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      pruneDir(root, childRel, keepFiles);
      const childAbs = path.join(root, childRel);
      if (fs.readdirSync(childAbs).length === 0) fs.rmdirSync(childAbs);
    } else if (!keepFiles.has(childRel)) {
      fs.rmSync(path.join(root, childRel));
    }
  }
}

/** Copy `source` to `dest` and apply the scaffold steps. */
export function scaffoldProject(source, dest, options) {
  fs.rmSync(dest, { recursive: true, force: true });
  copyDir(source, dest);
  return applyScaffold(dest, options);
}
