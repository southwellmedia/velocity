import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { hasRoute } from './site';

/**
 * playwright.config.ts points the form endpoints at tests/e2e/mock-endpoint.mjs.
 * The delivery tests run while the Actions still forward to those variables;
 * if you replace the forwarding with a provider SDK, mock that provider instead.
 */
const mockUrl = process.env.MOCK_ENDPOINT_URL;
const ACTIONS = 'src/actions/index.ts';
const forwards = (envVar: string) =>
  !!mockUrl && existsSync(ACTIONS) && readFileSync(ACTIONS, 'utf8').includes(envVar);

type Received = { path: string; authorization: string | null; body: Record<string, unknown> };

/** Wait for the mock endpoint to receive a submission matching `match`. */
async function received(request: APIRequestContext, match: (r: Received) => boolean) {
  let found: Received | undefined;
  await expect
    .poll(async () => {
      const all = (await (await request.get(`${mockUrl}/__received`)).json()) as Received[];
      found = all.find(match);
      return !!found;
    })
    .toBe(true);
  return found!;
}

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

test.describe('contact form delivery', () => {
  test.skip(!hasRoute('contact'), 'no contact page in this project');
  test.skip(!forwards('CONTACT_FORM_ENDPOINT'), 'the contact Action does not forward to CONTACT_FORM_ENDPOINT');

  async function fill(page: import('@playwright/test').Page, email: string, message: string) {
    await page.goto('/contact');
    const form = page.locator('#contact-form');
    await form.getByLabel('Name').fill('Ada Lovelace');
    await form.getByLabel('Email').fill(email);
    await form.getByLabel('Message').fill(message);
    await form.getByRole('button', { name: 'Send Message' }).click();
  }

  test('the endpoint receives the submission', async ({ page, request }, info) => {
    const email = `delivered-${info.testId}@example.com`;
    await fill(page, email, 'Hello from the delivery test');
    await expect(page.locator('#form-message')).toHaveText(/^Message sent successfully!/);

    const hit = await received(request, (r) => r.body.email === email);
    expect(hit.path).toBe('/contact');
    expect(hit.body).toMatchObject({ name: 'Ada Lovelace', email, message: 'Hello from the delivery test' });
    expect(hit.body).not.toHaveProperty('honeypot');
  });

  test('a failed delivery shows an error, not a success', async ({ page }, info) => {
    await fill(page, `failed-${info.testId}@example.com`, 'mock-fail: the endpoint answers 502');
    await expect(page.locator('#form-message')).toHaveText('Something went wrong');
    await expect(page.locator('#contact-form').getByLabel('Name')).toHaveValue('Ada Lovelace');
  });
});

test.describe('newsletter delivery', () => {
  test.skip(!forwards('NEWSLETTER_ENDPOINT'), 'the newsletter Action does not forward to NEWSLETTER_ENDPOINT');

  test('the endpoint receives the address with the API key', async ({ page, request }, info) => {
    const email = `subscriber-${info.testId}@example.com`;
    await page.goto('/blog');
    const form = page.locator('form.newsletter-form').first();
    await form.locator('input[name="email"]').fill(email);
    await form.getByRole('button').click();
    await expect(form.locator('.newsletter-message')).toHaveText('Thanks for subscribing!');

    const hit = await received(request, (r) => r.body.email === email);
    expect(hit).toEqual({ path: '/newsletter', authorization: 'Bearer e2e-newsletter-key', body: { email } });
  });

  test('a failed delivery shows an error', async ({ page }, info) => {
    await page.goto('/blog');
    const form = page.locator('form.newsletter-form').first();
    await form.locator('input[name="email"]').fill(`mock-fail-${info.testId}@example.com`);
    await form.getByRole('button').click();
    await expect(form.locator('.newsletter-message')).toHaveText('Something went wrong');
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
