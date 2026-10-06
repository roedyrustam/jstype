import { describe, it, expect } from 'vitest';
import { JSType } from '../src/app.js';
import { cors } from '../src/middleware/cors.js';

describe('CORS Middleware', () => {
  it('applies default CORS headers to normal requests', async () => {
    const app = new JSType();
    app.use(cors());
    app.get('/api/test', (c) => c.json({ ok: true }));

    const res = await app.fetch('http://localhost/api/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  it('handles preflight OPTIONS request with 204 No Content', async () => {
    const app = new JSType();
    app.use(cors());
    app.post('/api/items', (c) => c.json({ created: true }));

    const res = await app.fetch('http://localhost/api/items', {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Content-Type, Authorization',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toBe('Content-Type, Authorization');
  });

  it('supports specific string origin', async () => {
    const app = new JSType();
    app.use(cors({ origin: 'https://myapp.com' }));
    app.get('/data', (c) => c.text('hello'));

    const res = await app.fetch('http://localhost/data', {
      headers: { origin: 'https://myapp.com' },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('https://myapp.com');
    expect(res.headers.get('vary')).toBe('Origin');
  });

  it('supports array of allowed origins', async () => {
    const app = new JSType();
    app.use(
      cors({
        origin: ['https://site1.com', 'https://site2.com'],
      })
    );
    app.get('/data', (c) => c.text('hello'));

    // Allowed origin
    const res1 = await app.fetch('http://localhost/data', {
      headers: { origin: 'https://site2.com' },
    });
    expect(res1.headers.get('access-control-allow-origin')).toBe('https://site2.com');
    expect(res1.headers.get('vary')).toBe('Origin');

    // Disallowed origin
    const res2 = await app.fetch('http://localhost/data', {
      headers: { origin: 'https://disallowed.com' },
    });
    expect(res2.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('supports functional origin check', async () => {
    const app = new JSType();
    app.use(
      cors({
        origin: (origin) => origin.endsWith('.trusted.io'),
      })
    );
    app.get('/data', (c) => c.text('hello'));

    const resTrusted = await app.fetch('http://localhost/data', {
      headers: { origin: 'https://app.trusted.io' },
    });
    expect(resTrusted.headers.get('access-control-allow-origin')).toBe('https://app.trusted.io');

    const resUntrusted = await app.fetch('http://localhost/data', {
      headers: { origin: 'https://evil.com' },
    });
    expect(resUntrusted.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('supports credentials and reflects request origin', async () => {
    const app = new JSType();
    app.use(
      cors({
        credentials: true,
      })
    );
    app.get('/secure', (c) => c.json({ user: 'auth' }));

    const res = await app.fetch('http://localhost/secure', {
      headers: { origin: 'https://client.com' },
    });

    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://client.com');
    expect(res.headers.get('vary')).toBe('Origin');

    // Without origin header, credentials: true should NEVER set '*'
    const resNoOrigin = await app.fetch('http://localhost/secure');
    expect(resNoOrigin.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('sets exposed headers, max age, and custom allow methods', async () => {
    const app = new JSType();
    app.use(
      cors({
        allowMethods: ['GET', 'POST'],
        allowHeaders: ['X-Custom-Header', 'Content-Type'],
        exposeHeaders: ['X-Total-Count', 'X-Request-Id'],
        maxAge: 86400,
      })
    );
    app.get('/items', (c) => c.json([]));

    // Preflight
    const preflight = await app.fetch('http://localhost/items', {
      method: 'OPTIONS',
      headers: { origin: 'https://test.com' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toBe('GET, POST');
    expect(preflight.headers.get('access-control-allow-headers')).toBe('X-Custom-Header, Content-Type');
    expect(preflight.headers.get('access-control-max-age')).toBe('86400');
    expect(preflight.headers.get('access-control-expose-headers')).toBe('X-Total-Count, X-Request-Id');

    // Normal request
    const res = await app.fetch('http://localhost/items', {
      headers: { origin: 'https://test.com' },
    });
    expect(res.headers.get('access-control-expose-headers')).toBe('X-Total-Count, X-Request-Id');
  });
});
