/**
 * Resolve the Astro adapter (and matching CDN cache provider) for the
 * current deploy target.
 *
 * Detection order:
 *   1. DEPLOY_TARGET env var (node | vercel | netlify | cloudflare)
 *   2. Platform env vars set by the host's build environment
 *   3. Fallback: Node standalone server (local preview, Docker, VPS)
 *
 * Vercel, Netlify and Node adapters ship with Velocity. Cloudflare is opt-in
 * because its adapter pulls in the `workerd` runtime:
 *   pnpm add @astrojs/cloudflare
 */

const TARGETS = ['node', 'vercel', 'netlify', 'cloudflare'];

export function detectDeployTarget(env = process.env) {
  if (env.DEPLOY_TARGET) {
    const target = env.DEPLOY_TARGET.toLowerCase();
    if (!TARGETS.includes(target)) {
      throw new Error(`[velocity] Unknown DEPLOY_TARGET "${env.DEPLOY_TARGET}". Use one of: ${TARGETS.join(', ')}.`);
    }
    return target;
  }
  if (env.VERCEL) return 'vercel';
  if (env.NETLIFY) return 'netlify';
  if (env.CF_PAGES || env.WORKERS_CI) return 'cloudflare';
  return 'node';
}

async function importAdapter(pkg, target) {
  try {
    return await import(pkg);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find (module|package)/.test(String(error?.message))) {
      throw new Error(
        `[velocity] Deploy target "${target}" needs ${pkg}. Install it with:\n\n  pnpm add ${pkg}\n`,
        { cause: error },
      );
    }
    throw error;
  }
}

export async function resolveDeployTarget(env = process.env) {
  const name = detectDeployTarget(env);

  switch (name) {
    case 'vercel': {
      const { default: vercel } = await importAdapter('@astrojs/vercel', name);
      const { cacheVercel } = await import('@astrojs/vercel/cache');
      return { name, adapter: vercel(), cacheProvider: cacheVercel() };
    }
    case 'netlify': {
      const { default: netlify } = await importAdapter('@astrojs/netlify', name);
      const { cacheNetlify } = await import('@astrojs/netlify/cache');
      return { name, adapter: netlify(), cacheProvider: cacheNetlify() };
    }
    case 'cloudflare': {
      const { default: cloudflare } = await importAdapter('@astrojs/cloudflare', name);
      const { cacheCloudflare } = await import('@astrojs/cloudflare/cache');
      return { name, adapter: cloudflare(), cacheProvider: cacheCloudflare() };
    }
    default: {
      const { default: node } = await importAdapter('@astrojs/node', name);
      return { name, adapter: node({ mode: 'standalone' }), cacheProvider: undefined };
    }
  }
}
