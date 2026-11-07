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

/** Instruction files an agent reads in a project: the entry point, the rules and each skill. */
function agentDocs(dir: string) {
  const skills = path.join(dir, '.agents/skills');
  return [
    path.join(dir, 'AGENTS.md'),
    path.join(dir, '.agents/velocity.md'),
    ...fs.readdirSync(skills).map((name) => path.join(skills, name, 'SKILL.md')),
  ];
}

const backticked = (text: string) => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);

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

describe('package scripts', () => {
  it('validates with any package manager', () => {
    const { scripts } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(scripts.validate).not.toMatch(/\b(pnpm|npm|yarn|bun)\b/);
    expect(manifest.packageJson.scripts.validate.value).toBe(scripts.validate);
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

describe('agent files', () => {
  const overlay = path.join(root, 'variants/agents');
  const skillNames = fs.readdirSync(path.join(overlay, '.agents/skills'));
  const read = (rel: string) => fs.readFileSync(path.join(overlay, rel), 'utf8');

  it.each(skillNames)('%s has valid frontmatter', (name) => {
    const frontmatter = read(`.agents/skills/${name}/SKILL.md`).match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
    const description = frontmatter.match(/^description: (.+)$/m)?.[1]?.trim() ?? '';
    expect(frontmatter.match(/^name: (.+)$/m)?.[1]?.trim()).toBe(name);
    expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(1024);
  });

  it.each(skillNames)('%s is identical for every agent', (name) => {
    expect(read(`.claude/skills/${name}/SKILL.md`)).toBe(read(`.agents/skills/${name}/SKILL.md`));
  });

  it('has the same skills for every agent', () => {
    expect(fs.readdirSync(path.join(overlay, '.claude/skills'))).toEqual(skillNames);
  });

  it('keeps Velocity-owned files current and leaves AGENTS.md to the project', () => {
    expect(manifest.files.safe).toEqual(expect.arrayContaining(['.agents/velocity.md', '.agents/skills/', '.claude/skills/']));
    expect(manifest.files.protected).toContain('AGENTS.md');
    expect(manifest.files.seed).toContain('AGENTS.md');
  });

  it('describes file ownership the way the manifest does', () => {
    const rules = read('.agents/velocity.md');
    const line = (label: string) => rules.split(/\r?\n/).find((l) => l.startsWith(`- **${label}`)) ?? '';
    const listed = (label: string) => backticked(line(label)).filter((ref) => !ref.includes('velocity-backup'));
    expect(listed('Yours').length).toBeGreaterThan(0);
    expect(listed("Velocity's").length).toBeGreaterThan(0);
    for (const rel of listed('Yours')) expect(manifest.files.protected, rel).toContain(rel);
    for (const rel of listed("Velocity's")) expect(manifest.files.safe, rel).toContain(rel);
  });

  it('commits project skills but ignores local Claude state', () => {
    const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^!\.claude\/skills\/$/m);
    expect(gitignore).not.toMatch(/^\.claude\/$/m);
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

  it('gives agents instructions that fit the project', () => {
    expect(fs.existsSync(path.join(dir, '.claude/skills/velocity-add-page/SKILL.md'))).toBe(true);
    for (const doc of agentDocs(dir)) {
      const text = fs.readFileSync(doc, 'utf8');
      expect(text, doc).not.toMatch(/check:registry|test:scaffold|variants\//);
      const paths = backticked(text)
        .filter((ref) => /^(src|tests|integrations|\.agents)\//.test(ref))
        // Worked examples and templates aren't real paths
        .filter((ref) => !/[<*…]|pricing|\/Name/i.test(ref));
      for (const rel of paths) expect(fs.existsSync(path.join(dir, rel)), `${doc}: ${rel}`).toBe(true);
    }
  });

  it("starts projects with their own identity, not Velocity's", () => {
    const config = fs.readFileSync(path.join(dir, 'src/config/site.config.ts'), 'utf8');
    expect(config).toMatch(/name: 'My Site'/);
    expect(config).toMatch(/socialLinks: \[\]/);
    expect(config).not.toMatch(/author: 'Southwell Media'|github\.com\/southwellmedia'/);
    expect(fs.readFileSync(path.join(dir, 'README.md'), 'utf8')).toMatch(/^# My Site/);
  });

  it('enables the right locales', () => {
    const locales = fs.readFileSync(path.join(dir, 'src/i18n/locales.mjs'), 'utf8');
    expect(locales.includes("'es'")).toBe(options.i18n);
  });
});

describe('template extension points', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'velocity-manifest.json'), 'utf8'));

  it.each(['src/styles/theme.css', 'src/config/collections.ts'])('upgrades add %s but never replace it', (file) => {
    expect(fs.existsSync(path.join(process.cwd(), file))).toBe(true);
    expect(manifest.files.protected).toContain(file);
    expect(manifest.files.seed).toContain(file);
  });

  it.each(['Section', 'PageHeader', 'MediaSlot'])('adds the %s pattern to upgraded projects', (name) => {
    expect(manifest.files.seed).toContain(`src/components/patterns/${name}.astro`);
  });

  it('merges project collections and imports the active theme', () => {
    const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(read('src/content.config.ts')).toContain('...siteCollections');
    expect(read('src/styles/global.css')).toContain("@import './theme.css';");
  });
});

describe('styles', () => {
  it('limits Tailwind to src/, so it never scans node_modules', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/global.css'), 'utf8');
    expect(css).toContain("@import 'tailwindcss' source('..');");
  });
});
