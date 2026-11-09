import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import ButtonAstro from '@/components/ui/form/Button/Button.astro';
import { Button as ButtonReact } from '@/components/ui/form/Button/Button';

/**
 * Button.astro and Button.tsx are two renderings of one component. For the same
 * props they must produce the same behavior: what the element is, whether it
 * can be followed, focused or submitted, and what assistive tech is told.
 */

const BEHAVIOR = ['href', 'target', 'rel', 'disabled', 'aria-disabled', 'tabindex'] as const;

type Behavior = { tag: string } & Partial<Record<(typeof BEHAVIOR)[number], string>>;

/** The outer element's tag and behavior-relevant attributes. */
function behavior(html: string): Behavior {
  const open = html.trim().match(/^<(a|button)\b([^>]*)>/);
  if (!open) throw new Error(`No <a> or <button> at the start of: ${html.slice(0, 80)}`);
  const result: Behavior = { tag: open[1] };
  for (const [, name, value] of open[2].matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)) {
    const key = name.toLowerCase() as (typeof BEHAVIOR)[number];
    if (BEHAVIOR.includes(key)) result[key] = value ?? '';
  }
  // `disabled` is boolean: present or not is all that matters.
  if (result.disabled !== undefined) result.disabled = 'true';
  return result;
}

const cases: [string, Record<string, unknown>][] = [
  ['button', {}],
  ['disabled button', { disabled: true }],
  ['loading button', { loading: true }],
  ['internal link', { href: '/about' }],
  ['external link', { href: 'https://example.com' }],
  ['external link with its own target', { href: 'https://example.com', target: '_self' }],
  ['disabled link', { href: '/about', disabled: true }],
  ['disabled external link', { href: 'https://example.com', disabled: true }],
  ['loading link', { href: '/about', loading: true }],
];

describe('Button: Astro and React behave the same', async () => {
  const container = await AstroContainer.create();

  it.each(cases)('%s', async (_name, props) => {
    const astro = await container.renderToString(ButtonAstro, { props, slots: { default: 'Go' } });
    const react = renderToStaticMarkup(createElement(ButtonReact, props as never, 'Go'));
    expect(behavior(react)).toEqual(behavior(astro));
  });

  it('a disabled link cannot be followed or focused', async () => {
    const react = behavior(renderToStaticMarkup(createElement(ButtonReact, { href: '/about', disabled: true }, 'Go')));
    expect(react).toEqual({ tag: 'a', 'aria-disabled': 'true', tabindex: '-1' });
  });
});
