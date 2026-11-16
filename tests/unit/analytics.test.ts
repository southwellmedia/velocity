import { afterEach, describe, expect, it, vi } from 'vitest';
import { paramsFromAttributes, track } from '@/lib/analytics';

const attrs = (o: Record<string, string>) => Object.entries(o).map(([name, value]) => ({ name, value }));

function stubPage(config: { gtmId: string | null; gaId: string | null }) {
  const dataLayer: unknown[] = [];
  vi.stubGlobal('document', { getElementById: () => ({ textContent: JSON.stringify(config) }) });
  vi.stubGlobal('window', { dataLayer });
  return dataLayer;
}

afterEach(() => vi.unstubAllGlobals());

describe('paramsFromAttributes', () => {
  it('keeps only data-track-* attributes, snake_cased, with numbers parsed', () => {
    expect(
      paramsFromAttributes(
        attrs({ 'data-track': 'cta', 'data-track-link-location': 'hero', 'data-track-value': '199', class: 'x' }),
      ),
    ).toEqual({ link_location: 'hero', value: 199 });
  });

  it('moves item fields into an items array for ecommerce events', () => {
    expect(
      paramsFromAttributes(
        attrs({
          'data-track-item-id': 'lifetime',
          'data-track-item-name': 'Lifetime access',
          'data-track-price': '199',
          'data-track-value': '199',
          'data-track-currency': 'USD',
        }),
      ),
    ).toEqual({
      value: 199,
      currency: 'USD',
      items: [{ item_id: 'lifetime', item_name: 'Lifetime access', price: 199 }],
    });
  });
});

describe('track', () => {
  it('does nothing without analytics configured', () => {
    const dataLayer = stubPage({ gtmId: null, gaId: null });
    track('cta');
    expect(dataLayer).toEqual([]);
  });

  it('sends a gtag event with beacon transport for GA4', () => {
    const dataLayer = stubPage({ gtmId: null, gaId: 'G-TEST' });
    track('cta', { link_location: 'hero' });
    expect(dataLayer).toHaveLength(1);
    expect(Array.from(dataLayer[0] as ArrayLike<unknown>)).toEqual([
      'event',
      'cta',
      { link_location: 'hero', transport_type: 'beacon' },
    ]);
  });

  it('pushes a GTM event with an ecommerce object, clearing the previous one first', () => {
    const dataLayer = stubPage({ gtmId: 'GTM-TEST', gaId: null });
    track('begin_checkout', { currency: 'USD', value: 49, link_location: 'hero', items: [{ item_id: 'saas' }] });
    expect(dataLayer).toEqual([
      { ecommerce: null },
      { event: 'begin_checkout', link_location: 'hero', ecommerce: { currency: 'USD', value: 49, items: [{ item_id: 'saas' }] } },
    ]);
  });
});
