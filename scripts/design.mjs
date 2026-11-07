#!/usr/bin/env node
/**
 * Velocity design engine: apply a design direction and read the resolved design
 * tokens without a browser. Plain Node, no dependencies.
 *
 *   npm run design -- direction --base warm-local          # write the direction into src/styles/theme.css
 *   npm run design -- direction --base editorial --brand "#9a3412" --display Fraunces --body "Source Sans 3"
 *   npm run design -- direction --base clinical --fallback-fonts   # keep to fonts already installed
 *   npm run design -- direction --base warm-local --seed "Rosa's Bakery"   # the default seed is the site name
 *   npm run design -- direction --base editorial --pair 2  # one of the direction's alternative font pairings
 *   npm run design -- fonts --suggest "warm, old-fashioned"   # curated pairings for a voice, covering the site's languages
 *   npm run design -- direction --base warm-local --pairing lora-nunito-sans
 *   npm run design -- direction --list                     # the five directions
 *   npm run design -- tokens                               # resolved tokens + contrast matrix (light and dark)
 *   npm run design -- tokens --json
 *   npm run design -- fonts                                # packages ↔ astro.config.mjs ↔ --theme-font-* tokens
 *   npm run design -- fonts --fix                          # register missing families, drop unused ones
 *   npm run design -- compare ../other-site                # how alike two sites are: colours, controls, fonts, page structure
 *
 * `direction` varies the direction within its bounds by a seed (default: the site name), so two
 * sites in one direction don't come out identical; `--seed preset` gives the plain direction.
 * It writes one marked block at the end of src/styles/theme.css (re-running replaces it)
 * and registers the direction's fonts in `fonts` in astro.config.mjs. It never installs packages:
 * when a font package is missing it prints the install command, changes nothing and exits 1.
 * Every text/surface pair is checked against WCAG AA; brand steps are adjusted until they pass,
 * and the output says what changed.
 *
 * Directions live in .agents/design/directions/*.json. Rules: .agents/design.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Colour math (OKLCH ↔ sRGB, WCAG contrast)

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

function oklabToLinearSrgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function oklchToLinear({ l, c, h }) {
  const rad = (h * Math.PI) / 180;
  return oklabToLinearSrgb(l, c * Math.cos(rad), c * Math.sin(rad));
}

/**
 * Linear sRGB for an OKLCH colour. Out-of-gamut channels are clipped, which is what Chromium
 * and WebKit render today (and what axe then measures), rather than CSS Color 4's chroma reduction.
 */
export function toLinearSrgb(color) {
  if (color.rgb) return color.rgb;
  return oklchToLinear(color).map(clamp01);
}

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** OKLCH { l (0–1), c, h } for a #rgb or #rrggbb colour. */
export function hexToOklch(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  const full = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => toLinear(parseInt(full.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
  const c = Math.hypot(A, B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-4 ? 0 : h };
}

/** #rrggbb for a parsed colour (gamut-mapped). */
export function toHex(color) {
  return `#${toLinearSrgb(color)
    .map((v) => Math.round(clamp01(fromLinear(v)) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Relative luminance of the colour as the browser paints it: rounded to 8-bit sRGB first, as axe measures. */
export function luminance(color) {
  const [r, g, b] = toLinearSrgb(color).map((v) => toLinear(Math.round(clamp01(fromLinear(v)) * 255) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two parsed colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const formatOklch = ({ l, c, h }) => `oklch(${round(l * 100, 1)}% ${round(c, 3)} ${round(h, 1)})`;

// ---------------------------------------------------------------------------
// CSS custom properties: parse, cascade, resolve

/** Top-level `selector { --name: value; }` rules with their custom properties, in source order. */
export function parseCss(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    // Text before the selector can hold at-rule statements such as @import '…';
    const selectors = m[1].slice(m[1].lastIndexOf(';') + 1).trim().split(',').map((s) => s.trim());
    const decls = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const name = d.slice(0, i).trim();
      if (name.startsWith('--')) decls[name] = d.slice(i + 1).trim().replace(/\s+/g, ' ');
    }
    rules.push({ selectors, decls });
  }
  return rules;
}

/** Specificity of the selectors themes use, as a number, or -1 when it doesn't match `mode`. */
function matches(selector, mode) {
  const s = selector.replace(/\s+/g, '');
  const table = {
    ':root': [10, 10],
    html: [1, 1],
    '.dark': [-1, 10],
    ':root.dark': [-1, 20],
    'html.dark': [-1, 11],
    ':root:not(.dark)': [20, -1],
  };
  const hit = table[s];
  return hit ? hit[mode === 'dark' ? 1 : 0] : -1;
}

/** Custom properties in effect on <html> for light or dark mode, from CSS sources in cascade order. */
export function cascade(sources, mode) {
  const applied = [];
  let order = 0;
  for (const css of sources) {
    for (const rule of parseCss(css)) {
      order++;
      const spec = Math.max(...rule.selectors.map((s) => matches(s, mode)));
      if (spec >= 0) applied.push({ spec, order, decls: rule.decls });
    }
  }
  applied.sort((a, b) => a.spec - b.spec || a.order - b.order);
  return Object.assign({}, ...applied.map((r) => r.decls));
}

/** Substitute var() references recursively. */
export function substitute(value, vars, depth = 0) {
  if (depth > 32) return value;
  let out = '';
  let i = 0;
  while (i < value.length) {
    const start = value.indexOf('var(', i);
    if (start < 0) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, start);
    let level = 0;
    let j = start + 3;
    for (; j < value.length; j++) {
      if (value[j] === '(') level++;
      else if (value[j] === ')' && --level === 0) break;
    }
    const inner = value.slice(start + 4, j);
    const comma = inner.indexOf(',');
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? undefined : inner.slice(comma + 1).trim();
    const replacement = vars[name] ?? fallback ?? '';
    out += substitute(replacement, vars, depth + 1);
    i = j + 1;
  }
  return out;
}

/** Evaluate `calc(1 + 2)` style arithmetic in a string of plain numbers. */
function evalNumber(expr) {
  const e = expr.replace(/calc\(/g, '(').trim();
  if (!/^[\d.\s+\-*/()]+$/.test(e)) return NaN;
  try {
    return Number(Function(`"use strict"; return (${e});`)());
  } catch {
    return NaN;
  }
}

/** Split on top-level whitespace (parentheses keep their contents together). */
function splitArgs(s) {
  const parts = [];
  let level = 0;
  let cur = '';
  for (const ch of s.trim()) {
    if (ch === '(') level++;
    if (ch === ')') level--;
    if (/\s/.test(ch) && level === 0) {
      if (cur) parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

/** Parse a resolved colour value: oklch(), #hex or rgb(). Undefined when it isn't one. */
export function parseColor(value) {
  const v = value.trim();
  if (v.startsWith('#')) {
    try {
      return hexToOklch(v);
    } catch {
      return undefined;
    }
  }
  const ok = /^oklch\((.*)\)$/i.exec(v);
  if (ok) {
    const [lRaw, cRaw, hRaw] = splitArgs(ok[1].split('/')[0]);
    if (hRaw === undefined) return undefined;
    const l = lRaw.endsWith('%') ? evalNumber(lRaw.slice(0, -1)) / 100 : evalNumber(lRaw);
    const c = evalNumber(cRaw);
    const h = evalNumber(hRaw.replace(/deg$/, ''));
    return [l, c, h].some(Number.isNaN) ? undefined : { l, c, h };
  }
  const rgb = /^rgba?\(([^)]*)\)$/i.exec(v);
  if (rgb) {
    const [r, g, b] = rgb[1].split(/[\s,/]+/).map(Number);
    return { rgb: [r, g, b].map((x) => toLinear(x / 255)) };
  }
  return undefined;
}

/** `top` at `alpha` over `bottom`, blended in gamma-encoded sRGB as browsers composite. */
export function composite(top, alpha, bottom) {
  const enc = (c) => toLinearSrgb(c).map(fromLinear);
  const t = enc(top);
  const b = enc(bottom);
  return { rgb: t.map((v, i) => toLinear(alpha * v + (1 - alpha) * b[i])) };
}

// ---------------------------------------------------------------------------
// Project files

const DIRECTION_DIRS = ['.agents/design/directions', 'variants/agents/.agents/design/directions'];
export const THEME_FILE = 'src/styles/theme.css';
export const CONFIG_FILE = 'astro.config.mjs';
const MARK_START = '/* @velocity-direction';
const MARK_END = '/* @velocity-direction end */';

const readIf = (root, rel) => {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
};

/** The base theme theme.css imports ('default' when none is found). */
export function baseTheme(themeCss) {
  const css = themeCss.replace(/\/\*[\s\S]*?\*\//g, '');
  return /@import\s+['"]\.\/themes\/([\w-]+)\.css['"]/.exec(css)?.[1] ?? 'default';
}

/** The CSS sources that set tokens, in the order global.css loads them. */
export function themeSources(root, themeCss = readIf(root, THEME_FILE)) {
  return [
    readIf(root, 'src/styles/tokens/primitives.css'),
    readIf(root, 'src/styles/tokens/typography.css'),
    readIf(root, 'src/styles/tokens/spacing.css'),
    readIf(root, `src/styles/themes/${baseTheme(themeCss)}.css`),
    themeCss,
  ];
}

/** Every direction, keyed by id. */
export function loadDirections(root) {
  const dir = DIRECTION_DIRS.map((d) => path.join(root, d)).find((d) => fs.existsSync(d));
  if (!dir) return {};
  return Object.fromEntries(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => {
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        return [d.id, d];
      }),
  );
}

// ---------------------------------------------------------------------------
// Contrast pairs

/**
 * Text/surface pairs every theme must pass. `min` is the WCAG AA ratio: 4.5 for body text,
 * 3 where the token is only used for large text (brand-500 headings and logo text).
 */
export const PAIRS = [
  ...['--foreground', '--foreground-secondary', '--foreground-muted', '--foreground-subtle'].flatMap((fg) =>
    ['--background', '--background-secondary', '--card'].map((bg) => ({ fg, bg, min: 4.5 })),
  ),
  { fg: '--foreground', bg: '--background-tertiary', min: 4.5 },
  { fg: '--foreground-muted', bg: '--background-tertiary', min: 4.5 },
  { fg: '--muted-foreground', bg: '--background', min: 4.5 },
  { fg: '--muted-foreground', bg: '--muted', min: 4.5 },
  { fg: '--primary-foreground', bg: '--primary', min: 4.5 },
  { fg: '--secondary-foreground', bg: '--secondary', min: 4.5 },
  { fg: '--on-invert', bg: '--surface-invert', min: 4.5 },
  { fg: '--on-invert-secondary', bg: '--surface-invert', min: 4.5 },
  { fg: '--on-invert-muted', bg: '--surface-invert', min: 4.5 },
  { fg: '--on-invert-muted', bg: '--surface-invert-secondary', min: 4.5 },
  ...['success', 'warning', 'error', 'info'].map((s) => ({ fg: `--${s}-foreground`, bg: `--${s}-light`, min: 4.5 })),
  { fg: '--brand-500', bg: '--background', min: 3, note: 'large text only' },
  { fg: '--brand-500', bg: '--surface-invert', min: 4.5, note: 'eyebrows in invert bands' },
  { fg: '--brand-600', bg: '--background', min: 4.5, mode: 'light' },
  { fg: '--brand-600', bg: '--background-secondary', min: 4.5, mode: 'light' },
  { fg: '--brand-600', bg: '--background-tertiary', min: 4.5, mode: 'light' },
  { fg: '--brand-600', bg: 'mix(--brand-500 10%, --background)', min: 4.5, mode: 'light', note: 'brand Badge' },
  { fg: '--brand-400', bg: '--background', min: 4.5, mode: 'dark' },
  { fg: '--brand-400', bg: '--background-secondary', min: 4.5, mode: 'dark' },
  { fg: '--brand-400', bg: '--background-tertiary', min: 4.5, mode: 'dark' },
  { fg: '--brand-400', bg: 'mix(--brand-500 10%, --background)', min: 4.5, mode: 'dark', note: 'brand Badge' },
];

/** Resolve one mode's tokens and check every pair. */
export function resolveMode(sources, mode) {
  const vars = cascade(sources, mode);
  const color = (name) => {
    const mix = /^mix\((--[\w-]+) (\d+)%, (--[\w-]+)\)$/.exec(name);
    if (mix) {
      const top = color(mix[1]);
      const bottom = color(mix[3]);
      return top && bottom ? composite(top, Number(mix[2]) / 100, bottom) : undefined;
    }
    return vars[name] === undefined ? undefined : parseColor(substitute(vars[name], vars));
  };
  const pairs = PAIRS.filter((p) => !p.mode || p.mode === mode).map((p) => {
    const fg = color(p.fg);
    const bg = color(p.bg);
    const ratio = fg && bg ? contrast(fg, bg) : NaN;
    return { ...p, mode, ratio: round(ratio, 2), pass: ratio >= p.min };
  });
  return { vars, color, pairs };
}

// ---------------------------------------------------------------------------
// Directions → CSS

/** Velocity's gray scale lightness; directions tint it. */
const NEUTRAL_L = { 0: 100, 50: 98.3, 100: 96.5, 200: 91.3, 300: 85.8, 400: 64, 500: 52, 600: 38, 700: 32, 800: 26.7, 900: 19.4, 950: 12.3 };
/** Velocity's brand scale lightness and chroma; directions scale the chroma and set the hue. */
const BRAND = {
  50: [97.5, 0.02, 7], 100: [94.8, 0.04, 7], 200: [87.5, 0.08, 7], 300: [77.8, 0.14, 7], 400: [68.5, 0.19, 2],
  500: [62.5, 0.22, 0], 600: [53.2, 0.19, 0], 700: [45.5, 0.16, 0], 800: [37.2, 0.13, 0], 900: [26.5, 0.09, 0],
};

const oklch = (l, c, h) => ({ l: l / 100, c, h: ((h % 360) + 360) % 360 });

function neutral(step, { hue, chroma }) {
  const edge = step === 0 || step === 950 ? 0.5 : 1;
  return oklch(NEUTRAL_L[step], chroma * edge, hue);
}

/** Semantic tokens for both modes from a direction's small spec, mirroring default.css. */
function semanticTokens(spec, hue) {
  const tint = { hue: (spec.neutral?.hue ?? hue) + (spec.neutral?.hueShift ?? 0), chroma: spec.neutral?.chroma ?? 0 };
  const n = (s) => formatOklch(neutral(s, tint));
  const brandPrimary = spec.primary === 'brand';
  // Velocity's gray-400 sits right at 4.5:1 on gray-800; a little lighter keeps tinted neutrals above AA.
  const mutedDark = formatOklch(oklch(66, tint.chroma, tint.hue));
  const invert = spec.invert === 'brand'
    ? { 950: formatOklch(oklch(15, 0.05, hue)), 900: formatOklch(oklch(19, 0.06, hue)), 800: formatOklch(oklch(25, 0.07, hue)), 700: formatOklch(oklch(33, 0.07, hue)) }
    : { 950: n(950), 900: n(900), 800: n(800), 700: n(700) };

  const light = {
    '--background': n(0), '--background-secondary': n(50), '--background-tertiary': n(100), '--background-elevated': n(0),
    '--foreground': n(900), '--foreground-secondary': n(700), '--foreground-muted': n(600), '--foreground-subtle': n(500),
    '--border': n(200), '--border-strong': n(300), '--border-subtle': n(100),
    '--primary': brandPrimary ? 'var(--brand-600)' : n(900),
    '--primary-hover': brandPrimary ? 'var(--brand-700)' : n(800),
    '--primary-foreground': n(0),
    '--secondary': n(100), '--secondary-hover': n(200), '--secondary-foreground': n(900),
    '--accent': 'var(--brand-500)', '--accent-hover': 'var(--brand-600)', '--accent-light': 'var(--brand-100)',
    '--muted': n(100), '--muted-foreground': n(500),
    '--card': n(0), '--card-border': n(200),
    '--input-bg': n(0), '--input-border': n(300), '--input-focus': brandPrimary ? 'var(--brand-600)' : n(900),
    '--ring': brandPrimary ? 'var(--brand-600)' : n(900),
    '--gradient-start': n(100), '--gradient-end': n(0),
    '--surface-invert': invert[950], '--surface-invert-secondary': invert[900], '--surface-invert-tertiary': invert[800],
    '--on-invert': n(50), '--on-invert-secondary': n(200), '--on-invert-muted': n(300),
    '--border-invert': invert[800], '--border-invert-strong': invert[700],
  };
  const dark = {
    '--background': n(950), '--background-secondary': n(900), '--background-tertiary': n(800), '--background-elevated': n(900),
    '--foreground': n(50), '--foreground-secondary': n(300), '--foreground-muted': mutedDark,
    '--foreground-subtle': formatOklch(oklch(60, tint.chroma, tint.hue)),
    '--border': n(800), '--border-strong': n(700), '--border-subtle': n(900),
    '--primary': brandPrimary ? 'var(--brand-400)' : n(0),
    '--primary-hover': brandPrimary ? 'var(--brand-300)' : n(200),
    '--primary-foreground': n(950),
    '--secondary': n(800), '--secondary-hover': n(700), '--secondary-foreground': n(100),
    '--accent': 'var(--brand-500)', '--accent-hover': 'var(--brand-600)', '--accent-light': 'var(--brand-900)',
    '--muted': n(800), '--muted-foreground': mutedDark,
    '--card': n(900), '--card-border': n(800),
    '--input-bg': n(900), '--input-border': n(700), '--input-focus': brandPrimary ? 'var(--brand-400)' : n(0),
    '--ring': brandPrimary ? 'var(--brand-400)' : n(0),
    '--gradient-start': n(950), '--gradient-end': n(900),
    '--surface-invert': spec.invert === 'brand' ? invert[900] : n(900),
    '--surface-invert-secondary': spec.invert === 'brand' ? invert[800] : n(800),
    '--surface-invert-tertiary': spec.invert === 'brand' ? invert[700] : n(700),
    '--on-invert': n(50),
    '--on-invert-secondary': spec.invert === 'brand' ? n(200) : n(300),
    '--on-invert-muted': spec.invert === 'brand' ? n(300) : mutedDark,
    '--border-invert': spec.invert === 'brand' ? invert[700] : n(700),
    '--border-invert-strong': n(600),
  };
  return { light: { ...light, ...spec.light }, dark: { ...dark, ...spec.dark } };
}

function brandScale(hue, chromaScale) {
  return Object.fromEntries(
    Object.entries(BRAND).map(([step, [l, c, dh]]) => [`--brand-${step}`, oklch(l, c * chromaScale, hue + dh)]),
  );
}

const slug = (family) => family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const SANS = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif';
const SERIF = "ui-serif, Georgia, Cambria, 'Times New Roman', serif";

/** A font choice → { family, pkg, cssVariable, fallbacks }. */
export function fontSpec(family, fallbacks = ['sans-serif']) {
  const s = slug(family);
  return { family, pkg: s, cssVariable: `--font-${s}`, fallbacks };
}

/** Brand hue and chroma scale from a hex colour (chroma relative to Velocity's brand-600). */
export function brandFromHex(hex) {
  const { c, h } = hexToOklch(hex);
  return { hue: round(h, 1), chroma: round(Math.min(1.2, c / 0.19), 2) };
}

/**
 * Build a direction: tokens for both modes, fonts and controls, with brand steps adjusted
 * until every pair passes AA. Returns { css, fonts, adjustments, failures }.
 */
export function buildDirection(direction, { brand, display, body, pairing, fallbackFonts = false, seed, weights, sources = [] } = {}) {
  const varied = varyDirection(direction, seed, { brandLocked: Boolean(brand) });
  direction = varied.direction;
  // A catalogue pairing ({ display, body } with fallbacks); --display/--body still win.
  if (pairing) {
    display = display ?? pairing.display;
    body = body ?? pairing.body;
  }
  // Keep weights inside what the chosen fonts can draw, so headings don't fake bold.
  const clamps = [];
  const clamp = (control, range, label) => {
    const value = Number(direction.controls[control]);
    if (!range || !Number.isFinite(value)) return;
    const next = Math.min(range[1], Math.max(range[0], value));
    if (next !== value) {
      direction.controls = { ...direction.controls, [control]: String(next) };
      clamps.push(`${control} ${value} → ${next} (${label} draws ${range[0]}–${range[1]})`);
    }
  };
  clamp('--theme-heading-weight', weights?.display, 'the display font');
  clamp('--theme-button-weight', weights?.body, 'the body font');
  const { hue, chroma } = brand ? brandFromHex(brand) : { hue: direction.brand.hue, chroma: direction.brand.chroma };
  const scale = brandScale(hue, chroma);
  const semantic = semanticTokens(direction, hue);

  const pick = (role) => {
    const chosen = role === 'display' ? display : body;
    const base = fallbackFonts ? direction.fonts.installedFallback[role] : direction.fonts[role];
    if (chosen && typeof chosen === 'object') return fontSpec(chosen.family, chosen.fallbacks);
    if (chosen) return fontSpec(chosen, base.fallbacks);
    return fontSpec(base.family, base.fallbacks);
  };
  const fonts = { body: pick('body'), display: pick('display') };
  const stack = (f) => `var(${f.cssVariable}), ${f.fallbacks.includes('serif') ? SERIF : SANS}`;
  const fontTokens = {
    '--theme-font-sans': stack(fonts.body),
    '--theme-font-display': fonts.display.family === fonts.body.family
      ? 'var(--theme-font-sans)'
      : `var(${fonts.display.cssVariable}), var(--theme-font-sans)`,
  };

  // Check every pair; nudge brand steps (never neutrals) until they pass.
  const adjustments = [...clamps];
  const render = () => {
    const shared = {
      '--brand-hue': String(hue),
      ...Object.fromEntries(Object.entries(scale).map(([k, v]) => [k, formatOklch(v)])),
      ...fontTokens,
      ...direction.controls,
    };
    return { shared, css: toCss(direction, { hue, brand, seed, choices: varied.choices }, shared, semantic, fonts) };
  };
  const directionOf = {};
  for (let pass = 0; pass < 60; pass++) {
    const { css } = render();
    const results = ['light', 'dark'].flatMap((mode) => resolveMode([...sources, css], mode).pairs);
    const fixable = results.filter((r) => !r.pass).find((f) => [f.fg, f.bg].some((t) => /^--brand-\d+$/.test(t)) || brandRef(semantic, f));
    if (!fixable) break;
    const mode = fixable.mode;
    const resolved = resolveMode([...sources, css], mode);
    const brandToken = [fixable.fg, fixable.bg].find((t) => /^--brand-\d+$/.test(t)) ?? brandRef(semantic, fixable);
    const other = brandToken === fixable.fg || semanticRef(semantic, mode, fixable.fg) === brandToken ? fixable.bg : fixable.fg;
    const otherColor = resolved.color(other);
    const step = scale[brandToken];
    const darker = luminance(otherColor) > luminance(step);
    // Two pairs pulling the same step in opposite directions can't both pass: report them.
    if (directionOf[brandToken] !== undefined && directionOf[brandToken] !== darker) break;
    directionOf[brandToken] = darker;
    step.l = clamp01(step.l + (darker ? -0.01 : 0.01));
    const note = `${brandToken} ${darker ? 'darkened' : 'lightened'} to ${formatOklch(step)} so ${fixable.fg} on ${fixable.bg} (${mode}) reaches ${fixable.min}:1`;
    const prev = adjustments.findIndex((a) => a.startsWith(`${brandToken} `));
    if (prev >= 0) adjustments[prev] = note;
    else adjustments.push(note);
  }
  const { css } = render();
  const failures = ['light', 'dark'].flatMap((mode) => resolveMode([...sources, css], mode).pairs).filter((r) => !r.pass);
  return { css, fonts, adjustments, failures, hue, chroma, choices: varied.choices, seed };
}

/** The brand step a semantic token in a failing pair points at, if any. */
function semanticRef(semantic, mode, token) {
  const v = semantic[mode]?.[token];
  return /^var\((--brand-\d+)\)$/.exec(v ?? '')?.[1];
}
function brandRef(semantic, f) {
  return semanticRef(semantic, f.mode, f.fg) ?? semanticRef(semantic, f.mode, f.bg);
}

function block(selector, tokens) {
  return `${selector} {\n${Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
}

function toCss(direction, { hue, brand, seed, choices = [] }, shared, semantic, fonts) {
  const families = [...new Set([fonts.display.family, fonts.body.family])].join(' + ');
  const seedFlag = seed && seed !== 'preset' ? ` --seed "${seed}"` : ' --seed preset';
  const header = [
    `${MARK_START} ${direction.id} */`,
    `/* ${direction.name}: ${direction.feel}. Generated by \`npm run design -- direction --base ${direction.id}${brand ? ` --brand "${brand}"` : ''}${seedFlag}\`.`,
    `   Brand hue ${hue}; fonts ${families}.${choices.length ? ` Variation: ${choices.join(', ')}.` : ''}`,
    `   Edit the values freely: re-running the command replaces everything up to the end marker,`,
    `   so keep hand edits below it. Rules: .agents/design.md */`,
  ].join('\n');
  return [
    header,
    block(':root', { ...shared, ...semantic.light }),
    block('.dark', semantic.dark),
    MARK_END,
  ].join('\n\n');
}

/** theme.css with the direction block added, or replacing an earlier one. */
export function applyBlock(themeCss, css) {
  const start = themeCss.indexOf(MARK_START);
  if (start >= 0) {
    const end = themeCss.indexOf(MARK_END, start);
    if (end >= 0) {
      return `${themeCss.slice(0, start)}${css}${themeCss.slice(end + MARK_END.length)}`;
    }
  }
  return `${themeCss.trimEnd()}\n\n${css}\n`;
}

// ---------------------------------------------------------------------------
// Variation: two sites in the same direction shouldn't look the same

/** FNV-1a hash of a string, then a mulberry32 generator: the same seed always gives the same choices. */
export function seededRandom(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Defaults for directions that don't spell out their variation bounds. */
const VARIATION_DEFAULTS = {
  brandHue: 20,
  chroma: [0.9, 1.1],
  neutralHue: 30,
  neutralChroma: [0.7, 1.4],
  radius: [0.8, 1, 1.25],
  sectionSpace: [0.95, 1.1],
  headingScale: [0.96, 1.06],
  displayScale: [0.95, 1.08],
  tracking: [-0.01, 0.01],
};

const remScale = (value, factor) => {
  const m = /^([\d.]+)rem$/.exec(String(value).trim());
  return m ? `${round(Number(m[1]) * factor, 3)}rem` : value;
};

/**
 * A copy of `direction` with values picked from its `variation` bounds by `seed`.
 * The direction's character holds (warm-local stays warm and rounded); the exact hue,
 * tint, radii, weight, spacing and scale move within it. `brandLocked` keeps the
 * brand hue and chroma when the user gave a brand colour.
 * Returns { direction, choices } where choices describes what was picked.
 */
export function varyDirection(direction, seed, { brandLocked = false } = {}) {
  if (seed === undefined || seed === null || seed === '' || seed === 'preset') return { direction, choices: [] };
  const v = { ...VARIATION_DEFAULTS, ...(direction.variation ?? {}) };
  const rand = seededRandom(`${direction.id}:${seed}`);
  const range = ([lo, hi], digits = 2) => round(lo + rand() * (hi - lo), digits);
  const option = (list) => list[Math.floor(rand() * list.length)];
  const choices = [];
  const out = structuredClone(direction);
  out.controls = { ...direction.controls };

  // Always draw every value in the same order, so one seed means the same site whatever flags are given.
  const hueShift = Math.round((rand() * 2 - 1) * v.brandHue);
  const chroma = range(v.chroma);
  const neutralShift = Math.round((rand() * 2 - 1) * v.neutralHue);
  const neutralChroma = range(v.neutralChroma);
  const radius = option(v.radius);
  const sectionSpace = range(v.sectionSpace);
  const headingScale = range(v.headingScale);
  const displayScale = range(v.displayScale);
  const tracking = range(v.tracking, 3);
  const weight = v.headingWeight ? option(v.headingWeight) : undefined;
  const buttonRadius = v.buttonRadius ? option(v.buttonRadius) : undefined;
  const primary = v.primary ? option(v.primary) : undefined;
  const invert = v.invert ? option(v.invert) : undefined;

  if (!brandLocked) {
    // chromaAbsolute lets a monochrome direction pick up a faint accent instead of scaling zero.
    const brandChroma = v.chromaAbsolute ? range(v.chromaAbsolute) : round(direction.brand.chroma * chroma, 2);
    out.brand = { hue: (direction.brand.hue + hueShift + 360) % 360, chroma: brandChroma };
    choices.push(`brand hue ${out.brand.hue}`);
  }
  out.neutral = {
    ...direction.neutral,
    chroma: v.neutralChromaAbsolute ? range(v.neutralChromaAbsolute, 4) : round((direction.neutral?.chroma ?? 0) * neutralChroma, 4),
    hueShift: neutralShift,
  };
  if (out.neutral.chroma > 0) choices.push(`neutral tint ${neutralShift >= 0 ? '+' : ''}${neutralShift}°`);
  for (const k of ['--theme-radius-sm', '--theme-radius-md', '--theme-radius-lg', '--theme-radius-xl']) {
    if (out.controls[k] !== undefined) out.controls[k] = remScale(out.controls[k], radius);
  }
  if (radius !== 1) choices.push(`radii ×${radius}`);
  if (buttonRadius) {
    out.controls['--theme-radius-button'] = buttonRadius;
    choices.push(`button radius ${buttonRadius}`);
  } else if (out.controls['--theme-radius-button']) {
    out.controls['--theme-radius-button'] = remScale(out.controls['--theme-radius-button'], radius);
  }
  const scaleControl = (k, factor) => {
    const base = Number(out.controls[k] ?? 1);
    out.controls[k] = String(round(base * factor, 2));
  };
  scaleControl('--theme-section-space', sectionSpace);
  scaleControl('--theme-heading-scale', headingScale);
  scaleControl('--theme-display-scale', displayScale);
  choices.push(`spacing ×${out.controls['--theme-section-space']}`, `display ×${out.controls['--theme-display-scale']}`);
  const baseTracking = parseFloat(out.controls['--theme-heading-tracking'] ?? '-0.02');
  out.controls['--theme-heading-tracking'] = `${round(baseTracking + tracking, 3)}em`;
  if (weight) {
    out.controls['--theme-heading-weight'] = String(weight);
    choices.push(`heading weight ${weight}`);
  }
  if (primary) {
    out.primary = primary;
    choices.push(`${primary} buttons`);
  }
  if (invert) {
    out.invert = invert;
    choices.push(`${invert} invert bands`);
  }
  return { direction: out, choices };
}

/** The seed a project uses by default: its site name, unless it's still the scaffold's. */
export function defaultSeed(root) {
  const config = readIf(root, 'src/config/site.config.ts');
  const name = /\bname:\s*(['"`])((?:(?!\1).)+)\1/.exec(config)?.[2];
  if (name && name !== 'My Site') return name;
  return path.basename(path.resolve(root));
}

// ---------------------------------------------------------------------------
// Font catalogue: curated pairings, script coverage and weights

const FONT_CATALOG_PATHS = ['.agents/design/fonts.json', 'variants/agents/.agents/design/fonts.json'];

/** The curated catalogue: { families: { pkg: { family, category, weight, subsets } }, pairings: [...] }. */
export function loadFontCatalog(root) {
  const file = FONT_CATALOG_PATHS.map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
  return file ? JSON.parse(fs.readFileSync(file, 'utf8')) : { families: {}, pairings: [] };
}

/** Fontsource subsets each language needs beyond latin. Languages fontsource's variable Latin families can't cover are reported. */
const LOCALE_SUBSETS = {
  ru: 'cyrillic', uk: 'cyrillic', bg: 'cyrillic', sr: 'cyrillic', be: 'cyrillic', mk: 'cyrillic', kk: 'cyrillic',
  el: 'greek', vi: 'vietnamese', he: 'hebrew', ar: 'arabic', hi: 'devanagari',
  pl: 'latin-ext', cs: 'latin-ext', sk: 'latin-ext', hu: 'latin-ext', ro: 'latin-ext', hr: 'latin-ext', sl: 'latin-ext',
  tr: 'latin-ext', lt: 'latin-ext', lv: 'latin-ext', et: 'latin-ext', is: 'latin-ext', mt: 'latin-ext', az: 'latin-ext',
};
const SYSTEM_SCRIPT_LOCALES = new Set(['ja', 'zh', 'ko', 'th', 'ka', 'hy', 'bn', 'ta', 'fa', 'ur', 'km', 'my']);

/** Locales enabled in src/i18n/locales.mjs. */
export function projectLocales(root) {
  const text = readIf(root, 'src/i18n/locales.mjs');
  const list = /locales\s*=\s*\[([^\]]*)\]/.exec(text)?.[1] ?? "'en'";
  return [...list.matchAll(/['"]([\w-]+)['"]/g)].map((m) => m[1]);
}

/** { subsets: the fontsource subsets the locales need, system: locales no fontsource Latin family covers }. */
export function requiredSubsets(locales) {
  const subsets = new Set(['latin']);
  const system = [];
  for (const locale of locales) {
    const lang = locale.toLowerCase().split('-')[0];
    if (SYSTEM_SCRIPT_LOCALES.has(lang)) system.push(locale);
    else if (LOCALE_SUBSETS[lang]) subsets.add(LOCALE_SUBSETS[lang]);
  }
  return { subsets, system };
}

/** Subsets an installed package ships (from its file names), or the catalogue's record when it isn't installed. */
export function fontSubsets(root, pkg, catalog = loadFontCatalog(root)) {
  const css = readIf(root, `node_modules/@fontsource-variable/${pkg}/index.css`);
  if (css) {
    const known = ['latin-ext', 'latin', 'cyrillic-ext', 'cyrillic', 'greek-ext', 'greek', 'vietnamese', 'hebrew', 'arabic', 'devanagari'];
    return new Set([...css.matchAll(/files\/([\w-]+?)-wght-normal\.woff2/g)].map((m) => known.find((k) => m[1].endsWith(`-${k}`))).filter(Boolean));
  }
  return new Set(catalog.families[pkg]?.subsets ?? []);
}

const weightRange = (value) => {
  const [lo, hi] = String(value ?? '').split(/\s+/).map(Number);
  return Number.isFinite(lo) ? [lo, Number.isFinite(hi) ? hi : lo] : undefined;
};

/** Font weight range of a family: installed package first, then the catalogue. */
export function fontWeights(root, pkg, catalog = loadFontCatalog(root)) {
  return weightRange(installedWeight(root, pkg) ?? catalog.families[pkg]?.weight);
}

const fallbacksFor = (category) => (category === 'serif' ? ['serif'] : category === 'mono' ? ['monospace'] : ['sans-serif']);

/** A catalogue pairing as { display, body } families with fallbacks, or undefined. */
export function pairingFonts(catalog, id) {
  const p = catalog.pairings.find((x) => x.id === id);
  if (!p) return undefined;
  const role = (pkg) => ({ family: catalog.families[pkg]?.family ?? pkg, fallbacks: fallbacksFor(catalog.families[pkg]?.category) });
  return { id, display: role(p.display), body: role(p.body) };
}

/**
 * Pairings ranked for a description such as "warm, old-fashioned bakery", keeping only those whose
 * body font covers every enabled locale (the display font should too, but headings can fall back).
 */
export function suggestPairings(catalog, words, { subsets = new Set(['latin']), limit = 6 } = {}) {
  const terms = String(words).toLowerCase().split(/[^a-z-]+/).filter((w) => w.length > 2);
  const covers = (pkg) => [...subsets].every((s) => (catalog.families[pkg]?.subsets ?? []).includes(s));
  return catalog.pairings
    .filter((p) => covers(p.body))
    .map((p) => {
      const hay = [...p.voice, ...p.suits.toLowerCase().split(/[^a-z-]+/)];
      const score = terms.reduce((n, t) => n + (p.voice.includes(t) ? 3 : hay.some((h) => h.startsWith(t) || t.startsWith(h) && h.length > 3) ? 1 : 0), 0);
      return { ...p, score, displayCovers: covers(p.display) };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Fonts: packages ↔ astro.config.mjs ↔ tokens

/** fontsourceVariable({...}) entries registered in astro.config.mjs. */
export function registeredFonts(config) {
  return [...config.matchAll(/fontsourceVariable\(\{([^}]*)\}\)/g)].map((m) => {
    const get = (k) => new RegExp(`${k}:\\s*'([^']*)'`).exec(m[1])?.[1];
    return { name: get('name'), pkg: get('pkg'), cssVariable: get('cssVariable'), source: m[0] };
  }).filter((f) => f.name && f.pkg && f.cssVariable); // skips the helper's own definition, `fontsourceVariable({ name, pkg, … })`
}

/** Weight range of an installed @fontsource-variable package, or undefined when it isn't installed. */
export function installedWeight(root, pkg) {
  const css = readIf(root, `node_modules/@fontsource-variable/${pkg}/index.css`);
  return /font-weight:\s*(\d+(?:\s+\d+)?)/.exec(css)?.[1];
}

/** astro.config.mjs with entries for `fonts` that aren't registered yet, added first (so the body font is preloaded). */
export function addFontsToConfig(config, fonts) {
  const registered = new Set(registeredFonts(config).map((f) => f.name));
  const missing = fonts.filter((f) => !registered.has(f.family));
  if (!missing.length) return config;
  const m = /(fonts:\s*\[\s*\n)(\s*)/.exec(config);
  if (!m) throw new Error(`No \`fonts: [\` array found in ${CONFIG_FILE}`);
  const indent = m[2] || '    ';
  const lines = missing
    .map((f) => `fontsourceVariable({ name: '${f.family}', pkg: '${f.pkg}', cssVariable: '${f.cssVariable}', weight: '${f.weight}', fallbacks: [${f.fallbacks.map((x) => `'${x}'`).join(', ')}] }),`)
    .join(`\n${indent}`);
  return config.replace(m[0], `${m[1]}${indent}${lines}\n${indent}`);
}

/** astro.config.mjs without the given registered entries. */
export function removeFontsFromConfig(config, names) {
  let out = config;
  for (const f of registeredFonts(config).filter((x) => names.includes(x.name))) {
    out = out.replace(new RegExp(`\\n[ \\t]*${f.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},?`), '');
  }
  return out;
}

const SOURCE_EXT = /\.(astro|tsx?|jsx?|css|mdx?)$/;

/** Every --font-* variable referenced outside the theme (components using a family directly). */
function fontVarsUsedInSource(root) {
  const used = new Set();
  const walk = (rel) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (SOURCE_EXT.test(e.name) && !child.startsWith('src/styles/')) {
        for (const m of fs.readFileSync(path.join(root, child), 'utf8').matchAll(/var\((--font-[\w-]+)/g)) used.add(m[1]);
      }
    }
  };
  walk('src');
  return used;
}

/** Findings for the three places a font lives. */
export function fontsReport(root) {
  const config = readIf(root, CONFIG_FILE);
  const registered = registeredFonts(config);
  const findings = [];
  for (const f of registered) {
    if (!installedWeight(root, f.pkg)) {
      findings.push({ level: 'error', message: `${f.name} is registered in ${CONFIG_FILE} but @fontsource-variable/${f.pkg} isn't installed, so the build fails.`, fix: `${pmAdd(root)} @fontsource-variable/${f.pkg}` });
    }
  }
  const sources = themeSources(root);
  const usedByTokens = new Set();
  for (const mode of ['light', 'dark']) {
    const vars = cascade(sources, mode);
    for (const token of ['--theme-font-sans', '--theme-font-display', '--theme-font-mono']) {
      const fallback = (vars[token] ?? '').split(',')[1]?.trim() || 'a system font';
      const refs = [...(vars[token] ?? '').matchAll(/var\((--font-[\w-]+)\)/g)].map((m) => m[1]);
      for (const ref of refs) {
        usedByTokens.add(ref);
        if (!registered.some((r) => r.cssVariable === ref)) {
          findings.push({ level: 'error', message: `${token} uses ${ref}, but no family in ${CONFIG_FILE} has that cssVariable, so text silently falls back to ${fallback}.`, fix: 'npm run design -- fonts --fix registers it (after installing the package), or point the token at a registered family.' });
        }
      }
    }
  }
  // Choices worth a second look: overused defaults, too many families, letters or weights the fonts don't have.
  const catalog = loadFontCatalog(root);
  const usedFamilies = registered.filter((r) => usedByTokens.has(r.cssVariable) && r.cssVariable !== /var\((--font-[\w-]+)\)/.exec(cascade(sources, 'light')['--theme-font-mono'] ?? '')?.[1]);
  for (const f of usedFamilies) {
    if (catalog.families[f.pkg]?.overused) {
      findings.push({ level: 'warning', message: `${f.name} is one of the most common web fonts, so on its own it makes the site look like many others.`, fix: 'Keep it only if the brand uses it; otherwise pick a pairing with npm run design -- fonts --suggest "<voice>".' });
    }
  }
  if (usedFamilies.length > 2) {
    findings.push({ level: 'warning', message: `The theme uses ${usedFamilies.length} text families (${usedFamilies.map((f) => f.name).join(', ')}); two read as deliberate, more as noise and extra downloads.`, fix: 'Keep one display and one body family.' });
  }
  const { subsets: needed } = requiredSubsets(projectLocales(root));
  for (const f of usedFamilies) {
    const have = fontSubsets(root, f.pkg, catalog);
    const lacks = [...needed].filter((sub) => !have.has(sub));
    if (have.size && lacks.length) {
      findings.push({ level: 'warning', message: `${f.name} has no ${lacks.join(', ')} letters, which the site's languages need; those characters fall back to another font.`, fix: 'Choose a family that covers them: npm run design -- fonts --suggest "<voice>" lists only pairings that do.' });
    }
  }
  const lightVars = cascade(sources, 'light');
  const displayVar = /var\((--font-[\w-]+)\)/.exec(lightVars['--theme-font-display'] ?? '')?.[1] ?? /var\((--font-[\w-]+)\)/.exec(lightVars['--theme-font-sans'] ?? '')?.[1];
  const displayFont = registered.find((r) => r.cssVariable === displayVar);
  const range = displayFont && fontWeights(root, displayFont.pkg, catalog);
  const heading = Number(substitute(lightVars['--theme-heading-weight'] ?? '', lightVars));
  if (range && Number.isFinite(heading) && (heading < range[0] || heading > range[1])) {
    findings.push({ level: 'warning', message: `--theme-heading-weight is ${heading}, but ${displayFont.name} only draws ${range[0]}–${range[1]}, so the browser fakes the weight.`, fix: `Set --theme-heading-weight between ${range[0]} and ${range[1]} in ${THEME_FILE}.` });
  }
  const usedInSource = fontVarsUsedInSource(root);
  const unused = registered.filter((r) => !usedByTokens.has(r.cssVariable) && !usedInSource.has(r.cssVariable));
  for (const f of unused) {
    findings.push({ level: 'warning', name: f.name, message: `${f.name} is registered but no --theme-font-* token or component uses it. BaseLayout loads every registered family, so it costs a download.`, fix: 'npm run design -- fonts --fix removes it from astro.config.mjs (uninstall the package yourself if you like).' });
  }
  return { registered, findings, unused: unused.map((f) => f.name) };
}

function pmAdd(root) {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm add';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn add';
  if (fs.existsSync(path.join(root, 'bun.lock')) || fs.existsSync(path.join(root, 'bun.lockb'))) return 'bun add';
  return 'npm install';
}

// ---------------------------------------------------------------------------
// Commands

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split('=');
      const next = argv[i + 1];
      if (inline !== undefined) args[k] = inline;
      else if (next !== undefined && !next.startsWith('--')) args[k] = argv[++i];
      else args[k] = true;
    } else args._.push(a);
  }
  return args;
}

function cmdList(root, log) {
  const dirs = Object.values(loadDirections(root));
  const catalog = loadFontCatalog(root);
  if (!dirs.length) {
    log('No directions found in .agents/design/directions/.');
    return 1;
  }
  for (const d of dirs) {
    const fonts = [...new Set([d.fonts.display.family, d.fonts.body.family])].join(' + ');
    log(`${d.id.padEnd(18)} ${d.name}: ${d.feel}. Suits ${d.suits}. Fonts: ${fonts}.`);
    (d.pairings ?? []).forEach((id, i) => {
      const p = catalog.pairings.find((x) => x.id === id);
      if (p) log(`${''.padEnd(18)}   --pair ${i + 2}: ${[...new Set([catalog.families[p.display]?.family, catalog.families[p.body]?.family])].join(' + ')} (${p.voice.join(', ')})`);
    });
  }
  return 0;
}

export function cmdDirection(root, args, log = console.log) {
  if (args.list) return cmdList(root, log);
  const directions = loadDirections(root);
  const direction = directions[args.base];
  if (!direction) {
    log(`Unknown direction "${args.base ?? ''}". Choose one with --base: ${Object.keys(directions).join(', ')}.`);
    return 1;
  }
  if (args.brand && !/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(args.brand)) {
    log(`--brand must be a hex colour such as "#c2410c", got "${args.brand}".`);
    return 1;
  }
  const themeCss = readIf(root, THEME_FILE);
  const withoutBlock = applyBlock(themeCss, '').trimEnd() + '\n';
  const sources = themeSources(root, withoutBlock).slice(0, -1).concat(withoutBlock);
  const catalog = loadFontCatalog(root);
  // --pairing <id> takes any catalogue pairing; --pair <n> one of the direction's alternatives (1 is its default).
  const pairingId = typeof args.pairing === 'string' ? args.pairing : args.pair && Number(args.pair) > 1 ? direction.pairings?.[Number(args.pair) - 2] : undefined;
  const pairing = pairingId ? pairingFonts(catalog, pairingId) : undefined;
  if (pairingId && !pairing) {
    log(`No pairing "${pairingId}". List them with: npm run design -- fonts --suggest "<a few words for the voice>"`);
    return 1;
  }
  const options = {
    brand: args.brand && (args.brand.startsWith('#') ? args.brand : `#${args.brand}`),
    display: typeof args.display === 'string' ? args.display : undefined,
    body: typeof args.body === 'string' ? args.body : undefined,
    pairing,
    fallbackFonts: Boolean(args['fallback-fonts']),
    seed: typeof args.seed === 'string' ? args.seed : defaultSeed(root),
    sources,
  };
  // Build once to learn the fonts, then again with their weight ranges so weights stay drawable.
  const first = buildDirection(direction, options);
  const built = buildDirection(direction, {
    ...options,
    weights: { display: fontWeights(root, first.fonts.display.pkg, catalog), body: fontWeights(root, first.fonts.body.pkg, catalog) },
  });

  if (built.failures.length) {
    log('This combination fails WCAG AA and the brand colour can\'t be adjusted to fix it:');
    for (const f of built.failures) log(`  ${f.fg} on ${f.bg} (${f.mode}): ${f.ratio}:1, needs ${f.min}:1`);
    log('Nothing was written. Try another --brand colour or direction.');
    return 1;
  }

  const fonts = [built.fonts.body, built.fonts.display]
    .filter((f, i, all) => all.findIndex((x) => x.family === f.family) === i)
    .map((f) => ({ ...f, weight: installedWeight(root, f.pkg) }));
  const missing = fonts.filter((f) => !f.weight);

  if (args['dry-run']) {
    log(built.css);
    if (missing.length) log(`\nFonts to install first: ${pmAdd(root)} ${missing.map((f) => `@fontsource-variable/${f.pkg}`).join(' ')}`);
    return 0;
  }
  if (missing.length) {
    log(`${direction.name} uses ${missing.map((f) => f.family).join(' and ')}, which ${missing.length > 1 ? "aren't" : "isn't"} installed. Nothing was written.`);
    log(`Install, then run this command again:\n  ${pmAdd(root)} ${missing.map((f) => `@fontsource-variable/${f.pkg}`).join(' ')}`);
    log(`Or keep to installed fonts: npm run design -- direction --base ${direction.id}${args.brand ? ` --brand "${args.brand}"` : ''} --fallback-fonts`);
    return 1;
  }

  // Every enabled language must have its letters in the body font; headings may fall back, with a warning.
  const { subsets: needed, system } = requiredSubsets(projectLocales(root));
  const lacking = (pkg) => [...needed].filter((sub) => !fontSubsets(root, pkg, catalog).has(sub));
  const bodyLacks = lacking(built.fonts.body.pkg);
  const displayLacks = built.fonts.display.pkg === built.fonts.body.pkg ? [] : lacking(built.fonts.display.pkg);
  if (bodyLacks.length && !args['allow-missing-scripts']) {
    const alternatives = suggestPairings(catalog, direction.feel, { subsets: needed, limit: 4 }).map((p) => p.id);
    log(`${built.fonts.body.family} has no ${bodyLacks.join(', ')} letters, which this site's languages need. Nothing was written.`);
    log(`Pick a body font that covers them${alternatives.length ? `, such as --pairing ${alternatives.join(', --pairing ')}` : ''}, or add --allow-missing-scripts to accept a fallback font for those languages.`);
    return 1;
  }

  const config = readIf(root, CONFIG_FILE);
  const nextConfig = addFontsToConfig(config, fonts);
  fs.writeFileSync(path.join(root, THEME_FILE), applyBlock(themeCss, built.css));
  if (nextConfig !== config) fs.writeFileSync(path.join(root, CONFIG_FILE), nextConfig);

  log(`Applied ${direction.name} to ${THEME_FILE} (brand hue ${built.hue}, chroma ×${built.chroma}).`);
  if (built.choices.length) log(`Variation for seed "${built.seed}": ${built.choices.join(', ')}. Same seed, same result; --seed preset for the plain direction.`);
  log(`Fonts: ${[...new Set([built.fonts.display.family, built.fonts.body.family])].join(' + ')}${nextConfig !== config ? `; registered in ${CONFIG_FILE}` : ''}.`);
  for (const a of built.adjustments) log(`Adjusted: ${a}.`);
  if (displayLacks.length) log(`Note: ${built.fonts.display.family} has no ${displayLacks.join(', ')} letters, so headings in those languages fall back to ${built.fonts.body.family}.`);
  if (system.length) log(`Note: ${system.join(', ')} use a script no fontsource Latin family covers; text in those languages uses the visitor's system font.`);
  const report = fontsReport(root);
  if (report.unused.length) log(`No longer used: ${report.unused.join(', ')}. Run \`npm run design -- fonts --fix\` to stop loading them.`);
  log('Next: set branding.colors.themeColor in src/config/site.config.ts to the brand colour, and record the direction in .agents/site.md → Design.');
  return 0;
}

const CONTROLS = ['--theme-section-space', '--theme-heading-scale', '--theme-display-scale', '--theme-heading-weight', '--theme-heading-tracking', '--theme-body-leading', '--theme-radius-sm', '--theme-radius-md', '--theme-radius-lg', '--theme-radius-xl', '--theme-radius-button', '--theme-button-weight'];
const TYPE_STEPS = ['--text-xs', '--text-sm', '--text-base', '--text-lg', '--text-xl', '--text-2xl', '--text-3xl', '--text-4xl', '--text-5xl', '--text-6xl', '--text-7xl'];

export function tokensReport(root) {
  const themeCss = readIf(root, THEME_FILE);
  const sources = themeSources(root, themeCss);
  const direction = /@velocity-direction ([\w-]+) \*\//.exec(themeCss)?.[1];
  const modes = Object.fromEntries(['light', 'dark'].map((mode) => [mode, resolveMode(sources, mode)]));
  const light = modes.light;
  const show = (name, vars) => (vars[name] === undefined ? undefined : substitute(vars[name], vars));
  const colorTokens = Object.keys(light.vars).filter((k) => !k.startsWith('--theme-') && !k.startsWith('--text-') && !k.startsWith('--space-') && light.color(k));
  return {
    base: baseTheme(themeCss),
    direction: direction ?? null,
    controls: Object.fromEntries(CONTROLS.map((k) => [k, show(k, light.vars) ?? null])),
    fonts: Object.fromEntries(['--theme-font-sans', '--theme-font-display', '--theme-font-mono'].map((k) => [k, show(k, light.vars)?.split(',')[0].trim() ?? null])),
    typeScale: Object.fromEntries(TYPE_STEPS.map((k) => [k, show(k, light.vars) ?? null])),
    colors: Object.fromEntries(
      ['light', 'dark'].map((mode) => [
        mode,
        Object.fromEntries(colorTokens.map((k) => {
          const c = modes[mode].color(k);
          return [k, c ? { value: c.rgb ? show(k, modes[mode].vars) : formatOklch(c), hex: toHex(c) } : null];
        })),
      ]),
    ),
    contrast: [...modes.light.pairs, ...modes.dark.pairs],
  };
}

function cmdTokens(root, args, log) {
  const r = tokensReport(root);
  const failing = r.contrast.filter((p) => !p.pass);
  if (args.json) {
    log(JSON.stringify(r, null, 2));
    return failing.length ? 1 : 0;
  }
  log(`Theme: ${r.base}${r.direction ? ` + direction ${r.direction}` : ' (no direction applied)'}`);
  log('\nFonts');
  for (const [k, v] of Object.entries(r.fonts)) log(`  ${k.padEnd(22)} ${v}`);
  log('\nControls');
  for (const [k, v] of Object.entries(r.controls)) log(`  ${k.padEnd(24)} ${v ?? '(unset)'}`);
  log('\nType scale');
  for (const [k, v] of Object.entries(r.typeScale)) log(`  ${k.padEnd(12)} ${v ?? '(Tailwind default)'}`);
  for (const mode of ['light', 'dark']) {
    log(`\nColours (${mode})`);
    for (const [k, v] of Object.entries(r.colors[mode])) if (v) log(`  ${k.padEnd(28)} ${v.hex}  ${v.value}`);
  }
  log('\nContrast (WCAG AA)');
  for (const p of r.contrast) {
    log(`  ${p.pass ? 'pass' : 'FAIL'}  ${p.mode.padEnd(5)} ${p.fg} on ${p.bg}`.padEnd(70) + `${String(p.ratio).padStart(5)}:1  (needs ${p.min}${p.note ? `, ${p.note}` : ''})`);
  }
  log(failing.length ? `\n${failing.length} pair(s) below AA. Fix the tokens in ${THEME_FILE}, or re-apply a direction.` : '\nEvery pair passes AA.');
  return failing.length ? 1 : 0;
}

function cmdSuggest(root, args, log) {
  const catalog = loadFontCatalog(root);
  const { subsets, system } = requiredSubsets(projectLocales(root));
  const results = suggestPairings(catalog, args.suggest, { subsets, limit: Number(args.limit) || 6 });
  if (args.json) {
    log(JSON.stringify(results, null, 2));
    return results.length ? 0 : 1;
  }
  if (!results.length) {
    log(`No pairing matches "${args.suggest}" for this site's languages. Try other words (warm, literary, technical, playful, elegant, civic, bold, minimal…).`);
    return 1;
  }
  const name = (pkg) => catalog.families[pkg]?.family ?? pkg;
  log(`Pairings for "${args.suggest}"${subsets.size > 1 ? ` covering ${[...subsets].join(', ')}` : ''}:`);
  for (const p of results) {
    const fonts = p.display === p.body ? name(p.display) : `${name(p.display)} + ${name(p.body)}`;
    log(`  ${p.id.padEnd(26)} ${fonts.padEnd(36)} ${p.voice.join(', ')}. Suits ${p.suits}.${p.displayCovers ? '' : ' (headings fall back in some of your languages)'}`);
  }
  log('Apply one: npm run design -- direction --base <direction> --pairing <pairing>. It prints the install command for any font that isn\'t installed yet.');
  if (system.length) log(`Note: ${system.join(', ')} use a script these families don't cover; that text uses the visitor's system font.`);
  return 0;
}

export function cmdFonts(root, args, log = console.log) {
  if (typeof args.suggest === 'string') return cmdSuggest(root, args, log);
  let report = fontsReport(root);
  if (args.fix) {
    const config = readIf(root, CONFIG_FILE);
    let next = removeFontsFromConfig(config, report.unused);
    // Register families the tokens use but the config lacks, when their package is installed.
    const vars = cascade(themeSources(root), 'light');
    const wanted = ['--theme-font-sans', '--theme-font-display']
      .flatMap((t) => [...(vars[t] ?? '').matchAll(/var\(--font-([\w-]+)\)/g)].map((m) => m[1]))
      .filter((s) => !report.registered.some((r) => r.cssVariable === `--font-${s}`));
    const toAdd = [];
    for (const s of new Set(wanted)) {
      const weight = installedWeight(root, s);
      const css = readIf(root, `node_modules/@fontsource-variable/${s}/index.css`);
      const family = /font-family:\s*'([^']+?)(?: Variable)?'/.exec(css)?.[1];
      if (weight && family) toAdd.push({ ...fontSpec(family), pkg: s, cssVariable: `--font-${s}`, weight });
    }
    next = addFontsToConfig(next, toAdd);
    if (next !== config) {
      fs.writeFileSync(path.join(root, CONFIG_FILE), next);
      if (report.unused.length) log(`Removed from ${CONFIG_FILE}: ${report.unused.join(', ')}.`);
      if (toAdd.length) log(`Registered in ${CONFIG_FILE}: ${toAdd.map((f) => f.family).join(', ')}.`);
    }
    report = fontsReport(root);
  }
  if (args.json) {
    log(JSON.stringify(report, null, 2));
  } else {
    log(`Registered: ${report.registered.map((f) => f.name).join(', ') || 'none'}`);
    if (!report.findings.length) log('Fonts are consistent: every token points at a registered, installed family.');
    for (const f of report.findings) log(`${f.level === 'error' ? 'ERROR' : 'warning'}: ${f.message}\n  Fix: ${f.fix}`);
  }
  return report.findings.some((f) => f.level === 'error') ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Compare: how alike are two sites?

const COMPARE_COLORS = ['--background', '--background-secondary', '--foreground', '--foreground-muted', '--primary', '--brand-500', '--brand-600', '--surface-invert', '--card', '--border'];
const COMPARE_CONTROLS = ['--theme-radius-md', '--theme-radius-button', '--theme-heading-weight', '--theme-heading-tracking', '--theme-section-space', '--theme-display-scale', '--theme-heading-scale'];

function oklab({ l, c, h }) {
  const rad = (h * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

/** What a site's design is made of: resolved colours (light and dark), controls, fonts and each view's section sequence. */
export function designFingerprint(root) {
  const sources = themeSources(root);
  const colors = {};
  for (const mode of ['light', 'dark']) {
    const { color } = resolveMode(sources, mode);
    for (const k of COMPARE_COLORS) {
      const c = color(k);
      if (c && !c.rgb) colors[`${mode}:${k}`] = oklab(c);
    }
  }
  const vars = cascade(sources, 'light');
  const controls = Object.fromEntries(COMPARE_CONTROLS.map((k) => [k, substitute(vars[k] ?? '', vars)]));
  // A display stack of just var(--theme-font-sans) means the display font is the body font.
  const fontOf = (k) => {
    const v = /var\(--font-/.test(vars[k] ?? '') ? vars[k] : vars['--theme-font-sans'] ?? '';
    return /var\((--font-[\w-]+)\)/.exec(v)?.[1] ?? '';
  };
  const fonts = [fontOf('--theme-font-sans'), fontOf('--theme-font-display')];
  const views = {};
  const viewsDir = path.join(root, 'src/views');
  for (const file of fs.existsSync(viewsDir) ? fs.readdirSync(viewsDir).filter((f) => f.endsWith('.astro')) : []) {
    const text = fs.readFileSync(path.join(viewsDir, file), 'utf8');
    const sections = new Set([...text.matchAll(/import\s+(\w+)\s+from\s+['"]@\/components\/sections\/[^'"]+['"]/g)].map((m) => m[1]));
    const body = text.replace(/^---[\s\S]*?---/, '');
    views[file] = [...body.matchAll(/<([A-Z]\w*)\b([^>]*)>/g)]
      .filter((m) => sections.has(m[1]))
      .map((m) => `${m[1]}${/\blayout=["']([\w-]+)["']/.exec(m[2])?.[1] ? `:${/\blayout=["']([\w-]+)["']/.exec(m[2])[1]}` : ''}`);
  }
  return { colors, controls, fonts, views, direction: /@velocity-direction ([\w-]+) \*\//.exec(readIf(root, THEME_FILE))?.[1] ?? null };
}

/** Length of the longest common subsequence, for comparing section orders. */
function lcs(a, b) {
  const row = new Array(b.length + 1).fill(0);
  for (const x of a) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = x === b[j - 1] ? prev + 1 : Math.max(row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[b.length];
}

/**
 * How alike two sites are, 0 (nothing in common) to 1 (identical), per aspect.
 * colours: 1 minus the mean OKLab distance of key tokens (scaled so 0.1 apart counts as different);
 * controls: share of radius, weight, tracking, spacing and scale values that match;
 * fonts: share of the sans and display families that match;
 * structure: for views both sites have, matching section order (with layouts) as a share of the longer page.
 */
export function compareSites(a, b) {
  const keys = Object.keys(a.colors).filter((k) => b.colors[k]);
  const meanDelta = keys.length ? keys.reduce((sum, k) => sum + Math.hypot(...a.colors[k].map((v, i) => v - b.colors[k][i])), 0) / keys.length : 1;
  const colors = round(Math.max(0, 1 - meanDelta / 0.1), 2);
  const controls = round(COMPARE_CONTROLS.filter((k) => a.controls[k] === b.controls[k]).length / COMPARE_CONTROLS.length, 2);
  const fonts = round(a.fonts.filter((f, i) => f && f === b.fonts[i]).length / a.fonts.length, 2);
  const shared = Object.keys(a.views).filter((v) => b.views[v]?.length && a.views[v].length);
  const perView = Object.fromEntries(shared.map((v) => [v, round(lcs(a.views[v], b.views[v]) / Math.max(a.views[v].length, b.views[v].length), 2)]));
  const structure = shared.length ? round(Object.values(perView).reduce((x, y) => x + y, 0) / shared.length, 2) : null;
  const parts = [colors, controls, fonts, ...(structure === null ? [] : [structure])];
  const overall = round(parts.reduce((x, y) => x + y, 0) / parts.length, 2);
  const verdict = overall >= 0.8 ? 'near copy' : overall >= 0.6 ? 'similar' : 'distinct';
  return { colors, controls, fonts, structure, perView, overall, verdict, sameDirection: a.direction !== null && a.direction === b.direction };
}

function cmdCompare(root, args, log) {
  const other = args._[1];
  if (!other || !fs.existsSync(path.join(other, THEME_FILE))) {
    log('Usage: npm run design -- compare <path to another Velocity project>');
    return 1;
  }
  const r = compareSites(designFingerprint(root), designFingerprint(path.resolve(other)));
  if (args.json) {
    log(JSON.stringify(r, null, 2));
    return 0;
  }
  const pct = (x) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);
  log(`Similarity to ${other}: ${pct(r.overall)} (${r.verdict})${r.sameDirection ? ', same direction' : ''}`);
  log(`  colours ${pct(r.colors)}  controls ${pct(r.controls)}  fonts ${pct(r.fonts)}  page structure ${pct(r.structure)}`);
  for (const [view, score] of Object.entries(r.perView)) log(`  ${view}: ${pct(score)} of its section order matches`);
  if (r.verdict !== 'distinct') log('To tell them apart: try another --seed or --pair, change the page structure, and give each site its own signature section (.agents/design.md → Make it the site\'s own).');
  return 0;
}

const HELP = `Usage: npm run design -- <command>

  direction --base <id> [--brand <hex>] [--seed <text>|preset] [--pairing <id> | --pair <n>] [--display <family>] [--body <family>] [--fallback-fonts] [--dry-run]
  direction --list
  tokens [--json]
  fonts [--fix] [--json]
  fonts --suggest "<words for the voice>" [--json]
  compare <other project> [--json]

See .agents/design.md.`;

export function main(argv, { root = process.cwd(), log = console.log } = {}) {
  const args = parseArgs(argv);
  const [command] = args._;
  if (command === 'direction') return cmdDirection(root, args, log);
  if (command === 'tokens') return cmdTokens(root, args, log);
  if (command === 'fonts') return cmdFonts(root, args, log);
  if (command === 'compare') return cmdCompare(root, args, log);
  log(HELP);
  return command ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
