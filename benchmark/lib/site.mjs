/**
 * Build, serve and inspect a project in a real browser. Nothing here knows
 * about Velocity: the same code scores every arm.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanEnv,
  detectPackageManager,
  freePort,
  loadAxeBuilder,
  run,
  start,
  waitForHttp,
  walkFiles,
} from './util.mjs';

const NON_HTML =
  /\.(png|jpe?g|gif|webp|avif|svg|ico|xml|txt|json|webmanifest|pdf|zip|css|js|mjs|map|woff2?|ttf|mp4|webm)$/i;

/** Commands per package manager. Lockfiles may have changed during the agent run, so installs are not frozen. */
const PM = {
  pnpm: {
    install: ['pnpm', ['install', '--no-frozen-lockfile', '--prefer-offline']],
    build: ['pnpm', ['run', 'build']],
  },
  npm: {
    install: ['npm', ['install', '--no-audit', '--no-fund']],
    build: ['npm', ['run', 'build']],
  },
  yarn: { install: ['yarn', ['install']], build: ['yarn', ['run', 'build']] },
  bun: { install: ['bun', ['install']], build: ['bun', ['run', 'build']] },
};

/** Install dependencies with the project's package manager, then build. Returns { pm, ok, stage, installMs, buildMs, tail }, where stage is the step that ran last. */
export async function installAndBuild(dir, { logDir, timeoutMs = 15 * 60_000 } = {}) {
  const pm = detectPackageManager(dir);
  const env = cleanEnv({ CI: 'true', ASTRO_TELEMETRY_DISABLED: '1' });
  const [icmd, iargs] = PM[pm].install;
  const install = await run(icmd, iargs, {
    cwd: dir,
    env,
    timeoutMs,
    logFile: logDir && path.join(logDir, 'install.log'),
  });
  if (install.code !== 0) {
    return {
      pm,
      ok: false,
      stage: 'install',
      installMs: install.ms,
      buildMs: null,
      tail: tail(install),
    };
  }
  const [bcmd, bargs] = PM[pm].build;
  const build = await run(bcmd, bargs, {
    cwd: dir,
    env,
    timeoutMs,
    logFile: logDir && path.join(logDir, 'build.log'),
  });
  return {
    pm,
    ok: build.code === 0 && !build.timedOut,
    stage: 'build',
    installMs: install.ms,
    buildMs: build.ms,
    tail: build.code === 0 ? '' : tail(build),
  };
}

function tail(r, lines = 30) {
  return `${r.stdout}\n${r.stderr}`.trim().split('\n').slice(-lines).join('\n');
}

/**
 * Serve the build with `astro preview`, which handles static output and the
 * Node adapter alike (on-demand routes such as Astro Actions included).
 */
export async function startPreview(dir, { logDir } = {}) {
  const port = await freePort();
  const astroBin = path.join(dir, 'node_modules', 'astro', 'bin', 'astro.mjs');
  if (!fs.existsSync(astroBin))
    return { ok: false, error: 'astro is not installed in the project' };
  const proc = start(
    process.execPath,
    [astroBin, 'preview', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: dir,
      env: cleanEnv({ ASTRO_TELEMETRY_DISABLED: '1' }),
    }
  );
  const baseUrl = `http://127.0.0.1:${port}`;
  const up = await waitForHttp(`${baseUrl}/`, {
    timeoutMs: 60_000,
    isAlive: () => proc.child.exitCode === null,
  });
  const stop = async () => {
    await proc.stop();
    if (logDir) fs.writeFileSync(path.join(logDir, 'preview.log'), proc.output());
  };
  if (!up) {
    await stop();
    return {
      ok: false,
      error: `preview did not start:\n${proc.output().split('\n').slice(-20).join('\n')}`,
    };
  }
  return { ok: true, baseUrl, stop };
}

/** Pages present in the build output, as URL paths (catches pages nothing links to). */
export function builtPages(dir) {
  const dist = path.join(dir, 'dist');
  const roots = [path.join(dist, 'client'), dist].filter((d) => fs.existsSync(d));
  if (!roots.length) return [];
  const rootDir = roots[0];
  return walkFiles(rootDir, (p) => p.endsWith('.html'))
    .map((file) => path.relative(rootDir, file).split(path.sep).join('/'))
    .filter((rel) => !/^(404|500)(\/index)?\.html$/.test(rel) && !rel.startsWith('server/'))
    .map((rel) => '/' + rel.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, ''));
}

/** Runs in the browser: everything the assertions need from one page. */
function extractPage() {
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
  const clone = document.body ? document.body.cloneNode(true) : null;
  clone?.querySelectorAll('script, style, template, noscript').forEach((n) => n.remove());
  const isIn = (el, sel) => Boolean(el.closest(sel));
  const links = [...document.querySelectorAll('a[href]')].map((a) => ({
    href: a.href,
    text: norm(a.innerText || a.textContent || a.getAttribute('aria-label') || ''),
    label: norm(a.getAttribute('aria-label') || a.title || ''),
    hreflang: a.getAttribute('hreflang'),
    lang: a.getAttribute('lang'),
    inNav: isIn(a, 'nav, header, [role="navigation"], [role="banner"]'),
    inFooter: isIn(a, 'footer, [role="contentinfo"]'),
  }));
  // Language switchers built with <select> instead of links
  for (const opt of document.querySelectorAll('select option[value]')) {
    const v = opt.getAttribute('value');
    if (v && /^(\/|https?:)/.test(v)) {
      links.push({
        href: new URL(v, location.href).href,
        text: norm(opt.textContent),
        label: '',
        hreflang: opt.getAttribute('lang'),
        lang: opt.getAttribute('lang'),
        inNav: true,
        inFooter: false,
      });
    }
  }
  const controls = [...document.querySelectorAll('a[href], button, input[type="submit"]')].map(
    (el) => norm(el.innerText || el.value || el.getAttribute('aria-label') || '')
  );
  const jsonLdTypes = [];
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const walk = (o) => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (o && typeof o === 'object') {
          if (o['@type']) [].concat(o['@type']).forEach((t) => jsonLdTypes.push(String(t)));
          Object.values(o).forEach(walk);
        }
      };
      walk(JSON.parse(s.textContent));
    } catch {
      /* invalid JSON-LD is ignored */
    }
  }
  return {
    lang: document.documentElement.getAttribute('lang') ?? '',
    title: document.title,
    h1s: [...document.querySelectorAll('h1')].map((h) => norm(h.textContent)),
    text: norm(clone?.textContent ?? ''),
    visibleText: norm(document.body?.innerText ?? ''),
    links,
    controls,
    alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => ({
      hreflang: l.getAttribute('hreflang'),
      href: l.href,
    })),
    times: [...document.querySelectorAll('time[datetime]')].map((t) => t.getAttribute('datetime')),
    forms: [...document.querySelectorAll('form')].map((f) => ({
      hasEmail: Boolean(f.querySelector('input[type="email"], input[name*="mail" i]')),
    })),
    jsonLdTypes,
    cspMeta:
      document
        .querySelector('meta[http-equiv="content-security-policy" i]')
        ?.getAttribute('content') ?? null,
  };
}

/** Collects CSP violations on every page of a context. */
function cspInit() {
  window.__benchCsp = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__benchCsp.push({
      directive: e.effectiveDirective || e.violatedDirective,
      blocked: e.blockedURI,
      source: e.sourceFile,
      line: e.lineNumber,
      sample: e.sample,
    });
  });
}

export async function newContext(browser, options = {}) {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  await context.addInitScript(cspInit);
  return context;
}

/** Visit a page and record its status, content, CSP violations and errors. */
export async function inspect(context, url) {
  const page = await context.newPage();
  const consoleCsp = [];
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content[- ]Security[- ]Policy/i.test(m.text()))
      consoleCsp.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
  let record;
  try {
    const res = await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    const type = res?.headers()['content-type'] ?? '';
    if (!type.includes('html')) {
      record = { url, status: res?.status() ?? 0, html: false };
    } else {
      await page.waitForTimeout(400);
      const data = await page.evaluate(extractPage);
      const csp = await page.evaluate(() => window.__benchCsp ?? []);
      record = {
        url: page.url(),
        status: res.status(),
        html: true,
        cspHeader: res.headers()['content-security-policy'] ?? null,
        cspViolations: csp.length ? csp : consoleCsp.map((text) => ({ console: text })),
        jsErrors: errors,
        ...data,
      };
    }
  } catch (error) {
    record = { url, status: 0, html: false, error: String(error.message).slice(0, 300) };
  }
  await page.close();
  return record;
}

/** A normalized key for a URL's page: decoded path without trailing slash or index.html, so links and crawled pages match. */
export function pathKey(url) {
  const u = new URL(url);
  const p = decodeURI(u.pathname)
    .replace(/\/index\.html$/, '/')
    .replace(/\.html$/, '');
  return p.length > 1 ? p.replace(/\/+$/, '') : '/';
}

/**
 * Crawl same-origin links from `/`, plus every page in the build output.
 * Returns Map<pathKey, record>.
 */
export async function crawl(browser, baseUrl, { extraPaths = [], maxPages = 80 } = {}) {
  const context = await newContext(browser);
  const origin = new URL(baseUrl).origin;
  const pages = new Map();
  const queue = ['/', ...extraPaths].map((p) => new URL(p, baseUrl).href);
  const seen = new Set();
  while (queue.length && pages.size < maxPages) {
    const url = queue.shift();
    const key = pathKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    const record = await inspect(context, url);
    record.key = key;
    record.requested = url;
    pages.set(key, record);
    for (const link of record.links ?? []) {
      let u;
      try {
        u = new URL(link.href);
      } catch {
        continue;
      }
      if (u.origin !== origin || NON_HTML.test(u.pathname)) continue;
      u.hash = '';
      u.search = '';
      if (!seen.has(pathKey(u.href))) queue.push(u.href);
    }
  }
  await context.close();
  return pages;
}

/** Internal links that lead to an error status. */
export function brokenLinks(pages) {
  const broken = new Set();
  for (const page of pages.values()) {
    for (const link of page.links ?? []) {
      let key;
      try {
        if (new URL(link.href).origin !== new URL(page.url).origin) continue;
        key = pathKey(link.href);
      } catch {
        continue;
      }
      const target = pages.get(key);
      if (target && (target.status >= 400 || target.status === 0))
        broken.add(`${page.key} -> ${key} (${target.status})`);
    }
  }
  return [...broken];
}

/** axe-core WCAG 2 A/AA on each page, desktop and mobile, as Velocity's own e2e suite does. */
export async function axeAudit(browser, baseUrl, paths) {
  const AxeBuilder = loadAxeBuilder();
  const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
  const results = [];
  for (const p of paths) {
    for (const [device, viewport] of Object.entries(viewports)) {
      const context = await newContext(browser, { viewport });
      const page = await context.newPage();
      try {
        const res = await page.goto(new URL(p, baseUrl).href, {
          waitUntil: 'load',
          timeout: 30_000,
        });
        await page.waitForTimeout(300);
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          .exclude('astro-dev-toolbar')
          .analyze();
        const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        results.push({
          path: p,
          device,
          status: res?.status() ?? 0,
          seriousOrCritical: serious.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.length,
            targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
          })),
          moderateOrMinor: violations.length - serious.length,
        });
      } catch (error) {
        results.push({
          path: p,
          device,
          error: String(error.message).slice(0, 300),
          seriousOrCritical: [],
        });
      }
      await context.close();
    }
  }
  return results;
}

/** Optional: Lighthouse, only if a `lighthouse` CLI is on PATH. */
export async function lighthouse(url, chromePath) {
  const probe = await run('lighthouse', ['--version'], { timeoutMs: 20_000 });
  if (probe.code !== 0) return { available: false };
  const r = await run(
    'lighthouse',
    [
      url,
      '--output=json',
      '--quiet',
      `--chrome-path=${chromePath}`,
      '--chrome-flags=--headless=new --no-sandbox',
      '--only-categories=performance,accessibility,best-practices,seo',
    ],
    { timeoutMs: 180_000 }
  );
  try {
    const report = JSON.parse(r.stdout);
    return {
      available: true,
      version: probe.stdout.trim(),
      scores: Object.fromEntries(Object.entries(report.categories).map(([k, v]) => [k, v.score])),
    };
  } catch {
    return { available: true, error: tail(r, 10) };
  }
}
