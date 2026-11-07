#!/usr/bin/env node
/* eslint-disable no-console -- command-line script that prints its results */
/**
 * Turn raw.jsonl into summary.md.
 *
 *   node benchmark/summarize.mjs benchmark/results/2026-11-07-claude
 *
 * Every run counts: agent errors, timeouts and failed builds are failures, not
 * exclusions. Rates come with Wilson 95% intervals because n is small.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { median, parseArgs, wilson } from './lib/util.mjs';

/** Parse every record in a results folder's raw.jsonl, skipping blank lines. */
export function readRecords(dir) {
  const file = path.join(dir, 'raw.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** `k/n` as a percentage with its Wilson 95% interval, or 'n/a' when n is 0. */
const pct = (k, n) => {
  if (!n) return 'n/a';
  const [lo, hi] = wilson(k, n);
  return `${k}/${n} (${Math.round((100 * k) / n)}%, ${Math.round(lo * 100)}–${Math.round(hi * 100)})`;
};
/** Format a number to `digits` places, or 'n/a' when it is missing or not finite. */
const fmt = (v, digits = 0) =>
  v === null || v === undefined
    ? 'n/a'
    : Number(v).toLocaleString('en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
const med = (rows, get, digits = 0) => fmt(median(rows.map(get)), digits);

/** A Markdown table from a header row and data rows. */
function table(head, rows) {
  return [
    `| ${head.join(' | ')} |`,
    `|${head.map((_, i) => (i ? '---:' : '---')).join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

/** Group records into a Map by the value at `key`, keeping first-seen order. */
function group(records, key) {
  const m = new Map();
  for (const r of records) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

/** Total input tokens for a run, cache reads and writes included, or null when the agent didn't report them. */
const totalInput = (r) => {
  const a = r.agent ?? {};
  if (a.inputTokens === null || a.inputTokens === undefined) return null;
  return a.inputTokens + (a.cacheReadTokens ?? 0) + (a.cacheWriteTokens ?? 0);
};

/** Neutral metrics for a group of runs: task pass rate, build pass rate, axe-clean rate and median violations. */
function neutralRow(label, rs) {
  const built = rs.filter((r) => r.score?.build?.ok);
  const axeClean = built.filter((r) => r.score?.axe && r.score.axe.seriousOrCritical === 0);
  return [
    label,
    String(rs.length),
    pct(rs.filter((r) => r.score?.completion?.pass).length, rs.length),
    med(
      rs,
      (r) =>
        r.score?.completion?.checksTotal
          ? r.score.completion.checksPassed / r.score.completion.checksTotal
          : 0,
      2
    ),
    pct(built.length, rs.length),
    pct(axeClean.length, rs.length),
    med(built, (r) => r.score?.axe?.seriousOrCritical),
    med(built, (r) => r.score?.site?.brokenLinks?.length),
    pct(rs.filter((r) => !r.agent?.ok).length, rs.length),
  ];
}

/** Cost metrics for a group of runs: median cost, tokens, turns and duration. */
function costRow(label, rs) {
  const costs = rs.map((r) => r.agent?.costUsd).filter((c) => typeof c === 'number');
  return [
    label,
    String(rs.length),
    med(rs, (r) => r.agent?.turns),
    med(rs, totalInput),
    med(rs, (r) => r.agent?.outputTokens),
    med(rs, (r) => r.agent?.costUsd, 2),
    costs.length
      ? fmt(
          costs.reduce((a, b) => a + b, 0),
          2
        )
      : 'n/a',
    med(rs, (r) => (r.agent?.wallMs ?? 0) / 60_000, 1),
    med(rs, (r) => r.score?.diff?.filesChanged),
  ];
}

/** Velocity-specific metrics for a group of runs: CSP present, CSP violations and hreflang alternates. */
function velocityRow(label, rs) {
  const built = rs.filter((r) => r.score?.build?.ok && r.score?.velocitySpecific);
  const withCsp = built.filter((r) => r.score.velocitySpecific.cspPresent);
  const spanish = built.filter((r) => r.task === 'spanish');
  return [
    label,
    String(rs.length),
    pct(withCsp.length, built.length),
    withCsp.length
      ? pct(
          withCsp.filter((r) => r.score.velocitySpecific.cspViolations === 0).length,
          withCsp.length
        )
      : 'n/a (no CSP)',
    withCsp.length ? med(withCsp, (r) => r.score.velocitySpecific.cspViolations) : 'n/a',
    spanish.length
      ? pct(
          spanish.filter((r) => r.score.velocitySpecific.hreflangAlternates).length,
          spanish.length
        )
      : 'n/a',
  ];
}

/** Write summary.md for a results folder from its raw.jsonl and meta.json. Returns the Markdown. */
export function summarize(dir) {
  const records = readRecords(dir);
  const metaFile = path.join(dir, 'meta.json');
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  const arms = meta.arms ?? [...new Set(records.map((r) => r.arm))];
  const tasks = meta.tasks?.map((t) => t.id) ?? [...new Set(records.map((r) => r.task))];
  const byArm = group(records, (r) => r.arm);
  const byTaskArm = group(records, (r) => `${r.task}\u0000${r.arm}`);

  const out = [];
  out.push(`# Benchmark results: ${path.basename(dir)}`, '');
  out.push(`- Agent: \`${meta.agent?.template ?? 'unknown'}\``);
  out.push(
    `- Model: ${meta.agent?.model ?? 'unknown'}${meta.agent?.modelsReported?.length ? ` (reported by the agent: ${meta.agent.modelsReported.join(', ')})` : ''}`
  );
  out.push(
    `- Velocity: ${meta.velocity?.commit ?? meta.velocity?.ref ?? 'unknown'} (v${meta.velocity?.version ?? '?'}, variants ${meta.velocity?.variants?.join(', ') ?? '?'})${meta.velocity?.repoDirty ? ' — repo had uncommitted changes when run (scaffolded from the commit)' : ''}`
  );
  out.push(
    `- Astro arm: ${meta.astro?.source ?? 'unknown'}, astro ${meta.astro?.astroVersion ?? '?'}${meta.astro?.source === 'fallback' ? ' — **local stand-in for the minimal template; not comparable to published results**' : ''}`
  );
  out.push(
    `- Runs: ${records.length} of ${meta.plannedRuns ?? '?'} planned (${meta.repeats ?? '?'} repeats × ${tasks.length} tasks × ${arms.length} arms), order shuffled with seed ${meta.seed ?? '?'}`
  );
  out.push(
    `- Started ${meta.startedAt ?? '?'}, Node ${meta.node ?? '?'}, ${meta.platform ?? '?'}`,
    ''
  );

  if (!records.length) {
    out.push('_No runs recorded yet._', '');
    return out.join('\n');
  }

  out.push(
    'Rates are `passed/n (%, Wilson 95% interval)`. Medians are over all runs of the group; failed builds have no axe or link data and are excluded from those two medians only. ' +
      `With n = ${meta.repeats ?? '?'} per cell, intervals are wide: treat differences whose intervals overlap as noise.`,
    ''
  );

  out.push('## Neutral metrics', '', 'Apply equally to every arm.', '');
  const nHead = [
    'Arm',
    'n',
    'Task passed',
    'Median share of checks passed',
    'Build passed',
    'Built and 0 serious/critical axe issues',
    'Median axe serious/critical',
    'Median broken links',
    'Agent error/timeout',
  ];
  out.push(
    '### By arm (all tasks)',
    '',
    table(
      nHead,
      arms.map((a) => neutralRow(a, byArm.get(a) ?? []))
    ),
    ''
  );
  out.push('### By task', '');
  out.push(
    table(
      ['Task / arm', ...nHead.slice(1)],
      tasks.flatMap((t) =>
        arms.map((a) => neutralRow(`${t} / ${a}`, byTaskArm.get(`${t}\u0000${a}`) ?? []))
      )
    ),
    ''
  );

  out.push(
    '### Agent cost',
    '',
    'Tokens include cache reads and writes. `n/a` means the agent did not report the figure.',
    ''
  );
  const cHead = [
    'Arm',
    'n',
    'Median turns',
    'Median input tokens',
    'Median output tokens',
    'Median cost (USD)',
    'Total cost (USD)',
    'Median wall time (min)',
    'Median files changed',
  ];
  out.push(
    table(
      cHead,
      arms.map((a) => costRow(a, byArm.get(a) ?? []))
    ),
    ''
  );
  out.push(
    table(
      ['Task / arm', ...cHead.slice(1)],
      tasks.flatMap((t) =>
        arms.map((a) => costRow(`${t} / ${a}`, byTaskArm.get(`${t}\u0000${a}`) ?? []))
      )
    ),
    ''
  );

  out.push(
    '## Velocity-specific metrics',
    '',
    'Velocity ships a Content Security Policy and multilingual routing; plain Astro does not by default, so these columns compare the two Velocity arms with each other, not with the astro arm.',
    ''
  );
  out.push(
    table(
      [
        'Arm',
        'n',
        'CSP present (built runs)',
        'No CSP violations (of runs with a CSP)',
        'Median CSP violations',
        'Spanish task: hreflang alternates',
      ],
      arms.map((a) => velocityRow(a, byArm.get(a) ?? []))
    ),
    ''
  );

  out.push(
    '## Task diagnostics',
    '',
    'Continuous measures behind two pass/fail checks, for context.',
    ''
  );
  out.push(
    table(
      [
        'Arm',
        'Rebrand: median OKLab distance to #0F766E (pass ≤ 0.05)',
        'Contact: delivered from server / browser',
      ],
      arms.map((a) => {
        const rb = (byTaskArm.get(`rebrand\u0000${a}`) ?? []).filter((r) => r.score?.taskMetrics);
        const cf = (byTaskArm.get(`contact-form\u0000${a}`) ?? []).map(
          (r) => r.score?.taskMetrics?.deliveredFrom
        );
        return [
          a,
          rb.length ? med(rb, (r) => r.score.taskMetrics.brandColourDistance, 3) : 'n/a',
          cf.length
            ? `${cf.filter((x) => x === 'server').length} / ${cf.filter((x) => x === 'browser').length} of ${cf.length}`
            : 'n/a',
        ];
      })
    ),
    ''
  );

  out.push('## Failed checks', '', 'How often each required check failed, per arm.', '');
  const failRows = [];
  for (const t of tasks) {
    const ids = [
      ...new Set(
        records
          .filter((r) => r.task === t)
          .flatMap((r) =>
            (r.score?.completion?.checks ?? []).filter((c) => c.required).map((c) => c.id)
          )
      ),
    ];
    for (const id of ids) {
      failRows.push([
        `${t}: ${id}`,
        ...arms.map((a) => {
          const rs = byTaskArm.get(`${t}\u0000${a}`) ?? [];
          return `${rs.filter((r) => !(r.score?.completion?.checks ?? []).find((c) => c.id === id)?.ok).length}/${rs.length}`;
        }),
      ]);
    }
  }
  out.push(failRows.length ? table(['Check', ...arms], failRows) : '_No check data._', '');
  out.push(
    'Per-run details (agent output, diff, build and preview logs, crawl) are in `runs/<run-id>/`.',
    ''
  );
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs();
  const dir = args._[0];
  if (!dir) {
    console.error('Usage: node benchmark/summarize.mjs <results-dir>');
    process.exit(2);
  }
  const md = summarize(path.resolve(dir));
  fs.writeFileSync(path.join(dir, 'summary.md'), md + '\n');
  console.log(md);
}
