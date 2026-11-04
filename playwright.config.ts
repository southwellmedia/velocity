import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4399);

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
  webServer: {
    command: `"${process.execPath}" dist/server/entry.mjs`,
    port: PORT,
    env: { HOST: '127.0.0.1', PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
});
