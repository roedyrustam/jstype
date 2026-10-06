import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { JSType } from '../src/app.js';
import {
  describeRoute,
  generateOpenAPISpec,
  convertPathToOpenAPI,
  schemaToJsonSchema,
  scalarDocs,
  swaggerUI,
} from '../src/openapi/index.js';
import { validator } from '../src/validator/index.js';

describe('OpenAPI 3.1 & Interactive Docs Generator', () => {
  it('converts jstype route paths to OpenAPI path template', () => {
    expect(convertPathToOpenAPI('/users/:id')).toBe('/users/{id}');
    expect(convertPathToOpenAPI('/org/:orgId/users/:userId')).toBe(
      '/org/{orgId}/users/{userId}'
    );
    expect(convertPathToOpenAPI('/static/*filepath')).toBe('/static/{filepath}');
    expect(convertPathToOpenAPI('/files/*')).toBe('/files/{wildcard}');
    expect(convertPathToOpenAPI('*')).toBe('/{wildcard}');
    expect(convertPathToOpenAPI('/*')).toBe('/{wildcard}');
    expect(convertPathToOpenAPI('users/:id')).toBe('/users/{id}');
  });

  it('converts Zod schemas to OpenAPI JSON schemas', () => {
    const schema = z.object({
      id: z.string().uuid().describe('Unique ID'),
      email: z.string().email(),
      name: z.string().min(3).max(50),
      age: z.number().int().min(18),
      role: z.enum(['admin', 'member']).default('member'),
      active: z.boolean(),
      tags: z.array(z.string()),
      bio: z.string().optional(),
    });

    const jsonSchema = schemaToJsonSchema(schema);
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties.id).toMatchObject({ type: 'string', format: 'uuid', description: 'Unique ID' });
    expect(jsonSchema.properties.email).toMatchObject({ type: 'string', format: 'email' });
    expect(jsonSchema.properties.name).toMatchObject({
      type: 'string',
      minLength: 3,
      maxLength: 50,
    });
    expect(jsonSchema.properties.age).toMatchObject({
      type: 'integer',
      minimum: 18,
    });
    expect(jsonSchema.properties.role).toMatchObject({
      type: 'string',
      enum: ['admin', 'member'],
      default: 'member',
    });
    expect(jsonSchema.properties.active).toMatchObject({ type: 'boolean' });
    expect(jsonSchema.properties.tags).toMatchObject({
      type: 'array',
      items: { type: 'string' },
    });
    expect(jsonSchema.properties.bio).toMatchObject({ type: 'string' });

    // required list should not include optional bio or default role
    expect(jsonSchema.required).toContain('id');
    expect(jsonSchema.required).toContain('email');
    expect(jsonSchema.required).toContain('name');
    expect(jsonSchema.required).not.toContain('bio');
    expect(jsonSchema.required).not.toContain('role');

    // Recursive / lazy schema support
    type Category = { name: string; sub?: Category };
    const categorySchema: z.ZodType<Category> = z.lazy(() =>
      z.object({
        name: z.string(),
        sub: categorySchema.optional(),
      })
    );
    const lazyJson = schemaToJsonSchema(categorySchema);
    expect(lazyJson.type).toBe('object');
    expect(lazyJson.properties.name).toMatchObject({ type: 'string' });

    // Intersection support
    const partA = z.object({ a: z.string() });
    const partB = z.object({ b: z.number() });
    const interJson = schemaToJsonSchema(partA.and(partB));
    expect(interJson.allOf).toBeDefined();
    expect(interJson.allOf.length).toBe(2);
  });

  it('generates OpenAPI 3.1 spec from routes with describeRoute and validator', () => {
    const app = new JSType();

    const createUserSchema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
    });

    const querySchema = z.object({
      search: z.string().optional(),
    });

    app
      .get(
        '/api/users',
        describeRoute({
          summary: 'List users',
          tags: ['Users'],
          responses: {
            200: {
              description: 'List of all registered users',
            },
          },
        }),
        validator('query', querySchema),
        (c) => c.json([])
      )
      .post(
        '/api/users',
        describeRoute({
          summary: 'Create user',
          tags: ['Users'],
        }),
        validator('json', createUserSchema),
        (c) => c.json({ id: '1' }, 201)
      )
      .get(
        '/api/users/:id',
        describeRoute({
          summary: 'Get user by ID',
          tags: ['Users'],
        }),
        (c) => c.json({ id: c.req.param('id') })
      );

    const spec = app.getOpenAPISpec({
      title: 'Test Service API',
      version: '2.0.0',
      description: 'API description for testing',
    });

    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Test Service API');
    expect(spec.info.version).toBe('2.0.0');

    // GET /api/users
    const getUsers = spec.paths['/api/users']?.get;
    expect(getUsers).toBeDefined();
    expect(getUsers.summary).toBe('List users');
    expect(getUsers.tags).toEqual(['Users']);
    expect(getUsers.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'search',
          in: 'query',
        }),
      ])
    );

    // POST /api/users
    const postUser = spec.paths['/api/users']?.post;
    expect(postUser).toBeDefined();
    expect(postUser.summary).toBe('Create user');
    expect(postUser.requestBody).toBeDefined();
    expect(postUser.requestBody.content['application/json'].schema.type).toBe('object');
    expect(postUser.requestBody.content['application/json'].schema.properties.name).toBeDefined();
    expect(postUser.responses[400]).toBeDefined();
    expect(postUser.responses[400].description).toContain('Bad Request');

    // GET /api/users/{id}
    const getUserById = spec.paths['/api/users/{id}']?.get;
    expect(getUserById).toBeDefined();
    expect(getUserById.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'id',
          in: 'path',
          required: true,
        }),
      ])
    );
  });

  it('serves openapi.json via app.doc()', async () => {
    const app = new JSType();
    app.get('/health', describeRoute({ summary: 'Health check' }), (c) => c.text('OK'));
    app.doc('/openapi.json', { title: 'My API', version: '1.0.0' });

    const res = await app.fetch('http://localhost/openapi.json');
    expect(res.status).toBe(200);
    const spec = (await res.json()) as any;
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('My API');
    expect(spec.paths['/health'].get.summary).toBe('Health check');
  });

  it('serves interactive Scalar documentation via app.scalarDocs() and scalarDocs()', async () => {
    const app = new JSType();
    app.doc('/openapi.json', { title: 'Scalar Test' });
    app.scalarDocs('/docs', { specUrl: '/openapi.json', title: 'Custom Docs' });

    const res = await app.fetch('http://localhost/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('<title>Custom Docs</title>');
    expect(html).toContain('data-url="/openapi.json"');
    expect(html).toContain('@scalar/api-reference');
  });

  it('serves interactive Swagger UI documentation via app.swaggerUI()', async () => {
    const app = new JSType();
    app.doc('/openapi.json', { title: 'Swagger Test' });
    app.swaggerUI('/swagger', { specUrl: '/openapi.json', title: 'Swagger Explorer' });

    const res = await app.fetch('http://localhost/swagger');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('<title>Swagger Explorer</title>');
    expect(html).toContain('swagger-ui-bundle.js');
    expect(html).toContain('url: "/openapi.json"');
  });
});
