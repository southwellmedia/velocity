import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4399);

/**
 * Form endpoints point at a local mock (tests/e2e/mock-endpoint.mjs), so the
 * suite checks real delivery and never calls the project's own provider.
 * Projects without the mock keep the old behavior.
 */
const MOCK = 'tests/e2e/mock-endpoint.mjs';
const MOCK_PORT = PORT - 1;
const mock = existsSync(MOCK);
const mockUrl = `http://127.0.0.1:${MOCK_PORT}`;
process.env.MOCK_ENDPOINT_URL = mock ? mockUrl : '';

/**
 * E2E tests run against the production build served by the Node adapter, so
 * prerendered pages, Astro Actions and the Pagefind index are all real.
 * Build first: `pnpm build && pnpm test:e2e` (CI does this).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    ...(mock
      ? [{ command: `"${process.execPath}" ${MOCK} ${MOCK_PORT}`, url: `${mockUrl}/`, reuseExistingServer: false }]
      : []),
    {
      command: `"${process.execPath}" dist/server/entry.mjs`,
      port: PORT,
      env: {
        HOST: '127.0.0.1',
        PORT: String(PORT),
        ...(mock
          ? {
              CONTACT_FORM_ENDPOINT: `${mockUrl}/contact`,
              NEWSLETTER_ENDPOINT: `${mockUrl}/newsletter`,
              NEWSLETTER_API_KEY: 'e2e-newsletter-key',
            }
          : {}),
      },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
