#!/usr/bin/env node
/* eslint-disable no-console -- command-line script that prints its results */
/**
 * Score a project for one or more benchmark tasks.
 *
 *   node benchmark/score.mjs --project /path/to/site --task pricing-page
 *   node benchmark/score.mjs --project /path/to/site --task all --json out.json
 *
 * Independent of Velocity's own tooling: it installs, builds, serves the site
 * with `astro preview`, and inspects it in Chromium (crawl, task checks, axe,
 * CSP violation events). The same code scores every arm.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MOCK_PORT, startMockEndpoint } from './lib/mock-endpoint.mjs';
import {
  axeAudit,
  brokenLinks,
  builtPages,
  crawl,
  installAndBuild,
  lighthouse,
  startPreview,
} from './lib/site.mjs';
import { loadTasks, runTaskChecks } from './lib/tasks.mjs';
import { loadChromium, parseArgs, run, writeJson } from './lib/util.mjs';

/** Size of the agent's change, from the baseline commit the runner made. */
async function diffStats(dir, logDir) {
  if (!fs.existsSync(path.join(dir, '.git'))) return null;
  const git = (...a) =>
    run('git', ['-C', dir, '-c', 'core.quotepath=off', ...a], { timeoutMs: 60_000 });
  await git('add', '-A');
  const stat = await git('diff', '--cached', '--shortstat', 'HEAD');
  const names = await git('diff', '--cached', '--name-only', 'HEAD');
  if (logDir) {
    const patch = await git(
      'diff',
      '--cached',
      'HEAD',
      '--',
      '.',
      ':(exclude)*.lock',
      ':(exclude)*lock.yaml',
      ':(exclude)package-lock.json'
    );
    fs.writeFileSync(path.join(logDir, 'agent.diff'), patch.stdout);
  }
  const num = (re) => Number(stat.stdout.match(re)?.[1] ?? 0);
  return {
    filesChanged: num(/(\d+) files? changed/),
    insertions: num(/(\d+) insertions?/),
    deletions: num(/(\d+) deletions?/),
    files: names.stdout.split('\n').filter(Boolean).slice(0, 200),
  };
}

/**
 * @param {string} dir project directory
 * @param {string[]} taskIds
 * @param {{ mock?: object, mockPort?: number, logDir?: string, lighthouse?: boolean, skipInstall?: boolean }} options
 * @returns {Promise<Record<string, object>>} one score per task id
 */
export async function scoreProject(dir, taskIds, options = {}) {
  const logDir = options.logDir;
  if (logDir) fs.mkdirSync(logDir, { recursive: true });
  const started = Date.now();
  const diff = await diffStats(dir, logDir);
  const build = await installAndBuild(dir, { logDir });
  const base = { scorerVersion: 1, diff, build };

  if (!build.ok) {
    return Object.fromEntries(
      taskIds.map((id) => [
        id,
        {
          ...base,
          completion: {
            pass: false,
            checksPassed: 0,
            checksTotal: null,
            checks: [],
            reason: `${build.stage} failed`,
          },
          axe: null,
          site: null,
          velocitySpecific: null,
        },
      ])
    );
  }

  const ownMock = !options.mock;
  const mock = options.mock ?? (await startMockEndpoint(options.mockPort ?? DEFAULT_MOCK_PORT));
  const preview = await startPreview(dir, { logDir });
  const chromium = loadChromium();
  const browser = await chromium.launch();
  const out = {};
  try {
    if (!preview.ok) {
      for (const id of taskIds)
        out[id] = {
          ...base,
          serve: { ok: false, error: preview.error },
          completion: {
            pass: false,
            checksPassed: 0,
            checksTotal: null,
            checks: [],
            reason: 'preview failed',
          },
          axe: null,
          site: null,
          velocitySpecific: null,
        };
      return out;
    }
    const pages = await crawl(browser, preview.baseUrl, { extraPaths: builtPages(dir) });
    const htmlPages = [...pages.values()].filter((p) => p.html);
    const home = pages.get('/');
    const crawlCsp = htmlPages.flatMap((p) =>
      (p.cspViolations ?? []).map((v) => ({ page: p.key, ...v }))
    );
    const cspPresent = htmlPages.some((p) => p.cspMeta || p.cspHeader);
    const site = {
      homeOk: Boolean(home && home.status === 200),
      pagesFound: htmlPages.filter((p) => p.status === 200).length,
      brokenLinks: brokenLinks(pages),
      jsErrors: htmlPages.flatMap((p) => (p.jsErrors ?? []).map((e) => `${p.key}: ${e}`)),
    };
    if (logDir)
      writeJson(
        path.join(logDir, 'crawl.json'),
        htmlPages.map(({ text, visibleText: _visibleText, ...rest }) => ({
          ...rest,
          textLength: text?.length,
        }))
      );

    const axeCache = new Map();
    let lh = null;
    if (options.lighthouse) lh = await lighthouse(`${preview.baseUrl}/`, chromium.executablePath());

    for (const id of taskIds) {
      const result = await runTaskChecks(id, { pages, baseUrl: preview.baseUrl, browser, mock });
      const auditPaths = [...new Set(['/', ...result.audit])];
      const missing = auditPaths.filter((p) => !axeCache.has(p));
      for (const r of await axeAudit(browser, preview.baseUrl, missing)) {
        if (!axeCache.has(r.path)) axeCache.set(r.path, []);
        axeCache.get(r.path).push(r);
      }
      const axeResults = auditPaths.flatMap((p) => axeCache.get(p) ?? []);
      const rules = new Set(
        axeResults.flatMap((r) => r.seriousOrCritical.map((v) => `${r.path} ${v.id}`))
      );
      const csp = [
        ...crawlCsp,
        ...result.cspViolations.map((v) => ({ page: 'form-submit', ...v })),
      ];
      out[id] = {
        ...base,
        serve: { ok: true },
        completion: {
          pass: result.pass,
          checksPassed: result.checksPassed,
          checksTotal: result.checksTotal,
          checks: result.checks,
          error: result.error,
        },
        taskMetrics: result.metrics,
        axe: {
          pages: auditPaths,
          // Distinct (page, rule) pairs with serious or critical impact, across desktop and mobile
          seriousOrCritical: rules.size,
          violations: [...rules],
          errors: axeResults.filter((r) => r.error).map((r) => `${r.path} ${r.device}: ${r.error}`),
        },
        site,
        lighthouse: lh,
        // Only meaningful for projects that ship a CSP (plain Astro does not by default)
        velocitySpecific: {
          cspPresent,
          cspViolations: csp.length,
          cspDetails: csp.slice(0, 20),
          ...result.velocitySpecific,
        },
        scoreMs: Date.now() - started,
      };
    }
  } finally {
    await browser.close();
    await preview.stop?.();
    if (ownMock) await mock.stop();
  }
  return out;
}

/** Print one task's score: required checks passed, build, axe and CSP results. */
function printScore(id, s) {
  const c = s.completion;
  console.log(
    `\n■ ${id}: ${c.pass ? 'PASS' : 'FAIL'} (${c.checksPassed}/${c.checksTotal ?? '?'} required checks)${c.reason ? ` — ${c.reason}` : ''}`
  );
  console.log(`  build: ${s.build.ok ? 'ok' : `FAILED at ${s.build.stage}`} (${s.build.pm})`);
  for (const ch of c.checks)
    console.log(
      `  ${ch.ok ? '✓' : '✗'} ${ch.id}${ch.required ? '' : ' (not scored)'}${ch.detail ? ` — ${ch.detail}` : ''}`
    );
  if (s.axe)
    console.log(
      `  axe serious/critical (page, rule) pairs: ${s.axe.seriousOrCritical} on ${s.axe.pages.join(', ')}${s.axe.violations.length ? `\n    ${s.axe.violations.join('\n    ')}` : ''}`
    );
  if (s.site)
    console.log(
      `  pages: ${s.site.pagesFound}, broken internal links: ${s.site.brokenLinks.length}, JS errors: ${s.site.jsErrors.length}`
    );
  if (s.velocitySpecific)
    console.log(
      `  [velocity-specific] CSP present: ${s.velocitySpecific.cspPresent}, CSP violations: ${s.velocitySpecific.cspViolations}${s.velocitySpecific.hreflangAlternates !== undefined ? `, hreflang alternates: ${s.velocitySpecific.hreflangAlternates}` : ''}`
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs();
  if (!args.project) {
    console.error(
      'Usage: node benchmark/score.mjs --project <dir> [--task <id>|all] [--json <file>] [--log-dir <dir>] [--mock-port 4599] [--lighthouse]'
    );
    process.exit(2);
  }
  const tasks = loadTasks();
  const ids =
    !args.task || args.task === 'all' ? tasks.map((t) => t.id) : String(args.task).split(',');
  const dir = path.resolve(args.project);
  const scores = await scoreProject(dir, ids, {
    mockPort: args['mock-port'] ? Number(args['mock-port']) : undefined,
    logDir: args['log-dir'],
    lighthouse: Boolean(args.lighthouse),
  });
  for (const [id, s] of Object.entries(scores)) printScore(id, s);
  if (args.json) writeJson(path.resolve(args.json), scores);
}

export { printScore };
