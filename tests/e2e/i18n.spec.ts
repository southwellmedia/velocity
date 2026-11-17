import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { defaultLocale, locales } from '../../src/i18n/locales.mjs';
import { posts } from './site';

/**
 * Multilingual behaviour. Runs only when more than one locale is enabled
 * (e.g. a project created with `--i18n`, or the i18n scaffold variant in CI).
 */
const others = (locales as readonly string[]).filter((l) => l !== defaultLocale);
test.skip(others.length === 0, 'single-locale project');

test.describe('i18n', () => {
  for (const locale of others) {
    test(`/${locale}/ renders in ${locale}`, async ({ page }) => {
      const response = await page.goto(`/${locale}/`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
    });

    test(`/${locale}/ links alternates and switches language`, async ({ page, request }) => {
      await page.goto(`/${locale}/`);
      const hreflangs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
        els.map((el) => ({ lang: el.getAttribute('hreflang'), href: el.getAttribute('href') })),
      );
      expect(hreflangs.map((h) => h.lang)).toContain('x-default');
      for (const { href } of hreflangs) {
        expect((await request.get(new URL(href!).pathname)).status(), href!).toBe(200);
      }
    });

    test(`/${locale}/ nav links stay in ${locale}`, async ({ page, request }) => {
      await page.goto(`/${locale}/`);
      const hrefs = await page
        .getByRole('navigation', { name: /./ })
        .first()
        .locator('a[href^="/"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('href')!));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect((await request.get(href)).status(), href).toBe(200);
      }
    });
  }

  // Translations share a file name in each locale's folder
  for (const locale of others) {
    const slug = posts.find((p) =>
      ['md', 'mdx'].some((ext) => fs.existsSync(path.join('src/content/blog', locale, `${p}.${ext}`))),
    );
    test(`language switcher follows a post to its ${locale} translation`, async ({ page }) => {
      test.skip(!slug, `no ${locale} translation of a post`);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/blog/${slug}`);
      await page.locator('details.lang-switcher summary').first().click();
      const link = page.locator(`details.lang-switcher a[hreflang^="${locale}"]`).first();
      await expect(link).toHaveAttribute('href', new RegExp(`/blog/${slug}/?$`));
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/.*${slug}`));
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
    });
  }

  for (const locale of others) {
    test(`/${locale}/ hreflang links match the canonical URL`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      const hrefs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('href')),
      );
      expect(hrefs).toContain(canonical);
      for (const href of hrefs) expect(href).toMatch(/\/$/);
    });

    test(`unknown URLs under /${locale}/ get a 404 in ${locale}`, async ({ page }) => {
      const response = await page.goto(`/${locale}/does-not-exist`);
      expect(response?.status()).toBe(404);
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
    });
  }

  // With several locales the 404 is rendered on demand, so its policy is a header
  // sent before the layout renders. Scripts the layout renders inline (the theme
  // script) must already be in it, or the browser blocks them.
  for (const locale of locales as readonly string[]) {
    const path = locale === defaultLocale ? '/does-not-exist' : `/${locale}/does-not-exist`;
    test(`${path} has no CSP violations`, async ({ page }) => {
      const violations: string[] = [];
      await page.exposeFunction('reportCspViolation', (v: string) => violations.push(v));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          (window as unknown as { reportCspViolation: (v: string) => void }).reportCspViolation(
            `${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`,
          );
        });
      });

      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      const csp =
        response?.headers()['content-security-policy'] ??
        (await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content'));
      expect(csp).toMatch(/script-src 'self'[^;]* 'sha256-/);
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);

      // Exercise the theme toggle before checking. Its label is translated, so find it by id.
      await page.locator('#theme-toggle').first().click();
      expect(violations).toEqual([]);
    });
  }

  test('language switcher offers every locale', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.locator('details.lang-switcher summary').first().click();
    for (const locale of locales) {
      await expect(page.locator(`details.lang-switcher a[hreflang^="${locale}"]`).first()).toBeVisible();
    }
  });
});
