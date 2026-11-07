import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import * as design from '../../scripts/design.mjs';

type Pair = { fg: string; bg: string; mode: string; ratio: number; min: number; pass: boolean };

const REPO = path.resolve(__dirname, '../..');
const DIRECTIONS = path.join(REPO, 'variants/agents/.agents/design/directions');
type Direction = { id: string; name: string; feel: string; suits: string; rhythm: string; imagery: string; fonts: Record<string, any> } & Record<string, unknown>; // eslint-disable-line @typescript-eslint/no-explicit-any
type FontFinding = { level: string; message: string; fix: string };
const directions = design.loadDirections(REPO) as Record<string, Direction>;

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const CONFIG = `export default defineConfig({
  fonts: [
    fontsourceVariable({ name: 'Manrope', pkg: 'manrope', cssVariable: '--font-manrope', weight: '200 800', fallbacks: ['sans-serif'] }),
    fontsourceVariable({ name: 'Outfit', pkg: 'outfit', cssVariable: '--font-outfit', weight: '100 900', fallbacks: ['sans-serif'] }),
    fontsourceVariable({ name: 'JetBrains Mono', pkg: 'jetbrains-mono', cssVariable: '--font-jetbrains-mono', weight: '100 800', fallbacks: ['monospace'] }),
  ],
});
`;

const fontCss = (family: string, weight: string) =>
  `@font-face {\n  font-family: '${family} Variable';\n  font-weight: ${weight};\n  src: url(./files/x-latin-wght-normal.woff2) format('woff2-variations');\n  unicode-range: U+0000-00FF;\n}\n`;

/** A project with Velocity's real styles, the directions, a fonts config and the given installed font packages. */
function project({ base = 'default', installed = ['manrope', 'outfit', 'jetbrains-mono'], files = {} as Record<string, string> } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'design-'));
  dirs.push(root);
  fs.cpSync(path.join(REPO, 'src/styles'), path.join(root, 'src/styles'), { recursive: true });
  fs.cpSync(DIRECTIONS, path.join(root, '.agents/design/directions'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/styles/theme.css'), `/* Active theme */\n\n@import './themes/${base}.css';\n`);
  fs.writeFileSync(path.join(root, 'astro.config.mjs'), CONFIG);
  const families: Record<string, [string, string]> = {
    manrope: ['Manrope', '200 800'], outfit: ['Outfit', '100 900'], 'jetbrains-mono': ['JetBrains Mono', '100 800'],
    fraunces: ['Fraunces', '100 900'], 'source-sans-3': ['Source Sans 3', '200 900'], nunito: ['Nunito', '200 1000'],
    figtree: ['Figtree', '300 900'], 'space-grotesk': ['Space Grotesk', '300 700'], 'dm-sans': ['DM Sans', '100 1000'],
  };
  for (const pkg of installed) {
    const dir = path.join(root, 'node_modules/@fontsource-variable', pkg);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.css'), fontCss(...families[pkg]));
  }
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

const allFonts = ['manrope', 'outfit', 'jetbrains-mono', 'fraunces', 'source-sans-3', 'nunito', 'figtree', 'space-grotesk', 'dm-sans'];
const run = (root: string, ...argv: string[]) => {
  const out: string[] = [];
  const code = design.main(argv, { root, log: (s: string) => out.push(s) });
  return { code, out: out.join('\n') };
};
const read = (root: string, rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('colour math', () => {
  it('matches known WCAG contrast ratios', () => {
    const white = design.hexToOklch('#ffffff');
    const black = design.hexToOklch('#000000');
    expect(design.contrast(white, black)).toBeCloseTo(21, 1);
    expect(design.contrast(design.hexToOklch('#767676'), white)).toBeCloseTo(4.54, 1);
  });

  it('round-trips hex through OKLCH', () => {
    for (const hex of ['#c2410c', '#0ea5e9', '#16a34a', '#111827', '#facc15']) {
      expect(design.toHex(design.hexToOklch(hex))).toBe(hex);
    }
  });

  it('clips out-of-gamut OKLCH per channel, as Chromium renders it', () => {
    // Chromium renders this clinical brand step as #0078aa (measured by axe).
    expect(design.toHex(design.parseColor('oklch(53.2% 0.133 230)'))).toBe('#0078aa');
  });

  it('resolves var() chains and calc() in hue', () => {
    const vars = { '--h': '38', '--c': 'oklch(62.5% 0.22 calc(var(--h) + 7))', '--x': 'var(--c)' };
    const color = design.parseColor(design.substitute('var(--x)', vars));
    expect(color.h).toBe(45);
  });
});

describe('tokens', () => {
  it('reads the base theme from theme.css, ignoring the commented-out alternative', () => {
    expect(design.baseTheme("/* @import './themes/midnight.css'; */\n@import './themes/default.css';")).toBe('default');
  });

  it.each(['default', 'midnight'])('the %s base theme passes every pair in light and dark', (base) => {
    const report = design.tokensReport(project({ base }));
    const failing = (report.contrast as Pair[]).filter((p) => !p.pass);
    expect(failing).toEqual([]);
  });

  it('applies the cascade like the browser: .dark overrides :root, later rules win at equal specificity', () => {
    const vars = design.cascade([':root { --a: 1; --b: 1; }', '.dark { --a: 2; }', ':root { --b: 3; }'], 'dark');
    expect(vars).toMatchObject({ '--a': '2', '--b': '3' });
    expect(design.cascade([':root { --a: 1; }', '.dark { --a: 2; }'], 'light')['--a']).toBe('1');
  });

  it('reports controls and type scale with their defaults', () => {
    const report = design.tokensReport(project());
    expect(report.controls['--theme-section-space']).toBe('1');
    expect(report.controls['--theme-display-scale']).toBe('1');
    expect(report.typeScale['--text-5xl']).toContain('* 1');
  });
});

describe('directions', () => {
  it('ships the five directions with fonts, controls and rhythm', () => {
    expect(Object.keys(directions).sort()).toEqual(['bold-product', 'clinical', 'editorial', 'minimal-portfolio', 'warm-local']);
    for (const d of Object.values(directions)) {
      expect(d.name && d.feel && d.suits && d.rhythm && d.imagery).toBeTruthy();
      const families = new Set([d.fonts.display.family, d.fonts.body.family]);
      expect(families.size).toBeLessThanOrEqual(2);
      // The fallback must only use families every project already has installed.
      expect(['Manrope', 'Outfit']).toContain(d.fonts.installedFallback.body.family);
      expect(['Manrope', 'Outfit']).toContain(d.fonts.installedFallback.display.family);
    }
  });

  const brands = [undefined, '#c2410c', '#facc15', '#0ea5e9', '#16a34a', '#111827', '#ec4899', '#ffffff'];
  for (const base of ['default', 'midnight']) {
    for (const id of Object.keys(directions)) {
      it(`${id} over ${base} passes AA in light and dark with any brand colour`, () => {
        const sources = design.themeSources(project({ base }));
        for (const brand of brands) {
          const built = design.buildDirection(directions[id], { brand, sources });
          expect(built.failures).toEqual([]);
          const pairs = ['light', 'dark'].flatMap((m) => design.resolveMode([...sources, built.css], m).pairs) as Pair[];
          expect(pairs.filter((p) => !p.pass)).toEqual([]);
        }
      });
    }
  }

  it('darkens brand steps until they pass, and says so', () => {
    const sources = design.themeSources(project());
    const harsh = {
      ...directions['warm-local'],
      light: { '--background': 'oklch(91% 0 0)', '--foreground-subtle': 'oklch(38% 0 0)', '--muted-foreground': 'oklch(38% 0 0)' },
    };
    const built = design.buildDirection(harsh, { sources });
    expect(built.failures).toEqual([]);
    expect(built.adjustments.some((a: string) => a.startsWith('--brand-600 darkened'))).toBe(true);
  });

  it('stops when two pairs pull a brand step in opposite directions, and reports both', () => {
    const sources = design.themeSources(project());
    const conflicting = { ...directions['warm-local'], light: { '--background': 'oklch(80% 0 0)', '--foreground-subtle': 'oklch(25% 0 0)', '--foreground-muted': 'oklch(25% 0 0)', '--muted-foreground': 'oklch(25% 0 0)', '--foreground-secondary': 'oklch(20% 0 0)' } };
    const built = design.buildDirection(conflicting, { sources });
    expect(built.failures.length).toBeGreaterThan(0);
  });

  it('reports what it can\'t fix instead of writing it', () => {
    const root = project({ installed: allFonts });
    const before = read(root, 'src/styles/theme.css');
    const bad = { ...directions.editorial, id: 'bad', light: { '--foreground': 'oklch(90% 0 0)' } };
    fs.writeFileSync(path.join(root, '.agents/design/directions/bad.json'), JSON.stringify(bad));
    const { code, out } = run(root, 'direction', '--base', 'bad');
    expect(code).toBe(1);
    expect(out).toContain('--foreground on --background (light)');
    expect(read(root, 'src/styles/theme.css')).toBe(before);
  });
});

describe('npm run design -- direction', () => {
  it('writes one marked block into theme.css and registers the fonts, body first', () => {
    const root = project({ installed: allFonts });
    const { code, out } = run(root, 'direction', '--base', 'editorial', '--brand', '#9a3412');
    expect(code, out).toBe(0);
    const theme = read(root, 'src/styles/theme.css');
    expect(theme).toContain("@import './themes/default.css';");
    expect(theme).toContain('/* @velocity-direction editorial */');
    expect(theme).toContain('--theme-font-sans: var(--font-source-sans-3)');
    expect(theme).toContain('--theme-font-display: var(--font-fraunces)');
    const config = read(root, 'astro.config.mjs');
    expect(config.indexOf("name: 'Source Sans 3'")).toBeLessThan(config.indexOf("name: 'Fraunces'"));
    expect(config.indexOf("name: 'Fraunces'")).toBeLessThan(config.indexOf("name: 'Manrope'"));
    expect(config).toContain("pkg: 'fraunces', cssVariable: '--font-fraunces', weight: '100 900', fallbacks: ['serif']");
    expect(design.tokensReport(root).direction).toBe('editorial');
  });

  it('replaces its own block on re-run and keeps hand edits outside it', () => {
    const root = project({ installed: allFonts });
    run(root, 'direction', '--base', 'editorial');
    fs.appendFileSync(path.join(root, 'src/styles/theme.css'), '\n/* mine */\n:root { --header-offset: 0; }\n');
    run(root, 'direction', '--base', 'clinical');
    const theme = read(root, 'src/styles/theme.css');
    expect(theme.match(/@velocity-direction (?!end)/g)).toHaveLength(1);
    expect(theme).toContain('@velocity-direction clinical');
    expect(theme).toContain('--header-offset: 0;');
  });

  it('writes nothing and prints the install command when a font package is missing', () => {
    const root = project({ files: { 'pnpm-lock.yaml': '' } });
    const before = read(root, 'src/styles/theme.css');
    const { code, out } = run(root, 'direction', '--base', 'warm-local');
    expect(code).toBe(1);
    expect(out).toContain('pnpm add @fontsource-variable/nunito');
    expect(out).toContain('--fallback-fonts');
    expect(read(root, 'src/styles/theme.css')).toBe(before);
    expect(read(root, 'astro.config.mjs')).toBe(CONFIG);
  });

  it('--fallback-fonts keeps to installed families', () => {
    const root = project();
    const { code } = run(root, 'direction', '--base', 'warm-local', '--fallback-fonts');
    expect(code).toBe(0);
    expect(read(root, 'astro.config.mjs')).toBe(CONFIG);
    expect(read(root, 'src/styles/theme.css')).toContain('--theme-font-sans: var(--font-manrope)');
  });

  it('accepts --display and --body overrides', () => {
    const root = project({ installed: allFonts });
    run(root, 'direction', '--base', 'bold-product', '--display', 'Fraunces', '--body', 'DM Sans');
    const theme = read(root, 'src/styles/theme.css');
    expect(theme).toContain('--theme-font-sans: var(--font-dm-sans)');
    expect(theme).toContain('--theme-font-display: var(--font-fraunces)');
  });

  it('rejects unknown directions and malformed colours', () => {
    const root = project();
    expect(run(root, 'direction', '--base', 'nope').out).toContain('editorial');
    expect(run(root, 'direction', '--base', 'editorial', '--brand', 'orange').code).toBe(1);
  });
});

describe('npm run design -- fonts', () => {
  it('is clean on the scaffold', () => {
    const report = design.fontsReport(project());
    expect(report.findings).toEqual([]);
  });

  it('catches a token pointing at an unregistered family (the silent fallback)', () => {
    const root = project();
    fs.appendFileSync(path.join(root, 'src/styles/theme.css'), ':root { --theme-font-sans: var(--font-inter), sans-serif; }\n');
    const { findings } = design.fontsReport(root);
    expect((findings as FontFinding[]).some((f) => f.level === 'error' && f.message.includes('--font-inter'))).toBe(true);
  });

  it('catches a registered family whose package is missing', () => {
    const root = project({ installed: ['manrope', 'jetbrains-mono'] });
    const { findings } = design.fontsReport(root);
    expect((findings as FontFinding[]).some((f) => f.level === 'error' && f.fix.includes('@fontsource-variable/outfit'))).toBe(true);
  });

  it('--fix drops families nothing uses after a direction change', () => {
    const root = project({ installed: allFonts });
    run(root, 'direction', '--base', 'clinical');
    expect(design.fontsReport(root).unused.sort()).toEqual(['Manrope', 'Outfit']);
    const { code } = run(root, 'fonts', '--fix');
    expect(code).toBe(0);
    const config = read(root, 'astro.config.mjs');
    expect(config).not.toContain("name: 'Manrope'");
    expect(config).toContain("name: 'JetBrains Mono'");
    expect(design.fontsReport(root).findings).toEqual([]);
  });

  it('--fix keeps a family a component uses directly', () => {
    const root = project({ installed: allFonts, files: { 'src/components/Logo.astro': '<span style="font-family: var(--font-outfit)">x</span>' } });
    run(root, 'direction', '--base', 'clinical');
    expect(design.fontsReport(root).unused).toEqual(['Manrope']);
  });
});
