import { describe, it, expect } from 'vitest';
import { Context } from '../src/context.js';
import { JSTypeRequest } from '../src/request.js';

describe('Context and JSTypeRequest', () => {
  it('handles json, text, html, and redirect responses', async () => {
    const rawReq = new Request('http://localhost/api/test?search=jstype&page=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Custom-Req': 'custom-val' },
      body: JSON.stringify({ hello: 'world' }),
    });

    const req = new JSTypeRequest(rawReq, { id: '999' });
    const ctx = new Context(req, { SECRET: '123' });

    // Test JSTypeRequest
    expect(req.param('id')).toBe('999');
    expect(req.query('search')).toBe('jstype');
    expect(req.query('page')).toBe('1');
    expect(req.header('x-custom-req')).toBe('custom-val');
    const body = await req.json<{ hello: string }>();
    expect(body.hello).toBe('world');

    // Test Context variables
    ctx.set('user', { username: 'testuser' });
    expect(ctx.get('user')).toEqual({ username: 'testuser' });
    expect(ctx.env.SECRET).toBe('123');

    // Test c.json()
    ctx.header('X-App-Name', 'jstype');
    const jsonRes = ctx.json({ status: 'ok' }, 201);
    expect(jsonRes.status).toBe(201);
    expect(jsonRes.headers.get('content-type')).toBe('application/json');
    expect(jsonRes.headers.get('x-app-name')).toBe('jstype');
    const jsonData = await jsonRes.json();
    expect(jsonData).toEqual({ status: 'ok' });

    // Test c.text()
    const textRes = ctx.text('plain text');
    expect(textRes.status).toBe(200);
    expect(textRes.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await textRes.text()).toBe('plain text');

    // Test c.html()
    const htmlRes = ctx.html('<h1>Hello</h1>');
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await htmlRes.text()).toBe('<h1>Hello</h1>');

    // Test c.redirect()
    const redirectRes = ctx.redirect('/login');
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.get('location')).toBe('/login');
  });

  it('handles notFound and error responses', async () => {
    const rawReq = new Request('http://localhost/not-found');
    const ctx = new Context(new JSTypeRequest(rawReq));

    const notFoundRes = ctx.notFound('Custom Not Found');
    expect(notFoundRes.status).toBe(404);
    expect(await notFoundRes.json()).toEqual({ error: 'Custom Not Found' });

    const errRes = ctx.error(new Error('Boom!'), 500);
    expect(errRes.status).toBe(500);
    expect(await errRes.json()).toEqual({ error: 'Boom!' });
  });

  it('supports body caching allowing multiple json/text reads without stream errors', async () => {
    const rawReq = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: 'apple', price: 10 }),
    });

    const req = new JSTypeRequest(rawReq);
    const text1 = await req.text();
    expect(text1).toContain('apple');

    const json1 = await req.json<{ item: string }>();
    expect(json1.item).toBe('apple');

    const json2 = await req.json<{ item: string }>();
    expect(json2.item).toBe('apple');

    const text2 = await req.text();
    expect(text2).toBe(text1);
  });

  it('supports header() without arguments and queries() helper', async () => {
    const rawReq = new Request('http://localhost/test?tag=alpha&tag=beta', {
      headers: {
        'X-First': '1',
        'X-Second': '2',
      },
    });

    const req = new JSTypeRequest(rawReq);
    const allHeaders = req.header();
    expect(allHeaders['x-first']).toBe('1');
    expect(allHeaders['x-second']).toBe('2');

    const tags = req.queries('tag');
    expect(tags).toEqual(['alpha', 'beta']);
  });

  it('updates response headers when c.header is called after response creation', async () => {
    const rawReq = new Request('http://localhost/test');
    const ctx = new Context(new JSTypeRequest(rawReq));

    ctx.json({ ok: true });
    expect(ctx.res?.headers.get('x-late-header')).toBeNull();

    ctx.header('X-Late-Header', 'injected-later');
    expect(ctx.res?.headers.get('x-late-header')).toBe('injected-later');
  });
});
