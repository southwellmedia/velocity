import { expect, test } from '@playwright/test';
import { hasRoute } from './site';

test.describe('contact form (Astro Action)', () => {
  test.skip(!hasRoute('contact'), 'no contact page in this project');

  test('submits successfully', async ({ page }) => {
    await page.goto('/contact');
    const form = page.locator('#contact-form');
    await form.getByLabel('Name').fill('Ada Lovelace');
    await form.getByLabel('Email').fill('ada@example.com');
    await form.getByLabel('Message').fill('Hello from the Playwright suite!');

    const actionCall = page.waitForResponse((r) => r.url().includes('/_actions/contact'));
    await form.getByRole('button', { name: 'Send Message' }).click();
    expect((await actionCall).status()).toBe(200);

    await expect(page.locator('#form-message')).toHaveText(/^Message sent successfully!/);
    await expect(form.getByLabel('Name')).toHaveValue('');
  });

  test('shows server-side validation errors', async ({ page }) => {
    await page.goto('/contact');
    const form = page.locator('#contact-form');
    await form.getByLabel('Name').fill('Ada');
    await form.getByLabel('Email').fill('ada@example.com');
    // Passes the browser's `required` check but fails the 10-char server rule
    await form.getByLabel('Message').fill('Too short');
    await form.getByRole('button', { name: 'Send Message' }).click();

    await expect(page.locator('#form-message')).toHaveText(/at least 10 characters/);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('forms still reach their Action', async ({ page }) => {
    test.skip(!hasRoute('contact'), 'no contact page in this project');
    await page.goto('/contact');
    const form = page.locator('#contact-form');
    await form.getByLabel('Name').fill('Ada Lovelace');
    await form.getByLabel('Email').fill('ada@example.com');
    await form.getByLabel('Message').fill('Hello from a browser without JavaScript');

    const actionCall = page.waitForResponse((r) => r.url().includes('/_actions/contact'));
    await form.getByRole('button', { name: 'Send Message' }).click();
    expect((await actionCall).status()).toBe(200);
  });
});

test('newsletter form subscribes via Astro Action', async ({ page }) => {
  await page.goto('/blog');
  const form = page.locator('form.newsletter-form').first();
  await form.locator('input[name="email"]').fill('ada@example.com');
  await form.getByRole('button').click();
  await expect(form.locator('.newsletter-message')).toHaveText('Thanks for subscribing!');
});
