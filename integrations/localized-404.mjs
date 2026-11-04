import { locales } from '../src/i18n/locales.mjs';

/**
 * A prerendered 404 can only be in one language. With several locales, render it
 * on demand so /es/no-existe gets a Spanish page. Single-language sites keep the
 * static page, so a 404 never runs a server function.
 */
export default function localized404() {
  return {
    name: 'velocity:localized-404',
    hooks: {
      'astro:route:setup': ({ route }) => {
        if (locales.length > 1 && route.component.endsWith('src/pages/404.astro')) {
          route.prerender = false;
        }
      },
    },
  };
}
