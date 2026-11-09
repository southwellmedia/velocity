/**
 * A stand-in for the form endpoints (CONTACT_FORM_ENDPOINT, NEWSLETTER_ENDPOINT)
 * while the E2E suite runs. playwright.config.ts starts it and points the
 * server at it, so the tests can check that a submission really arrived and
 * that a failed delivery shows the form's error. No real provider is called.
 *
 *   POST /<form>      records { path, authorization, body } and answers 204,
 *                     or 502 when the body contains "mock-fail"
 *   GET  /__received  the recorded submissions as JSON
 *
 * Usage: node tests/e2e/mock-endpoint.mjs <port>
 */
import http from 'node:http';

const port = Number(process.argv[2] ?? process.env.MOCK_ENDPOINT_PORT ?? 4398);
const received = [];

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/__received') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(received));
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(req.url === '/' ? 200 : 405).end();
    return;
  }

  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400).end();
      return;
    }
    received.push({ path: req.url, authorization: req.headers.authorization ?? null, body });
    res.writeHead(raw.includes('mock-fail') ? 502 : 204).end();
  });
});

server.listen(port, '127.0.0.1');
