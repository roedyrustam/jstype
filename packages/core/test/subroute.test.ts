import { describe, expect, it } from 'vitest';
import { JSType } from '../src/app.js';
import { describeRoute } from '../src/openapi/describe.js';

describe('JSType Sub-Routing Engine (app.route)', () => {
  it('correctly mounts sub-app routes with path prefix', async () => {
    const userApp = new JSType()
      .get('/', (c) => c.json({ users: ['Alice', 'Bob'] }))
      .get('/:id', (c) => c.json({ user: c.req.param('id') }))
      .post('/', async (c) => {
        const body = await c.req.json<{ name: string }>();
        return c.json({ created: body?.name }, 201);
      });

    const mainApp = new JSType()
      .get('/health', (c) => c.text('OK'))
      .route('/api/users', userApp);

    // Test GET /health on main app
    const healthRes = await mainApp.fetch(new Request('http://localhost/health'));
    expect(healthRes.status).toBe(200);
    expect(await healthRes.text()).toBe('OK');

    // Test GET /api/users
    const usersRes = await mainApp.fetch(new Request('http://localhost/api/users'));
    expect(usersRes.status).toBe(200);
    expect(await usersRes.json()).toEqual({ users: ['Alice', 'Bob'] });

    // Test GET /api/users/42
    const userDetailRes = await mainApp.fetch(new Request('http://localhost/api/users/42'));
    expect(userDetailRes.status).toBe(200);
    expect(await userDetailRes.json()).toEqual({ user: '42' });

    // Test POST /api/users
    const postRes = await mainApp.fetch(
      new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Charlie' }),
      })
    );
    expect(postRes.status).toBe(201);
    expect(await postRes.json()).toEqual({ created: 'Charlie' });
  });

  it('inherits and executes sub-app scoped middlewares', async () => {
    const executionOrder: string[] = [];

    const bookApp = new JSType();
    bookApp.use(async (c, next) => {
      executionOrder.push('book-mw-before');
      c.header('X-Book-Scope', 'true');
      await next();
      executionOrder.push('book-mw-after');
    });
    bookApp.get('/:isbn', (c) => {
      executionOrder.push('book-handler');
      return c.json({ isbn: c.req.param('isbn') });
    });

    const rootApp = new JSType();
    rootApp.use(async (c, next) => {
      executionOrder.push('root-mw-before');
      await next();
      executionOrder.push('root-mw-after');
    });
    rootApp.route('/books', bookApp);

    const res = await rootApp.fetch(new Request('http://localhost/books/978-3-16-148410-0'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-book-scope')).toBe('true');
    expect(await res.json()).toEqual({ isbn: '978-3-16-148410-0' });

    expect(executionOrder).toEqual([
      'root-mw-before',
      'book-mw-before',
      'book-handler',
      'book-mw-after',
      'root-mw-after',
    ]);
  });

  it('supports deep nested sub-routing and OpenAPI reflection', async () => {
    const commentsApp = new JSType().get(
      '/',
      describeRoute({ summary: 'List post comments', tags: ['Comments'] }),
      (c) => c.json({ comments: [] })
    );

    const postsApp = new JSType()
      .get(
        '/',
        describeRoute({ summary: 'List all posts', tags: ['Posts'] }),
        (c) => c.json({ posts: [] })
      )
      .route('/:postId/comments', commentsApp);

    const rootApp = new JSType()
      .route('/api/posts', postsApp)
      .doc('/openapi.json');

    // Test deep routed endpoint
    const commentsRes = await rootApp.fetch(
      new Request('http://localhost/api/posts/100/comments')
    );
    expect(commentsRes.status).toBe(200);
    expect(await commentsRes.json()).toEqual({ comments: [] });

    // Test OpenAPI generation with merged paths
    const spec = rootApp.getOpenAPISpec();
    expect(spec.paths['/api/posts']).toBeDefined();
    expect(spec.paths['/api/posts'].get?.summary).toBe('List all posts');
    expect(spec.paths['/api/posts/{postId}/comments']).toBeDefined();
    expect(spec.paths['/api/posts/{postId}/comments'].get?.summary).toBe('List post comments');
  });
});
