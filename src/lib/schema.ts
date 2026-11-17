/**
 * Structured data (schema.org JSON-LD) for search engines. Build an object with
 * one of these helpers and render it with `<JsonLd schema={...} />`
 * (src/components/seo/JsonLd.astro), anywhere in the page.
 *
 *   createWebsiteSchema        every page (BaseLayout)
 *   createOrganizationSchema   the home page (`includeOrgSchema` on a layout)
 *   createLocalBusinessSchema  a business with an address: restaurant, clinic, shop, contractor
 *   createProductSchema        a page that sells one thing at a price
 *   createBlogPostSchema       blog posts (BlogLayout)
 *   createBreadcrumbSchema     breadcrumbs (Breadcrumbs)
 *   createFAQSchema            questions and answers (Faq)
 *
 * Only state what the page itself shows. Search engines compare the two.
 */
import type {
  WebSite,
  Organization,
  LocalBusiness,
  Product,
  BlogPosting,
  BreadcrumbList,
  FAQPage,
  WithContext,
  SearchAction,
} from 'schema-dts';
import siteConfig from '@/config/site.config';

/** An absolute URL on this site */
const absolute = (path: string) => new URL(path, siteConfig.url).toString();

/**
 * The site's mark, for Organization and publisher logos. The favicon is the one
 * logo file with a public address: the logos in src/assets/ are fingerprinted.
 */
function logoUrl() {
  // Read loosely: a project's own SiteConfig may predate `branding`
  const favicon = (siteConfig as { branding?: { favicon?: { svg?: string } } }).branding?.favicon?.svg;
  return absolute(favicon || '/favicon.svg');
}

/**
 * Create WebSite schema for homepage
 */
export function createWebsiteSchema(): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
      },
      'query-input': {
        '@type': 'PropertyValueSpecification',
        valueRequired: true,
        valueName: 'search_term_string',
      },
    } as SearchAction,
  };
}

/**
 * Create Organization schema
 */
export function createOrganizationSchema(): WithContext<Organization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: logoUrl(),
    sameAs: siteConfig.socialLinks,
    contactPoint: siteConfig.phone
      ? {
          '@type': 'ContactPoint',
          telephone: siteConfig.phone,
          contactType: 'customer service',
        }
      : undefined,
  };
}

export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

/** One run of days with the same hours, on the 24-hour clock: `{ days: ['Friday', 'Saturday'], opens: '17:30', closes: '23:00' }` */
export interface OpeningHours {
  days: Weekday[];
  opens: string;
  closes: string;
}

export interface LocalBusinessInput {
  /**
   * The schema.org type that fits the business: 'Restaurant', 'Dentist',
   * 'GeneralContractor', 'AutoRepair', 'Store'… (https://schema.org/LocalBusiness
   * lists them). Defaults to 'LocalBusiness'.
   */
  type?: string;
  /** Defaults to the site's name */
  name?: string;
  /** Defaults to the site's description */
  description?: string;
  /** The page about the business. Defaults to the site's home page. */
  url?: string;
  /** A photo of the place or its work: an absolute URL, or a path on this site */
  image?: string | string[];
  /** Defaults to `phone` in the site config */
  telephone?: string;
  /** Defaults to `email` in the site config */
  email?: string;
  /** Defaults to `address` in the site config. Pass `null` for a business with no premises to visit. */
  address?: { street: string; city: string; state?: string; zip?: string; country: string } | null;
  geo?: { latitude: number; longitude: number };
  /** Leave a day out and it is closed. Write these once, in a config file, and render the hours table from the same list. */
  openingHours?: OpeningHours[];
  /** schema.org's price range: '$' to '$$$$' */
  priceRange?: string;
  /**
   * Anything else schema.org defines for the type, added as written:
   * `{ servesCuisine: 'Italian', acceptsReservations: true }`,
   * `{ areaServed: 'Travis County' }`.
   */
  extra?: Record<string, unknown>;
}

/**
 * Create LocalBusiness schema: a business people visit or call, with its
 * address, phone and opening hours. Contact details default to the site config,
 * so a call with only `type` and `openingHours` is usually enough:
 *
 *   createLocalBusinessSchema({ type: 'Restaurant', openingHours: restaurant.hours, priceRange: '$$' })
 */
export function createLocalBusinessSchema(business: LocalBusinessInput = {}): WithContext<LocalBusiness> {
  const address = business.address === undefined ? siteConfig.address : business.address;
  const images = business.image === undefined ? [] : [business.image].flat();

  return {
    '@context': 'https://schema.org',
    '@type': business.type ?? 'LocalBusiness',
    name: business.name ?? siteConfig.name,
    description: business.description ?? siteConfig.description,
    url: business.url ?? siteConfig.url,
    image: images.length ? images.map(absolute) : undefined,
    telephone: business.telephone ?? siteConfig.phone,
    email: business.email ?? siteConfig.email,
    address: address
      ? {
          '@type': 'PostalAddress',
          streetAddress: address.street,
          addressLocality: address.city,
          addressRegion: address.state,
          postalCode: address.zip,
          addressCountry: address.country,
        }
      : undefined,
    geo: business.geo ? { '@type': 'GeoCoordinates', ...business.geo } : undefined,
    openingHoursSpecification: business.openingHours?.map((slot) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: slot.days,
      opens: slot.opens,
      closes: slot.closes,
    })),
    priceRange: business.priceRange,
    ...business.extra,
  } as WithContext<LocalBusiness>;
}

export interface ProductInput {
  name: string;
  description: string;
  /** The page that sells it. An absolute URL, or a path on this site. */
  url: string;
  /** An absolute URL, or a path on this site */
  image: string | string[];
  /** The price as a number, with no symbol: 49 or '49.00' */
  price: number | string;
  /** ISO 4217 code. Defaults to 'USD'. */
  currency?: string;
  /** The last day of this price, as YYYY-MM-DD, when it has an end date */
  priceValidUntil?: string;
  /** Defaults to 'InStock' */
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder' | 'Discontinued';
  /** Defaults to the site's name */
  brand?: string;
  sku?: string;
  category?: string;
}

/**
 * Create Product schema with one Offer: a page that sells one thing at a stated
 * price. Use the price the page shows. Ratings and reviews are left out on
 * purpose: add them only from real reviews the page displays.
 */
export function createProductSchema(product: ProductInput): WithContext<Product> {
  const url = absolute(product.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    url,
    image: [product.image].flat().map(absolute),
    sku: product.sku,
    category: product.category,
    brand: { '@type': 'Brand', name: product.brand ?? siteConfig.name },
    offers: {
      '@type': 'Offer',
      url,
      price: String(product.price),
      priceCurrency: product.currency ?? 'USD',
      priceValidUntil: product.priceValidUntil,
      availability: `https://schema.org/${product.availability ?? 'InStock'}`,
    },
  };
}

/**
 * Create BlogPosting schema for blog posts
 */
export function createBlogPostSchema(post: {
  title: string;
  description: string;
  url: string;
  image: string;
  datePublished: Date;
  dateModified?: Date;
  author: { name: string; url?: string };
}): WithContext<BlogPosting> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url: post.url,
    image: post.image,
    datePublished: post.datePublished.toISOString(),
    dateModified: post.dateModified?.toISOString() || post.datePublished.toISOString(),
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: post.author.url,
    },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      logo: {
        '@type': 'ImageObject',
        url: logoUrl(),
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': post.url,
    },
  };
}

/**
 * Create BreadcrumbList schema
 */
export function createBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Create FAQPage schema
 */
export function createFAQSchema(
  faqs: Array<{ question: string; answer: string }>
): WithContext<FAQPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
