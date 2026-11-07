/**
 * Task prompts (benchmark/tasks/*.md) and the automated checks that decide
 * whether each task was done. Checks look only at the built, served site
 * through a browser — never at file paths or framework conventions — so they
 * apply equally to every arm.
 *
 * Each check returns { id, ok, required, detail }. A task passes when every
 * required check passes. Non-required checks are reported, not scored.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BENCH_DIR } from './util.mjs';
import { newContext, pathKey } from './site.mjs';

/** Read the task prompts (front matter id and title, then the prompt body) from `dir`, in file order. */
export function loadTasks(dir = path.join(BENCH_DIR, 'tasks')) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!m) throw new Error(`${file}: missing front matter`);
      const meta = Object.fromEntries(
        m[1]
          .split('\n')
          .map((l) => l.match(/^(\w+):\s*(.*)$/))
          .filter(Boolean)
          .map(([, k, v]) => [k, v.trim()])
      );
      if (!CHECKS[meta.id]) throw new Error(`${file}: no checks defined for task id "${meta.id}"`);
      return {
        ...meta,
        file,
        template: m[2].trim(),
        sha256: crypto.createHash('sha256').update(raw).digest('hex'),
      };
    });
}

/** The exact prompt an agent receives. Placeholders are filled identically for every arm. */
export function renderPrompt(task, vars) {
  return task.template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`Task ${task.id}: no value for {{${k}}}`);
    return vars[k];
  });
}

// ---------------------------------------------------------------- helpers

/** Lower-case text and normalize apostrophes and whitespace, for forgiving text matching. */
const lc = (s) => (s ?? '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');
const has = (page, needle) => lc(page?.text).includes(lc(needle));
const check = (id, ok, detail = '', required = true) => ({ id, ok: Boolean(ok), required, detail });
/** Whether a crawled page loaded with a 2xx status and HTML. */
const ok200 = (p) => p && p.html && p.status >= 200 && p.status < 300;

/** The crawled page a link points at, or undefined for external or unparseable links. */
function linkTarget(pages, link) {
  try {
    return pages.get(pathKey(link.href));
  } catch {
    return undefined;
  }
}

/** A page reached from a home-page link whose text matches, or a page whose path matches. */
function findPage(pages, { linkText, pathRe }) {
  const home = pages.get('/');
  for (const link of home?.links ?? []) {
    if (linkText.test(link.text) || linkText.test(link.label)) {
      const t = linkTarget(pages, link);
      if (ok200(t) && t.key !== '/') return t;
    }
  }
  for (const p of pages.values()) if (ok200(p) && pathRe.test(p.key)) return p;
  return null;
}

/** Whether page `from` links to page `target` (optionally only links that pass `filter`). */
function linksTo(from, target, filter = () => true) {
  if (!from || !target) return false;
  return (from.links ?? []).some((l) => {
    try {
      return pathKey(l.href) === target.key && filter(l);
    } catch {
      return false;
    }
  });
}

const STOP_ES = new Set(
  'el la los las de del que y en un una para con por es nuestro nuestra nuestros su sus tu tus más como al lo se este esta sitio inicio bienvenido bienvenidos'.split(
    ' '
  )
);
const STOP_EN = new Set(
  'the and of to in for with is are your our on this that it be you we home welcome site'.split(' ')
);
/** Count Spanish and English marker words in text, to tell whether a page is actually in Spanish. */
function languageScore(text) {
  const words = lc(text).match(/[a-záéíóúñü]+/g) ?? [];
  let es = 0;
  let en = 0;
  for (const w of words) {
    if (STOP_ES.has(w)) es++;
    if (STOP_EN.has(w)) en++;
  }
  return { es, en };
}

// --------------------------------------------------------- browser checks

/** Runs in the page: nearest visible colour to the target (OKLab distance) and the fonts in use. */
function brandProbe(targetHex) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const toRgb = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a };
  };
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const oklab = ({ r, g, b }) => {
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const target = oklab(toRgb(targetHex));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let best = { distance: Infinity };
  for (const el of document.querySelectorAll('body *')) {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (
      rect.width * rect.height < 4 ||
      cs.visibility === 'hidden' ||
      cs.display === 'none' ||
      Number(cs.opacity) === 0
    )
      continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const candidates = [['background-color', cs.backgroundColor]];
    if (ownText) candidates.push(['color', cs.color]);
    if (parseFloat(cs.borderTopWidth) > 0) candidates.push(['border-color', cs.borderTopColor]);
    if (el instanceof SVGElement) candidates.push(['fill', cs.fill], ['stroke', cs.stroke]);
    for (const [prop, value] of candidates) {
      if (!value || value === 'none' || value === 'transparent') continue;
      const rgb = toRgb(value);
      if (rgb.a < 200) continue;
      const d = dist(oklab(rgb), target);
      if (d < best.distance)
        best = {
          distance: d,
          prop,
          value,
          element:
            el.tagName.toLowerCase() +
            (el.className && typeof el.className === 'string'
              ? '.' + el.className.split(/\s+/).slice(0, 3).join('.')
              : ''),
        };
    }
  }
  const first = (el) =>
    el
      ? getComputedStyle(el)
          .fontFamily.split(',')[0]
          .trim()
          .replace(/^["']|["']$/g, '')
      : null;
  const p = document.querySelector('main p, p');
  return {
    color: {
      ...best,
      distance: Number.isFinite(best.distance) ? Number(best.distance.toFixed(4)) : null,
    },
    fonts: {
      body: first(document.body),
      h1: first(document.querySelector('h1')),
      p: first(p),
      loaded: [...document.fonts]
        .filter((f) => f.status === 'loaded')
        .map((f) => f.family.replace(/^["']|["']$/g, '')),
    },
  };
}

const BRAND_HEX = '#0F766E';
const BRAND_TOLERANCE = 0.05; // OKLab distance; ~2.5x a just-noticeable difference

/** Rebrand checks: the brand colour is close to the requested one on the home page and Inter is the font in use. */
async function rebrandChecks(ctx) {
  const context = await newContext(ctx.browser);
  const page = await context.newPage();
  await page.goto(new URL('/', ctx.baseUrl).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const probe = await page.evaluate(brandProbe, BRAND_HEX);
  await context.close();
  const isInter = (f) => /^inter\b/i.test(f ?? '');
  const used = [probe.fonts.body, probe.fonts.p, probe.fonts.h1].filter((f) => f !== null);
  return {
    checks: [
      check(
        'brand colour #0F766E visible on home page',
        probe.color.distance !== null && probe.color.distance <= BRAND_TOLERANCE,
        `nearest ${probe.color.value ?? 'none'} (${probe.color.prop ?? '-'} on ${probe.color.element ?? '-'}), OKLab distance ${probe.color.distance} (tolerance ${BRAND_TOLERANCE})`
      ),
      check(
        'body, paragraph and heading text set in Inter',
        used.length > 0 && used.every(isInter),
        `body=${probe.fonts.body} p=${probe.fonts.p} h1=${probe.fonts.h1}`
      ),
      check(
        'an Inter web font actually loaded',
        probe.fonts.loaded.some(isInter),
        `loaded: ${[...new Set(probe.fonts.loaded)].join(', ') || 'none'}`
      ),
    ],
    metrics: { brandColourDistance: probe.color.distance, fonts: probe.fonts },
  };
}

/** Fill the first form with an email field, submit it, and wait for the mock endpoint. */
async function submitContactForm(ctx, page) {
  const token = `bench-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${token}@example.com`;
  const message = `Hello from the benchmark, reference ${token}. Please ignore.`;
  const form = page
    .locator('form:has(input[type="email"]), form:has(input[name*="mail" i])')
    .first();
  if ((await form.count()) === 0)
    return { submitted: false, detail: 'no form with an email field', token };
  const fields = form.locator('input, textarea, select');
  const n = await fields.count();
  for (let i = 0; i < n; i++) {
    const f = fields.nth(i);
    if (!(await f.isVisible().catch(() => false)) || !(await f.isEditable().catch(() => false)))
      continue; // skips honeypots
    const info = await f.evaluate((el) => ({
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute('type') || '').toLowerCase(),
      key: [
        el.name,
        el.id,
        el.getAttribute('placeholder'),
        el.getAttribute('autocomplete'),
        el.labels?.[0]?.textContent,
      ]
        .join(' ')
        .toLowerCase(),
      required: el.required,
    }));
    if (['submit', 'button', 'hidden', 'reset', 'image', 'file'].includes(info.type)) continue;
    if (info.type === 'checkbox' || info.type === 'radio') {
      if (info.required) await f.check().catch(() => {});
      continue;
    }
    if (info.tag === 'select') {
      await f.selectOption({ index: 1 }).catch(() => {});
      continue;
    }
    let value = 'Benchmark';
    if (info.type === 'email' || /mail/.test(info.key)) value = email;
    else if (info.tag === 'textarea' || /message|comment|body|enquiry|inquiry/.test(info.key))
      value = message;
    else if (/name/.test(info.key)) value = 'Bench Tester';
    else if (info.type === 'tel' || /phone|tel/.test(info.key)) value = '+15555550123';
    else if (info.type === 'url') value = 'https://example.com';
    else if (info.type === 'number') value = '1';
    await f.fill(value).catch(() => {});
  }
  ctx.mock.reset();
  const before = page.url();
  const submit = form
    .locator('button[type="submit"], button:not([type]), input[type="submit"]')
    .first();
  if ((await submit.count()) > 0) await submit.click().catch(() => {});
  else await form.evaluate((f) => f.requestSubmit()).catch(() => {});
  const deadline = Date.now() + 15_000;
  let hit;
  while (Date.now() < deadline && !hit) {
    hit = ctx.mock.requests.find(
      (r) =>
        r.method === 'POST' &&
        // Only the endpoint the prompt named counts, not any path on the mock server
        r.path.split('?')[0] === new URL(ctx.mock.url).pathname &&
        r.body.includes(email.split('@')[0]) &&
        r.body.includes(token)
    );
    if (!hit) await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1000);
  const after = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  return {
    submitted: true,
    token,
    email,
    message,
    hit,
    requests: ctx.mock.requests.length,
    navigated: page.url() !== before,
    confirmation: /thank|sent|received|success|got your message/i.test(after),
  };
}

/** Contact checks: submitting the form delivers JSON with name, email and message to the mock endpoint, and (optionally) the visitor sees a confirmation. */
async function contactChecks(ctx, contact) {
  if (!contact)
    return {
      checks: [
        check('message delivered to the form service', false, 'no contact page'),
        check('delivered as JSON with name, email and message', false, 'no contact page'),
        check('visitor sees a confirmation', false, 'no contact page', false),
      ],
      metrics: {},
    };
  const context = await newContext(ctx.browser);
  const page = await context.newPage();
  await page.goto(contact.url, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const r = await submitContactForm(ctx, page);
  const csp = await page.evaluate(() => window.__benchCsp ?? []).catch(() => []);
  await context.close();
  const json = r.hit?.json;
  const jsonOk =
    json &&
    typeof json === 'object' &&
    lc(JSON.stringify(json)).includes(r.token) &&
    ['name', 'email', 'message'].every((k) =>
      Object.keys(json).some((jk) => jk.toLowerCase() === k)
    );
  return {
    checks: [
      check(
        'message delivered to the form service',
        r.hit,
        r.hit
          ? `${r.hit.method} ${r.hit.path} (${r.hit.contentType}, origin ${r.hit.origin ?? 'server'})`
          : (r.detail ?? `no matching request (${r.requests ?? 0} received)`)
      ),
      check(
        'delivered as JSON with name, email and message',
        jsonOk,
        r.hit ? `body: ${r.hit.body.slice(0, 200)}` : 'not delivered'
      ),
      check(
        'visitor sees a confirmation',
        r.confirmation,
        r.navigated ? 'page navigated after submit' : '',
        false
      ),
    ],
    metrics: { deliveredFrom: r.hit ? (r.hit.origin ? 'browser' : 'server') : null },
    cspViolations: csp,
  };
}

// ------------------------------------------------------------------ tasks

/**
 * Per task: `run(ctx)` → { checks, audit: [paths for axe], metrics, velocitySpecific, cspViolations }.
 * ctx: { pages: Map, baseUrl, browser, mock }.
 */
export const CHECKS = {
  'pricing-page': async ({ pages }) => {
    const page = findPage(pages, { linkText: /pric/i, pathRe: /pric/i });
    const home = pages.get('/');
    const plans = ['Starter', 'Pro', 'Team'].filter((n) => has(page, n));
    const prices = [/\$\s?9(\.00)?(?!\d)/, /\$\s?29(\.00)?(?!\d)/, /\$\s?79(\.00)?(?!\d)/].filter(
      (re) => re.test(page?.text ?? '')
    );
    const ctas = (page?.controls ?? []).filter((t) =>
      /sign\s?-?up|get started|start|choose|subscribe|buy|join|try|select/i.test(t)
    );
    return {
      checks: [
        check('pricing page exists', page, page ? page.key : 'not found from home links or URL'),
        check(
          'page has exactly one h1',
          page?.h1s.length === 1,
          page ? `${page.h1s.length} h1` : ''
        ),
        check('all three plans named', plans.length === 3, `found: ${plans.join(', ') || 'none'}`),
        check('all three prices shown', prices.length === 3, `${prices.length}/3 prices`),
        check(
          'a sign-up button per plan',
          ctas.length >= 3,
          `${ctas.length} sign-up style links/buttons`
        ),
        check(
          'linked from the main menu',
          linksTo(home, page, (l) => l.inNav),
          'home page header/nav link'
        ),
      ],
      audit: page ? [page.key] : [],
    };
  },

  'faq-page': async ({ pages }) => {
    const page = findPage(pages, {
      linkText: /\bfaqs?\b|frequently|questions/i,
      pathRe: /faq|questions/i,
    });
    const home = pages.get('/');
    const questions = ['Do you offer refunds', 'Can I cancel at any time', 'Is there a free trial'];
    const answers = ['within 30 days', 'account settings', /14[- ]day free trial/i];
    const qFound = questions.filter((q) => has(page, q));
    const aFound = answers.filter((a) =>
      a instanceof RegExp ? a.test(page?.text ?? '') : has(page, a)
    );
    return {
      checks: [
        check('FAQ page exists', page, page ? page.key : 'not found from home links or URL'),
        check(
          'page has exactly one h1',
          page?.h1s.length === 1,
          page ? `${page.h1s.length} h1` : ''
        ),
        check('all three questions present', qFound.length === 3, `${qFound.length}/3`),
        check('all three answers present', aFound.length === 3, `${aFound.length}/3`),
        check(
          'linked from the footer',
          linksTo(home, page, (l) => l.inFooter),
          'home page footer link'
        ),
        check(
          'FAQPage structured data',
          page?.jsonLdTypes.includes('FAQPage'),
          page?.jsonLdTypes.join(', ') ?? '',
          false
        ),
      ],
      audit: page ? [page.key] : [],
    };
  },

  rebrand: async (ctx) => {
    const r = await rebrandChecks(ctx);
    // Contrast is site-wide after a colour change: audit a few more pages.
    const others = [...ctx.pages.values()]
      .filter((p) => ok200(p) && p.key !== '/')
      .map((p) => p.key)
      .sort()
      .slice(0, 4);
    return { ...r, audit: others };
  },

  spanish: async ({ pages }) => {
    const home = pages.get('/');
    const isEs = (p) => ok200(p) && /^es\b/i.test(p.lang);
    const esPages = [...pages.values()].filter(isEs);
    const switchLinks = (home?.links ?? []).filter((l) => isEs(linkTarget(pages, l)));
    const es = switchLinks.length
      ? linkTarget(pages, switchLinks[0])
      : (pages.get('/es') ?? esPages[0]);
    const back = (es?.links ?? []).some((l) => {
      const t = linkTarget(pages, l);
      return ok200(t) && /^en\b/i.test(t.lang);
    });
    const score = languageScore(es?.visibleText);
    const translated = es && home && es.visibleText !== home.visibleText && score.es > score.en;
    const hreflang = Boolean(
      home?.alternates.some((a) => /^es/i.test(a.hreflang)) &&
      es?.alternates.some((a) => /^en/i.test(a.hreflang))
    );
    return {
      checks: [
        check(
          'a Spanish page exists (html lang="es")',
          esPages.length > 0,
          `${esPages.length} Spanish page(s)${es ? `, e.g. ${es.key}` : ''}`
        ),
        check(
          'home page links to the Spanish version',
          switchLinks.length > 0,
          switchLinks[0] ? `"${switchLinks[0].text || switchLinks[0].label}"` : ''
        ),
        check('Spanish page links back to English', back, ''),
        check(
          'Spanish page content is in Spanish',
          translated,
          es ? `Spanish/English function words: ${score.es}/${score.en}` : ''
        ),
      ],
      audit: es ? [es.key] : [],
      metrics: {
        spanishPages: esPages.length,
        englishPages: [...pages.values()].filter((p) => ok200(p) && /^en\b/i.test(p.lang)).length,
      },
      velocitySpecific: { hreflangAlternates: hreflang },
    };
  },

  'contact-form': async (ctx) => {
    const page = findPage(ctx.pages, { linkText: /contact|get in touch/i, pathRe: /contact/i });
    const contact = page && page.forms.some((f) => f.hasEmail) ? page : null;
    const r = await contactChecks(ctx, contact);
    return {
      checks: [
        check(
          'contact page with a form exists',
          contact,
          page ? `${page.key}${contact ? '' : ' (no form with an email field)'}` : 'not found'
        ),
        ...r.checks,
      ],
      audit: page ? [page.key] : [],
      metrics: r.metrics,
      cspViolations: r.cspViolations,
    };
  },

  'blog-post': async ({ pages }) => {
    const all = [...pages.values()].filter(ok200);
    const post = all.find((p) => p.h1s.some((h) => /four[- ]day week/i.test(h)));
    const body = ['It never came', 'written updates', 'three-month trial'].filter((s) =>
      has(post, s)
    );
    const dated =
      post &&
      (/(2(nd)?\s+nov(ember|\.)?,?\s+2026|nov(ember|\.)?\s+2(nd)?,?\s+2026|2026-11-02|11\/0?2\/2026|0?2\/11\/2026)/i.test(
        post.text
      ) ||
        post.times.some((t) => t.startsWith('2026-11-02')));
    const index = findPage(pages, { linkText: /^blog$|^news$|^articles$/i, pathRe: /^\/blog$/i });
    return {
      checks: [
        check(
          'post page exists with the title as h1',
          post,
          post ? post.key : 'no page with that h1'
        ),
        check('full post text present', body.length === 3, `${body.length}/3 paragraphs`),
        check('post shows its date (2 November 2026)', dated, post?.times.join(', ') ?? ''),
        check(
          'blog page lists the post',
          index && index !== post && linksTo(index, post),
          index ? `blog page ${index.key}` : 'no blog page found'
        ),
        check(
          'post has exactly one h1',
          post?.h1s.length === 1,
          post ? `${post.h1s.length} h1` : '',
          false
        ),
      ],
      audit: [post?.key, index?.key].filter(Boolean),
    };
  },
};

/** Run one task's checks and return a normalised result. */
export async function runTaskChecks(taskId, ctx) {
  try {
    const r = await CHECKS[taskId](ctx);
    const required = r.checks.filter((c) => c.required);
    return {
      pass: required.every((c) => c.ok),
      checksPassed: required.filter((c) => c.ok).length,
      checksTotal: required.length,
      checks: r.checks,
      audit: r.audit ?? [],
      metrics: r.metrics ?? {},
      velocitySpecific: r.velocitySpecific ?? {},
      cspViolations: r.cspViolations ?? [],
    };
  } catch (error) {
    return {
      pass: false,
      checksPassed: 0,
      checksTotal: null,
      checks: [],
      audit: [],
      metrics: {},
      velocitySpecific: {},
      cspViolations: [],
      error: String(error.stack ?? error).slice(0, 1000),
    };
  }
}
