---
name: velocity-connect-forms
description: Connect this Velocity site's contact and newsletter forms to a real provider (Resend by default, or Postmark, a webhook or a newsletter service) through the Astro Actions in src/actions/index.ts, with secrets in astro:env. Use when asked to make the contact form send email, connect the newsletter signup, or set up form delivery.
---

# Connect the forms

**First, read the Project notes in `AGENTS.md`.** They describe this site's own conventions and take priority over the examples here.

`ContactForm` and `NewsletterForm` submit to the `contact` and `newsletter` Actions in `src/actions/index.ts`. Each Action forwards submissions as JSON to `CONTACT_FORM_ENDPOINT` or `NEWSLETTER_ENDPOINT` when that variable is set (with `NEWSLETTER_API_KEY` as a Bearer token), through `postJson` in `src/lib/form-delivery.ts`. With neither, it reports success, discards the submission and logs a warning. That discard path carries a marker line, `// @velocity-stub contact` or `// @velocity-stub newsletter`, and `npm run check:agent` reports it while the endpoint isn't set.

**If the user already has a webhook or form service** (Zapier, Make, Formspree, a serverless function), the endpoint route needs no code: set the variable in `.env` and on the host, then skip to step 6. On Vercel, Netlify and Cloudflare, set it in the platform's environment settings. A self-hosted Node server doesn't load `.env` by itself, so start it with `node --env-file=.env dist/server/entry.mjs`. Otherwise, wire a provider as below.

Actions run on the server through the deploy adapter, while every page stays prerendered. Don't add `output: 'server'`.

## 1. Choose a provider

Ask the user which provider they use. If they have no preference, use Resend.

| Form | Default | Alternatives |
|------|---------|--------------|
| Contact | Resend (`POST https://api.resend.com/emails`) | Postmark (`POST https://api.postmarkapp.com/email` with an `X-Postmark-Server-Token` header), or a webhook such as Zapier, Make or a CRM at `CONTACT_FORM_ENDPOINT` |
| Newsletter | Resend contacts | Buttondown, Kit, Mailchimp or another list provider, with its key in `NEWSLETTER_API_KEY` |

Call providers with `fetch`, not their Node SDKs. `fetch` works on every adapter Velocity deploys to: Node, Vercel, Netlify and Cloudflare. Read the provider's current API reference for the endpoint and body before writing the request, and don't guess field names.

Keep the forms posting to the Actions. `ContactForm` and `NewsletterForm` also accept an external `action` URL, but that skips the server-side honeypot check, and the CSP's `form-action 'self'` blocks it when JavaScript is off.

## 2. Declare the secrets

Add the variables to `env.schema` in `astro.config.mjs`. `CONTACT_FORM_ENDPOINT` and `NEWSLETTER_API_KEY` are already declared.

```js
RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
CONTACT_TO_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
CONTACT_FROM_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
```

Keep them `optional`, so the site still builds without them. The handler returns an error when one is missing.

Document each variable in `.env.example` with a placeholder value, never a real one. Put real values in `.env` locally, which git ignores, and in the hosting platform's environment settings for production. On Cloudflare, use `wrangler secret put`.

Import secrets from `astro:env/server`, never from `import.meta.env` or `process.env`.

## 3. Wire the contact Action

```ts
import { ActionError, defineAction } from 'astro:actions';
import { CONTACT_FROM_EMAIL, CONTACT_TO_EMAIL, RESEND_API_KEY } from 'astro:env/server';
import { contactSchema, newsletterSchema } from '@/lib/forms';

// inside `server`:
contact: defineAction({
  accept: 'form',
  input: contactSchema,
  handler: async ({ honeypot, ...data }) => {
    // Bots fill hidden fields. Report success so they don't retry, but drop it.
    if (honeypot) return { success: true };

    if (!RESEND_API_KEY || !CONTACT_TO_EMAIL || !CONTACT_FROM_EMAIL) {
      console.error('[actions.contact] RESEND_API_KEY, CONTACT_TO_EMAIL or CONTACT_FROM_EMAIL is not set');
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Contact form is not configured' });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: CONTACT_TO_EMAIL,
        reply_to: data.email,
        subject: data.subject || `New message from ${data.name}`,
        text: `${data.message}\n\nFrom: ${data.name} <${data.email}>`,
      }),
    });

    if (!response.ok) {
      console.error('[actions.contact] Resend returned', response.status, await response.text());
      throw new ActionError({ code: 'BAD_GATEWAY', message: 'Message could not be sent' });
    }

    return { success: true };
  },
}),
```

- Keep the honeypot check first, and keep `honeypot` (contact) and `website` (newsletter) optional in `src/lib/forms.ts`. A validation error would tell a bot which field gave it away.
- Throw an `ActionError` whenever delivery fails. Never return `{ success: true }` for a message that wasn't delivered. The forms show their translated error message for any `ActionError`.
- Send to the site owner and put the visitor's address in `reply_to`. Don't send to the visitor's address, or the form becomes an open relay.
- `CONTACT_FROM_EMAIL` must be on a domain verified in Resend. Resend's `onboarding@resend.dev` sender only delivers to the Resend account owner's own address, which is fine for a first test.
- Log the status and provider response with `console.error`, but never the API key. Remove the `import.meta.env.DEV` `console.log` of the submission, which logs personal data.
- For a webhook, you don't need this code: the Action already forwards to `CONTACT_FORM_ENDPOINT`. Replace that forwarding only when you switch to a provider.

## 4. Wire the newsletter Action

Use the same shape: keep `if (website) return { success: true };`, check the key, call the provider, and throw an `ActionError` unless the response is OK. An address that is already subscribed counts as success, so check how the provider reports it, often as a `409` status or an error code in the body. Don't treat other errors as success.

## 5. Remove the markers

When you replace an Action's forwarding with a provider, remove its discard path, `warnUndelivered` call and `// @velocity-stub` line along with it, so a missing key throws an `ActionError` instead of dropping submissions. In projects created before 2.3, delete the TODO comment the stub carried instead. If you used the endpoint route, leave the marker: `check:agent` stays quiet while the endpoint is set. Remove a marker only for a handler that delivers.

## 6. Send a real message

Validation and type checks don't prove delivery. Before you report a form as working, send a real submission through the provider.

1. If no API key is available in `.env` or the environment, **stop and ask the user for one**, along with the recipient and sender addresses. Don't invent a key, mock the provider, or report the form as working without a real send. Tell the user which variables to set and where.
2. Start the dev server with `npm run dev:bg` and get the port from `npx astro dev status`.
3. Submit the form in the browser, or post to the Action directly. `checkOrigin` is on, so send an `Origin` header:

   ```sh
   curl -i -X POST "http://localhost:4321/_actions/contact" \
     -H "Origin: http://localhost:4321" \
     -F name="Delivery test" -F email="you@example.com" \
     -F message="Testing the contact form delivery."
   ```

   Use the real port in both places, and post to `/_actions/newsletter` with only `-F email=…` for the newsletter.
4. Expect HTTP 200. Then confirm with the user, or in the provider's dashboard or logs, that the email arrived or the contact was added. A 200 alone only proves the handler didn't throw.
5. Unset the key, or set an invalid one, and check that the form now shows an error instead of success.

## 7. Update the E2E form tests

`tests/e2e/forms.spec.ts` expects successful submissions. The built server only reads the real environment, not `.env`, so without a key those tests now fail, and with a key every run sends a real email. Ask the user which they want:

- **Skip without a key:** add `test.skip(!process.env.RESEND_API_KEY, 'needs a form provider key')` to the tests that expect success. Keep the validation-error test running, because it never reaches the provider.
- **Run against the provider:** export the variables before running the suite, and use a test recipient such as Resend's `delivered@resend.dev`.

Don't change the Actions to fake success in tests.

## 8. Check your work

1. Run `npm run validate`.
2. Run `npm run check:agent`. It scans the source and build output for raw translation keys, CSP problems (inline event handlers, unhashed inline scripts), broken internal links and stubbed forms, and prints the file, the rule and the fix for each. It must no longer report the forms you connected.
3. Run `npm run build && npm run test:e2e` for the axe, CSP and form checks. If Playwright has no browser, run `npx playwright install chromium`.
4. Tell the user which variables production needs, and that the forms only deliver once those are set on the hosting platform.
