import { afterEach, describe, expect, it, vi } from 'vitest';
import { postJson, resetDeliveryWarnings, warnUndelivered } from '@/lib/form-delivery';

function fakeFetch(status: number) {
  return vi.fn(async () => new Response(null, { status }));
}

describe('postJson', () => {
  it('POSTs the body as JSON with any extra headers', async () => {
    const fetchImpl = fakeFetch(200);
    await postJson('https://hooks.example.com/contact', { email: 'ada@example.com' }, { authorization: 'Bearer k' }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://hooks.example.com/contact');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"email":"ada@example.com"}');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json', authorization: 'Bearer k' });
  });

  it('throws on a non-2xx response so the form can show an error', async () => {
    await expect(postJson('https://hooks.example.com/contact', {}, {}, fakeFetch(500))).rejects.toThrow('500');
  });

  it('throws when the endpoint cannot be reached', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(postJson('https://hooks.example.com/contact', {}, {}, fetchImpl)).rejects.toThrow('fetch failed');
  });
});

describe('warnUndelivered', () => {
  afterEach(() => resetDeliveryWarnings());

  it('names the env var to set', () => {
    const log = vi.fn();
    warnUndelivered('contact', 'CONTACT_FORM_ENDPOINT', log);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('CONTACT_FORM_ENDPOINT'));
  });

  it('warns once per form', () => {
    const log = vi.fn();
    warnUndelivered('contact', 'CONTACT_FORM_ENDPOINT', log);
    warnUndelivered('contact', 'CONTACT_FORM_ENDPOINT', log);
    warnUndelivered('newsletter', 'NEWSLETTER_ENDPOINT', log);
    expect(log).toHaveBeenCalledTimes(2);
  });
});
