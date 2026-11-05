import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cardAccent, completeSocialImages, readPage, renderCard } from '../../integrations/og-images.mjs';

const page = (image: string, title = 'Primary care — Acme') => `<!doctype html><html><head>
<meta name="theme-color" content="#006876">
<meta property="og:title" content="${title}">
<meta property="og:image" content="${image}">
<meta property="og:description" content="Care for the whole family.">
<meta property="og:site_name" content="Acme">
</head><body></body></html>`;

const site = 'https://acme.test';
let dir: string;

const write = (file: string, html: string) => {
  const target = path.join(dir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
};

const isPng = (file: string) =>
  fs.readFileSync(path.join(dir, file)).subarray(1, 4).toString() === 'PNG';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velocity-og-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('completeSocialImages', () => {
  it('draws a card for a page that has none, however deep it is', async () => {
    write('services/primary-care/index.html', page(`${site}/og/services/primary-care.png`));
    const result = await completeSocialImages(dir, { site });
    expect(result).toEqual({ pages: 1, generated: 1 });
    expect(isPng('og/services/primary-care.png')).toBe(true);
  });

  it('leaves an existing image alone', async () => {
    write('index.html', page(`${site}/og/index.png`));
    write('og/index.png', 'already here');
    const result = await completeSocialImages(dir, { site });
    expect(result.generated).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'og/index.png'), 'utf8')).toBe('already here');
  });

  it('fails the build when a custom image is missing, and names the page', async () => {
    write('index.html', page(`${site}/share.jpg`));
    await expect(completeSocialImages(dir, { site })).rejects.toThrow(/index\.html → \/share\.jpg/);
  });

  it('ignores images hosted elsewhere, and the 404 page', async () => {
    write('index.html', page('https://cdn.example.com/share.jpg'));
    write('404.html', page(`${site}/og/404.png`));
    await expect(completeSocialImages(dir, { site })).resolves.toEqual({ pages: 1, generated: 0 });
  });
});

describe('readPage', () => {
  it('drops the site name and decodes the title', () => {
    const details = readPage(page(`${site}/x.png`, 'Tom &amp; Jerry&#39;s — Acme'));
    expect(details.title).toBe("Tom & Jerry's");
    expect(details.themeColor).toBe('#006876');
  });

  it('reads the site name alone on a home page', () => {
    expect(readPage(page(`${site}/x.png`, 'Acme')).title).toBe('Acme');
  });
});

describe('cardAccent', () => {
  it('uses the theme color', () => {
    expect(cardAccent('#006876')).toBe('#006876');
  });

  it('falls back when the color would vanish on the dark card, or is not a hex value', () => {
    expect(cardAccent('#121412')).toBe('#fafafa');
    expect(cardAccent('oklch(50% 0.1 200)')).toBe('#fafafa');
    expect(cardAccent(undefined)).toBe('#fafafa');
  });
});

describe('renderCard', () => {
  it('draws a 1200×630 card, with symbols in the title', async () => {
    const png = await renderCard({
      title: 'Cats & dogs <3',
      siteName: 'Acme',
      hostname: 'acme.test',
      themeColor: '#006876',
    });
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it('keeps the footer inside the card', async () => {
    const png = await renderCard({ title: 'Acme', siteName: 'Acme', hostname: 'acme.test', themeColor: '#006876' });
    const strip = sharp(png).extract({ left: 70, top: 530, width: 320, height: 60 });
    const { channels } = await strip.stats();
    expect(channels[0].stdev).toBeGreaterThan(5);
  });
});
