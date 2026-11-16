/**
 * Analytics events
 *
 * `track()` sends an event to whichever of GA4 or Google Tag Manager
 * `Analytics.astro` loaded, and does nothing when neither is configured. Consent
 * is Google Consent Mode's job: events sent without consent go out as cookieless
 * pings, or not at all in strict mode before consent.
 *
 * Elements can also be tracked without code: `ClickTracking.astro` sends
 * `data-track="event_name"` on click, with every `data-track-*` attribute as a
 * parameter (`data-track-link-location="hero"` → `link_location: 'hero'`).
 */

export type TrackParams = Record<string, string | number | boolean | unknown[] | Record<string, unknown>>;

interface AnalyticsWindow {
  dataLayer?: unknown[];
}

const PREFIX = 'data-track-';
const NUMBER = /^-?\d+(\.\d+)?$/;

/** Item fields that GA4 ecommerce events expect inside `items`, not at the top level */
const ITEM_FIELDS = ['item_id', 'item_name', 'item_category', 'item_variant', 'price', 'quantity'];

/**
 * Turns `data-track-*` attributes into event parameters: names lose the prefix
 * and use underscores, and numeric values become numbers. When an `item_id` or
 * `item_name` is present, the item fields move into a one-item `items` array,
 * so ecommerce events such as `begin_checkout` reach GA4's ecommerce reports.
 */
export function paramsFromAttributes(attributes: Iterable<{ name: string; value: string }>): TrackParams {
  const params: TrackParams = {};
  for (const { name, value } of attributes) {
    if (!name.startsWith(PREFIX)) continue;
    const key = name.slice(PREFIX.length).replace(/-/g, '_');
    if (!key) continue;
    params[key] = NUMBER.test(value) ? Number(value) : value;
  }

  if ('item_id' in params || 'item_name' in params) {
    const item: Record<string, unknown> = {};
    for (const field of ITEM_FIELDS) {
      if (field in params) {
        item[field] = params[field];
        delete params[field];
      }
    }
    params.items = [item];
  }
  return params;
}

function readConfig(): { gtmId: string | null; gaId: string | null } | null {
  const el = typeof document !== 'undefined' ? document.getElementById('analytics-data') : null;
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

/** Sends an analytics event. Safe to call when analytics isn't configured. */
export function track(event: string, params: TrackParams = {}): void {
  const config = readConfig();
  if (!config || (!config.gtmId && !config.gaId)) return;

  const w = window as unknown as AnalyticsWindow;
  w.dataLayer = w.dataLayer || [];

  if (config.gtmId) {
    // GTM reads plain objects. Clear the previous ecommerce object first, as
    // Google recommends, so items from one event don't leak into the next.
    if (Array.isArray(params.items)) {
      const { items, currency, value, ...rest } = params;
      w.dataLayer.push({ ecommerce: null });
      w.dataLayer.push({ event, ...rest, ecommerce: { currency, value, items } });
    } else {
      w.dataLayer.push({ event, ...params });
    }
    return;
  }

  // gtag.js reads the Arguments object, not an array
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params -- GA4 requires the Arguments object
    w.dataLayer!.push(arguments);
  }
  // Beacon transport lets the hit survive the click navigating away
  gtag('event', event, { ...params, transport_type: 'beacon' });
}

/** Sends the `data-track` event of the clicked element, if any. */
export function trackClick(e: MouseEvent): void {
  // Middle-click opens a link too; other auxiliary buttons don't
  if (e.type === 'auxclick' && e.button !== 1) return;
  const target = e.target instanceof Element ? e.target.closest('[data-track]') : null;
  if (!target) return;
  const event = target.getAttribute('data-track');
  if (!event) return;

  const params = paramsFromAttributes(target.attributes);
  if (target instanceof HTMLAnchorElement && target.href) params.link_url = target.href;
  track(event, params);
}
