/**
 * Delivery helpers for Velocity's form actions (src/actions/index.ts).
 *
 * Velocity doesn't pick an email or newsletter provider for you. Out of the box
 * a form can forward submissions to an HTTP endpoint you set in `.env`
 * (CONTACT_FORM_ENDPOINT, NEWSLETTER_ENDPOINT). Anything more specific, such as
 * Resend, Postmark or a CRM SDK, goes in the action itself.
 */

/**
 * A failed delivery. Carries only the HTTP status (when the endpoint answered),
 * never the endpoint URL, which can contain a token.
 */
export class DeliveryError extends Error {
  constructor(readonly status?: number) {
    super(status ? `Form endpoint responded with ${status}` : 'Form endpoint could not be reached');
    this.name = 'DeliveryError';
  }
}

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
    // A redirect would be followed as a GET without the body, and a 2xx from
    // that would report a submission that never arrived.
    redirect: 'error',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // Release the connection; only the status matters.
  await response.body?.cancel().catch(() => {});
  if (!response.ok) throw new DeliveryError(response.status);
}

/**
 * A form with no delivery configured while FORMS_REQUIRE_DELIVERY is on. Its
 * message names the variable to set; it holds no secret, so it is safe to log.
 */
export class DeliveryNotConfiguredError extends Error {
  constructor(
    readonly form: string,
    readonly envVar: string
  ) {
    super(
      `[velocity] The ${form} form has no delivery configured and FORMS_REQUIRE_DELIVERY is on, so the submission was rejected. ` +
        `Set ${envVar} where the server runs, or add your provider in src/actions/index.ts.`
    );
    this.name = 'DeliveryNotConfiguredError';
  }
}

/**
 * What a form does when no delivery is configured.
 *
 * - `required` false (the default): warn once and let the action report
 *   success, so a fresh project's forms work before a provider is chosen.
 * - `required` true (FORMS_REQUIRE_DELIVERY=true): throw, so the visitor sees
 *   the form's error instead of a success for a message nobody receives. Turn
 *   it on in production once the site is live.
 */
export function handleUndelivered(
  form: string,
  envVar: string,
  required: boolean | undefined,
  log: (message: string) => void = console.warn
): void {
  if (required) throw new DeliveryNotConfiguredError(form, envVar);
  warnUndelivered(form, envVar, log);
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
      `Set ${envVar} in .env or add your provider in src/actions/index.ts. ` +
      `Set FORMS_REQUIRE_DELIVERY=true in production to reject submissions instead.`
  );
}

/** Test helper: forget which forms have already warned. */
export function resetDeliveryWarnings(): void {
  warned.clear();
}
