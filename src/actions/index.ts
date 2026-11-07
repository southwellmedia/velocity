import { defineAction } from 'astro:actions';
import { contactSchema, newsletterSchema } from '@/lib/forms';

/**
 * Astro Actions — type-safe server functions for Velocity's forms.
 *
 * Actions always render on demand (via the adapter resolved in
 * astro.config.mjs), even though every page is prerendered. Call them from the
 * client with `actions.contact(formData)` or render `<form action={actions.contact}>`.
 *
 * Replace the TODOs with your email provider, CRM, or newsletter API, then
 * delete the @velocity-stub lines. Until then the forms report success but
 * deliver nothing, and `npm run check:agent` warns about them.
 */
export const server = {
  contact: defineAction({
    accept: 'form',
    input: contactSchema,
    handler: async ({ honeypot, ...data }) => {
      // Bots fill hidden fields. Report success so they don't retry, but drop it.
      if (honeypot) return { success: true };

      // @velocity-stub contact (npm run check:agent reports this line until it's removed)
      // TODO: deliver the message — e.g. Resend, Postmark, a CRM, or forward
      // to CONTACT_FORM_ENDPOINT (see .env.example / astro:env/server).
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

      // @velocity-stub newsletter (npm run check:agent reports this line until it's removed)
      // TODO: subscribe the address with your provider (NEWSLETTER_API_KEY).
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[actions.newsletter]', email);
      }

      return { success: true };
    },
  }),
};
