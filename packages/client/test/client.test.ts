import { describe, it, expect } from 'vitest';
import { JSType } from 'jstype-core';
import { createClient } from '../src/client.js';

describe('createClient Proxy RPC', () => {
  it('makes typed requests via app.fetch in-memory', async () => {
    const app = new JSType();

    const routes = app
      .get('/api/users', (c) => {
        return c.json([
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' },
        ]);
      })
      .get('/api/users/:id', (c) => {
        const id = c.req.param('id');
        return c.json({ id, name: `User ${id}` });
      })
      .post('/api/users', async (c) => {
        const body = await c.req.json<{ name: string }>();
        return c.json({ id: '3', name: body.name }, 201);
      })
      .get('/api/search', (c) => {
        const q = c.req.query('q');
        return c.json({ query: q });
      });

    type AppType = typeof routes;

    const client = createClient<AppType>('http://localhost:3000', {
      fetch: app.fetch,
    });

    // 1. Chained $get
    const usersRes = await client.api.users.$get();
    expect(usersRes.status).toBe(200);
    const users = await usersRes.json();
    expect(users).toEqual([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);

    // 2. Chained with param substitution: client.api.users[':id'].$get({ param: { id: '99' } })
    const userRes = await client.api.users[':id'].$get({
      param: { id: '99' },
    });
    expect(userRes.status).toBe(200);
    const user = await userRes.json();
    expect(user).toEqual({ id: '99', name: 'User 99' });

    // 3. Chained with raw string in path: client.api.users['99'].$get()
    const userDirectRes = await client.api.users['99'].$get();
    expect(userDirectRes.status).toBe(200);
    const userDirect = await userDirectRes.json();
    expect(userDirect).toEqual({ id: '99', name: 'User 99' });

    // 4. Chained $post with json payload
    const postRes = await client.api.users.$post({
      json: { name: 'Charlie' },
    });
    expect(postRes.status).toBe(201);
    const created = await postRes.json();
    expect(created).toEqual({ id: '3', name: 'Charlie' });

    // 5. Query parameters
    const searchRes = await client.api.search.$get({
      query: { q: 'typed-rpc' },
    });
    expect(searchRes.status).toBe(200);
    const searchResult = await searchRes.json();
    expect(searchResult).toEqual({ query: 'typed-rpc' });
  });

  it('supports custom headers and base headers', async () => {
    const app = new JSType();
    app.get('/headers', (c) => {
      return c.json({
        auth: c.req.header('authorization'),
        custom: c.req.header('x-custom'),
      });
    });

    type HeaderApp = typeof app;
    const client = createClient<HeaderApp>('http://localhost:3000', {
      fetch: app.fetch,
      headers: { authorization: 'Bearer token123' },
    });

    const res = await client.headers.$get({
      headers: { 'x-custom': 'header-val' },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      auth: 'Bearer token123',
      custom: 'header-val',
    });
  });

  it('correctly substitutes wildcards and handles query arrays', async () => {
    const app = new JSType();

    const routes = app
      .get('/static/*', (c) => {
        return c.json({ file: c.req.param('wildcard') });
      })
      .get('/files/*filepath', (c) => {
        return c.json({ file: c.req.param('filepath') });
      })
      .get('/search', (c) => {
        return c.json({ tags: c.req.queries('tag') });
      });

    type AppType = typeof routes;

    const client = createClient<AppType>('http://localhost:3000', {
      fetch: app.fetch,
    });

    // 1. Anonymous wildcard with param: { wildcard: ... }
    const staticRes = await client.static['*'].$get({
      param: { wildcard: 'css/style.css' },
    });
    expect(staticRes.status).toBe(200);
    expect(await staticRes.json()).toEqual({ file: 'css/style.css' });

    // 2. Named wildcard with param: { filepath: ... }
    const fileRes = await client.files['*filepath'].$get({
      param: { filepath: 'docs/guide/start.pdf' },
    });
    expect(fileRes.status).toBe(200);
    expect(await fileRes.json()).toEqual({ file: 'docs/guide/start.pdf' });

    // 3. Query with array values
    const searchRes = await client.search.$get({
      query: { tag: ['frontend', 'backend'] },
    });
    expect(searchRes.status).toBe(200);
    expect(await searchRes.json()).toEqual({ tags: ['frontend', 'backend'] });

    // 4. Exact path index access
    const directRes = await client['/search'].$get({
      query: { tag: ['typescript'] },
    });
    expect(directRes.status).toBe(200);
    expect(await directRes.json()).toEqual({ tags: ['typescript'] });
  });

  it('consumes sub-routed APIs with end-to-end type safety', async () => {
    const postsApp = new JSType()
      .get('/', (c) => c.json([{ id: 1, title: 'Post 1' }]))
      .get('/:id', (c) => c.json({ id: Number(c.req.param('id')), title: 'Post Detail' }));

    const mainApp = new JSType().route('/api/posts', postsApp);

    type AppType = typeof mainApp;

    const client = createClient<AppType>('http://localhost:3000', {
      fetch: mainApp.fetch,
    });

    // Sub-route list
    const listRes = await client.api.posts.$get();
    expect(listRes.status).toBe(200);
    expect(await listRes.json()).toEqual([{ id: 1, title: 'Post 1' }]);

    // Sub-route detail
    const detailRes = await client.api.posts[':id'].$get({
      param: { id: '42' },
    });
    expect(detailRes.status).toBe(200);
    expect(await detailRes.json()).toEqual({ id: 42, title: 'Post Detail' });
  });
});
