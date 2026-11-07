/**
 * The three arms. Each produces a ready-to-run project (dependencies
 * installed, as both CLIs do by default) that the runner copies for every run,
 * so all runs of an arm start from an identical tree.
 *
 *   velocity                 this repo at a git ref, scaffolded with scripts/scaffold.mjs
 *   velocity-no-agent-files  the same project with AGENTS.md, CLAUDE.md, .agents/ and .claude/ removed
 *   astro                    `npm create astro@<version> -- --template minimal`
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { cleanEnv, REPO_DIR, run } from './util.mjs';

export const ARMS = ['velocity', 'velocity-no-agent-files', 'astro'];

/** Files an agent reads for instructions. Removed in the ablation arm. */
export const AGENT_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  '.agents',
  '.claude',
  '.cursor',
  '.cursorrules',
  '.codex',
  '.github/copilot-instructions.md',
];

/** package.json scripts that belong to the benchmark and must not reach a project. */
const BENCH_SCRIPTS = /^bench(:|$)/;

/** Parse a 'demo=false,i18n=true,components=all' spec into scaffold options. */
export function parseVelocityOptions(spec = 'demo=false,i18n=false,components=all') {
  const o = Object.fromEntries(spec.split(',').map((kv) => kv.split('=')));
  return { demo: o.demo === 'true', i18n: o.i18n === 'true', components: o.components ?? 'all' };
}

/** Await a run() result and throw with its output tail unless it exited 0 without timing out. */
async function must(promise, what) {
  const r = await promise;
  if (r.code !== 0 || r.timedOut)
    throw new Error(
      `${what} failed (exit ${r.code}${r.timedOut ? ', timed out' : ''}):\n${`${r.stdout}\n${r.stderr}`.trim().split('\n').slice(-25).join('\n')}`
    );
  return r;
}

/** Scaffold a Velocity project at `dest` from `ref` (a clean checkout, so uncommitted edits don't leak in). Returns the commit used. */
async function createVelocity(dest, { ref = 'HEAD', velocityOptions, logDir }) {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'velocity-src-'));
  let commit = null;
  let dirty;
  try {
    if (ref === 'worktree') {
      // Uncommitted state of the repo. Useful while developing; results should use a commit.
      fs.cpSync(REPO_DIR, src, {
        recursive: true,
        filter: (p) =>
          !/[\\/](node_modules|dist|\.git|\.astro)([\\/]|$)/.test(p.slice(REPO_DIR.length)),
      });
    } else {
      commit = (
        await must(run('git', ['-C', REPO_DIR, 'rev-parse', ref]), 'git rev-parse')
      ).stdout.trim();
      const tar = path.join(src, '..', `${path.basename(src)}.tar`);
      await must(
        run('git', ['-C', REPO_DIR, 'archive', '--format=tar', '-o', tar, commit]),
        'git archive'
      );
      await must(run('tar', ['-xf', tar, '-C', src]), 'tar');
      fs.rmSync(tar, { force: true });
    }
    dirty = (await run('git', ['-C', REPO_DIR, 'status', '--porcelain'])).stdout.trim().length > 0;
    const { scaffoldProject } = await import(
      pathToFileURL(path.join(src, 'scripts', 'scaffold.mjs')).href
    );
    const { applied } = scaffoldProject(src, dest, velocityOptions);
    // The benchmark never ships to projects, whether or not the manifest lists it yet.
    fs.rmSync(path.join(dest, 'benchmark'), { recursive: true, force: true });
    const pkgPath = path.join(dest, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    for (const name of Object.keys(pkg.scripts ?? {}))
      if (BENCH_SCRIPTS.test(name)) delete pkg.scripts[name];
    // create-velocity-astro names the package after the project; every arm's project is called "site".
    pkg.name = path.basename(dest);
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    await must(
      run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], {
        cwd: dest,
        env: cleanEnv({ CI: 'true' }),
        timeoutMs: 15 * 60_000,
        logFile: logDir && path.join(logDir, 'velocity-install.log'),
      }),
      'pnpm install'
    );
    return {
      source: ref === 'worktree' ? 'worktree' : 'git-archive',
      ref,
      commit,
      repoDirty: dirty,
      version: pkg.version,
      variants: applied,
      options: velocityOptions,
    };
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
  }
}

/**
 * Stand-in for the official "minimal" template when `npm create astro` cannot
 * download it (e.g. no access to GitHub). Close to withastro/astro
 * examples/minimal, but not byte-identical (the favicon is a placeholder). Runs that use it are labelled `source: "fallback"` and are
 * not comparable to published results.
 */
const MINIMAL_FALLBACK = {
  'package.json': (v) =>
    JSON.stringify(
      {
        name: 'site',
        type: 'module',
        version: '0.0.1',
        scripts: {
          dev: 'astro dev',
          build: 'astro build',
          preview: 'astro preview',
          astro: 'astro',
        },
        dependencies: { astro: `^${v}` },
      },
      null,
      2
    ) + '\n',
  'astro.config.mjs': () =>
    "// @ts-check\nimport { defineConfig } from 'astro/config';\n\n// https://astro.build/config\nexport default defineConfig({});\n",
  'tsconfig.json': () =>
    JSON.stringify(
      {
        extends: 'astro/tsconfigs/strict',
        include: ['.astro/types.d.ts', '**/*'],
        exclude: ['dist'],
      },
      null,
      2
    ) + '\n',
  'src/pages/index.astro': () =>
    '---\n\n---\n\n<html lang="en">\n\t<head>\n\t\t<meta charset="utf-8" />\n\t\t<link rel="icon" type="image/svg+xml" href="/favicon.svg" />\n\t\t<meta name="viewport" content="width=device-width" />\n\t\t<meta name="generator" content={Astro.generator} />\n\t\t<title>Astro</title>\n\t</head>\n\t<body>\n\t\t<h1>Astro</h1>\n\t</body>\n</html>\n',
  'public/favicon.svg': () =>
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#000"/></svg>\n',
  '.gitignore': () =>
    '# build output\ndist/\n\n# generated types\n.astro/\n\n# dependencies\nnode_modules/\n\n# logs\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\npnpm-debug.log*\n\n# environment variables\n.env\n.env.production\n\n# macOS-specific files\n.DS_Store\n\n# jetbrains setting folder\n.idea/\n',
  'README.md': () =>
    '# Astro Starter Kit: Minimal\n\n```sh\nnpm create astro@latest -- --template minimal\n```\n\n| Command | Action |\n| :-- | :-- |\n| `npm install` | Installs dependencies |\n| `npm run dev` | Starts local dev server at `localhost:4321` |\n| `npm run build` | Build your production site to `./dist/` |\n| `npm run preview` | Preview your build locally, before deploying |\n',
};

/** The last meaningful lines of a failed command's output, for error messages. */
function createErrorSummary(r) {
  const lines = `${r.stdout}\n${r.stderr}`
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const useful = lines.filter(
    (l) =>
      /error|not be found|ENOTFOUND|ECONN|403|404/i.test(l) &&
      !/^npm (error|notice)/.test(l) &&
      !/trace-warnings/.test(l)
  );
  return (useful.length ? useful : lines.slice(-6)).slice(0, 6).join('\n');
}

/** Create a plain Astro project at `dest` with `npm create astro` (minimal template), or the local fallback when allowed. */
async function createAstro(
  dest,
  { createAstroVersion = 'latest', allowFallback = false, fallbackAstroVersion, logDir }
) {
  const parent = path.dirname(dest);
  fs.mkdirSync(parent, { recursive: true });
  fs.rmSync(dest, { recursive: true, force: true });
  const r = await run(
    'npm',
    [
      'create',
      `astro@${createAstroVersion}`,
      '--',
      path.basename(dest),
      '--template',
      'minimal',
      '--install',
      '--no-git',
      '--yes',
      '--skip-houston',
    ],
    {
      cwd: parent,
      env: cleanEnv({ CI: 'true' }),
      timeoutMs: 10 * 60_000,
      logFile: logDir && path.join(logDir, 'create-astro.log'),
    }
  );
  const created = r.code === 0 && fs.existsSync(path.join(dest, 'package.json'));
  if (!created) {
    if (!allowFallback)
      throw new Error(
        `npm create astro failed (exit ${r.code}). Re-run with network access to GitHub, or pass --allow-astro-fallback for a local, unofficial stand-in.\n${`${r.stdout}\n${r.stderr}`.trim().split('\n').slice(-15).join('\n')}`
      );
    fs.rmSync(dest, { recursive: true, force: true });
    const version = fallbackAstroVersion;
    for (const [rel, make] of Object.entries(MINIMAL_FALLBACK)) {
      fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true });
      fs.writeFileSync(path.join(dest, rel), make(version));
    }
    await must(
      run('npm', ['install', '--no-audit', '--no-fund'], {
        cwd: dest,
        env: cleanEnv({ CI: 'true' }),
        timeoutMs: 10 * 60_000,
        logFile: logDir && path.join(logDir, 'astro-fallback-install.log'),
      }),
      'npm install (fallback)'
    );
  }
  const astroPkg = JSON.parse(
    fs.readFileSync(path.join(dest, 'node_modules', 'astro', 'package.json'), 'utf8')
  );
  return {
    source: created ? 'npm-create-astro' : 'fallback',
    createAstroVersion,
    astroVersion: astroPkg.version,
    createError: created ? undefined : createErrorSummary(r),
  };
}

/** Build the base project for an arm at `dest`. Returns metadata recorded with every run. */
export async function createArm(arm, dest, options) {
  fs.rmSync(dest, { recursive: true, force: true });
  if (arm === 'astro') return { arm, ...(await createAstro(dest, options)) };
  const meta = await createVelocity(dest, options);
  if (arm === 'velocity') return { arm, ...meta };
  if (arm === 'velocity-no-agent-files') {
    const removed = AGENT_FILES.filter((rel) => fs.existsSync(path.join(dest, rel)));
    for (const rel of removed) fs.rmSync(path.join(dest, rel), { recursive: true, force: true });
    return { arm, ...meta, removedAgentFiles: removed };
  }
  throw new Error(`Unknown arm "${arm}". Use one of: ${ARMS.join(', ')}`);
}

/** Copy a base project for one run and commit it, so the agent's diff can be measured. */
export async function cloneForRun(base, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(base, dest, { recursive: true, verbatimSymlinks: true });
  const git = (...a) =>
    run('git', [
      '-C',
      dest,
      '-c',
      'user.name=benchmark',
      '-c',
      'user.email=benchmark@example.com',
      '-c',
      'commit.gpgsign=false',
      ...a,
    ]);
  await must(git('init', '-q', '-b', 'main'), 'git init');
  await must(git('add', '-A'), 'git add');
  await must(git('commit', '-q', '-m', 'Initial project'), 'git commit');
  return (await git('rev-parse', 'HEAD^{tree}')).stdout.trim();
}
