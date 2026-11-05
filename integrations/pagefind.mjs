import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { completeSocialImages } from './og-images.mjs';

/**
 * Also completes each page's social share image. That runs here because this step
 * reads every finished page, and because astro.config.mjs belongs to the project,
 * so a new integration would never reach projects that upgrade.
 *
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
  let site;

  return {
    name: 'velocity:pagefind',
    hooks: {
      'astro:config:done': ({ config }) => {
        // Static builds emit to outDir; adapter builds emit prerendered pages
        // to build.client. Adapters that relocate output (e.g. Vercel) do so
        // after this integration has written the index.
        clientDir = config.adapter ? config.build.client : config.outDir;
        site = config.site;
      },
      'astro:build:done': async ({ logger }) => {
        const output = fileURLToPath(clientDir);
        const social = await completeSocialImages(output, { site });
        logger.info(`Checked share images on ${social.pages} page(s), drew ${social.generated}`);

        const { createIndex, close } = await import('pagefind');
        const { index, errors } = await createIndex();
        if (!index) throw new Error(`Pagefind failed to start: ${errors.join(', ')}`);

        const { page_count, errors: addErrors } = await index.addDirectory({ path: output });
        if (addErrors.length) logger.warn(addErrors.join('\n'));

        await index.writeFiles({ outputPath: path.join(output, 'pagefind') });
        await close();
        logger.info(`Indexed ${page_count} page(s) for search`);
      },
    },
  };
}
