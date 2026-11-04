import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/cn';
import { formatDate, generateId, getReadingTime, isExternalUrl } from '@/lib/utils';
import { createBreadcrumbSchema, createFAQSchema } from '@/lib/schema';

describe('cn', () => {
  it('merges conflicting Tailwind classes, last wins', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  // Tailwind v4 syntax — requires tailwind-merge v3
  it.each([
    [['duration-150', 'duration-(--transition-fast)'], 'duration-(--transition-fast)'],
    [['bg-red-500', 'bg-(--brand)'], 'bg-(--brand)'],
    [['shadow-sm', 'shadow-xs'], 'shadow-xs'],
    [['bg-red-500', 'bg-linear-to-r'], 'bg-red-500 bg-linear-to-r'],
  ])('resolves Tailwind v4 conflicts: %j', (input, expected) => {
    expect(cn(...input)).toBe(expected);
  });

  it('drops falsy values', () => {
    const isActive = false as boolean;
    expect(cn('a', isActive && 'b', undefined, null, 'c')).toBe('a c');
  });
});

describe('utils', () => {
  it('formats dates', () => {
    expect(formatDate(new Date('2026-11-03T12:00:00Z'))).toBe('November 3, 2026');
  });

  it('formats frontmatter dates (UTC midnight) without shifting the day', () => {
    // `publishedAt: 2026-11-03` in frontmatter becomes this Date
    expect(formatDate(new Date('2026-11-03'))).toBe('November 3, 2026');
  });

  it('reports at least one minute for short content', () => {
    expect(getReadingTime('')).toBe(1);
  });

  it('rounds reading time up', () => {
    expect(getReadingTime('word '.repeat(201))).toBe(2);
  });

  it('generates prefixed ids', () => {
    expect(generateId('tab')).toMatch(/^tab-[a-z0-9]+$/);
  });

  it('detects external URLs', () => {
    expect(isExternalUrl('https://astro.build')).toBe(true);
    expect(isExternalUrl('/blog')).toBe(false);
  });
});

describe('JSON-LD schema helpers', () => {
  it('numbers breadcrumb positions from 1', () => {
    const schema = createBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Blog', url: '/blog' },
    ]);
    expect(schema.itemListElement).toMatchObject([{ position: 1 }, { position: 2 }]);
  });

  it('maps FAQs to Question entities', () => {
    const schema = createFAQSchema([{ question: 'Q?', answer: 'A.' }]);
    expect(schema.mainEntity).toMatchObject([
      { '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } },
    ]);
  });
});
