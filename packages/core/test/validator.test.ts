import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { JSType } from '../src/app.js';
import { validator, type StandardSchemaV1 } from '../src/validator/index.js';

describe('Validator Middleware & Schema Adapter', () => {
  it('validates JSON body with Zod and provides typed access via c.req.valid', async () => {
    const userSchema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      age: z.number().int().positive().optional(),
    });

    const app = new JSType();

    app.post('/api/users', validator('json', userSchema), (c) => {
      const data = c.req.valid('json');
      return c.json({ created: true, user: data }, 201);
    });

    // 1. Success case
    const validRes = await app.fetch('http://localhost/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com', age: 25 }),
    });

    expect(validRes.status).toBe(201);
    const validData = await validRes.json();
    expect(validData).toEqual({
      created: true,
      user: { name: 'Alice', email: 'alice@example.com', age: 25 },
    });

    // 2. Validation failure case
    const invalidRes = await app.fetch('http://localhost/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'A', email: 'not-an-email' }),
    });

    expect(invalidRes.status).toBe(400);
    const errorData = (await invalidRes.json()) as any;
    expect(errorData.success).toBe(false);
    expect(errorData.target).toBe('json');
    expect(errorData.issues).toBeDefined();
    expect(errorData.issues.length).toBeGreaterThan(0);
  });

  it('handles malformed JSON body gracefully', async () => {
    const schema = z.object({ text: z.string() });
    const app = new JSType();

    app.post('/api/echo', validator('json', schema), (c) => {
      return c.json(c.req.valid('json'));
    });

    const res = await app.fetch('http://localhost/api/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ invalid json ',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe('Malformed JSON payload');
  });

  it('validates query parameters', async () => {
    const querySchema = z.object({
      page: z.string().transform((v) => parseInt(v, 10)),
      limit: z.string().transform((v) => parseInt(v, 10)),
    });

    const app = new JSType();

    app.get('/api/items', validator('query', querySchema), (c) => {
      const q = c.req.valid('query');
      return c.json({ page: q.page, limit: q.limit });
    });

    const res = await app.fetch('http://localhost/api/items?page=2&limit=50');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ page: 2, limit: 50 });
  });

  it('validates route parameters with validator("param", schema)', async () => {
    const paramSchema = z.object({
      id: z.string().regex(/^\d+$/, 'ID must be numeric'),
    });

    const app = new JSType();

    app.get('/api/items/:id', validator('param', paramSchema), (c) => {
      const params = c.req.valid('param');
      return c.json({ id: params.id });
    });

    // Valid
    const validRes = await app.fetch('http://localhost/api/items/123');
    expect(validRes.status).toBe(200);
    expect(await validRes.json()).toEqual({ id: '123' });

    // Invalid
    const invalidRes = await app.fetch('http://localhost/api/items/abc');
    expect(invalidRes.status).toBe(400);
  });

  it('supports Standard Schema v1 specification (~standard)', async () => {
    // Custom Standard Schema v1 compliant mock
    const standardMock: StandardSchemaV1<{ count: number }, { count: number }> = {
      '~standard': {
        version: 1,
        vendor: 'custom-spec',
        validate: (value: unknown) => {
          if (
            typeof value === 'object' &&
            value !== null &&
            'count' in value &&
            typeof (value as any).count === 'number' &&
            (value as any).count >= 0
          ) {
            return { value: value as { count: number } };
          }
          return {
            issues: [{ message: 'Count must be a non-negative number', path: ['count'] }],
          };
        },
      },
    };

    const app = new JSType();

    app.post('/api/counter', validator('json', standardMock), (c) => {
      const { count } = c.req.valid('json');
      return c.json({ current: count });
    });

    // Valid
    const res1 = await app.fetch('http://localhost/api/counter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ count: 10 }),
    });
    expect(res1.status).toBe(200);
    expect(await res1.json()).toEqual({ current: 10 });

    // Invalid
    const res2 = await app.fetch('http://localhost/api/counter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ count: -5 }),
    });
    expect(res2.status).toBe(400);
    const err = (await res2.json()) as any;
    expect(err.issues[0].message).toContain('Count must be a non-negative number');
  });

  it('supports custom validationHook for custom responses', async () => {
    const schema = z.object({ code: z.string().min(5) });

    const app = new JSType();

    app.post(
      '/api/token',
      validator('json', schema, (result, c) => {
        if (!result.success) {
          return c.json({ customError: 'Invalid code provided' }, 422);
        }
      }),
      (c) => c.json({ ok: true })
    );

    const res = await app.fetch('http://localhost/api/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '12' }),
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ customError: 'Invalid code provided' });
  });

  it('allows empty body when JSON schema is optional or accepts undefined', async () => {
    const optSchema = z.object({ note: z.string().optional() }).optional();
    const app = new JSType();

    app.post('/api/optional-body', validator('json', optSchema), (c) => {
      const body = c.req.valid('json');
      return c.json({ received: body ?? null });
    });

    const res = await app.fetch('http://localhost/api/optional-body', {
      method: 'POST',
      body: '',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: null });
  });

  it('validates headers case-insensitively with validator("header", schema)', async () => {
    const headerSchema = z.object({
      authorization: z.string().startsWith('Bearer '),
      'x-custom-key': z.string(),
    });

    const app = new JSType();

    app.get('/api/secure-header', validator('header', headerSchema), (c) => {
      const h = c.req.valid('header');
      return c.json({ auth: h.authorization, key: h['x-custom-key'] });
    });

    const validRes = await app.fetch('http://localhost/api/secure-header', {
      headers: {
        Authorization: 'Bearer valid-token',
        'X-Custom-Key': 'my-key',
      },
    });

    expect(validRes.status).toBe(200);
    expect(await validRes.json()).toEqual({
      auth: 'Bearer valid-token',
      key: 'my-key',
    });

    const invalidRes = await app.fetch('http://localhost/api/secure-header', {
      headers: {
        Authorization: 'Basic credentials',
      },
    });

    expect(invalidRes.status).toBe(400);
  });
});
