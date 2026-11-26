import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Progress from '@/components/ui/data-display/Progress/Progress.astro';
import FormField from '@/components/patterns/FormField.astro';
import { ToastProvider } from '@/components/ui/feedback/Toast/Toast';

// Names and relations that axe checks on a page, rendered here so they
// can't come undone without a test saying so.

describe('Progress', () => {
  it('names the progress bar itself', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Progress, { props: { value: 64, 'aria-label': 'Upload progress' } });
    expect(html).toMatch(/role="progressbar"[^>]*aria-label="Upload progress"/);
  });
});

describe('FormField', () => {
  it('points its label at the id it is given', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(FormField, {
      props: { id: 'color', label: 'Favorite color' },
      slots: { input: '<input id="color" type="color" name="color" />' },
    });
    expect(html).toContain('for="color"');
    expect(html).toContain('id="color"');
  });
});

describe('Toast', () => {
  it('gives the notifications area a role for its label', () => {
    const html = renderToStaticMarkup(createElement(ToastProvider, null));
    expect(html).toMatch(/role="region"[^>]*aria-label="Notifications"|aria-label="Notifications"[^>]*role="region"/);
  });
});
