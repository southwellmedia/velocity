import { z } from 'astro/zod';

/**
 * Form schemas shared by Astro Actions (src/actions) and unit tests.
 *
 * Error messages are translation keys (see form.errors.* in src/i18n/ui.ts);
 * the form components translate them in the visitor's language.
 *
 * Honeypot fields are optional strings. Never reject them in validation:
 * a validation error tells a bot exactly which field gave it away.
 */

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'form.errors.nameTooShort').max(100, 'form.errors.nameTooLong'),
  email: z.email('form.errors.invalidEmail'),
  subject: z.string().trim().max(200, 'form.errors.subjectTooLong').optional(),
  message: z
    .string()
    .trim()
    .min(10, 'form.errors.messageTooShort')
    .max(5000, 'form.errors.messageTooLong'),
  honeypot: z.string().optional(),
});

export const newsletterSchema = z.object({
  email: z.email('form.errors.invalidEmail'),
  website: z.string().optional(),
});

/** Every message key the schemas can produce (forms embed their translations). */
export const formErrorKeys = [
  'form.errors.nameTooShort',
  'form.errors.nameTooLong',
  'form.errors.invalidEmail',
  'form.errors.subjectTooLong',
  'form.errors.messageTooShort',
  'form.errors.messageTooLong',
] as const;

export type ContactInput = z.infer<typeof contactSchema>;
export type NewsletterInput = z.infer<typeof newsletterSchema>;
