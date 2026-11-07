/**
 * Delivery helpers for Velocity's form actions (src/actions/index.ts).
 *
 * Velocity doesn't pick an email or newsletter provider for you. Out of the box
 * a form can forward submissions to an HTTP endpoint you set in `.env`
 * (CONTACT_FORM_ENDPOINT, NEWSLETTER_ENDPOINT). Anything more specific, such as
 * Resend, Postmark or a CRM SDK, goes in the action itself.
 */

/** How long to wait for an endpoint before treating the submission as failed. */
const TIMEOUT_MS = 10_000;

/**
 * POST a JSON body to `endpoint`. Throws when the endpoint can't be reached or
 * answers with a non-2xx status, so the action can report a failure instead of
 * telling the visitor their message was sent.
 */
export async function postJson(
  endpoint: string,
  body: unknown,
  headers: Record<string, string> = {},
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Form endpoint responded with ${response.status} ${response.statusText}`.trim());
  }
}

const warned = new Set<string>();

/**
 * Log, once per form per server process, that submissions are being dropped
 * because no delivery is configured. Keeps the gap visible without failing
 * the form for visitors.
 */
export function warnUndelivered(
  form: string,
  envVar: string,
  log: (message: string) => void = console.warn
): void {
  if (warned.has(form)) return;
  warned.add(form);
  log(
    `[velocity] The ${form} form has no delivery configured, so submissions are discarded. ` +
      `Set ${envVar} in .env or add your provider in src/actions/index.ts.`
  );
}

/** Test helper: forget which forms have already warned. */
export function resetDeliveryWarnings(): void {
  warned.clear();
}
