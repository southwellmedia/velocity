#!/usr/bin/env node
/**
 * Adapter smoke test: checks that a build for a serverless host is complete and
 * that its server function really runs Velocity's Actions.
 *
 *   DEPLOY_TARGET=vercel pnpm build && node scripts/smoke-adapter.mjs vercel
 *   DEPLOY_TARGET=netlify pnpm build && node scripts/smoke-adapter.mjs netlify
 *   DEPLOY_TARGET=cloudflare pnpm build && node scripts/smoke-adapter.mjs cloudflare
 *
 * For Vercel and Netlify it imports the built function and sends it the same
 * requests the host would: a contact form submission delivered to a local mock
 * endpoint, a submission the endpoint rejects, an invalid one and an unknown
 * action. For Cloudflare it runs the worker in workerd with `wrangler dev`
 * (installed with @astrojs/cloudflare) and checks that Actions answer; the
 * delivery checks are skipped there, since workerd may not reach a loopback
 * mock. The Node adapter is covered by `pnpm test:e2e`.
 *
 * Exits non-zero, naming the failed check, when anything is wrong.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const target = process.argv[2];

/** Per host: the files a deploy needs, and how to call the server function. */
const TARGETS = {
  vercel: {
    files: ['.vercel/output/config.json', '.vercel/output/static/index.html', '.vercel/output/functions/_render.func/.vc-config.json'],
    async handler() {
      const config = readJson('.vercel/output/functions/_render.func/.vc-config.json');
      const entry = path.join('.vercel/output/functions/_render.func', config.handler);
      const mod = await import(pathToFileURL(path.join(root, entry)).href);
      return { handle: (request) => mod.default.fetch(request) };
    },
    routes() {
      // Actions must reach the function instead of falling through to the 404 page.
      const { routes } = readJson('.vercel/output/config.json');
      const action = routes.find((r) => r.src && new RegExp(r.src).test('/_actions/contact'));
      if (action?.dest !== '_render') return 'Vercel routes do not send /_actions/* to the server function';
    },
  },
  netlify: {
    files: ['dist/index.html', '.netlify/v1/functions/ssr/ssr.mjs'],
    async handler() {
      const mod = await import(pathToFileURL(path.join(root, '.netlify/v1/functions/ssr/ssr.mjs')).href);
      return { handle: (request) => mod.default(request, { ip: '127.0.0.1' }) };
    },
    routes() {
      const source = fs.readFileSync(path.join(root, '.netlify/v1/functions/ssr/ssr.mjs'), 'utf8');
      if (!/path:\s*'\/\*'/.test(source)) return 'the Netlify function is not mounted on /*';
    },
  },
  cloudflare: {
    files: ['dist/client/index.html', 'dist/server/entry.mjs', 'dist/server/wrangler.json'],
    delivery: false,
    async handler() {
      const wrangler = path.join(root, 'node_modules/.bin/wrangler');
      if (!fs.existsSync(wrangler)) throw new Error('wrangler is not installed (it comes with @astrojs/cloudflare)');
      const port = 8787 + Math.floor(Math.random() * 1000);
      const base = `http://127.0.0.1:${port}`;
      const child = spawn(wrangler, ['dev', '--config', 'dist/server/wrangler.json', '--ip', '127.0.0.1', '--port', String(port)], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
      });
      let log = '';
      child.stdout.on('data', (c) => (log += c));
      child.stderr.on('data', (c) => (log += c));
      for (let i = 0; i < 60; i++) {
        if (child.exitCode !== null) throw new Error(`wrangler dev exited:\n${log.slice(-2000)}`);
        const up = await fetch(`${base}/`).then((r) => r.ok, () => false);
        if (up) break;
        if (i === 59) throw new Error(`wrangler dev did not start:\n${log.slice(-2000)}`);
        await sleep(1000);
      }
      return {
        origin: base,
        // Requests are built for ORIGIN; send them to the local worker with a matching Origin.
        handle: (request) => fetch(new URL(new URL(request.url).pathname, base), {
          method: request.method,
          body: request.body,
          duplex: 'half',
          headers: { ...Object.fromEntries(request.headers), origin: base },
        }),
        stop: () => child.kill(),
      };
    },
    routes() {
      const config = readJson('dist/server/wrangler.json');
      if (config.main !== 'entry.mjs') return `wrangler.json points at "${config.main}", not the built entry.mjs`;
      if (!config.assets?.directory) return 'wrangler.json does not serve the prerendered pages as assets';
    },
  },
};

const failures = [];
const passes = [];

function check(name, problem) {
  if (problem) failures.push(`${name}: ${problem}`);
  else passes.push(name);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

/** A form endpoint that records what it receives; answers 502 to "mock-fail". */
function startMockEndpoint() {
  const received = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      received.push({ path: req.url, body: raw });
      res.writeHead(raw.includes('mock-fail') ? 502 : 204).end();
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, received, url: `http://127.0.0.1:${server.address().port}` }))
  );
}

const ORIGIN = 'https://smoke.example.com';

function contact(fields) {
  const body = new FormData();
  for (const [k, v] of Object.entries({ name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hello from the adapter smoke test', ...fields })) {
    body.set(k, v);
  }
  // Astro's checkOrigin rejects form posts from another origin.
  return new Request(`${ORIGIN}/_actions/contact`, { method: 'POST', body, headers: { origin: ORIGIN } });
}

async function main() {
  const spec = TARGETS[target];
  if (!spec) {
    console.error(`Usage: node scripts/smoke-adapter.mjs <${Object.keys(TARGETS).join('|')}>`);
    process.exit(2);
  }

  for (const file of spec.files) {
    check(`build output has ${file}`, fs.existsSync(path.join(root, file)) ? undefined : `missing. Run DEPLOY_TARGET=${target} pnpm build first.`);
  }
  if (failures.length) return;
  check('routes reach the server function', spec.routes());

  const delivery = spec.delivery !== false;
  const mock = await startMockEndpoint();
  // Set before the function loads; astro:env reads secrets from the environment.
  if (delivery) process.env.CONTACT_FORM_ENDPOINT = `${mock.url}/contact`;
  let server;
  try {
    server = await spec.handler();
    const { handle } = server;

    const ok = await handle(contact({}));
    check('a valid submission succeeds', ok.status === 200 ? undefined : `expected 200, got ${ok.status}`);

    if (delivery) {
      check(
        'the submission reaches CONTACT_FORM_ENDPOINT',
        mock.received.some((r) => r.path === '/contact' && r.body.includes('Hello from the adapter smoke test'))
          ? undefined
          : 'the mock endpoint received nothing'
      );
      const failed = await handle(contact({ message: 'mock-fail: endpoint answers 502' }));
      check('a failed delivery is reported as an error', failed.status >= 500 ? undefined : `expected a 5xx, got ${failed.status}`);
    }

    const invalid = await handle(contact({ email: 'not-an-email' }));
    check('an invalid submission is rejected', invalid.status === 400 ? undefined : `expected 400, got ${invalid.status}`);

    const missing = await handle(new Request(`${ORIGIN}/_actions/does-not-exist`, { method: 'POST', headers: { origin: ORIGIN } }));
    check('an unknown action is a 404', missing.status === 404 ? undefined : `expected 404, got ${missing.status}`);
  } finally {
    server?.stop?.();
    mock.server.close();
  }
}

await main().catch((error) => failures.push(`smoke test crashed: ${error?.stack ?? error}`));

for (const name of passes) console.log(`  ok    ${name}`);
for (const failure of failures) console.error(`  FAIL  ${failure}`);
console.log(`\n[velocity] ${target} adapter: ${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
