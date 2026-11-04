import { describe, expect, it } from 'vitest';
import { contactSchema, newsletterSchema } from '@/lib/forms';

const validContact = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Hello',
  message: 'This is a long enough message.',
};

describe('contactSchema', () => {
  it('accepts a valid submission', () => {
    expect(contactSchema.safeParse(validContact).success).toBe(true);
  });

  it('accepts a filled honeypot so bots get no validation signal', () => {
    const result = contactSchema.safeParse({ ...validContact, honeypot: 'http://spam.example' });
    expect(result.success).toBe(true);
  });

  it('trims whitespace before length checks', () => {
    const result = contactSchema.safeParse({ ...validContact, name: '  A  ' });
    expect(result.success).toBe(false);
  });

  it.each([
    ['email', 'not-an-email', 'form.errors.invalidEmail'],
    ['message', 'too short', 'form.errors.messageTooShort'],
    ['name', 'A', 'form.errors.nameTooShort'],
  ])('rejects an invalid %s with a translatable message key', (field, value, message) => {
    const result = contactSchema.safeParse({ ...validContact, [field]: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe('newsletterSchema', () => {
  it('accepts a valid email', () => {
    expect(newsletterSchema.safeParse({ email: 'ada@example.com' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(newsletterSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});
