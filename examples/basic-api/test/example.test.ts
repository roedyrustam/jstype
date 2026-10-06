import { describe, it, expect } from 'vitest';
import { app } from '../src/server.js';
import { client } from '../src/client.js';

describe('Basic API Example End-to-End', () => {
  it('correctly executes full CRUD cycle with typed client and Zod validation', async () => {
    // 1. Health check
    const healthRes = await client.health.$get();
    expect(healthRes.status).toBe(200);
    expect(await healthRes.text()).toBe('OK');

    // 2. Initial users
    const usersRes = await client.api.users.$get();
    expect(usersRes.status).toBe(200);
    const users = await usersRes.json();
    expect(users.length).toBeGreaterThanOrEqual(2);

    // 3. Create user (valid payload)
    const createRes = await client.api.users.$post({
      json: { name: 'E2E User', role: 'user' },
    });
    expect(createRes.status).toBe(201);
    const createdUser = await createRes.json();
    expect(createdUser.name).toBe('E2E User');

    // 4. Fetch single user
    const singleRes = await client.api.users[':id'].$get({
      param: { id: createdUser.id },
    });
    expect(singleRes.status).toBe(200);
    const singleUser = await singleRes.json();
    expect(singleUser).toEqual(createdUser);

    // 5. Delete user
    const deleteRes = await client.api.users[':id'].$delete({
      param: { id: createdUser.id },
    });
    expect(deleteRes.status).toBe(200);
    const deleteResult = (await deleteRes.json()) as any;
    expect(deleteResult.success).toBe(true);

    // 6. Verify middleware headers (CORS and Response-Time)
    expect(deleteRes.headers.get('x-response-time')).toBeDefined();
    expect(deleteRes.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('rejects invalid payload on POST /api/users with 400 Bad Request', async () => {
    const invalidRes = await app.fetch('http://localhost/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'A', role: 'superadmin' }), // name < 2 chars, invalid enum role
    });

    expect(invalidRes.status).toBe(400);
    const body = (await invalidRes.json()) as any;
    expect(body.success).toBe(false);
    expect(body.target).toBe('json');
    expect(body.issues).toBeDefined();
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it('serves auto-generated OpenAPI 3.1.0 spec at /openapi.json', async () => {
    const res = await app.fetch('http://localhost/openapi.json');
    expect(res.status).toBe(200);
    const spec = (await res.json()) as any;
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('JSType Basic API');
    expect(spec.paths['/api/users'].post.requestBody.content['application/json'].schema.properties.name).toBeDefined();
  });

  it('serves interactive Scalar documentation at /docs', async () => {
    const res = await app.fetch('http://localhost/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Scalar');
    expect(html).toContain('@scalar/api-reference');
  });

  it('serves interactive Swagger UI documentation at /swagger', async () => {
    const res = await app.fetch('http://localhost/swagger');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('swagger-ui');
  });

  it('serves realtime SSE stream at /api/events', async () => {
    const res = await app.fetch('http://localhost/api/events');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('event: system');
    expect(text).toContain('data: {"status":"online"');
  });

  it('injects secureHeaders on all responses', async () => {
    const res = await app.fetch('http://localhost/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });
});
