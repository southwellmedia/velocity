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
    await form.getByLabel('Message').fill('Too short');
    // Skip the browser's own checks (minlength) to reach the 10-char server rule
    await form.evaluate((el: HTMLFormElement) => (el.noValidate = true));
    await form.getByRole('button', { name: 'Send Message' }).click();

    await expect(page.locator('#form-message')).toHaveText(/at least 10 characters/);
  });

  test('shows a field error only after interaction, linked for screen readers', async ({ page }) => {
    await page.goto('/contact');
    const form = page.locator('#contact-form');
    const message = form.getByLabel('Message');
    const error = form.locator('[data-field-error]').filter({ has: page.locator('[data-field-error-text]') });

    // Nothing on load, even though the empty required field is invalid
    await expect(message).not.toHaveAttribute('aria-invalid', 'true');
    await expect(error.first()).toBeHidden();

    await message.fill('Too short');
    await message.blur();
    await expect(message).toHaveAttribute('aria-invalid', 'true');
    const errorId = await message.getAttribute('data-error-id');
    await expect(message).toHaveAttribute('aria-describedby', new RegExp(`\\b${errorId}\\b`));
    // In the site's language (ui.ts), not the browser's
    await expect(page.locator(`#${errorId}`)).toContainText('Use at least 10 characters (you have 9).');

    // Clears as soon as the value is valid
    await message.fill('Long enough to pass the check');
    await expect(message).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator(`#${errorId}`)).toBeHidden();
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
