import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import * as check from '../../scripts/check-agent.mjs';

type Finding = { rule: string; severity: string; file: string; line?: number; message: string; fix: string; ref: string };

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A minimal project: English copy with a `pricing` namespace, plus the given files. */
function project(files: Record<string, string> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-agent-'));
  dirs.push(root);
  const base: Record<string, string> = {
    'src/i18n/locales.mjs': "export const defaultLocale = 'en';\nexport const locales = ['en'];\n",
    'src/i18n/ui.ts': "export const ui = { en: { nav: { home: 'Home' } } };\n",
    'src/i18n/translations/en.ts': "export default { pricing: { title: 'Pricing' } };\n",
    'dist/index.html': page('<h1>Home</h1>'),
  };
  for (const [rel, text] of Object.entries({ ...base, ...files })) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

function page(body: string, scriptHashes: string[] = []) {
  const csp = `script-src 'self' ${scriptHashes.map((h) => `'sha256-${h}'`).join(' ')}`;
  return `<!doctype html><html><head><meta http-equiv="content-security-policy" content="${csp}"></head><body>${body}</body></html>`;
}

async function findings(root: string, rule?: string): Promise<Finding[]> {
  const result = await check.run(root);
  return (result.findings as Finding[]).filter((f) => !rule || f.rule === rule);
}

describe('check:agent', () => {
  it('passes a clean project', async () => {
    const root = project({
      'src/views/PricingView.astro': "---\nconst t = useTranslations(locale);\n---\n<h1>{t('pricing.title')}</h1>\n",
    });
    const result = await check.run(root);
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('fails when the build output is missing', async () => {
    const root = project();
    fs.rmSync(path.join(root, 'dist'), { recursive: true });
    expect((await check.run(root)).ok).toBe(false);
  });

  it('every finding names the file, the rule in velocity.md and the fix', async () => {
    const root = project({ 'dist/index.html': page('<button onclick="go()">Go</button>') });
    const [f] = await findings(root, 'csp/inline-handler');
    expect(f.file).toBe('dist/index.html');
    expect(f.ref).toMatch(/^\.agents\/velocity\.md → /);
    expect(f.fix).toMatch(/addEventListener/);
  });

  describe('i18n/missing-key', () => {
    it('reports t() keys with no English string', async () => {
      const root = project({
        'src/views/PricingView.astro': "---\nconst t = useTranslations(locale);\n---\n<p>{t('pricing.lead')}</p>\n",
      });
      const [f] = await findings(root, 'i18n/missing-key');
      expect(f).toMatchObject({ severity: 'error', file: 'src/views/PricingView.astro', line: 4 });
      expect(f.message).toContain('pricing.lead');
    });

    it('accepts keys from the built-in UI strings and ignores plain text and code samples', async () => {
      const root = project({
        'src/views/HomeView.astro': "---\n---\n<p>{t('nav.home')}</p><p>{t('Pricing')}</p>\n",
        'src/components/Demo.tsx': "const code = `const title = t('hero.title');`;\n",
      });
      expect(await findings(root, 'i18n/missing-key')).toEqual([]);
    });
  });

  it('i18n/raw-key: reports keys rendered as text or attributes', async () => {
    const root = project({
      'dist/index.html': page('<h1>pricing.heading</h1><img src="/index.html" alt="nav.logo"><code>nav.config.ts</code>'),
    });
    const raw = await findings(root, 'i18n/raw-key');
    expect(raw.map((f) => f.message)).toEqual([
      expect.stringContaining('"nav.logo"'),
      expect.stringContaining('"pricing.heading"'),
    ]);
  });

  it('i18n/untranslated: warns about English fallbacks, including built-in UI strings', async () => {
    const root = project({
      'src/i18n/locales.mjs': "export const defaultLocale = 'en';\nexport const locales = ['en', 'de'];\n",
      'src/i18n/translations/de.ts': "export default { pricing: { title: 'Preise' } };\n",
    });
    const [f] = await findings(root, 'i18n/untranslated');
    expect(f).toMatchObject({ severity: 'warning', file: 'src/i18n/translations/de.ts' });
    expect(f.message).toContain('nav.home');
    expect(f.fix).toContain('not src/i18n/ui.ts');
  });

  describe('csp', () => {
    it('reports inline event handlers and javascript: URLs', async () => {
      const root = project({ 'dist/index.html': page('<a href="javascript:void(0)">x</a><div onClick="x()"></div>') });
      expect((await findings(root, 'csp/inline-handler')).length).toBe(1);
      expect((await findings(root, 'csp/javascript-url')).length).toBe(1);
    });

    it('reports inline scripts missing from the CSP, but not hashed or JSON ones', async () => {
      const hashed = 'console.log(1)';
      const hash = (await import('node:crypto')).createHash('sha256').update(hashed).digest('base64');
      const root = project({
        'dist/index.html': page(
          `<script>${hashed}</script><script>console.log(2)</script><script type="application/json">{"a":1}</script>`,
          [hash],
        ),
      });
      const found = await findings(root, 'csp/unhashed-script');
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain('console.log(2)');
    });
  });

  it('links/broken: reports missing pages, assets and anchors', async () => {
    const root = project({
      'dist/about/index.html': page('<h2 id="team">Team</h2>'),
      'dist/index.html': page(
        '<a href="/about">ok</a><a href="/about/#team">ok</a><a href="/pricing">missing</a>' +
          '<a href="/about#nope">bad anchor</a><a href="#top">top</a><img src="/logo.svg" alt="">' +
          '<form action="/_actions/contact/"></form><a href="https://example.com/x">external</a>',
      ),
    });
    const messages = (await findings(root, 'links/broken')).map((f) => f.message);
    expect(messages).toHaveLength(3);
    expect(messages.join('\n')).toMatch(/\/pricing[\s\S]*#nope[\s\S]*\/logo\.svg/);
  });

  it('i18n/single-locale-page: flags pages with no other-language versions on a multilingual site', async () => {
    const alternates = '<link rel="alternate" hreflang="es-ES" href="/es/">';
    const files = {
      'src/i18n/locales.mjs': "export const defaultLocale = 'en';\nexport const locales = ['en', 'es'];\n",
      'src/i18n/translations/es.ts': "export default { pricing: { title: 'Precios' } };\n",
      'src/i18n/ui.ts': "export const ui = { en: { nav: { home: 'Home' } }, es: { nav: { home: 'Inicio' } } };\n",
      'dist/index.html': page(alternates),
      'dist/pricing/index.html': page('<h1>Pricing</h1>'),
      'dist/404.html': page('<h1>Not found</h1>'),
      'dist/blog/hello/index.html': page('<meta property="og:type" content="article"><h1>Post</h1>'),
      'src/pages/legal.astro': `<!-- ${check.SINGLE_LANGUAGE} -->\n<h1>Legal</h1>\n`,
      'dist/legal/index.html': page('<h1>Legal</h1>'),
    };
    const [f, ...rest] = await findings(project(files), 'i18n/single-locale-page');
    expect(rest).toEqual([]);
    expect(f).toMatchObject({ severity: 'warning', file: 'dist/pricing/index.html' });
    expect(f.message).toContain('/es/');

    const single = project({ 'dist/pricing/index.html': page('<h1>Pricing</h1>') });
    expect(await findings(single, 'i18n/single-locale-page')).toEqual([]);
  });

  it('links/broken: accepts server-rendered routes, redirects and a base path', async () => {
    const root = project({
      'src/pages/dashboard.astro': '---\nexport const prerender = false;\n---\n<p>Dashboard</p>\n',
      'src/pages/users/[id].astro': '---\nexport const prerender = false;\n---\n',
      'src/pages/api/ping.ts': 'export const prerender = false;\nexport const GET = () => new Response();\n',
      'astro.config.mjs': "export default { redirects: { '/old': '/' } };\n",
      'dist/index.html': page(
        '<a href="/dashboard">a</a><a href="/users/42">b</a><a href="/api/ping">c</a><a href="/old">d</a><a href="/users">missing</a>',
      ),
    });
    const broken = (await findings(root, 'links/broken')).map((f) => f.message);
    expect(broken).toHaveLength(1);
    expect(broken[0]).toContain('/users');

    const withBase = project({
      'dist/index.html': page('<link rel="stylesheet" href="/docs/_astro/site.css"><a href="/docs/about/">ok</a><a href="/docs/nope/">bad</a>'),
      'dist/about/index.html': page('<h1>About</h1>'),
      'dist/_astro/site.css': '',
    });
    expect((await findings(withBase, 'links/broken')).map((f) => f.message)).toEqual([expect.stringContaining('/docs/nope/')]);
  });

  it('forms/stub: warns on marked stubs and on the TODOs older projects shipped', async () => {
    const root = project({
      'src/actions/index.ts':
        '// @velocity-stub contact\n      // TODO: subscribe the address with your provider\n',
    });
    const stubs = await findings(root, 'forms/stub');
    expect(stubs.map((f) => [f.severity, f.line, f.message.split(' ')[0]])).toEqual([
      ['warning', 1, 'actions.contact'],
      ['warning', 2, 'actions.newsletter'],
    ]);
  });

  it('forms/stub: stays quiet when the endpoint that turns forwarding on is set', async () => {
    const root = project({
      'src/actions/index.ts': '// @velocity-stub contact\n// @velocity-stub newsletter\n',
      '.env': 'CONTACT_FORM_ENDPOINT=https://hooks.example.com/contact\nNEWSLETTER_ENDPOINT=""\n',
    });
    const stubs = await findings(root, 'forms/stub');
    expect(stubs.map((f) => f.message.split(' ')[0])).toEqual(['actions.newsletter']);
    expect(stubs[0].message).toContain('NEWSLETTER_ENDPOINT');
  });

  it('ownership/edited: warns when a Velocity-owned file changed since the baseline', async () => {
    const root = project({
      'velocity-manifest.json': JSON.stringify({ files: { safe: ['src/lib/'] } }),
      'src/lib/blog.ts': 'export const a = 1;\n',
      'src/lib/utils.ts': 'export const b = 1;\n',
    });
    expect(check.writeBaseline(root)).toBe(2);
    expect(await findings(root, 'ownership/edited')).toEqual([]);
    fs.writeFileSync(path.join(root, 'src/lib/blog.ts'), 'export const a = 2;\n');
    const [f] = await findings(root, 'ownership/edited');
    expect(f).toMatchObject({ file: 'src/lib/blog.ts', severity: 'warning' });
  });

  describe('strings/hardcoded', () => {
    it('warns on text and UI attributes written into markup', async () => {
      const root = project({
        'src/views/PricingView.astro':
          '---\nconst x = "Not markup";\n---\n<section class="[&_:not(pre)>code]:px-1">\n  <h2>Choose a plan</h2>\n  <button aria-label="Close dialog">{t(\'pricing.title\')}</button>\n  <script>const y = "Not markup either";</script>\n</section>\n',
      });
      const hits = (await findings(root, 'strings/hardcoded')).map((f) => [f.line, f.message.split('"')[1]]);
      expect(hits).toEqual([
        [6, 'aria-label='],
        [5, 'Choose a plan'],
      ]);
    });

    it('scans pages, components in any folder and React islands', async () => {
      const root = project({
        'package.json': '{}',
        'src/pages/pricing.astro': '<h1>Simple pricing</h1>\n',
        'src/components/pricing/PlanCard.astro': '<button aria-label="Choose this plan">Choose</button>\n',
        'src/components/pricing/Toggle.tsx':
          'export default function Toggle() {\n  return <button title="Billing">Switch to yearly</button>;\n}\n',
      });
      const hits = (await findings(root, 'strings/hardcoded')).map((f) => `${f.file}:${f.line} ${f.message.split('"')[1]}`);
      expect(hits).toEqual(
        expect.arrayContaining([
          'src/pages/pricing.astro:1 Simple pricing',
          'src/components/pricing/PlanCard.astro:1 aria-label=',
          'src/components/pricing/Toggle.tsx:2 title=',
          'src/components/pricing/Toggle.tsx:2 Switch to yearly',
        ]),
      );
    });

    it("leaves Velocity's own files alone, but not files a project adds or edits there", async () => {
      const root = project({
        'velocity-manifest.json': JSON.stringify({ files: { safe: ['src/components/ui/'] } }),
        'src/components/ui/Card/Card.astro': '<p>Velocity text</p>\n',
        'src/components/ui/Edited/Edited.astro': '<p>Original</p>\n',
      });
      check.writeBaseline(root);
      fs.writeFileSync(path.join(root, 'src/components/ui/Edited/Edited.astro'), '<p>Edited by the project</p>\n');
      fs.mkdirSync(path.join(root, 'src/components/ui/PlanBadge'), { recursive: true });
      fs.writeFileSync(path.join(root, 'src/components/ui/PlanBadge/PlanBadge.astro'), '<span>Most popular</span>\n');
      const files = (await findings(root, 'strings/hardcoded')).map((f) => f.file).sort();
      expect(files).toEqual(['src/components/ui/Edited/Edited.astro', 'src/components/ui/PlanBadge/PlanBadge.astro']);
    });

    it('lets a deliberately single-language file opt out', async () => {
      const root = project({ 'src/views/Legal.astro': `<!-- ${check.ALLOW_HARDCODED} -->\n<p>Terms of service</p>\n` });
      expect(await findings(root, 'strings/hardcoded')).toEqual([]);
    });
  });

  it('--strict turns warnings into errors', async () => {
    const root = project({ 'src/actions/index.ts': '// @velocity-stub contact\n' });
    expect((await check.run(root)).ok).toBe(true);
    expect((await check.run(root, { strict: true })).ok).toBe(false);
  });
});
