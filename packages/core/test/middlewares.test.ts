import { describe, expect, it } from 'vitest';
import { JSType } from '../src/app.js';
import { basicAuth } from '../src/middleware/basicAuth.js';
import { bearerAuth } from '../src/middleware/bearerAuth.js';
import { etag } from '../src/middleware/etag.js';
import { rateLimiter } from '../src/middleware/rateLimiter.js';
import { secureHeaders } from '../src/middleware/secureHeaders.js';

describe('Built-in Production Middlewares', () => {
  describe('secureHeaders', () => {
    it('sets default security headers on responses', async () => {
      const app = new JSType();
      app.use(secureHeaders());
      app.get('/test', (c) => c.text('secure'));

      const res = await app.fetch(new Request('http://localhost/test'));
      expect(res.status).toBe(200);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      expect(res.headers.get('strict-transport-security')).toContain('max-age=15552000');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('origin-agent-cluster')).toBe('?1');
      expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
    });

    it('allows customizing CSP and disabling specific headers', async () => {
      const app = new JSType();
      app.use(
        secureHeaders({
          contentSecurityPolicy: "default-src 'self'",
          xFrameOptions: false,
        })
      );
      app.get('/custom', (c) => c.text('custom'));

      const res = await app.fetch(new Request('http://localhost/custom'));
      expect(res.headers.get('content-security-policy')).toBe("default-src 'self'");
      expect(res.headers.get('x-frame-options')).toBeNull();
    });
  });

  describe('etag', () => {
    it('generates ETag header for GET responses', async () => {
      const app = new JSType();
      app.use(etag());
      app.get('/data', (c) => c.json({ message: 'hello' }));

      const res = await app.fetch(new Request('http://localhost/data'));
      expect(res.status).toBe(200);
      const tag = res.headers.get('etag');
      expect(tag).toBeDefined();
      expect(tag?.startsWith('"')).toBe(true);
    });

    it('returns 304 Not Modified when if-none-match matches', async () => {
      const app = new JSType();
      app.use(etag());
      app.get('/data', (c) => c.json({ message: 'hello' }));

      const firstRes = await app.fetch(new Request('http://localhost/data'));
      const generatedTag = firstRes.headers.get('etag')!;

      const secondRes = await app.fetch(
        new Request('http://localhost/data', {
          headers: { 'if-none-match': generatedTag },
        })
      );
      expect(secondRes.status).toBe(304);
      expect(await secondRes.text()).toBe('');
    });
  });

  describe('rateLimiter', () => {
    it('allows requests within limit and sets RateLimit headers', async () => {
      const app = new JSType();
      app.use(rateLimiter({ limit: 3, windowMs: 10_000 }));
      app.get('/api', (c) => c.text('ok'));

      const res1 = await app.fetch(new Request('http://localhost/api'));
      expect(res1.status).toBe(200);
      expect(res1.headers.get('ratelimit-limit')).toBe('3');
      expect(res1.headers.get('ratelimit-remaining')).toBe('2');

      const res2 = await app.fetch(new Request('http://localhost/api'));
      expect(res2.status).toBe(200);
      expect(res2.headers.get('ratelimit-remaining')).toBe('1');

      const res3 = await app.fetch(new Request('http://localhost/api'));
      expect(res3.status).toBe(200);
      expect(res3.headers.get('ratelimit-remaining')).toBe('0');

      // 4th request should be blocked with 429
      const res4 = await app.fetch(new Request('http://localhost/api'));
      expect(res4.status).toBe(429);
      expect(res4.headers.get('retry-after')).toBeDefined();
    });
  });

  describe('bearerAuth', () => {
    it('protects routes and validates Bearer token', async () => {
      const app = new JSType();
      app.use('/admin/*', bearerAuth({ token: 'secret-token-123' }));
      app.get('/admin/dashboard', (c) => c.json({ admin: true }));

      // Missing header -> 401
      const noAuth = await app.fetch(new Request('http://localhost/admin/dashboard'));
      expect(noAuth.status).toBe(401);
      expect(noAuth.headers.get('www-authenticate')).toContain('Bearer');

      // Invalid token -> 401
      const invalidAuth = await app.fetch(
        new Request('http://localhost/admin/dashboard', {
          headers: { authorization: 'Bearer wrong-token' },
        })
      );
      expect(invalidAuth.status).toBe(401);

      // Valid token -> 200
      const validAuth = await app.fetch(
        new Request('http://localhost/admin/dashboard', {
          headers: { authorization: 'Bearer secret-token-123' },
        })
      );
      expect(validAuth.status).toBe(200);
      expect(await validAuth.json()).toEqual({ admin: true });
    });
  });

  describe('basicAuth', () => {
    it('authenticates using HTTP Basic credentials', async () => {
      const app = new JSType();
      app.use('/secret', basicAuth({ username: 'admin', password: 'password123' }));
      app.get('/secret', (c) => c.text('top secret'));

      // No credentials -> 401
      const res1 = await app.fetch(new Request('http://localhost/secret'));
      expect(res1.status).toBe(401);
      expect(res1.headers.get('www-authenticate')).toContain('Basic');

      // Valid base64 credentials (admin:password123 -> YWRtaW46cGFzc3dvcmQxMjM=)
      const creds = btoa('admin:password123');
      const res2 = await app.fetch(
        new Request('http://localhost/secret', {
          headers: { authorization: `Basic ${creds}` },
        })
      );
      expect(res2.status).toBe(200);
      expect(await res2.text()).toBe('top secret');
    });
  });
});
