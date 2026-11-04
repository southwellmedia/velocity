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

  test('language switcher offers every locale', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.locator('details.lang-switcher summary').first().click();
    for (const locale of locales) {
      await expect(page.locator(`details.lang-switcher a[hreflang^="${locale}"]`).first()).toBeVisible();
    }
  });
});
