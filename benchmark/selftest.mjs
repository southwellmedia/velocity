#!/usr/bin/env node
/* eslint-disable no-console -- command-line script that prints its results */
/**
 * Self-test: proves the scorer can tell done from not done, without running
 * a model.
 *
 *   node benchmark/selftest.mjs                 # everything below
 *   node benchmark/selftest.mjs --skip-pipeline # skip the run.mjs end-to-end check
 *
 * 1. Unit checks: command-template splitting, agent output parsing, prompts.
 * 2. Negative control: a freshly scaffolded Velocity project, untouched. Every
 *    task must FAIL, while build, axe and CSP must be clean.
 * 2b. Reference: Velocity's own --i18n scaffold must pass the Spanish checks,
 *    so they don't penalise how Velocity builds a language switcher.
 * 3. Ablation arm: only the agent files differ from the velocity arm.
 * 4. Negative control: a fresh plain Astro project. Every task must FAIL.
 * 5. Positive control: the plain Astro project plus a hand-written solution to
 *    all six tasks (selftest/fixtures/astro-all-tasks). Every task must PASS.
 *    This shows the checks are achievable without Velocity.
 * 6. Pipeline: run.mjs with a no-op agent, one repeat of one task per arm,
 *    writing raw.jsonl and summary.md to a temp directory.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildArgv, parseAgentOutput, PRESETS } from './lib/agent.mjs';
import { AGENT_FILES, cloneForRun, createArm, parseVelocityOptions } from './lib/arms.mjs';
import { endpointUrl, startMockEndpoint } from './lib/mock-endpoint.mjs';
import { loadTasks, renderPrompt } from './lib/tasks.mjs';
import { BENCH_DIR, parseArgs, REPO_DIR, run, walkFiles, writeJson } from './lib/util.mjs';
import { printScore, scoreProject } from './score.mjs';

const args = parseArgs();
const work = path.resolve(
  args['work-dir'] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'velocity-bench-selftest-'))
);
const mockPort = Number(args['mock-port'] ?? 4598);
const results = [];
const notes = [];

/** Record and print one self-test assertion. */
function expect(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const astroVersion = JSON.parse(
  fs.readFileSync(path.join(REPO_DIR, 'package.json'), 'utf8')
).dependencies.astro.replace(/^[^\d]*/, '');
const tasks = loadTasks();
const taskIds = tasks.map((t) => t.id);

// ------------------------------------------------------------------- 1
console.log('\n1. Unit checks');
{
  const argv = buildArgv(PRESETS.claude, { prompt: `It's "quoted" & $HOME`, model: 'm-1' });
  expect(
    'prompt passes through the template as one argument, unexpanded',
    argv[2] === `It's "quoted" & $HOME` &&
      argv[0] === 'claude' &&
      argv[argv.indexOf('--model') + 1] === 'm-1',
    JSON.stringify(argv.slice(0, 5))
  );
  const quoted = buildArgv(`agent --flag 'a b' "{prompt}"`, { prompt: 'x y' });
  expect(
    'quoted template arguments stay whole',
    JSON.stringify(quoted) === JSON.stringify(['agent', '--flag', 'a b', 'x y']),
    JSON.stringify(quoted)
  );

  const claude = parseAgentOutput(
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      num_turns: 7,
      duration_ms: 1234,
      total_cost_usd: 0.42,
      usage: {
        input_tokens: 10,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 30,
        output_tokens: 40,
      },
      modelUsage: { 'claude-x': {} },
    })
  );
  expect(
    'parses Claude Code JSON output',
    claude.turns === 7 &&
      claude.costUsd === 0.42 &&
      claude.inputTokens === 10 &&
      claude.cacheReadTokens === 30 &&
      claude.outputTokens === 40 &&
      claude.modelsReported[0] === 'claude-x' &&
      claude.isError === false
  );
  const codex = parseAgentOutput(
    [
      '{"type":"thread.started"}',
      '{"type":"item.completed","item":{"type":"command_execution"}}',
      '{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":50,"output_tokens":9}}',
    ].join('\n')
  );
  expect(
    'parses Codex JSONL events',
    codex.format === 'codex-events' &&
      codex.inputTokens === 100 &&
      codex.cacheReadTokens === 50 &&
      codex.outputTokens === 9 &&
      codex.toolCalls === 1
  );
  expect(
    'unparseable output gives nulls, not zeros',
    parseAgentOutput('not json').turns === null && parseAgentOutput('').costUsd === null
  );

  const prompts = tasks.map((t) => renderPrompt(t, { CONTACT_ENDPOINT: endpointUrl(4599) }));
  expect(
    'six tasks load and render',
    tasks.length === 6 && prompts.every((p) => p.length > 40 && !p.includes('{{')),
    taskIds.join(', ')
  );
  expect(
    'prompts never mention Velocity, Astro or agent files',
    prompts.every((p) => !/velocity|astro|agents?\.md|claude|skill/i.test(p))
  );
}

// ------------------------------------------------------------------- 2
const mock = await startMockEndpoint(mockPort);
/** Score `dir` against every task, printing per-task results with --verbose. */
const scoreAll = async (dir, label) => {
  const scores = await scoreProject(dir, taskIds, { mock, logDir: path.join(work, 'logs', label) });
  if (args.verbose) for (const [id, s] of Object.entries(scores)) printScore(id, s);
  writeJson(path.join(work, 'logs', label, 'scores.json'), scores);
  return scores;
};
const describeFails = (scores) =>
  Object.entries(scores)
    .map(([id, s]) => `${id} ${s.completion.checksPassed}/${s.completion.checksTotal}`)
    .join(', ');

try {
  console.log(`\n2. Negative control: untouched Velocity project (work dir ${work})`);
  const velocityOptions = parseVelocityOptions(args['velocity-options']);
  const vBase = path.join(work, 'base-velocity', 'site');
  const vMeta = await createArm('velocity', vBase, {
    ref: args['velocity-ref'] ?? 'HEAD',
    velocityOptions,
    logDir: path.join(work, 'logs', 'setup-velocity'),
  });
  console.log(
    `  scaffolded ${vMeta.commit?.slice(0, 7) ?? vMeta.ref} (v${vMeta.version}, variants ${vMeta.variants.join(', ')})`
  );
  expect('benchmark/ is not shipped to the project', !fs.existsSync(path.join(vBase, 'benchmark')));
  expect(
    'agent files present in the velocity arm',
    ['AGENTS.md', '.agents/velocity.md', '.claude/skills'].every((f) =>
      fs.existsSync(path.join(vBase, f))
    )
  );
  const vRun = path.join(work, 'run-velocity', 'site');
  await cloneForRun(vBase, vRun);
  const vScores = await scoreAll(vRun, 'velocity-baseline');
  const any = Object.values(vScores);
  expect(
    'build passes',
    any.every((s) => s.build.ok),
    any[0].build.ok ? '' : any[0].build.tail
  );
  expect(
    'every task fails (nothing was done)',
    any.every((s) => !s.completion.pass),
    describeFails(vScores)
  );
  expect(
    'no required check passes by accident',
    any.every((s) => s.completion.checksPassed === 0),
    describeFails(vScores)
  );
  expect(
    '0 serious/critical axe issues on audited pages',
    any.every((s) => s.axe?.seriousOrCritical === 0),
    [...new Set(any.flatMap((s) => s.axe?.violations ?? []))].join('; ')
  );
  expect(
    'CSP detected',
    any.every((s) => s.velocitySpecific?.cspPresent)
  );
  expect(
    '0 CSP violations observed',
    any.every((s) => s.velocitySpecific?.cspViolations === 0),
    JSON.stringify(any[0].velocitySpecific?.cspDetails ?? []).slice(0, 300)
  );
  expect(
    'home page and crawl work',
    any[0].site?.homeOk && any[0].site.pagesFound >= 2 && any[0].site.brokenLinks.length === 0,
    `${any[0].site?.pagesFound} pages, ${any[0].site?.brokenLinks.length} broken links`
  );
  expect(
    'diff is empty before any agent runs',
    vScores[taskIds[0]].diff?.filesChanged === 0,
    JSON.stringify(vScores[taskIds[0]].diff?.files ?? [])
  );

  console.log(
    '\n2b. Reference: Velocity scaffolded with --i18n (es + fr) must pass the Spanish checks'
  );
  const iBase = path.join(work, 'base-velocity-i18n', 'site');
  await createArm('velocity', iBase, {
    ref: args['velocity-ref'] ?? 'HEAD',
    velocityOptions: { ...velocityOptions, i18n: true },
    logDir: path.join(work, 'logs', 'setup-velocity-i18n'),
  });
  const iScores = await scoreProject(iBase, ['spanish'], {
    mock,
    logDir: path.join(work, 'logs', 'velocity-i18n'),
  });
  const sp = iScores.spanish;
  expect(
    "Velocity's own Spanish output passes (no bias against its language switcher)",
    sp.completion.pass,
    sp.completion.checks
      .filter((c) => !c.ok)
      .map((c) => c.id)
      .join('; ')
  );
  expect('hreflang alternates detected', sp.velocitySpecific?.hreflangAlternates === true);

  // ----------------------------------------------------------------- 3
  console.log('\n3. Ablation arm: velocity-no-agent-files');
  const nBase = path.join(work, 'base-velocity-no-agent-files', 'site');
  const nMeta = await createArm('velocity-no-agent-files', nBase, {
    ref: args['velocity-ref'] ?? 'HEAD',
    velocityOptions,
    logDir: path.join(work, 'logs', 'setup-no-agent'),
  });
  const files = (d) => new Set(walkFiles(d).map((f) => path.relative(d, f)));
  const vFiles = files(vBase);
  const nFiles = files(nBase);
  const onlyInV = [...vFiles].filter((f) => !nFiles.has(f));
  const onlyInN = [...nFiles].filter((f) => !vFiles.has(f));
  const isAgentFile = (f) => AGENT_FILES.some((a) => f === a || f.startsWith(a + path.sep));
  expect(
    'removes AGENTS.md, CLAUDE.md, .agents/, .claude/',
    ['AGENTS.md', 'CLAUDE.md', '.agents', '.claude'].every(
      (f) => nMeta.removedAgentFiles.includes(f) && !fs.existsSync(path.join(nBase, f))
    ),
    nMeta.removedAgentFiles.join(', ')
  );
  expect(
    'nothing else differs from the velocity arm',
    onlyInN.length === 0 && onlyInV.every(isAgentFile),
    `${onlyInV.length} files removed: ${onlyInV.filter((f) => !isAgentFile(f)).join(', ') || 'all agent files'}`
  );

  // ----------------------------------------------------------------- 4
  console.log('\n4. Negative control: untouched plain Astro project');
  const aBase = path.join(work, 'base-astro', 'site');
  const aMeta = await createArm('astro', aBase, {
    createAstroVersion: args['create-astro-version'] ?? 'latest',
    allowFallback: true,
    fallbackAstroVersion: astroVersion,
    logDir: path.join(work, 'logs', 'setup-astro'),
  });
  if (aMeta.source === 'fallback') {
    const note = `npm create astro could not download the minimal template, so the local stand-in was used (astro ${aMeta.astroVersion}). Error: ${aMeta.createError?.replace(/\s+/g, ' ').slice(0, 200)}`;
    notes.push(note);
    console.log(`  ⚠ ${note}`);
  } else {
    console.log(`  created with npm create astro (astro ${aMeta.astroVersion})`);
  }
  const aRun = path.join(work, 'run-astro', 'site');
  await cloneForRun(aBase, aRun);
  const aScores = await scoreAll(aRun, 'astro-baseline');
  const aAny = Object.values(aScores);
  expect(
    'build passes',
    aAny.every((s) => s.build.ok),
    aAny[0].build.ok ? '' : aAny[0].build.tail
  );
  expect(
    'every task fails (nothing was done)',
    aAny.every((s) => !s.completion.pass),
    describeFails(aScores)
  );
  expect(
    'no CSP (so CSP metrics are n/a for this arm)',
    aAny.every((s) => s.velocitySpecific?.cspPresent === false)
  );
  console.log(
    `  (info) axe serious/critical on the bare template: ${aAny[0].axe?.seriousOrCritical} ${aAny[0].axe?.violations.join(', ')}`
  );

  // ----------------------------------------------------------------- 5
  console.log('\n5. Positive control: plain Astro + hand-written solution to every task');
  const pRun = path.join(work, 'run-astro-solved', 'site');
  await cloneForRun(aBase, pRun);
  const fixture = path.join(BENCH_DIR, 'selftest', 'fixtures', 'astro-all-tasks');
  for (const file of walkFiles(fixture)) {
    const rel = path.relative(fixture, file);
    fs.mkdirSync(path.dirname(path.join(pRun, rel)), { recursive: true });
    fs.writeFileSync(
      path.join(pRun, rel),
      fs.readFileSync(file, 'utf8').replaceAll('{{CONTACT_ENDPOINT}}', mock.url)
    );
  }
  const add = await run(
    'npm',
    ['install', '--no-audit', '--no-fund', '@fontsource-variable/inter@5'],
    { cwd: pRun, timeoutMs: 5 * 60_000 }
  );
  expect(
    'fixture dependency installed (@fontsource-variable/inter, into the temp project only)',
    add.code === 0,
    add.code === 0 ? '' : add.stderr.slice(-300)
  );
  const pScores = await scoreAll(pRun, 'astro-solved');
  for (const [id, s] of Object.entries(pScores)) {
    const failed = s.completion.checks
      .filter((c) => c.required && !c.ok)
      .map((c) => `${c.id} (${c.detail})`);
    expect(
      `${id} passes`,
      s.completion.pass,
      failed.join('; ') || `${s.completion.checksPassed}/${s.completion.checksTotal}`
    );
  }
  const pAny = Object.values(pScores);
  expect(
    'solved site has 0 serious/critical axe issues',
    pAny.every((s) => s.axe?.seriousOrCritical === 0),
    [...new Set(pAny.flatMap((s) => s.axe?.violations ?? []))].join('; ')
  );
  expect(
    'diff is measured',
    pScores[taskIds[0]].diff?.filesChanged > 0,
    `${pScores[taskIds[0]].diff?.filesChanged} files`
  );
  expect(
    'message reached the mock from the browser',
    pScores['contact-form'].taskMetrics?.deliveredFrom === 'browser'
  );
} finally {
  await mock.stop();
}

// ------------------------------------------------------------------- 6
if (!args['skip-pipeline']) {
  console.log('\n6. Pipeline: run.mjs with a no-op agent');
  const out = path.join(work, 'pipeline-results');
  const r = await run(
    process.execPath,
    [
      path.join(BENCH_DIR, 'run.mjs'),
      '--agent-cmd',
      `${process.execPath} ${path.join(BENCH_DIR, 'selftest', 'noop-agent.mjs')} {prompt}`,
      '--model',
      'noop',
      '--repeats',
      '1',
      '--tasks',
      'pricing-page',
      '--out',
      out,
      '--work-dir',
      path.join(work, 'pipeline-work'),
      '--allow-astro-fallback',
      '--seed',
      '1',
      '--mock-port',
      String(mockPort + 1),
    ],
    { timeoutMs: 20 * 60_000, logFile: path.join(work, 'logs', 'pipeline.log') }
  );
  expect(
    'run.mjs exits 0',
    r.code === 0,
    r.code === 0 ? '' : `${r.stdout}\n${r.stderr}`.split('\n').slice(-15).join('\n')
  );
  const raw = fs.existsSync(path.join(out, 'raw.jsonl'))
    ? fs
        .readFileSync(path.join(out, 'raw.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
    : [];
  expect(
    'raw.jsonl has one record per arm',
    raw.length === 3 && new Set(raw.map((x) => x.arm)).size === 3,
    `${raw.length} records`
  );
  expect(
    'agent metrics recorded',
    raw.every((x) => x.agent.turns === 0 && x.agent.costUsd === 0 && x.agent.ok)
  );
  expect(
    'no-op agent fails the task in every arm',
    raw.every((x) => x.score.completion.pass === false && x.score.build.ok)
  );
  const summary = fs.existsSync(path.join(out, 'summary.md'))
    ? fs.readFileSync(path.join(out, 'summary.md'), 'utf8')
    : '';
  expect(
    'summary.md written',
    summary.includes('## Neutral metrics') && summary.includes('## Velocity-specific metrics')
  );
  console.log(`  results in ${out}`);
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\nSelf-test: ${results.length - failed.length}/${results.length} checks passed.${notes.length ? `\nNotes:\n- ${notes.join('\n- ')}` : ''}`
);
console.log(`Work dir: ${work}`);
process.exit(failed.length ? 1 : 0);
