import { describe, expect, it } from 'vitest';
import { detectDeployTarget } from '../../integrations/deploy-target.mjs';

describe('detectDeployTarget', () => {
  it('defaults to the Node adapter', () => {
    expect(detectDeployTarget({})).toBe('node');
  });

  it.each([
    [{ VERCEL: '1' }, 'vercel'],
    [{ NETLIFY: 'true' }, 'netlify'],
    [{ CF_PAGES: '1' }, 'cloudflare'],
    [{ WORKERS_CI: '1' }, 'cloudflare'],
  ])('detects the platform from %o', (env, expected) => {
    expect(detectDeployTarget(env)).toBe(expected);
  });

  it('lets DEPLOY_TARGET override platform detection', () => {
    expect(detectDeployTarget({ VERCEL: '1', DEPLOY_TARGET: 'Node' })).toBe('node');
  });

  it('rejects unknown targets', () => {
    expect(() => detectDeployTarget({ DEPLOY_TARGET: 'heroku' })).toThrow(/Unknown DEPLOY_TARGET/);
  });
});
