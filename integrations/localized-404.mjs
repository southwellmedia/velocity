import { locales } from '../src/i18n/locales.mjs';
import { layoutScriptHashes, readBuildEnv } from './layout-csp.mjs';

/**
 * A prerendered 404 can only be in one language. With several locales, render it
 * on demand so /es/no-existe gets a Spanish page. Single-language sites keep the
 * static page, so a 404 never runs a server function.
 *
 * A page rendered on demand sends its Content Security Policy before the layout
 * has rendered, so the layout's inline scripts are listed in the config as well
 * (see layout-csp.mjs). That covers the 404 and any page a project marks
 * `prerender = false`.
 */
export default function localized404() {
  return {
    name: 'velocity:localized-404',
    hooks: {
      'astro:config:setup': ({ config, updateConfig }) => {
        const { csp } = config.security;
        if (!csp) return;
        const hashes = layoutScriptHashes(readBuildEnv(config.root), config.root);
        // `csp: true` is replaced by this object, so it needs Astro's default algorithm
        const algorithm = csp === true ? { algorithm: 'SHA-256' } : {};
        updateConfig({ security: { csp: { ...algorithm, scriptDirective: { hashes } } } });
      },
      'astro:route:setup': ({ route }) => {
        if (locales.length > 1 && route.component.endsWith('src/pages/404.astro')) {
          route.prerender = false;
        }
      },
    },
  };
}
