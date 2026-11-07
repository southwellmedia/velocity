import { ActionError, defineAction } from 'astro:actions';
import { CONTACT_FORM_ENDPOINT, NEWSLETTER_API_KEY, NEWSLETTER_ENDPOINT } from 'astro:env/server';
import { contactSchema, newsletterSchema } from '@/lib/forms';
import { postJson, warnUndelivered, DeliveryError } from '@/lib/form-delivery';

/**
 * Astro Actions — type-safe server functions for Velocity's forms.
 *
 * Actions always render on demand (via the adapter resolved in
 * astro.config.mjs), even though every page is prerendered. Call them from the
 * client with `actions.contact(formData)` or render `<form action={actions.contact}>`.
 *
 * Delivery:
 * - Set CONTACT_FORM_ENDPOINT / NEWSLETTER_ENDPOINT in `.env` to forward each
 *   submission as JSON to your own endpoint (a webhook, a serverless function,
 *   Zapier, Formspree and so on). NEWSLETTER_API_KEY, when set, is sent as a
 *   Bearer token with newsletter requests.
 * - Or replace the forwarding below with your provider's SDK (Resend,
 *   Postmark, a CRM, Mailchimp...).
 * - With neither, submissions are discarded and the server logs a warning.
 *   That path is marked @velocity-stub; `npm run check:agent` warns about it
 *   while the endpoint isn't set. Delete the marker once a provider is wired.
 */
export const server = {
  contact: defineAction({
    accept: 'form',
    input: contactSchema,
    handler: async ({ honeypot, ...data }) => {
      // Bots fill hidden fields. Report success so they don't retry, but drop it.
      if (honeypot) return { success: true };

      if (CONTACT_FORM_ENDPOINT) {
        await deliver('contact', () => postJson(CONTACT_FORM_ENDPOINT!, data));
        return { success: true };
      }

      // @velocity-stub contact (no delivery configured: discarded, see npm run check:agent)
      warnUndelivered('contact', 'CONTACT_FORM_ENDPOINT');
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[actions.contact]', data);
      }
      return { success: true };
    },
  }),

  newsletter: defineAction({
    accept: 'form',
    input: newsletterSchema,
    handler: async ({ email, website }) => {
      if (website) return { success: true };

      if (NEWSLETTER_ENDPOINT) {
        const headers: Record<string, string> = NEWSLETTER_API_KEY
          ? { authorization: `Bearer ${NEWSLETTER_API_KEY}` }
          : {};
        await deliver('newsletter', () => postJson(NEWSLETTER_ENDPOINT!, { email }, headers));
        return { success: true };
      }

      // @velocity-stub newsletter (no delivery configured: discarded, see npm run check:agent)
      warnUndelivered('newsletter', 'NEWSLETTER_ENDPOINT');
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[actions.newsletter]', email);
      }
      return { success: true };
    },
  }),
};

/**
 * Run a delivery and turn any failure into an ActionError, so the form shows
 * its error message instead of telling the visitor it worked.
 */
async function deliver(form: string, send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    // Log only the status: a fetch error's message can include the endpoint URL and any token in it.
    const status = error instanceof DeliveryError ? error.status : undefined;
    console.error(`[actions.${form}] delivery failed${status ? ` (HTTP ${status})` : ' (endpoint unreachable or timed out)'}`);
    throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: `The ${form} form could not be delivered.` });
  }
}
