/**
 * Mock "form provider" for the contact-form task. Records every request so the
 * scorer can check that submitting the site's form actually delivered a
 * message. Sends permissive CORS headers, like hosted form services do, so a
 * client-side fetch is not penalised for reasons unrelated to the site.
 */
import http from 'node:http';

export const DEFAULT_MOCK_PORT = 4599;
export const MOCK_PATH = '/messages';

export function endpointUrl(port = DEFAULT_MOCK_PORT) {
  return `http://127.0.0.1:${port}${MOCK_PATH}`;
}

export async function startMockEndpoint(port = DEFAULT_MOCK_PORT) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const cors = {
        'access-control-allow-origin': req.headers.origin ?? '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers':
          req.headers['access-control-request-headers'] ?? 'content-type, accept',
        'access-control-max-age': '600',
      };
      if (req.method === 'GET' && req.url === '/__requests') {
        res.writeHead(200, { 'content-type': 'application/json', ...cors });
        res.end(JSON.stringify(requests, null, 2));
        return;
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        res.end();
        return;
      }
      const body = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try {
        json = JSON.parse(body);
      } catch {
        /* not JSON */
      }
      requests.push({
        at: new Date().toISOString(),
        method: req.method,
        path: req.url,
        contentType: req.headers['content-type'] ?? null,
        origin: req.headers.origin ?? null,
        body: body.slice(0, 20_000),
        json,
      });
      res.writeHead(200, { 'content-type': 'application/json', ...cors });
      res.end(JSON.stringify({ ok: true, id: `msg_${requests.length}` }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    url: endpointUrl(port),
    port,
    requests,
    reset: () => requests.splice(0, requests.length),
    stop: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      }),
  };
}
