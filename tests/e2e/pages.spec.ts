import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { createHash } from 'node:crypto';
import { ALL_PAGES, PAGES, hasRoute } from './site';

for (const path of PAGES) {
  test.describe(path, () => {
    test('renders without console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('main#main-content')).toBeVisible();
      expect(errors).toEqual([]);
    });

    test('has a single <main> landmark', async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('main')).toHaveCount(1);
    });

    test('has no serious accessibility violations', async ({ page }) => {
      // Entrance animations fade content in; with reduced motion they finish
      // instantly, so axe measures final colours rather than mid-fade ones.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .exclude('astro-dev-toolbar')
        .analyze();
      const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  });
}

test('every inline script has a hash in the CSP', async ({ page }) => {
  // Position in the document must not be what lets a script run
  await page.goto('/');
  const csp = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
  const scripts = await page
    .locator('script:not([src]):not([type="application/json"]):not([type="application/ld+json"])')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ''));
  expect(scripts.length).toBeGreaterThan(0);
  for (const code of scripts) {
    const hash = createHash('sha256').update(code).digest('base64');
    expect(csp, code.slice(0, 60)).toContain(`sha256-${hash}`);
  }
});

test('component showcase dialog opens and closes under the CSP', async ({ page }) => {
  test.skip(!hasRoute('components'), 'no component showcase in this project');
  await page.goto('/components');
  await page.locator('[data-dialog-open="demo-dialog"]').click();
  const cancel = page.locator('[data-dialog-close="demo-dialog"]').first();
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(cancel).toBeHidden();
});

test('only the Latin font is preloaded, and other scripts have a font', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(1);
  const ranges = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.family.includes('Manrope')).map((f) => f.unicodeRange),
  );
  expect(ranges.join(',')).toMatch(/U\+4[0-9A-F]{2}/i); // Cyrillic
});

test('search pages are out of the sitemap but readable by crawlers', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).not.toMatch(/Disallow: \/search/);
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).toContain('<loc>');
  expect(sitemap).not.toMatch(/\/search\/</);
});

test('404 page returns 404', async ({ page }) => {
  const response = await page.goto('/does-not-exist');
  expect(response?.status()).toBe(404);
});

test('fonts are self-hosted and the body font is preloaded', async ({ page }) => {
  await page.goto('/');
  const preloads = page.locator('link[rel="preload"][as="font"]');
  await expect(preloads.first()).toHaveAttribute('href', /^\/_astro\/fonts\/.+\.woff2$/);
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family).toMatch(/Manrope/);
});

test.describe('Content Security Policy', () => {
  for (const path of ALL_PAGES) {
    test(`${path} ships a hash-based CSP with no violations`, async ({ page }) => {
      const violations: string[] = [];
      await page.exposeFunction('reportCspViolation', (v: string) => violations.push(v));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          (window as unknown as { reportCspViolation: (v: string) => void }).reportCspViolation(
            `${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`,
          );
        });
      });

      await page.goto(path);
      const csp = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
      expect(csp).toMatch(/script-src 'self'[^;]* 'sha256-/);
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      expect(csp).toContain("style-src-attr 'unsafe-inline'");

      // Exercise interactive islands (theme toggle) before checking.
      await page.getByRole('button', { name: /toggle theme/i }).first().click();
      expect(violations).toEqual([]);
    });
  }
});

test('navigations prefetch internal links on hover', async ({ page }) => {
  await page.goto('/');
  const prefetched = page.waitForRequest((r) => new URL(r.url()).pathname.startsWith('/blog'));
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Blog' }).hover();
  await prefetched;
});

test.describe('social previews', () => {
  for (const path of PAGES) {
    test(`${path} og:image resolves`, async ({ page, request }) => {
      await page.goto(path);
      const og = await page.locator('meta[property="og:image"]').getAttribute('content');
      expect(og).toBeTruthy();
      // og:image is absolute on the production domain; check the same path locally
      const response = await request.get(new URL(og!).pathname);
      expect(response.status(), og!).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    });
  }
});
