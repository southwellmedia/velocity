#!/usr/bin/env node
/**
 * Agent-ready check: catches the mistakes `astro check` and the build let through.
 *
 *   npm run check:agent                     # after `npm run build`
 *   npm run check:agent -- --json           # machine-readable findings
 *   npm run check:agent -- --strict         # warnings fail too
 *   npm run check:agent -- --write-baseline # record Velocity-owned files as they are now
 *
 * Every finding names the file, the rule in .agents/velocity.md it breaks, and the fix.
 * Errors exit 1. Warnings are printed but pass unless --strict is given.
 *
 * Rules
 *   i18n/missing-key       t('a.b') with no English string: the raw key renders     (error)
 *   i18n/raw-key           a translation key rendered as text in the build          (error)
 *   i18n/untranslated      keys an enabled locale doesn't translate (falls back)     (warning)
 *   csp/inline-handler     onclick= and other inline event handlers                  (error)
 *   csp/unhashed-script    an inline <script> whose hash isn't in the page's CSP    (error)
 *   csp/javascript-url     href="javascript:..."                                    (error)
 *   links/broken           internal link, asset or #anchor that doesn't exist        (error)
 *   forms/stub             a form Action that reports success but delivers nothing  (warning)
 *   ownership/edited       a Velocity-owned file changed since scaffold or upgrade   (warning)
 *   strings/hardcoded      user-facing text written into a view or component         (warning)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BASELINE = '.velocity/baseline.json';
const RULES_DOC = '.agents/velocity.md';

const RULES = {
  'i18n/missing-key': { severity: 'error', ref: 'Rules → No hardcoded user-facing strings' },
  'i18n/raw-key': { severity: 'error', ref: 'Rules → No hardcoded user-facing strings' },
  'i18n/untranslated': { severity: 'warning', ref: 'Rules → No hardcoded user-facing strings' },
  'csp/inline-handler': { severity: 'error', ref: 'Rules → CSP is on' },
  'csp/unhashed-script': { severity: 'error', ref: 'Rules → CSP is on' },
  'csp/javascript-url': { severity: 'error', ref: 'Rules → CSP is on' },
  'links/broken': { severity: 'error', ref: 'Rules → Internal links' },
  'forms/stub': { severity: 'warning', ref: 'Rules → Forms' },
  'ownership/edited': { severity: 'warning', ref: 'Who owns which files' },
  'strings/hardcoded': { severity: 'warning', ref: 'Rules → No hardcoded user-facing strings' },
};

function finding(rule, { file, line, message, fix }) {
  return { rule, severity: RULES[rule].severity, file, line, message, fix, ref: `${RULES_DOC} → ${RULES[rule].ref}` };
}

// ---------------------------------------------------------------------------
// Files

const SKIP_DIRS = new Set(['node_modules', '.git', '.astro', 'dist', '.velocity-backup', 'test-results', 'playwright-report']);

/** Project-relative paths of files under `rel` that pass `filter`, sorted, skipping build and dependency folders. */
export function walk(root, rel = '', filter = () => true) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return filter(rel) ? [rel] : [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => {
      if (e.isDirectory() && SKIP_DIRS.has(e.name)) return [];
      const child = rel ? `${rel}/${e.name}` : e.name;
      return e.isDirectory() ? walk(root, child, filter) : filter(child) ? [child] : [];
    });
}

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('base64');

/** Where the static pages are: dist/client with an adapter, dist without. */
export function findDistDir(root) {
  for (const rel of ['dist/client', 'dist']) {
    if (fs.existsSync(path.join(root, rel, 'index.html'))) return rel;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// i18n

const KEY_SHAPE = /^[a-zA-Z][\w-]*(\.[\w-]+)+$/;

/** The string at a dotted `key` in a nested dictionary, or undefined when the path ends anywhere but a string. */
function lookup(dict, key) {
  let node = dict;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Every dotted key path in a nested dictionary that ends at a string. */
export function leaves(dict, prefix = '') {
  return Object.entries(dict ?? {}).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : typeof v === 'string' ? [`${prefix}${k}`] : [],
  );
}

/** Load ui.ts, translations/*.ts and locales.mjs. Node ≥22.18 strips TypeScript types natively. */
export async function loadDictionaries(root) {
  const importFile = async (rel) => {
    const abs = path.join(root, rel);
    return fs.existsSync(abs) ? import(pathToFileURL(abs).href) : undefined;
  };
  const uiMod = await importFile('src/i18n/ui.ts').catch(() => undefined);
  const localesMod = await importFile('src/i18n/locales.mjs').catch(() => undefined);
  const site = {};
  for (const rel of walk(root, 'src/i18n/translations', (f) => f.endsWith('.ts'))) {
    const locale = path.basename(rel, '.ts');
    const mod = await importFile(rel).catch(() => undefined);
    if (mod?.default) site[locale] = mod.default;
  }
  const defaultLocale = localesMod?.defaultLocale ?? 'en';
  return {
    ui: uiMod?.ui ?? {},
    site,
    defaultLocale,
    locales: [...(localesMod?.locales ?? [defaultLocale])],
  };
}

/** Same lookup order as src/i18n/index.ts, minus the final "return the key". */
export function resolves(dicts, key, locale = dicts.defaultLocale) {
  return (
    lookup(dicts.site[locale], key) ??
    lookup(dicts.ui[locale], key) ??
    lookup(dicts.site[dicts.defaultLocale], key) ??
    lookup(dicts.ui[dicts.defaultLocale], key)
  );
}

/**
 * Blank out code samples, keeping offsets: fenced blocks in MDX, and template
 * literals that aren't themselves the argument of t(), such as a snippet shown on a page.
 */
function codeOnly(text, file) {
  const keep = (m) => m.replace(/[^\n]/g, ' ');
  let out = file.endsWith('.mdx') ? text.replace(/^```[\s\S]*?^```/gm, keep) : text;
  out = out.replace(/(?<!\bt\(\s*)`(?:\\.|[^`\\])*`/g, keep);
  return out;
}

/** Literal keys passed to t() in source files. Dynamic keys (template strings with ${}) are skipped. */
export function findKeyUses(root) {
  const uses = [];
  const files = walk(root, 'src', (f) => /\.(astro|ts|tsx|mdx)$/.test(f) && !f.startsWith('src/i18n/'));
  for (const file of files) {
    const text = codeOnly(read(root, file), file);
    for (const m of text.matchAll(/\bt\(\s*(['"`])([^'"`$\n]+)\1/g)) {
      if (KEY_SHAPE.test(m[2])) uses.push({ key: m[2], file, line: lineOf(text, m.index) });
    }
  }
  return uses;
}

/** i18n/missing-key: literal t() keys with no string in the default locale or Velocity's built-in UI strings. */
export function checkMissingKeys(root, dicts) {
  const out = [];
  const seen = new Set();
  for (const use of findKeyUses(root)) {
    if (resolves(dicts, use.key) !== undefined) continue;
    const id = `${use.key}@${use.file}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const ns = use.key.split('.')[0];
    out.push(
      finding('i18n/missing-key', {
        file: use.file,
        line: use.line,
        message: `t('${use.key}') has no English string, so the page shows "${use.key}".`,
        fix: `Add ${use.key} to src/i18n/translations/${dicts.defaultLocale}.ts (under \`${ns}\`), then to each other locale's file.`,
      }),
    );
  }
  return out;
}

/** i18n/untranslated: one finding per enabled locale listing the keys it falls back to English for. */
export function checkUntranslated(dicts) {
  const out = [];
  const expected = [...new Set([...leaves(dicts.site[dicts.defaultLocale]), ...leaves(dicts.ui[dicts.defaultLocale])])];
  for (const locale of dicts.locales) {
    if (locale === dicts.defaultLocale) continue;
    const missing = expected.filter((key) => !lookup(dicts.site[locale], key) && !lookup(dicts.ui[locale], key));
    if (!missing.length) continue;
    const builtIn = missing.filter((key) => lookup(dicts.ui[dicts.defaultLocale], key) && !lookup(dicts.site[dicts.defaultLocale], key));
    const sample = missing.slice(0, 5).join(', ') + (missing.length > 5 ? ', …' : '');
    out.push(
      finding('i18n/untranslated', {
        file: `src/i18n/translations/${locale}.ts`,
        message: `${missing.length} key(s) show English on /${locale}/ pages: ${sample}.`,
        fix:
          `Translate them in src/i18n/translations/${locale}.ts.` +
          (builtIn.length
            ? ` ${builtIn.length} are Velocity's built-in UI strings; add them to your translations file, not src/i18n/ui.ts, which upgrades replace.`
            : ''),
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build output

const TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
const ATTR = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/** Attributes of a tag's attribute source as a lower-cased name → value map (bare attributes map to ''). */
function attrs(source) {
  const out = {};
  for (const m of source.matchAll(ATTR)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Strip script, style, template and comment bodies so tag and text scans only see markup. */
function markupOnly(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/<(script|style|template|pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => {
      const open = m.match(/^<[^>]*>/)[0];
      return open + ' '.repeat(m.length - open.length);
    });
}

/** The built file a URL path serves (exact file, `<path>/index.html` or `<path>.html`), or undefined. */
export function pageForUrl(distRoot, pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidates = [clean, `${clean.replace(/\/$/, '')}/index.html`, `${clean.replace(/\/$/, '')}.html`];
  return candidates.find((c) => {
    const abs = path.join(distRoot, c);
    return c !== '' && fs.existsSync(abs) && fs.statSync(abs).isFile();
  });
}

const NON_EXECUTABLE = /^(application\/(ld\+)?json|importmap|text\/template|speculationrules)$/i;

/**
 * Scan every built page. `keyIsRaw(text)` decides whether a text node is an unresolved translation key.
 */
export function checkBuild(root, distRel, { keyIsRaw = () => false, defaultLocale = 'en' } = {}) {
  const distRoot = path.join(root, distRel);
  const pages = walk(distRoot, '', (f) => f.endsWith('.html'));
  const out = [];
  const idsCache = new Map();
  const idsOf = (rel) => {
    if (!idsCache.has(rel)) {
      const html = fs.readFileSync(path.join(distRoot, rel), 'utf8');
      idsCache.set(rel, new Set([...html.matchAll(/\s(?:id|name)\s*=\s*["']?([^"'\s>]+)/g)].map((m) => decode(m[1]))));
    }
    return idsCache.get(rel);
  };
  const reported = new Set();
  const once = (key, f) => {
    if (reported.has(key)) return;
    reported.add(key);
    out.push(f);
  };

  for (const page of pages) {
    const file = `${distRel}/${page}`;
    const html = fs.readFileSync(path.join(distRoot, page), 'utf8');
    const markup = markupOnly(html);
    const csp = html.match(/<meta[^>]+http-equiv=["']content-security-policy["'][^>]*>/i)?.[0];
    const scriptSrc = csp ? decode(attrs(csp).content ?? '').match(/script-src([^;]*)/)?.[1] ?? '' : undefined;

    // Inline scripts must be hashed into the page's CSP.
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const a = attrs(m[1]);
      if ('src' in a || NON_EXECUTABLE.test(a.type ?? '') || !m[2].trim() || scriptSrc === undefined) continue;
      if (scriptSrc.includes(`'sha256-${sha256(m[2])}'`) || scriptSrc.includes("'unsafe-inline'")) continue;
      once(`script:${sha256(m[2])}`, finding('csp/unhashed-script', {
        file,
        line: lineOf(html, m.index),
        message: `An inline <script> isn't in this page's CSP, so the browser blocks it: "${m[2].trim().slice(0, 60)}…"`,
        fix: 'Move the code into a bundled <script> (Astro hashes those), or render it with <InlineScript code={...} /> importing the source with ?raw. Never add unsafe-inline.',
      }));
    }

    for (const m of markup.matchAll(TAG)) {
      const tag = m[1].toLowerCase();
      const a = attrs(m[2] ?? '');
      const line = lineOf(html, m.index);

      for (const name of Object.keys(a)) {
        if (/^on[a-z]+$/.test(name)) {
          once(`handler:${file}:${name}:${line}`, finding('csp/inline-handler', {
            file,
            line,
            message: `<${tag} ${name}="…"> is an inline event handler; CSP blocks it.`,
            fix: `Remove ${name} and add the listener in the component's <script> with addEventListener, guarded for astro:after-swap.`,
          }));
        }
      }

      for (const attr of ['href', 'src', 'action', 'poster']) {
        const value = a[attr] === undefined ? undefined : decode(a[attr]).trim();
        if (!value) continue;
        if (/^javascript:/i.test(value)) {
          once(`js:${file}:${line}`, finding('csp/javascript-url', {
            file,
            line,
            message: `<${tag} ${attr}="${value.slice(0, 40)}"> runs script from a URL; CSP blocks it.`,
            fix: 'Use a <button> with a listener added in the component script.',
          }));
          continue;
        }
        if (tag === 'link' && /preconnect|dns-prefetch/.test(a.rel ?? '')) continue;
        let target;
        if (value.startsWith('#')) target = { page, hash: value.slice(1) };
        else if (value.startsWith('/') && !value.startsWith('//')) {
          const url = new URL(value, 'https://site.invalid');
          if (url.pathname.startsWith('/_actions/') || url.pathname.startsWith('/_image')) continue;
          const resolved = pageForUrl(distRoot, url.pathname);
          if (!resolved) {
            once(`link:${url.pathname}`, finding('links/broken', {
              file,
              line,
              message: `<${tag} ${attr}="${value}"> points at a page or file the build doesn't contain.`,
              fix: 'Build internal links with localizeRoute()/localizePath() from @/i18n and check the route exists in src/config/nav.config.ts; for assets, use a file that exists in public/ or import it.',
            }));
            continue;
          }
          target = { page: resolved, hash: url.hash.slice(1) };
        }
        if (target?.hash && target.page.endsWith('.html') && target.hash !== 'top') {
          const hash = decodeURIComponent(target.hash);
          if (!idsOf(target.page).has(hash)) {
            once(`hash:${target.page}#${hash}`, finding('links/broken', {
              file,
              line,
              message: `<${tag} ${attr}="${value}"> links to #${hash}, but no element on ${target.page} has that id.`,
              fix: `Add id="${hash}" to the target element, or fix the link.`,
            }));
          }
        }
      }

      for (const attr of ['alt', 'title', 'aria-label', 'placeholder', 'content']) {
        const value = a[attr] && decode(a[attr]).trim();
        if (value && keyIsRaw(value)) rawKey(once, file, line, value, defaultLocale);
      }
    }

    // Text nodes
    const text = markup.replace(TAG, (t) => '<'.padEnd(t.length - 1, ' ') + '>').replace(/<\/[^>]+>/g, (t) => '<'.padEnd(t.length - 1, ' ') + '>');
    for (const m of text.matchAll(/>([^<]+)</g)) {
      const value = decode(m[1]).trim();
      if (value && keyIsRaw(value)) rawKey(once, file, lineOf(html, m.index), value, defaultLocale);
    }
  }
  return { findings: out, pages: pages.length };
}

function rawKey(once, file, line, key, locale) {
  once(`raw:${file}:${key}`, finding('i18n/raw-key', {
    file,
    line,
    message: `The page shows the translation key "${key}" instead of text.`,
    fix: `Add ${key} to src/i18n/translations/${locale}.ts. If the key is built at runtime, check the parts it's made from.`,
  }));
}

/** A text node is a raw key when it is key-shaped, its namespace is known or used in source, and it doesn't resolve. */
export function rawKeyMatcher(dicts, usedKeys = []) {
  const namespaces = new Set(
    [...Object.keys(dicts.site[dicts.defaultLocale] ?? {}), ...Object.keys(dicts.ui[dicts.defaultLocale] ?? {}), ...usedKeys.map((k) => k.split('.')[0])],
  );
  return (text) => KEY_SHAPE.test(text) && namespaces.has(text.split('.')[0]) && resolves(dicts, text) === undefined;
}

// ---------------------------------------------------------------------------
// Forms

const STUBS = [
  { pattern: /^\s*\/\/\s*@velocity-stub\s+(\w+)/, name: (m) => m[1] },
  // Projects created before 2.3 have the TODOs but not the marker.
  { pattern: /^\s*\/\/\s*TODO: deliver the message/, name: () => 'contact' },
  { pattern: /^\s*\/\/\s*TODO: subscribe the address/, name: () => 'newsletter' },
];

/** forms/stub: Actions still carrying a `@velocity-stub` marker, or the TODO lines that projects before 2.3 shipped. */
export function checkFormStubs(root) {
  const out = [];
  const seen = new Set();
  for (const file of walk(root, 'src/actions', (f) => /\.(ts|js|mjs)$/.test(f))) {
    read(root, file)
      .split('\n')
      .forEach((text, i) => {
        for (const stub of STUBS) {
          const m = text.match(stub.pattern);
          if (!m || seen.has(stub.name(m))) continue;
          seen.add(stub.name(m));
          out.push(finding('forms/stub', {
            file,
            line: i + 1,
            message: `actions.${stub.name(m)} reports success but delivers nothing. Visitors think their message was sent.`,
            fix: 'Connect a provider (see the velocity-connect-forms skill), send a real test message, then delete the @velocity-stub line. Secrets go through astro:env.',
          }));
        }
      });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ownership

/** Files Velocity ships and replaces on upgrade (velocity-manifest.json → files.safe). */
export function velocityOwnedFiles(root) {
  const manifestPath = path.join(root, 'velocity-manifest.json');
  if (!fs.existsSync(manifestPath)) return [];
  const { files } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return [...new Set((files?.safe ?? []).flatMap((entry) => walk(root, entry.replace(/\/$/, ''))))].sort();
}

export function writeBaseline(root) {
  const files = Object.fromEntries(velocityOwnedFiles(root).map((rel) => [rel, sha256(fs.readFileSync(path.join(root, rel)))]));
  fs.mkdirSync(path.join(root, path.dirname(BASELINE)), { recursive: true });
  fs.writeFileSync(path.join(root, BASELINE), JSON.stringify({ note: 'Written by check:agent. Rewrite after an upgrade with npm run check:agent -- --write-baseline.', files }, null, 2) + '\n');
  return Object.keys(files).length;
}

/** ownership/edited: Velocity-owned files whose hash differs from the baseline. Skipped when there is no baseline. */
export function checkOwnership(root) {
  const baselinePath = path.join(root, BASELINE);
  if (!fs.existsSync(baselinePath)) return { findings: [], skipped: true };
  const { files } = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const out = [];
  for (const [rel, hash] of Object.entries(files ?? {})) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || sha256(fs.readFileSync(abs)) === hash) continue;
    out.push(finding('ownership/edited', {
      file: rel,
      message: 'This file is Velocity-owned and the next upgrade replaces it, losing the edit.',
      fix: 'Make the change in a file you own (src/components/site/, src/views/, src/components/patterns/, src/styles/theme.css, translations), or tell the user the edit will need reapplying after upgrades.',
    }));
  }
  return { findings: out, skipped: false };
}

// ---------------------------------------------------------------------------
// Hardcoded strings (warning: heuristics, so allow a file to opt out)

export const ALLOW_HARDCODED = 'velocity-allow-hardcoded';
const HARDCODED_DIRS = ['src/views', 'src/components/site', 'src/components/patterns', 'src/layouts'];
const UI_ATTRS = /\s(alt|title|aria-label|placeholder|label|description|lead|heading|subtitle)\s*=\s*"([^"{}]*[A-Za-z]{2}[^"{}]*)"/g;

/** Blank out {expressions} (tracking nested braces and strings), keeping offsets. */
function blankExpressions(src) {
  let out = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (depth > 0) {
      if (quote) {
        if (c === '\\') { out += '  '; i++; continue; }
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      out += c === '\n' ? '\n' : ' ';
    } else if (c === '{') {
      depth = 1;
      out += ' ';
    } else out += c;
  }
  return out;
}

/** Hardcoded text and UI attributes in an .astro template, ignoring frontmatter, scripts, styles, code and {expressions}. */
export function findHardcoded(source) {
  const fm = source.match(/^---\r?\n[\s\S]*?\r?\n---/);
  const start = fm ? fm[0].length : 0;
  const keep = (m) => m.replace(/[^\n]/g, ' ');
  let body = source.slice(start)
    .replace(/<!--[\s\S]*?-->/g, keep)
    .replace(/<(script|style|pre|code)\b[\s\S]*?<\/\1>/gi, keep);
  body = blankExpressions(body);
  const hits = [];
  const at = (index, text) => hits.push({ line: lineOf(source, start + index), text: text.trim().replace(/\s+/g, ' ') });
  for (const m of body.matchAll(UI_ATTRS)) at(m.index, `${m[1]}="${m[2]}"`);
  const textOnly = body.replace(/<\/?[a-zA-Z!][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g, keep);
  for (const m of textOnly.matchAll(/[^\s<>][^<>\n]*/g)) {
    const text = m[0].trim();
    // Words of two or more letters; skip entities, punctuation and single symbols.
    // Skip entities and lone lowercase identifiers such as a handle or a code name.
    if (/[A-Za-zÀ-ÿ]{2,}/.test(text) && !/^&[a-z]+;$/.test(text) && !/^[a-z][\w.-]*$/.test(text)) at(m.index, text);
  }
  return hits;
}

/** strings/hardcoded: warnings for every .astro file in the project-owned folders that hasn't opted out. */
export function checkHardcoded(root) {
  const out = [];
  for (const dir of HARDCODED_DIRS) {
    for (const file of walk(root, dir, (f) => f.endsWith('.astro'))) {
      const source = read(root, file);
      if (source.includes(ALLOW_HARDCODED)) continue;
      for (const hit of findHardcoded(source)) {
        out.push(finding('strings/hardcoded', {
          file,
          line: hit.line,
          message: `"${hit.text.slice(0, 60)}" is written into the markup, so it won't translate.`,
          fix: `Move it to src/i18n/translations/<locale>.ts and render it with t('…'). If the file is deliberately single-language, add a ${ALLOW_HARDCODED} comment to it.`,
        }));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Runner

/** Run every rule against the project at `root`. Returns { ok, errors, warnings, findings, notes }; `strict` makes every finding an error. */
export async function run(root, { strict = false } = {}) {
  const findings = [];
  const notes = [];
  const dicts = await loadDictionaries(root);
  findings.push(...checkMissingKeys(root, dicts), ...checkUntranslated(dicts));

  const distRel = findDistDir(root);
  if (distRel) {
    const used = findKeyUses(root).map((u) => u.key);
    const build = checkBuild(root, distRel, { keyIsRaw: rawKeyMatcher(dicts, used), defaultLocale: dicts.defaultLocale });
    findings.push(...build.findings);
    notes.push(`Scanned ${build.pages} built page(s) in ${distRel}/.`);
  } else {
    findings.push({
      rule: 'build/missing',
      severity: 'error',
      file: 'dist/',
      message: 'No build output to scan.',
      fix: 'Run npm run build first (npm run validate does both).',
      ref: `${RULES_DOC} → Commands`,
    });
  }

  findings.push(...checkFormStubs(root));
  const ownership = checkOwnership(root);
  findings.push(...ownership.findings);
  if (ownership.skipped) notes.push(`No ${BASELINE}, so edits to Velocity-owned files weren't checked. Run npm run check:agent -- --write-baseline on a clean checkout to start tracking.`);
  findings.push(...checkHardcoded(root));

  if (strict) for (const f of findings) f.severity = 'error';
  const errors = findings.filter((f) => f.severity === 'error').length;
  return { ok: errors === 0, errors, warnings: findings.length - errors, findings, notes };
}

/** Human-readable report: findings grouped by rule, at most 20 per rule, each group with its velocity.md reference and fix. */
export function format(result) {
  const lines = [];
  const groups = Map.groupBy ? Map.groupBy(result.findings, (f) => f.rule) : new Map();
  for (const [rule, items] of groups) {
    lines.push('', `${items[0].severity === 'error' ? '✖' : '⚠'} ${rule} (${items.length})  ${items[0].ref}`);
    const shown = items.slice(0, 20);
    for (const f of shown) {
      lines.push(`  ${f.file}${f.line ? `:${f.line}` : ''}  ${f.message}`);
    }
    if (items.length > shown.length) lines.push(`  …and ${items.length - shown.length} more (--json lists all)`);
    lines.push(`  fix: ${items[0].fix}`);
  }
  for (const note of result.notes) lines.push('', `ℹ ${note}`);
  lines.push('', result.ok ? `✔ check:agent passed (${result.warnings} warning(s))` : `✖ check:agent: ${result.errors} error(s), ${result.warnings} warning(s)`);
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const root = process.cwd();
  if (args.has('--write-baseline')) {
    console.log(`Recorded ${writeBaseline(root)} Velocity-owned file(s) in ${BASELINE}.`);
    process.exit(0);
  }
  const result = await run(root, { strict: args.has('--strict') });
  console.log(args.has('--json') ? JSON.stringify(result, null, 2) : format(result));
  process.exit(result.ok ? 0 : 1);
}
