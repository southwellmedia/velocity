import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import siteConfig from '@/config/site.config';
import {
  createBlogPostSchema,
  createLocalBusinessSchema,
  createOrganizationSchema,
  createProductSchema,
} from '@/lib/schema';

/** The schema as it reaches the page: JSON drops every key left undefined */
const rendered = (schema: unknown) => JSON.parse(JSON.stringify(schema));

describe('schema logos', () => {
  const post = createBlogPostSchema({
    title: 'A post',
    description: 'About something',
    url: `${siteConfig.url}/blog/a-post/`,
    image: `${siteConfig.url}/og/blog/a-post.png`,
    datePublished: new Date('2026-11-03'),
    author: { name: 'Ada' },
  });

  it('point at a file the project ships', () => {
    const logo = rendered(createOrganizationSchema()).logo as string;
    expect(logo.startsWith(siteConfig.url)).toBe(true);
    expect(fs.existsSync(`public${new URL(logo).pathname}`)).toBe(true);
  });

  it('are the same for the organization and a post publisher', () => {
    expect(rendered(post).publisher.logo.url).toBe(rendered(createOrganizationSchema()).logo);
  });
});

describe('createLocalBusinessSchema', () => {
  it('takes the name and contact details from the site config', () => {
    const schema = rendered(createLocalBusinessSchema());
    expect(schema).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: siteConfig.name,
      url: siteConfig.url,
      telephone: siteConfig.phone,
      email: siteConfig.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: siteConfig.address?.street,
        addressLocality: siteConfig.address?.city,
        addressCountry: siteConfig.address?.country,
      },
    });
  });

  it('uses the type and the details it is given', () => {
    const schema = rendered(
      createLocalBusinessSchema({
        type: 'Restaurant',
        name: 'Vesper',
        telephone: '+15035550142',
        address: { street: '18 Calloway Row', city: 'Portland', state: 'OR', zip: '97205', country: 'US' },
        geo: { latitude: 45.52, longitude: -122.68 },
        priceRange: '$$$',
        extra: { servesCuisine: 'Wood-fire cooking', acceptsReservations: true },
      }),
    );
    expect(schema).toMatchObject({
      '@type': 'Restaurant',
      name: 'Vesper',
      telephone: '+15035550142',
      address: { streetAddress: '18 Calloway Row', addressRegion: 'OR', postalCode: '97205' },
      geo: { '@type': 'GeoCoordinates', latitude: 45.52, longitude: -122.68 },
      priceRange: '$$$',
      servesCuisine: 'Wood-fire cooking',
      acceptsReservations: true,
    });
  });

  it('writes one opening-hours entry per run of days', () => {
    const schema = rendered(
      createLocalBusinessSchema({
        openingHours: [
          { days: ['Tuesday', 'Wednesday'], opens: '17:30', closes: '22:00' },
          { days: ['Sunday'], opens: '12:00', closes: '20:00' },
        ],
      }),
    );
    expect(schema.openingHoursSpecification).toEqual([
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Tuesday', 'Wednesday'], opens: '17:30', closes: '22:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Sunday'], opens: '12:00', closes: '20:00' },
    ]);
  });

  it('leaves out what it was not given', () => {
    const schema = rendered(createLocalBusinessSchema({ address: null }));
    for (const key of ['address', 'geo', 'image', 'openingHoursSpecification', 'priceRange']) {
      expect(schema).not.toHaveProperty(key);
    }
  });

  it('makes image paths absolute', () => {
    const schema = rendered(createLocalBusinessSchema({ image: ['/photos/room.jpg', 'https://cdn.example.org/bar.jpg'] }));
    expect(schema.image).toEqual([`${siteConfig.url}/photos/room.jpg`, 'https://cdn.example.org/bar.jpg']);
  });
});

describe('createProductSchema', () => {
  const base = { name: 'Field jacket', description: 'Waxed cotton', url: '/shop/field-jacket/', image: '/photos/jacket.jpg' };

  it('states the price as an offer in stock, in US dollars unless told otherwise', () => {
    const schema = rendered(createProductSchema({ ...base, price: 285 }));
    expect(schema).toMatchObject({
      '@type': 'Product',
      name: 'Field jacket',
      url: `${siteConfig.url}/shop/field-jacket/`,
      image: [`${siteConfig.url}/photos/jacket.jpg`],
      brand: { '@type': 'Brand', name: siteConfig.name },
      offers: {
        '@type': 'Offer',
        url: `${siteConfig.url}/shop/field-jacket/`,
        price: '285',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    });
    expect(schema.offers).not.toHaveProperty('priceValidUntil');
  });

  it('carries a currency, an end date, stock and a brand when given', () => {
    const schema = rendered(
      createProductSchema({
        ...base,
        price: '49.00',
        currency: 'EUR',
        priceValidUntil: '2026-12-31',
        availability: 'PreOrder',
        brand: 'Northline',
        sku: 'NL-100',
      }),
    );
    expect(schema).toMatchObject({
      sku: 'NL-100',
      brand: { name: 'Northline' },
      offers: { price: '49.00', priceCurrency: 'EUR', priceValidUntil: '2026-12-31', availability: 'https://schema.org/PreOrder' },
    });
  });

  it('never invents ratings or reviews', () => {
    const schema = rendered(createProductSchema({ ...base, price: 285 }));
    expect(schema).not.toHaveProperty('aggregateRating');
    expect(schema).not.toHaveProperty('review');
  });
});
