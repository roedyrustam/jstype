import { describe, it, expect } from 'vitest';
import { JSType } from '../src/app.js';

describe('JSType App and Middlewares', () => {
  it('handles HTTP methods and params', async () => {
    const app = new JSType();

    app.get('/items', (c) => c.json([{ id: 1 }]));
    app.post('/items', async (c) => {
      const data = await c.req.json<{ name: string }>();
      return c.json({ id: 2, name: data.name }, 201);
    });
    app.put('/items/:id', (c) => c.json({ updated: c.req.param('id') }));
    app.delete('/items/:id', (c) => c.json({ deleted: c.req.param('id') }));
    app.patch('/items/:id', (c) => c.json({ patched: c.req.param('id') }));

    // GET /items
    const resGet = await app.fetch(new Request('http://localhost/items'));
    expect(resGet.status).toBe(200);
    expect(await resGet.json()).toEqual([{ id: 1 }]);

    // POST /items
    const resPost = await app.fetch(
      new Request('http://localhost/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Gadget' }),
      })
    );
    expect(resPost.status).toBe(201);
    expect(await resPost.json()).toEqual({ id: 2, name: 'Gadget' });

    // PUT /items/42
    const resPut = await app.fetch(
      new Request('http://localhost/items/42', { method: 'PUT' })
    );
    expect(resPut.status).toBe(200);
    expect(await resPut.json()).toEqual({ updated: '42' });

    // DELETE /items/42
    const resDel = await app.fetch(
      new Request('http://localhost/items/42', { method: 'DELETE' })
    );
    expect(resDel.status).toBe(200);
    expect(await resDel.json()).toEqual({ deleted: '42' });

    // PATCH /items/42
    const resPatch = await app.fetch(
      new Request('http://localhost/items/42', { method: 'PATCH' })
    );
    expect(resPatch.status).toBe(200);
    expect(await resPatch.json()).toEqual({ patched: '42' });
  });

  it('runs global and scoped middleware in onion order', async () => {
    const app = new JSType();
    const order: string[] = [];

    // Global middleware
    app.use(async (_c, next) => {
      order.push('global-start');
      const res = await next();
      order.push('global-end');
      res?.headers.set('X-Global', 'true');
      return res;
    });

    // Scoped middleware
    app.use('/admin/*', async (_c, next) => {
      order.push('admin-start');
      const res = await next();
      order.push('admin-end');
      return res;
    });

    app.get('/admin/dashboard', (c) => {
      order.push('handler');
      return c.text('Dashboard');
    });

    const res = await app.fetch(new Request('http://localhost/admin/dashboard'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Dashboard');
    expect(res.headers.get('x-global')).toBe('true');
    expect(order).toEqual([
      'global-start',
      'admin-start',
      'handler',
      'admin-end',
      'global-end',
    ]);
  });

  it('supports middleware short-circuiting', async () => {
    const app = new JSType();

    app.use('/protected/*', (c) => {
      return c.json({ error: 'Unauthorized' }, 401);
    });

    app.get('/protected/secret', (c) => c.text('Secret'));

    const res = await app.fetch(new Request('http://localhost/protected/secret'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 404 for unknown route', async () => {
    const app = new JSType();
    const res = await app.fetch(new Request('http://localhost/non-existent'));
    expect(res.status).toBe(404);
  });

  it('supports custom notFound and onError handlers', async () => {
    const app = new JSType();
    app.notFound((c) => c.json({ custom: 'not-found' }, 404));
    app.onError((err, c) => c.json({ customError: (err as Error).message }, 500));

    app.get('/crash', () => {
      throw new Error('Explosion');
    });

    const notFoundRes = await app.fetch(new Request('http://localhost/missing'));
    expect(notFoundRes.status).toBe(404);
    expect(await notFoundRes.json()).toEqual({ custom: 'not-found' });

    const crashRes = await app.fetch(new Request('http://localhost/crash'));
    expect(crashRes.status).toBe(500);
    expect(await crashRes.json()).toEqual({ customError: 'Explosion' });
  });

  it('supports handlers returning raw objects, strings, and numbers', async () => {
    const app = new JSType();

    app.get('/raw-object', () => ({ message: 'hello raw object' }));
    app.get('/raw-string', () => 'hello raw string');
    app.get('/raw-number', () => 42);

    const resObj = await app.fetch('http://localhost/raw-object');
    expect(resObj.status).toBe(200);
    expect(resObj.headers.get('content-type')).toBe('application/json');
    expect(await resObj.json()).toEqual({ message: 'hello raw object' });

    const resStr = await app.fetch('http://localhost/raw-string');
    expect(resStr.status).toBe(200);
    expect(resStr.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await resStr.text()).toBe('hello raw string');

    const resNum = await app.fetch('http://localhost/raw-number');
    expect(resNum.status).toBe(200);
    expect(await resNum.json()).toBe(42);
  });

  it('supports calling app.fetch directly with relative URL strings', async () => {
    const app = new JSType();
    app.get('/relative', (c) => c.text('relative OK'));

    const res1 = await app.fetch('/relative');
    expect(res1.status).toBe(200);
    expect(await res1.text()).toBe('relative OK');

    const res2 = await app.fetch('relative');
    expect(res2.status).toBe(200);
    expect(await res2.text()).toBe('relative OK');
  });

  it('allows middleware and handler to both read request body without errors', async () => {
    const app = new JSType();
    let loggedBody: any;

    app.use(async (c, next) => {
      loggedBody = await c.req.json();
      await next();
    });

    app.post('/echo', async (c) => {
      const data = await c.req.json<{ greeting: string }>();
      return c.json({ echo: data.greeting });
    });

    const res = await app.fetch('http://localhost/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ greeting: 'hi' }),
    });

    expect(res.status).toBe(200);
    expect(loggedBody).toEqual({ greeting: 'hi' });
    expect(await res.json()).toEqual({ echo: 'hi' });
  });

  it('propagates c.header injected by middleware after next()', async () => {
    const app = new JSType();

    app.use(async (c, next) => {
      await next();
      c.header('X-After-Next', 'injected');
    });

    app.get('/header-test', (c) => c.text('ok'));

    const res = await app.fetch('http://localhost/header-test');
    expect(res.headers.get('x-after-next')).toBe('injected');
  });
});

