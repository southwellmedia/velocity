/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig applies Astro's Vite setup, so `astro/zod`, `@/` aliases and
// astro:* virtual modules resolve exactly as they do in the app.
export default getViteConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
