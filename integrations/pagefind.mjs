import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Builds a Pagefind search index from the prerendered HTML after every
 * production build. The index is written to `<client output>/pagefind/` and
 * loaded on demand by the site search dialog — no search server required.
 *
 * Only content inside `data-pagefind-body` is indexed (see PageLayout /
 * BlogLayout), so navigation, footers and demos stay out of results.
 *
 * @returns {import('astro').AstroIntegration}
 */
export default function pagefind() {
  let clientDir;

  return {
    name: 'velocity:pagefind',
    hooks: {
      'astro:config:done': ({ config }) => {
        // Static builds emit to outDir; adapter builds emit prerendered pages
        // to build.client. Adapters that relocate output (e.g. Vercel) do so
        // after this integration has written the index.
        clientDir = config.adapter ? config.build.client : config.outDir;
      },
      'astro:build:done': async ({ logger }) => {
        const { createIndex, close } = await import('pagefind');
        const site = fileURLToPath(clientDir);
        const { index, errors } = await createIndex();
        if (!index) throw new Error(`Pagefind failed to start: ${errors.join(', ')}`);

        const { page_count, errors: addErrors } = await index.addDirectory({ path: site });
        if (addErrors.length) logger.warn(addErrors.join('\n'));

        await index.writeFiles({ outputPath: path.join(site, 'pagefind') });
        await close();
        logger.info(`Indexed ${page_count} page(s) for search`);
      },
    },
  };
}
