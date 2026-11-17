import { afterEach, describe, expect, it, vi } from 'vitest';

/** The schema as it reaches the page: JSON drops every key left undefined */
const rendered = (schema: unknown) => JSON.parse(JSON.stringify(schema));

/** The site-wide schema as a project with these routes would render it */
async function websiteSchemaWith(routes: Record<string, { path: string }>) {
  vi.doMock('@/config/nav.config', () => ({ routes }));
  const { createWebsiteSchema } = await import('@/lib/schema');
  return rendered(createWebsiteSchema());
}

afterEach(() => {
  vi.doUnmock('@/config/nav.config');
  vi.resetModules();
});

describe('createWebsiteSchema search action', () => {
  it('points at the search route when the project has one', async () => {
    const { default: siteConfig } = await import('@/config/site.config');
    const schema = await websiteSchemaWith({ home: { path: '' }, search: { path: 'find' } });

    expect(schema.potentialAction.target.urlTemplate).toBe(`${siteConfig.url}/find?q={search_term_string}`);
  });

  it('is left out when the project has no search route', async () => {
    const schema = await websiteSchemaWith({ home: { path: '' }, blog: { path: 'blog' } });

    expect(schema['@type']).toBe('WebSite');
    expect(schema).not.toHaveProperty('potentialAction');
  });
});
