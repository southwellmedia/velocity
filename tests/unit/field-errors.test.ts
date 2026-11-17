import { describe, expect, it } from 'vitest';
import { describedByWith } from '@/lib/field-errors';

describe('describedByWith', () => {
  it('adds the error id after existing ids when invalid', () => {
    expect(describedByWith('email-hint password-help', 'email-client-error', true)).toBe(
      'email-hint password-help email-client-error'
    );
  });

  it('keeps ids the caller linked when the field becomes valid again', () => {
    expect(describedByWith('password-help email-client-error', 'email-client-error', false)).toBe('password-help');
  });

  it('does not duplicate the error id', () => {
    expect(describedByWith('help email-client-error', 'email-client-error', true)).toBe('help email-client-error');
  });

  it('returns null when nothing is left', () => {
    expect(describedByWith('email-client-error', 'email-client-error', false)).toBeNull();
    expect(describedByWith(null, 'x', false)).toBeNull();
  });
});
