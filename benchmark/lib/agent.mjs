/**
 * Invoke a coding agent headlessly from a command template and pull whatever
 * cost metrics its output exposes.
 *
 * Placeholders, substituted per argument (no shell, so nothing needs quoting):
 *   {prompt}  the task prompt
 *   {model}   the pinned model (--model / BENCH_MODEL)
 *   {cwd}     the project directory (also the process's working directory)
 */
import fs from 'node:fs';
import path from 'node:path';
import { cleanEnv, run, splitCommand } from './util.mjs';

export const PRESETS = {
  // Verified flags (Claude Code CLI). --setting-sources/--strict-mcp-config keep the
  // operator's own user settings, plugins and MCP servers out of the runs.
  claude:
    'claude -p {prompt} --model {model} --permission-mode bypassPermissions --output-format json --setting-sources project,local --strict-mcp-config --no-session-persistence',
  // Optional, not exercised by this repo's self-test. Check flags against your installed version.
  codex:
    'codex exec --json --model {model} --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check {prompt}',
  cursor: 'cursor-agent -p {prompt} --model {model} --force --output-format json',
};

/** Split an agent command template into argv and substitute {prompt}, {model} and {cwd} in each token, with no shell. */
export function buildArgv(template, vars) {
  const tokens = splitCommand(template);
  if (!tokens.length) throw new Error('Empty agent command template');
  return tokens.map((t) => t.replace(/\{(prompt|model|cwd)\}/g, (_, k) => vars[k] ?? ''));
}

/** All JSON values in the output: one document, a JSON array, or JSON lines. */
function jsonValues(stdout) {
  const s = stdout.trim();
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [v];
  } catch {
    return s
      .split('\n')
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return undefined;
        }
      })
      .filter((v) => v && typeof v === 'object');
  }
}

/**
 * Normalised metrics. Fields the agent doesn't report stay null, and the
 * summary shows them as "n/a" rather than guessing.
 */
export function parseAgentOutput(stdout) {
  const values = jsonValues(stdout);
  const metrics = {
    format: 'unknown',
    isError: null,
    turns: null,
    inputTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    outputTokens: null,
    costUsd: null,
    reportedDurationMs: null,
    modelsReported: [],
  };
  const result = [...values].reverse().find((v) => v.type === 'result');
  if (result) {
    // Claude Code (--output-format json or stream-json)
    const u = result.usage ?? {};
    Object.assign(metrics, {
      format: 'claude-result',
      isError: Boolean(result.is_error) || (result.subtype && result.subtype !== 'success'),
      turns: result.num_turns ?? null,
      inputTokens: u.input_tokens ?? null,
      cacheReadTokens: u.cache_read_input_tokens ?? null,
      cacheWriteTokens: u.cache_creation_input_tokens ?? null,
      outputTokens: u.output_tokens ?? null,
      costUsd: result.total_cost_usd ?? result.cost_usd ?? null,
      reportedDurationMs: result.duration_ms ?? null,
      modelsReported: Object.keys(result.modelUsage ?? {}),
      subtype: result.subtype ?? null,
    });
    return metrics;
  }
  const turns = values.filter((v) => v.type === 'turn.completed' && v.usage);
  if (turns.length) {
    // Codex `exec --json` event stream
    const sum = (k) => turns.reduce((a, t) => a + (t.usage[k] ?? 0), 0);
    Object.assign(metrics, {
      format: 'codex-events',
      isError: values.some((v) => v.type === 'turn.failed' || v.type === 'error'),
      inputTokens: sum('input_tokens'),
      cacheReadTokens: sum('cached_input_tokens'),
      outputTokens: sum('output_tokens'),
      toolCalls: values.filter(
        (v) =>
          v.type === 'item.completed' &&
          v.item &&
          v.item.type !== 'agent_message' &&
          v.item.type !== 'reasoning'
      ).length,
    });
    return metrics;
  }
  // Anything else: look for a usage object anywhere.
  const usage = values.map((v) => v.usage).find(Boolean);
  if (usage) {
    Object.assign(metrics, {
      format: 'generic-usage',
      inputTokens: usage.input_tokens ?? usage.inputTokens ?? null,
      outputTokens: usage.output_tokens ?? usage.outputTokens ?? null,
    });
  }
  if (values.length && metrics.format === 'unknown') metrics.format = 'json-without-usage';
  return metrics;
}

/** Run the agent once in `cwd` with the prompt, logging to `logDir`. Returns exit status, timing and the usage it reported. */
export async function runAgent({ template, prompt, model, cwd, timeoutMs, logDir }) {
  const argv = buildArgv(template, { prompt, model, cwd });
  const r = await run(argv[0], argv.slice(1), {
    cwd,
    env: cleanEnv(),
    timeoutMs,
    logFile: path.join(logDir, 'agent.log'),
  });
  fs.writeFileSync(path.join(logDir, 'agent.stdout'), r.stdout);
  fs.writeFileSync(path.join(logDir, 'agent.stderr'), r.stderr);
  const metrics = parseAgentOutput(r.stdout);
  return {
    argv0: argv[0],
    exitCode: r.code,
    timedOut: r.timedOut,
    wallMs: r.ms,
    ok: r.code === 0 && !r.timedOut && metrics.isError !== true,
    ...metrics,
  };
}

/** Linux only: stop processes the agent left running inside the project (dev servers etc.). */
export function killStrays(dir) {
  if (process.platform !== 'linux') return [];
  const killed = [];
  const root = fs.realpathSync(dir);
  for (const pid of fs.readdirSync('/proc').filter((p) => /^\d+$/.test(p))) {
    if (Number(pid) === process.pid) continue;
    try {
      const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      if (cwd === root || cwd.startsWith(root + path.sep)) {
        process.kill(Number(pid), 'SIGKILL');
        killed.push(Number(pid));
      }
    } catch {
      /* gone or not ours */
    }
  }
  return killed;
}
