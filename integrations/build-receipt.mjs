import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Fills in the build receipt on the demo home page (src/components/landing/BuildReceipt.astro)
 * with figures that only exist once the build has finished:
 *
 * - `jsKb`: gzipped JavaScript the page loads up front: its module scripts, island
 *   components and renderers, everything those import statically, and inline scripts.
 *   Code split off behind a dynamic import() is not counted.
 * - `pages`: HTML pages written by this build.
 * - `buildSeconds`: time from the start of `astro build` to the end of page generation.
 *
 * The page renders each of these rows with `hidden` and an empty value. This step
 * writes the value and removes `hidden`. A figure it can't measure keeps its row
 * hidden, so the page never shows a made-up number. Pages without receipt rows are
 * left alone, so this costs nothing in projects that remove the demo.
 *
 * Called from integrations/pagefind.mjs, which already reads every finished page.
 */

/** Every file under `dir` whose name ends with `ext`. */
async function walk(dir, ext) {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith(ext)).map((e) => path.join(e.parentPath, e.name));
}

const assetUrls = /(?:\ssrc|\scomponent-url|\srenderer-url|\sbefore-hydration-url)="(\/[^"]+\.js)"/g;
const modulePreloads = /<link[^>]*rel="modulepreload"[^>]*href="(\/[^"]+\.js)"/g;
const staticImports = /(?:\bfrom|\bimport)\s*["']([^"']+\.js)["']/g;
const inlineScripts = /<script(?![^>]*\ssrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g;

/** Gzipped bytes of the JavaScript `html` loads up front. */
async function measureJs(html, outDir) {
  const seen = new Set();
  const queue = [...html.matchAll(assetUrls), ...html.matchAll(modulePreloads)].map((m) => path.join(outDir, m[1]));
  let bytes = 0;

  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const code = await fs.readFile(file);
    bytes += gzipSync(code).length;
    for (const [, spec] of code.toString('utf8').matchAll(staticImports)) {
      queue.push(spec.startsWith('/') ? path.join(outDir, spec) : path.resolve(path.dirname(file), spec));
    }
  }

  for (const [, code] of html.matchAll(inlineScripts)) {
    if (code.trim()) bytes += gzipSync(code).length;
  }
  return bytes;
}

/** Write `value` into the receipt row `key` and unhide it. */
function fill(html, key, value) {
  const row = new RegExp(`(<[^>]*\\sdata-receipt-row="${key}"[^>]*?)\\shidden(?=[\\s>])`);
  const slot = new RegExp(`(<[^>]*\\sdata-receipt-value="${key}"[^>]*>)(</[a-z]+>)`);
  if (!row.test(html) || !slot.test(html)) return html;
  return html.replace(slot, `$1${value}$2`).replace(row, '$1');
}

/**
 * @param {string} outDir Folder holding the prerendered HTML
 * @param {{ startedAt?: number }} options `startedAt` from performance.now() at astro:build:start
 * @returns {Promise<number>} Number of pages whose receipt was filled
 */
export async function completeBuildReceipt(outDir, { startedAt } = {}) {
  const pages = await walk(outDir, '.html');
  const buildSeconds = startedAt === undefined ? undefined : (performance.now() - startedAt) / 1000;
  let filled = 0;

  for (const page of pages) {
    const html = await fs.readFile(page, 'utf8');
    if (!html.includes('data-receipt-row=')) continue;

    let out = fill(html, 'pages', String(pages.length));
    if (buildSeconds !== undefined) out = fill(out, 'buildSeconds', `${buildSeconds.toFixed(1)} s`);
    try {
      out = fill(out, 'jsKb', `${((await measureJs(html, outDir)) / 1024).toFixed(1)} KB`);
    } catch {
      // A script we couldn't read: leave the row hidden rather than undercount.
    }

    if (out !== html) {
      await fs.writeFile(page, out);
      filled += 1;
    }
  }
  return filled;
}
