/**
 * Build receipt data for the demo home page.
 *
 * Everything here is read from the project while the page prerenders, so the
 * numbers describe the build that produced the page. Figures that only exist
 * after the build (JS on the page, pages emitted, build time) are filled in by
 * integrations/build-receipt.mjs; see BuildReceipt.astro.
 *
 * A value that can't be read is `undefined`, and its row is left out. Never
 * substitute a default number.
 */
import fs from 'node:fs';
import path from 'node:path';
import { locales } from '@/i18n';

const root = process.cwd();

function readJson(file: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Installed version of a dependency, from its own package.json. `via` finds a
 * package that isn't hoisted (pnpm) next to the package that depends on it.
 */
function installed(pkg: string, via?: string): string | undefined {
  const candidates = [path.join(root, 'node_modules', pkg)];
  if (via) {
    try {
      candidates.push(path.join(path.dirname(fs.realpathSync(path.join(root, 'node_modules', via))), pkg));
    } catch {
      // `via` isn't installed
    }
  }
  for (const dir of candidates) {
    try {
      const { version } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { version?: unknown };
      if (typeof version === 'string') return version;
    } catch {
      // not here
    }
  }
  return undefined;
}

/** Velocity version: the project's .velocity.json, else this repo's manifest. */
function velocityVersion(): string | undefined {
  for (const file of ['.velocity.json', 'velocity-manifest.json']) {
    const version = readJson(file)?.version;
    if (typeof version === 'string') return version;
  }
  return undefined;
}

/**
 * Components in `dirs`: one per .astro or .tsx file name, so a component
 * with both an Astro and a React version (Alert.astro, Alert.tsx) counts once.
 */
function countComponents(dirs: string[]): number {
  const names = new Set<string>();
  for (const dir of dirs) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const entry of fs.readdirSync(full, { withFileTypes: true, recursive: true })) {
      const match = entry.isFile() && /^(.+)\.(astro|tsx)$/.exec(entry.name);
      if (match) names.add(path.join(entry.parentPath, match[1]));
    }
  }
  return names.size;
}

/** Agent skills: folders holding a SKILL.md, in a project or in this repo's agent files. */
function agentSkills(): string[] {
  for (const dir of ['.agents/skills', 'variants/agents/.agents/skills']) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    const skills = fs
      .readdirSync(full, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(full, d.name, 'SKILL.md')));
    if (skills.length) return skills.map((d) => d.name).sort();
  }
  return [];
}

/** Short commit hash from the deploy platform, when it provides one. */
function commit(): string | undefined {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.COMMIT_REF ?? process.env.CF_PAGES_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : undefined;
}

const componentDirs = ['ui', 'patterns', 'blocks', 'hero'].map((d) => `src/components/${d}`);

export interface Receipt {
  velocity?: string;
  builtOn: string;
  commit?: string;
  stack: { label: string; version?: string }[];
  components: number;
  /** Skill folder names; empty when the project has none */
  agentSkills: string[];
  locales: number;
}

export function getReceipt(): Receipt {
  return {
    velocity: velocityVersion(),
    builtOn: new Date().toISOString().slice(0, 10),
    commit: commit(),
    stack: [
      { label: 'Astro', version: installed('astro') },
      { label: 'Vite', version: installed('vite', 'astro') },
      { label: 'Tailwind CSS', version: installed('tailwindcss') },
      { label: 'TypeScript', version: installed('typescript') },
      { label: 'React', version: installed('react') },
      { label: 'Node', version: process.versions.node },
    ],
    components: countComponents(componentDirs),
    agentSkills: agentSkills(),
    locales: locales.length,
  };
}
