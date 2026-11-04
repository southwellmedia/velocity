/**
 * t() falls back to the key itself, so a missing string shows up as raw text such
 * as "services.title" on the page. This fails the build's test step instead.
 *
 * Keys built at runtime, such as t(`steps.${n}`), can't be checked statically.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { translate } from '@/i18n';
import { defaultLocale } from '@/i18n/locales.mjs';

const src = path.join(process.cwd(), 'src');
const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(file);
    return /\.(astro|ts)$/.test(entry.name) ? [file] : [];
  });

const KEY = String.raw`['"]([a-zA-Z]\w*(?:\.\w+)+)['"]`;
const PATTERNS = [
  new RegExp(String.raw`\bt\(\s*${KEY}`, 'g'),
  new RegExp(String.raw`\blabel:\s*${KEY}`, 'g'),
];

describe('translations', () => {
  it('has a string for every key the site uses', () => {
    const missing = files(src).flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)])
        .map((match) => match[1])
        .filter((key) => translate(defaultLocale, key) === key)
        .map((key) => `${path.relative(src, file)}: ${key}`);
    });
    expect([...new Set(missing)]).toEqual([]);
  });
});
