import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DeliveryError,
  DeliveryNotConfiguredError,
  handleUndelivered,
  postJson,
  resetDeliveryWarnings,
  warnUndelivered,
} from '@/lib/form-delivery';

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

  it('refuses redirects, which would drop the body and could fake a success', async () => {
    const fetchImpl = fakeFetch(200);
    await postJson('https://hooks.example.com/contact', {}, {}, fetchImpl);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.redirect).toBe('error');
  });

  it('reports only the status, never the endpoint URL', async () => {
    const error = await postJson('https://user:secret@hooks.example.com/t0ken', {}, {}, fakeFetch(502)).catch((e) => e);
    expect(error).toBeInstanceOf(DeliveryError);
    expect(error.status).toBe(502);
    expect(error.message).not.toMatch(/secret|t0ken|hooks/);
  });

  it('releases the response body', async () => {
    const cancel = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, body: { cancel } }) as unknown as Response);
    await postJson('https://hooks.example.com/contact', {}, {}, fetchImpl);
    expect(cancel).toHaveBeenCalledOnce();
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

describe('handleUndelivered', () => {
  afterEach(() => resetDeliveryWarnings());

  it('only warns by default, so a fresh project still reports success', () => {
    const log = vi.fn();
    expect(() => handleUndelivered('contact', 'CONTACT_FORM_ENDPOINT', false, log)).not.toThrow();
    expect(() => handleUndelivered('contact', 'CONTACT_FORM_ENDPOINT', undefined, log)).not.toThrow();
    expect(log).toHaveBeenCalledOnce();
  });

  it('rejects the submission when delivery is required', () => {
    const log = vi.fn();
    const error = (() => {
      try {
        handleUndelivered('newsletter', 'NEWSLETTER_ENDPOINT', true, log);
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(DeliveryNotConfiguredError);
    expect((error as Error).message).toContain('NEWSLETTER_ENDPOINT');
    expect((error as Error).message).toContain('FORMS_REQUIRE_DELIVERY');
    expect(log).not.toHaveBeenCalled();
  });
});
