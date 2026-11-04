import { describe, expect, it } from 'vitest';
import { getLocaleName, getLocaleTag } from '@/i18n/config';

describe('locale helpers', () => {
  it.each([
    ['en', 'en-US'],
    ['es', 'es-ES'],
    ['fr', 'fr-FR'],
    ['de', 'de-DE'],
    ['pt', 'pt-BR'],
    ['ja', 'ja-JP'],
    ['ko', 'ko-KR'],
    ['en-GB', 'en-GB'],
  ])('tags %s as %s', (locale, tag) => {
    expect(getLocaleTag(locale)).toBe(tag);
  });

  it.each([
    ['en', 'English'],
    ['es', 'Español'],
    ['fr', 'Français'],
    ['de', 'Deutsch'],
    ['ja', '日本語'],
  ])('names %s as %s', (locale, name) => {
    expect(getLocaleName(locale)).toBe(name);
  });
});
