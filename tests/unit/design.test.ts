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
  fs.copyFileSync(path.join(REPO, 'variants/agents/.agents/design/fonts.json'), path.join(root, '.agents/design/fonts.json'));
  fs.writeFileSync(path.join(root, 'src/styles/theme.css'), `/* Active theme */\n\n@import './themes/${base}.css';\n`);
  fs.writeFileSync(path.join(root, 'astro.config.mjs'), CONFIG);
  const families: Record<string, [string, string]> = {
    manrope: ['Manrope', '200 800'], outfit: ['Outfit', '100 900'], 'jetbrains-mono': ['JetBrains Mono', '100 800'],
    fraunces: ['Fraunces', '100 900'], 'source-sans-3': ['Source Sans 3', '200 900'], nunito: ['Nunito', '200 1000'],
    figtree: ['Figtree', '300 900'], 'space-grotesk': ['Space Grotesk', '300 700'], 'dm-sans': ['DM Sans', '100 1000'],
    newsreader: ['Newsreader', '200 800'], 'source-sans-3-alt': ['Source Sans 3', '200 900'],
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

const allFonts = ['manrope', 'outfit', 'jetbrains-mono', 'fraunces', 'source-sans-3', 'nunito', 'figtree', 'space-grotesk', 'dm-sans', 'newsreader'];
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
  it('reads the real astro.config.mjs, ignoring the helper definition', () => {
    const config = fs.readFileSync(path.join(REPO, 'astro.config.mjs'), 'utf8');
    expect(design.registeredFonts(config).map((f: { name: string }) => f.name)).toEqual(['Manrope', 'Outfit', 'JetBrains Mono']);
    const root = project({ installed: allFonts, files: { 'astro.config.mjs': config } });
    expect(run(root, 'direction', '--base', 'editorial').code).toBe(0);
    const next = read(root, 'astro.config.mjs');
    expect(next).toContain("fontsourceVariable({ name: 'Source Sans 3'");
    expect(next).toContain('function fontsourceVariable({ name, pkg, cssVariable, weight, fallbacks })');
    expect(run(root, 'fonts', '--fix').code).toBe(0);
    expect(read(root, 'astro.config.mjs')).toContain('function fontsourceVariable({ name, pkg, cssVariable, weight, fallbacks })');
    expect(design.fontsReport(root).findings).toEqual([]);
  });

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

describe('section sources', () => {
  const SECTIONS = path.join(REPO, 'variants/agents/.agents/design/sections');
  const files = fs.readdirSync(SECTIONS).filter((f) => f.endsWith('.astro')).sort();
  const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'component-registry.json'), 'utf8')).components as Record<string, { files: string[] }>;
  const entryFor = (file: string) => Object.entries(registry).find(([, c]) => c.files.includes(file))?.[0];
  const recipes = fs.readFileSync(path.join(REPO, 'variants/agents/.agents/recipes.md'), 'utf8');

  it('match the recipes.md index one to one', () => {
    const listed = [...recipes.matchAll(/^\| `(\w+)` \|/gm)].map((m) => `${m[1]}.astro`).sort();
    expect(listed).toEqual(files);
  });

  it.each(files)('%s carries a stamp, imports only registry components and declares them in @requires', (file) => {
    const text = fs.readFileSync(path.join(SECTIONS, file), 'utf8');
    const stamp = /@velocity-section (\w+)@(\d+\.\d+\.\d+)/.exec(text);
    expect(stamp?.[1]).toBe(file.replace('.astro', ''));
    const imports = [...text.matchAll(/from '@\/components\/([^']+)'/g)].map((m) => `src/components/${m[1]}`);
    const entries = imports.map((rel) => {
      const entry = entryFor(rel);
      expect(entry, `${file} imports ${rel}, which isn't in component-registry.json`).toBeDefined();
      return entry;
    });
    const requires = /@requires ([^\n]+)/.exec(text)?.[1].split(',').map((s) => s.trim()).filter((s) => s !== 'none') ?? [];
    expect(requires.sort()).toEqual([...new Set(entries)].sort());
    // Copy comes in as props: no t() lookups of the project's own keys.
    expect(text).not.toMatch(/\bt\(/);
  });

  it('pass check:agent design rules from their copied location', async () => {
    // @ts-expect-error plain ESM script without type declarations
    const check = await import('../../scripts/check-agent.mjs');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sections-'));
    dirs.push(root);
    fs.mkdirSync(path.join(root, 'src/components/sections'), { recursive: true });
    fs.mkdirSync(path.join(root, '.agents'), { recursive: true });
    fs.writeFileSync(path.join(root, '.agents/site.md'), '# Brief\n');
    for (const f of files) fs.copyFileSync(path.join(SECTIONS, f), path.join(root, 'src/components/sections', f));
    const source = check.checkDesignSource(root) as { rule: string; file: string; line: number; message: string }[];
    expect(source.map((f) => `${f.file}:${f.line} ${f.message}`)).toEqual([]);
    const hardcoded = await check.checkHardcoded(root);
    expect(hardcoded.map((f: { file: string; line: number; message: string }) => `${f.file}:${f.line} ${f.message}`)).toEqual([]);
  });
});

describe('variation', () => {
  type Varied = { direction: { brand: { hue: number }; controls: Record<string, string> }; choices: string[] };
  const vary = (id: string, seed: string, opts = {}) => design.varyDirection(directions[id], seed, opts) as Varied;

  it('is deterministic per seed, different across seeds, and off for "preset"', () => {
    expect(vary('warm-local', "Rosa's Bakery")).toEqual(vary('warm-local', "Rosa's Bakery"));
    const seeds = ['Crumb & Co', 'The Daily Loaf', 'Leith Pantry', 'Rye Society', 'Oven Door'];
    const shapes = new Set(seeds.map((seed) => JSON.stringify(vary('warm-local', seed).direction)));
    expect(shapes.size).toBe(seeds.length);
    expect(vary('warm-local', 'preset').direction).toEqual(directions['warm-local']);
    expect(vary('warm-local', 'preset').choices).toEqual([]);
  });

  it('keeps the brand hue when the user gave a brand colour', () => {
    const locked = vary('clinical', 'Seed', { brandLocked: true });
    expect(locked.direction.brand).toEqual(directions.clinical.brand);
    expect(locked.choices.some((c) => c.startsWith('brand hue'))).toBe(false);
  });

  it('stays inside the direction: radii scale, the button radius comes from its options', () => {
    for (let i = 0; i < 40; i++) {
      const { direction } = vary('warm-local', `seed ${i}`);
      expect(['9999px', '0.75rem']).toContain(direction.controls['--theme-radius-button']);
      expect(['700', '800', '900']).toContain(direction.controls['--theme-heading-weight']);
      const md = parseFloat(direction.controls['--theme-radius-md']);
      expect(md).toBeGreaterThanOrEqual(0.75 * 0.75 - 0.001);
      expect(md).toBeLessThanOrEqual(0.75 * 1.25 + 0.001);
    }
  });

  for (const id of Object.keys(directions)) {
    it(`${id} passes AA for 40 seeds over both base themes`, () => {
      for (const base of ['default', 'midnight']) {
        const sources = design.themeSources(project({ base }));
        for (let i = 0; i < 40; i++) {
          const built = design.buildDirection(directions[id], { sources, seed: `site ${i}` });
          expect(built.failures, `${id} ${base} seed ${i}`).toEqual([]);
        }
      }
    });
  }

  it('every direction offers alternative pairings from the catalogue', () => {
    const catalog = design.loadFontCatalog(REPO);
    for (const d of Object.values(directions)) {
      const ids = (d as unknown as { pairings: string[] }).pairings;
      expect(ids.length).toBeGreaterThanOrEqual(2);
      for (const id of ids) expect(design.pairingFonts(catalog, id), `${d.id}: ${id}`).toBeDefined();
    }
  });

  it('defaults the seed to the site name, or the folder while the name is the scaffold\'s', () => {
    const named = project({ files: { 'src/config/site.config.ts': "export default { name: \"Rosa's Bakery\" };" } });
    expect(design.defaultSeed(named)).toBe("Rosa's Bakery");
    const scaffold = project({ files: { 'src/config/site.config.ts': "export default { name: 'My Site' };" } });
    expect(design.defaultSeed(scaffold)).toBe(path.basename(scaffold));
  });

  it('the command records the seed, prints the variation, and --pair picks alternative fonts', () => {
    const root = project({ installed: allFonts, files: { 'src/config/site.config.ts': "export default { name: 'Crumb & Co' };" } });
    const { code, out } = run(root, 'direction', '--base', 'editorial', '--pair', '2');
    expect(code, out).toBe(0);
    expect(out).toMatch(/Variation for seed "Crumb & Co": /);
    const theme = read(root, 'src/styles/theme.css');
    expect(theme).toContain('--seed "Crumb & Co"');
    expect(theme).toContain('--theme-font-display: var(--font-newsreader)');
    run(root, 'direction', '--base', 'editorial', '--seed', 'preset');
    expect(read(root, 'src/styles/theme.css')).toContain('--seed preset');
  });
});

describe('compare', () => {
  const view = (sections: string) =>
    `---\n${sections.split(' ').map((s) => `import ${s.split(':')[0]} from '@/components/sections/${s.split(':')[0]}.astro';`).join('\n')}\n---\n<Layout>\n${sections
      .split(' ')
      .map((s) => `  <${s.split(':')[0]}${s.includes(':') ? ` layout="${s.split(':')[1]}"` : ''} />`)
      .join('\n')}\n</Layout>\n`;

  it('scores an identical site as a near copy, and a varied one as distinct', () => {
    const home = view('HeroSplit FeatureGrid:columns Testimonials CTABand:invert');
    const a = project({ installed: allFonts, files: { 'src/views/HomeView.astro': home, 'src/config/site.config.ts': "export default { name: 'One' };" } });
    const b = project({ installed: allFonts, files: { 'src/views/HomeView.astro': home, 'src/config/site.config.ts': "export default { name: 'One' };" } });
    run(a, 'direction', '--base', 'warm-local');
    run(b, 'direction', '--base', 'warm-local');
    const same = design.compareSites(design.designFingerprint(a), design.designFingerprint(b));
    expect(same).toMatchObject({ overall: 1, verdict: 'near copy', sameDirection: true });

    const c = project({
      installed: allFonts,
      files: { 'src/views/HomeView.astro': view('HeroTypographic FeatureGrid:numbered Steps FAQ:split'), 'src/config/site.config.ts': "export default { name: 'Two' };" },
    });
    run(c, 'direction', '--base', 'warm-local', '--pair', '2');
    const varied = design.compareSites(design.designFingerprint(a), design.designFingerprint(c));
    expect(varied.structure).toBe(0);
    expect(varied.overall).toBeLessThan(0.6);
    expect(varied.verdict).toBe('distinct');
  });

  it('reads section order with layouts from the views', () => {
    const root = project({ files: { 'src/views/HomeView.astro': view('HeroSplit FeatureGrid:bento CTABand') } });
    expect(design.designFingerprint(root).views['HomeView.astro']).toEqual(['HeroSplit', 'FeatureGrid:bento', 'CTABand']);
  });
});

describe('font catalogue', () => {
  type Family = { family: string; category: string; weight: string; subsets: string[]; overused?: boolean };
  type Pairing = { id: string; display: string; body: string; voice: string[]; suits: string };
  const catalog = design.loadFontCatalog(REPO) as { families: Record<string, Family>; pairings: Pairing[] };

  it('has dozens of pairings over real families, without the overused defaults', () => {
    expect(catalog.pairings.length).toBeGreaterThanOrEqual(50);
    expect(new Set(catalog.pairings.map((p) => p.id)).size).toBe(catalog.pairings.length);
    for (const p of catalog.pairings) {
      for (const pkg of [p.display, p.body]) {
        const f = catalog.families[pkg];
        expect(f, `${p.id}: ${pkg}`).toBeDefined();
        expect(f.overused, `${p.id} uses ${f.family}`).toBeFalsy();
        expect(f.subsets).toContain('latin');
        expect(f.weight).toMatch(/^\d+( \d+)?$/);
      }
      expect(p.voice.length).toBeGreaterThanOrEqual(2);
      expect(p.suits).toBeTruthy();
    }
    // Package names follow the family names, as fontsVariable() and the CLI expect.
    for (const [pkg, f] of Object.entries(catalog.families)) expect(design.fontSpec(f.family).pkg).toBe(pkg);
  });

  it("covers every direction's default and fallback fonts", () => {
    for (const d of Object.values(directions)) {
      for (const role of ['display', 'body'] as const) {
        expect(catalog.families[design.fontSpec(d.fonts[role].family).pkg], `${d.id} ${role}`).toBeDefined();
      }
    }
  });

  it('suggests pairings by voice and keeps only those whose body font covers the languages', () => {
    const warm = design.suggestPairings(catalog, 'warm old-fashioned bakery') as Pairing[];
    expect(warm.length).toBeGreaterThan(0);
    expect(warm.every((p) => p.voice.some((v) => ['warm', 'old-fashioned'].includes(v)) || /bakeries/.test(p.suits))).toBe(true);
    const russian = design.suggestPairings(catalog, 'warm friendly', { subsets: new Set(['latin', 'cyrillic']), limit: 20 }) as Pairing[];
    expect(russian.length).toBeGreaterThan(0);
    for (const p of russian) expect(catalog.families[p.body].subsets).toContain('cyrillic');
    expect(design.suggestPairings(catalog, 'zzzz')).toEqual([]);
  });

  it('maps locales to the subsets they need', () => {
    const r = design.requiredSubsets(['en', 'pl', 'ru', 'vi', 'ja']);
    expect([...r.subsets].sort()).toEqual(['cyrillic', 'latin', 'latin-ext', 'vietnamese']);
    expect(r.system).toEqual(['ja']);
  });
});

describe('font checks when applying a direction', () => {
  const faceCss = (family: string, weight: string, subsets: string[]) =>
    subsets.map((sub) => `@font-face {\n  font-family: '${family} Variable';\n  font-weight: ${weight};\n  src: url(./files/x-${sub}-wght-normal.woff2) format('woff2-variations');\n  unicode-range: U+0000-00FF;\n}\n`).join('');
  const install = (root: string, pkg: string, family: string, weight: string, subsets: string[]) => {
    const dir = path.join(root, 'node_modules/@fontsource-variable', pkg);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.css'), faceCss(family, weight, subsets));
  };

  it('refuses a body font without the letters an enabled language needs, and names pairings that have them', () => {
    const root = project({ installed: allFonts, files: { 'src/i18n/locales.mjs': "export const defaultLocale = 'en';\nexport const locales = ['en', 'ru'];\n" } });
    install(root, 'nunito', 'Nunito', '200 1000', ['latin', 'latin-ext']);
    const before = read(root, 'src/styles/theme.css');
    const { code, out } = run(root, 'direction', '--base', 'warm-local');
    expect(code).toBe(1);
    expect(out).toMatch(/Nunito has no cyrillic letters/);
    expect(out).toMatch(/--pairing /);
    expect(read(root, 'src/styles/theme.css')).toBe(before);
    expect(run(root, 'direction', '--base', 'warm-local', '--allow-missing-scripts').code).toBe(0);
  });

  it('clamps heading weight to what the display font can draw, and says so', () => {
    const root = project({ installed: allFonts });
    install(root, 'space-grotesk', 'Space Grotesk', '300 700', ['latin']);
    const { code, out } = run(root, 'direction', '--base', 'warm-local', '--display', 'Space Grotesk', '--seed', 'preset');
    expect(code, out).toBe(0);
    expect(out).toMatch(/--theme-heading-weight 800 → 700 \(the display font draws 300–700\)/);
    expect(read(root, 'src/styles/theme.css')).toContain('--theme-heading-weight: 700;');
  });

  it('applies any catalogue pairing with --pairing', () => {
    const root = project({ installed: allFonts });
    install(root, 'lora', 'Lora', '400 700', ['latin', 'latin-ext']);
    install(root, 'nunito-sans', 'Nunito Sans', '200 1000', ['latin', 'latin-ext']);
    const { code, out } = run(root, 'direction', '--base', 'clinical', '--pairing', 'lora-nunito-sans');
    expect(code, out).toBe(0);
    const theme = read(root, 'src/styles/theme.css');
    expect(theme).toContain('--theme-font-display: var(--font-lora)');
    expect(theme).toContain('--theme-font-sans: var(--font-nunito-sans)');
    expect(run(root, 'direction', '--base', 'clinical', '--pairing', 'nope').out).toMatch(/No pairing "nope"/);
  });

  it('design fonts warns about overused defaults, extra families and weights the font fakes', () => {
    const root = project({ installed: [...allFonts] });
    install(root, 'inter', 'Inter', '100 900', ['latin']);
    fs.writeFileSync(path.join(root, 'astro.config.mjs'), CONFIG.replace("fonts: [\n", "fonts: [\n    fontsourceVariable({ name: 'Inter', pkg: 'inter', cssVariable: '--font-inter', weight: '100 900', fallbacks: ['sans-serif'] }),\n"));
    fs.appendFileSync(path.join(root, 'src/styles/theme.css'), ':root { --theme-font-sans: var(--font-inter), sans-serif; --theme-font-display: var(--font-outfit), sans-serif; }\n');
    const messages = (design.fontsReport(root).findings as { message: string }[]).map((f) => f.message).join('\n');
    expect(messages).toMatch(/Inter is one of the most common web fonts/);
    const heavy = project({ installed: [...allFonts] });
    install(heavy, 'outfit', 'Outfit', '300 600', ['latin']);
    fs.appendFileSync(path.join(heavy, 'src/styles/theme.css'), ':root { --theme-heading-weight: 800; }\n');
    expect((design.fontsReport(heavy).findings as { message: string }[]).some((f) => /only draws 300–600/.test(f.message))).toBe(true);
  });
});

describe('custom directions (--spec)', () => {
  it('--new writes a spec from a preset, and --spec applies it unvaried', () => {
    const root = project({ installed: allFonts, files: { 'src/config/site.config.ts': "export default { name: \"Rosa's Bakery\" };" } });
    const made = run(root, 'direction', '--new', 'rosas', '--base', 'warm-local');
    expect(made.code, made.out).toBe(0);
    const spec = JSON.parse(read(root, 'src/styles/direction.json'));
    expect(spec).toMatchObject({ id: 'rosas', name: "Rosa's Bakery", basedOn: 'warm-local' });
    expect(spec.variation).toBeUndefined();
    expect(run(root, 'direction', '--new', 'again').out).toMatch(/already exists/);

    spec.brand = { hue: 140, chroma: 0.6 };
    spec.controls['--theme-radius-button'] = '0.25rem';
    fs.writeFileSync(path.join(root, 'src/styles/direction.json'), JSON.stringify(spec));
    const applied = run(root, 'direction', '--spec');
    expect(applied.code, applied.out).toBe(0);
    const theme = read(root, 'src/styles/theme.css');
    expect(theme).toContain('/* @velocity-direction rosas */');
    expect(theme).toContain('--brand-hue: 140;');
    expect(theme).toContain('--theme-radius-button: 0.25rem;');
    expect(design.tokensReport(root).contrast.every((p: Pair) => p.pass)).toBe(true);
  });

  it('names every problem in a spec instead of writing a broken theme', () => {
    const root = project({ installed: allFonts });
    const before = read(root, 'src/styles/theme.css');
    fs.writeFileSync(
      path.join(root, 'src/styles/direction.json'),
      JSON.stringify({ id: 'Bad Name', name: 'x', feel: 'y', brand: { hue: 400, chroma: 2 }, neutral: { chroma: 0.2 }, primary: 'blue', invert: 'neutral', fonts: { display: { family: 'Nunito' } }, controls: { '--theme-radius-md': 'big', '--color': 'red', '--theme-section-space': 3 }, light: { '--background': 'red; } body { x' } }),
    );
    const { code, out } = run(root, 'direction', '--spec');
    expect(code).toBe(1);
    for (const field of ['"id"', '"brand.hue"', '"brand.chroma"', '"neutral.chroma"', '"primary"', '"fonts.body.family"', '"controls.--theme-radius-md"', '"controls.--color"', '"controls.--theme-section-space"', '"light.--background"']) {
      expect(out).toContain(field);
    }
    expect(read(root, 'src/styles/theme.css')).toBe(before);
    expect(run(root, 'direction', '--spec', 'missing.json').out).toMatch(/doesn't exist/);
  });

  it('every preset is itself a valid spec', () => {
    for (const d of Object.values(directions)) expect(design.validateSpec(d), d.id).toEqual([]);
  });
});
