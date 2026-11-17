import { afterEach, describe, expect, it, vi } from 'vitest';

/** The schema as it reaches the page: JSON drops every key left undefined */
const rendered = (schema: unknown) => JSON.parse(JSON.stringify(schema));

afterEach(() => {
  vi.doUnmock('@/config/nav.config');
  vi.resetModules();
});

describe('createWebsiteSchema search action', () => {
  it('points at the search route the project has', async () => {
    const { routes } = await import('@/config/nav.config');
    const { default: siteConfig } = await import('@/config/site.config');
    const { createWebsiteSchema } = await import('@/lib/schema');

    const search = (routes as Record<string, { path: string } | undefined>).search;
    expect(search, 'this repo ships a search page').toBeDefined();
    expect(rendered(createWebsiteSchema()).potentialAction.target.urlTemplate).toBe(
      `${siteConfig.url}/${search!.path}?q={search_term_string}`,
    );
  });

  it('is left out when the project has no search route', async () => {
    vi.doMock('@/config/nav.config', () => ({ routes: { home: { path: '' }, blog: { path: 'blog' } } }));
    const { createWebsiteSchema } = await import('@/lib/schema');

    const schema = rendered(createWebsiteSchema());
    expect(schema['@type']).toBe('WebSite');
    expect(schema).not.toHaveProperty('potentialAction');
  });
});
