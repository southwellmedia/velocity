/**
 * Small helpers shared by the benchmark scripts. No dependencies beyond Node.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const BENCH_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = path.resolve(BENCH_DIR, '..');

/** Parse `--key=value`, `--key value` and `--flag` arguments. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq !== -1) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--'))
      out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

/**
 * Run a command without a shell. Resolves (never rejects) with
 * { code, signal, timedOut, stdout, stderr, ms }.
 */
export function run(
  cmd,
  args,
  { cwd, env, timeoutMs = 10 * 60_000, input, logFile, maxBuffer = 20 * 1024 * 1024 } = {}
) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let settled = false;
    let stderr = '';
    let timedOut = false;
    let log;
    if (logFile) {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      log = fs.createWriteStream(logFile);
      log.write(
        `$ ${[cmd, ...args].map(shellQuote).join(' ')}\n# cwd: ${cwd ?? process.cwd()}\n\n`
      );
    }
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env: env ?? process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
    } catch (error) {
      resolve({
        code: -1,
        signal: null,
        timedOut: false,
        stdout: '',
        stderr: String(error),
        ms: 0,
      });
      return;
    }
    const append = (which) => (chunk) => {
      const s = chunk.toString();
      if (which === 'out') stdout = (stdout + s).slice(-maxBuffer);
      else stderr = (stderr + s).slice(-maxBuffer);
      if (!settled) log?.write(s);
    };
    child.stdout.on('data', append('out'));
    child.stderr.on('data', append('err'));
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.on('error', (error) => {
      stderr += String(error);
    });
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      log?.end(
        `\n# exit ${code}${signal ? ` (${signal})` : ''}${timedOut ? ' TIMEOUT' : ''} after ${Date.now() - started}ms\n`
      );
      resolve({ code: code ?? -1, signal, timedOut, stdout, stderr, ms: Date.now() - started });
    };
    child.on('close', finish);
    // A leftover grandchild (say, a dev server the agent started) can hold the
    // pipes open so 'close' never fires; settle shortly after the process exits.
    child.on('exit', (code, signal) => setTimeout(() => finish(code, signal), 2000).unref());
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

/** Start a long-running process (e.g. a preview server). Returns { child, output(), stop() }. */
export function start(cmd, args, { cwd, env } = {}) {
  let output = '';
  const child = spawn(cmd, args, {
    cwd,
    env: env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  child.stdout.on('data', (c) => (output = (output + c).slice(-200_000)));
  child.stderr.on('data', (c) => (output = (output + c).slice(-200_000)));
  child.on('error', (e) => (output += String(e)));
  return {
    child,
    output: () => output,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve();
        child.once('close', () => resolve());
        killTree(child);
        setTimeout(resolve, 5000).unref();
      }),
  };
}

/** Terminate a child and its process group (SIGTERM, then SIGKILL after a grace period). */
function killTree(child) {
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => {
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
      else child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }, 3000).unref();
}

/** Quote a string for a POSIX shell, leaving safe strings bare. Used only for logging commands. */
export function shellQuote(s) {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/**
 * Split a command template into argv like a POSIX shell would (quotes and
 * backslashes only; no expansion). Placeholders are substituted per token, so
 * a prompt never needs escaping.
 */
export function splitCommand(template) {
  const tokens = [];
  let cur = '';
  let quote = null;
  let has = false;
  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < template.length) cur += template[++i];
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (ch === '\\' && i + 1 < template.length) {
      cur += template[++i];
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) tokens.push(cur);
      cur = '';
      has = false;
    } else {
      cur += ch;
    }
  }
  if (quote) throw new Error(`Unterminated quote in command template: ${template}`);
  if (has || cur) tokens.push(cur);
  return tokens;
}

export async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Poll `url` until it answers, the process dies (`isAlive` false) or the timeout passes. Returns whether it answered. */
export async function waitForHttp(url, { timeoutMs = 60_000, isAlive = () => true } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive()) return false;
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  return false;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The median of the finite numbers in `values`, or null when there are none. */
export function median(values) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Wilson score interval for a binomial proportion (95%). */
export function wilson(successes, n, z = 1.96) {
  if (!n) return [null, null];
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Resolve a package from the benchmark's location (i.e. the Velocity repo), falling back to NODE_PATH. */
export function requireFromRepo(id) {
  const req = createRequire(path.join(BENCH_DIR, 'package.json'));
  return req(id);
}

/** Load Playwright's chromium: `playwright` if installed, else the repo's `@playwright/test`. */
export function loadChromium() {
  for (const id of ['playwright', '@playwright/test']) {
    try {
      const mod = requireFromRepo(id);
      if (mod.chromium) return mod.chromium;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'Playwright not found. Run `pnpm install` in the Velocity repo and `npx playwright install chromium`.'
  );
}

/** The AxeBuilder class from @axe-core/playwright, resolved from this repo, or null when it isn't installed. */
export function loadAxeBuilder() {
  try {
    const mod = requireFromRepo('@axe-core/playwright');
    return mod.default ?? mod.AxeBuilder ?? mod;
  } catch {
    throw new Error(
      '@axe-core/playwright not found. Run `pnpm install` in the Velocity repo (it is a devDependency).'
    );
  }
}

/** Package manager a project uses, from its lockfile. Defaults to npm. */
export function detectPackageManager(dir) {
  const has = (f) => fs.existsSync(path.join(dir, f));
  if (has('pnpm-lock.yaml')) return 'pnpm';
  if (has('yarn.lock')) return 'yarn';
  if (has('bun.lockb') || has('bun.lock')) return 'bun';
  return 'npm';
}

/** Recursively collect files under `dir` that pass `filter`, skipping node_modules and .git. */
export function walkFiles(dir, filter = () => true, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walkFiles(p, filter, out);
    } else if (filter(p)) out.push(p);
  }
  return out;
}

/** Environment for child processes, without variables that would make a nested agent think it is inside another session. */
export function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
