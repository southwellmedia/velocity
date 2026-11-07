#!/usr/bin/env node
/* eslint-disable no-console -- command-line script that prints its results */
/**
 * Run the benchmark: every task × arm × repeat, in a shuffled order.
 *
 *   node benchmark/run.mjs --model claude-opus-5-5
 *   node benchmark/run.mjs --agent codex --model gpt-5.1-codex --repeats 3
 *   node benchmark/run.mjs --agent-cmd 'my-agent --model {model} {prompt}' --model x
 *   node benchmark/run.mjs --resume benchmark/results/2026-11-07-claude
 *
 * See benchmark/README.md for every option and how to read the output.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { killStrays, PRESETS, runAgent } from './lib/agent.mjs';
import { ARMS, cloneForRun, createArm, parseVelocityOptions } from './lib/arms.mjs';
import { DEFAULT_MOCK_PORT, startMockEndpoint } from './lib/mock-endpoint.mjs';
import { loadTasks, renderPrompt } from './lib/tasks.mjs';
import { BENCH_DIR, parseArgs, REPO_DIR, writeJson } from './lib/util.mjs';
import { scoreProject } from './score.mjs';
import { summarize } from './summarize.mjs';

const args = parseArgs();
/** Normalize a comma-separated CLI value or an array into a list of trimmed, non-empty strings. */
const list = (v) =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

/** Small seeded PRNG so a run order can be reproduced. */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh results folder for today and this agent, suffixed when one already exists. */
function resultsDir(agentName) {
  const date = new Date().toISOString().slice(0, 10);
  const base = path.join(BENCH_DIR, 'results', `${date}-${agentName}`);
  let dir = base;
  for (let i = 2; fs.existsSync(dir); i++) dir = `${base}-${i}`;
  return dir;
}

/** Plan the task × arm × repeat runs (or resume a previous plan), run each agent in a fresh project copy, score it and append to raw.jsonl. */
async function main() {
  const resume = typeof args.resume === 'string' ? path.resolve(args.resume) : null;
  const prior = resume ? JSON.parse(fs.readFileSync(path.join(resume, 'meta.json'), 'utf8')) : null;
  const opt = (k, def) => args[k] ?? prior?.options?.[k] ?? def;

  const preset = opt('agent', 'claude');
  const template = opt('agent-cmd', PRESETS[preset]);
  if (!template)
    throw new Error(
      `Unknown --agent "${preset}". Presets: ${Object.keys(PRESETS).join(', ')}; or pass --agent-cmd.`
    );
  const model = opt('model', process.env.BENCH_MODEL);
  if (!model && !args['allow-unpinned-model'])
    throw new Error(
      'Pin the model with --model <id> or BENCH_MODEL (or pass --allow-unpinned-model and accept that results may mix models).'
    );
  if (model && !template.includes('{model}'))
    console.warn(
      '⚠ The agent command has no {model} placeholder, so --model is recorded but not passed to the agent.'
    );

  const allTasks = loadTasks();
  const taskIds = list(opt('tasks')) ?? allTasks.map((t) => t.id);
  const tasks = taskIds.map(
    (id) =>
      allTasks.find((t) => t.id === id) ??
      (() => {
        throw new Error(`Unknown task ${id}`);
      })()
  );
  const arms = list(opt('arms')) ?? ARMS;
  for (const a of arms) if (!ARMS.includes(a)) throw new Error(`Unknown arm ${a}`);
  const repeats = Number(opt('repeats', 5));
  const seed = Number(opt('seed', prior?.seed ?? Math.floor(Math.random() * 2 ** 31)));
  const timeoutMs = Number(opt('timeout-min', 30)) * 60_000;
  const mockPort = Number(opt('mock-port', DEFAULT_MOCK_PORT));
  const workDir = path.resolve(opt('work-dir', path.join(os.tmpdir(), 'velocity-bench')));
  const outDir =
    resume ?? path.resolve(opt('out', resultsDir(path.basename(String(template.split(/\s+/)[0])))));
  const armOptions = {
    ref: opt('velocity-ref', 'HEAD'),
    velocityOptions: parseVelocityOptions(opt('velocity-options')),
    createAstroVersion: opt('create-astro-version', 'latest'),
    allowFallback: Boolean(opt('allow-astro-fallback', false)),
    fallbackAstroVersion: JSON.parse(
      fs.readFileSync(path.join(REPO_DIR, 'package.json'), 'utf8')
    ).dependencies.astro.replace(/^[^\d]*/, ''),
  };

  fs.mkdirSync(path.join(outDir, 'runs'), { recursive: true });
  const done = new Set();
  const rawFile = path.join(outDir, 'raw.jsonl');
  if (fs.existsSync(rawFile))
    for (const l of fs.readFileSync(rawFile, 'utf8').split('\n').filter(Boolean))
      done.add(JSON.parse(l).runId);

  // Plan: every combination, shuffled so arms interleave (API load, caches and time of day affect all arms alike).
  const rand = mulberry32(seed);
  const plan = tasks.flatMap((task) =>
    arms.flatMap((arm) =>
      Array.from({ length: repeats }, (_, i) => ({
        task,
        arm,
        repeat: i + 1,
        runId: `${task.id}__${arm}__r${i + 1}`,
      }))
    )
  );
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }

  console.log(
    `Results: ${outDir}\nWork dir: ${workDir}\nAgent: ${template}\nModel: ${model ?? '(unpinned)'}\nPlan: ${plan.length} runs (${done.size} already done), seed ${seed}\n`
  );

  // Base project per arm, built once and copied for every run.
  const bases = {};
  const armMeta = {};
  for (const arm of arms) {
    const dest = path.join(workDir, '_base', arm, 'site');
    process.stdout.write(`Preparing arm ${arm}… `);
    armMeta[arm] = await createArm(arm, dest, {
      ...armOptions,
      logDir: path.join(outDir, 'setup', arm),
    });
    bases[arm] = dest;
    console.log(
      `ok (${armMeta[arm].source}${armMeta[arm].commit ? ` ${armMeta[arm].commit.slice(0, 7)}` : ''}${armMeta[arm].astroVersion ? ` astro ${armMeta[arm].astroVersion}` : ''})`
    );
    if (armMeta[arm].source === 'fallback')
      console.warn(
        `  ⚠ npm create astro failed; using the local stand-in. Do not publish these results as the astro arm.\n  ${armMeta[arm].createError?.split('\n').join('\n  ')}`
      );
  }

  const meta = {
    startedAt: prior?.startedAt ?? new Date().toISOString(),
    resumedAt: resume ? new Date().toISOString() : undefined,
    node: process.version,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    agent: {
      preset: args['agent-cmd'] ? 'custom' : preset,
      template,
      model: model ?? null,
      modelsReported: prior?.agent?.modelsReported ?? [],
    },
    velocity: armMeta.velocity ?? armMeta['velocity-no-agent-files'] ?? null,
    noAgentFiles: armMeta['velocity-no-agent-files']
      ? { removed: armMeta['velocity-no-agent-files'].removedAgentFiles }
      : null,
    astro: armMeta.astro ?? null,
    arms,
    tasks: tasks.map((t) => ({ id: t.id, file: t.file, sha256: t.sha256 })),
    repeats,
    seed,
    plannedRuns: plan.length,
    timeoutMin: timeoutMs / 60_000,
    mockPort,
    scorer: createHash('sha256')
      .update(
        ['score.mjs', 'lib/site.mjs', 'lib/tasks.mjs']
          .map((f) => fs.readFileSync(path.join(BENCH_DIR, f)))
          .join('')
      )
      .digest('hex')
      .slice(0, 16),
    options: {
      ...Object.fromEntries(Object.entries(args).filter(([k]) => k !== '_' && k !== 'resume')),
      seed,
    },
  };
  writeJson(path.join(outDir, 'meta.json'), meta);

  const mock = await startMockEndpoint(mockPort);
  try {
    for (const [order, item] of plan.entries()) {
      if (done.has(item.runId)) continue;
      const { task, arm, repeat, runId } = item;
      const runDir = path.join(outDir, 'runs', runId);
      const projDir = path.join(workDir, runId, 'site');
      fs.mkdirSync(runDir, { recursive: true });
      console.log(`[${order + 1}/${plan.length}] ${runId}`);
      const baselineTree = await cloneForRun(bases[arm], projDir);
      const prompt = renderPrompt(task, { CONTACT_ENDPOINT: mock.url });
      fs.writeFileSync(path.join(runDir, 'prompt.txt'), prompt);
      mock.reset();
      const startedAt = new Date().toISOString();
      const agent = await runAgent({
        template,
        prompt,
        model,
        cwd: projDir,
        timeoutMs,
        logDir: runDir,
      });
      agent.requestsToMockDuringRun = mock.requests.length;
      agent.strayProcessesKilled = killStrays(projDir).length;
      for (const m of agent.modelsReported ?? [])
        if (!meta.agent.modelsReported.includes(m)) meta.agent.modelsReported.push(m);
      console.log(
        `  agent: exit ${agent.exitCode}${agent.timedOut ? ' TIMEOUT' : ''}, ${(agent.wallMs / 60_000).toFixed(1)} min, turns ${agent.turns ?? 'n/a'}, cost ${agent.costUsd ?? 'n/a'}`
      );

      const scores = await scoreProject(projDir, [task.id], {
        mock,
        logDir: runDir,
        lighthouse: Boolean(args.lighthouse),
      });
      const score = scores[task.id];
      console.log(
        `  score: build ${score.build.ok ? 'ok' : 'FAIL'}, task ${score.completion.pass ? 'PASS' : 'FAIL'} (${score.completion.checksPassed}/${score.completion.checksTotal ?? '?'}), axe ${score.axe?.seriousOrCritical ?? 'n/a'}, CSP violations ${score.velocitySpecific?.cspViolations ?? 'n/a'}`
      );

      const record = {
        runId,
        task: task.id,
        arm,
        repeat,
        order,
        startedAt,
        baselineTree,
        agent,
        score,
      };
      fs.appendFileSync(rawFile, JSON.stringify(record) + '\n');
      writeJson(path.join(outDir, 'meta.json'), meta);
      if (!args['keep-projects'])
        fs.rmSync(path.join(workDir, runId), { recursive: true, force: true });
    }
  } finally {
    await mock.stop();
  }

  const md = summarize(outDir);
  fs.writeFileSync(path.join(outDir, 'summary.md'), md + '\n');
  console.log(`\nWrote ${path.relative(process.cwd(), path.join(outDir, 'summary.md'))}`);
}

main().catch((error) => {
  console.error(error.stack ?? error);
  process.exit(1);
});
