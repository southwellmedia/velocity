import { expect, test } from '@playwright/test';
import { posts } from './site';

// Search for a word from the first post's slug and expect that post in the results.
const slug = posts[0];
const query = slug?.split('-').find((word) => word.length > 3) ?? slug;

test.describe('site search (Pagefind)', () => {
  test.skip(!slug, 'no blog posts to search for');

  test('finds a blog post', async ({ page }) => {
    await page.goto('/search');
    await page.getByRole('searchbox').fill(query!);
    await expect(page.locator(`#search-results a[href*="/blog/${slug}"]`).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`\\?q=${query}`));
  });

  test('reads the query from the URL', async ({ page }) => {
    await page.goto(`/search?q=${query}`);
    await expect(page.locator('#search-results li').first()).toBeVisible();
  });
});

test('does not index the components showcase', async ({ page }) => {
  await page.goto('/search?q=Dropdown');
  await expect(page.locator('#search-status')).toBeVisible();
  await expect(page.locator('#search-results a[href^="/components"]')).toHaveCount(0);
});
