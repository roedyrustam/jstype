import {
  cors,
  describeRoute,
  etag,
  JSType,
  logger,
  secureHeaders,
  validator,
} from 'jstype-core';
import { z } from 'zod';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
}

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'user']).default('user'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const initialUsers: User[] = [
  { id: '1', name: 'Alice', role: 'admin' },
  { id: '2', name: 'Bob', role: 'user' },
];

export const users: User[] = [...initialUsers];

export const app = new JSType();

// 1. Built-in Production Middlewares
app.use(secureHeaders());
app.use(cors());
app.use(etag());
app.use(logger());

// Global response timing middleware
app.use(async (_c, next) => {
  const start = Date.now();
  const res = await next();
  const duration = Date.now() - start;
  res?.headers.set('X-Response-Time', `${duration}ms`);
  return res;
});

// 2. OpenAPI & Interactive Documentation Endpoints
app.doc('/openapi.json', {
  title: 'JSType Basic API',
  version: '1.0.0',
  description: 'Modern type-safe API with built-in OpenAPI 3.1 & Scalar docs',
});
app.scalarDocs('/docs', {
  specUrl: '/openapi.json',
  title: 'JSType API Documentation (Scalar)',
});
app.swaggerUI('/swagger', {
  specUrl: '/openapi.json',
  title: 'JSType API Documentation (Swagger)',
});

// 3. Modular Sub-Router: Users Resource
export const usersApp = new JSType()
  .get(
    '/',
    describeRoute({
      summary: 'List all users',
      tags: ['Users'],
    }),
    (c) => {
      return c.json(users);
    }
  )
  .get(
    '/:id',
    describeRoute({
      summary: 'Get user by ID',
      tags: ['Users'],
    }),
    (c) => {
      const id = c.req.param('id');
      const user = users.find((u) => u.id === id);
      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }
      return c.json(user);
    }
  )
  .post(
    '/',
    describeRoute({
      summary: 'Create a new user',
      tags: ['Users'],
    }),
    validator('json', createUserSchema),
    (c) => {
      const body = c.req.valid('json');
      const newUser: User = {
        id: String(users.length + 1),
        name: body.name,
        role: body.role ?? 'user',
      };
      users.push(newUser);
      return c.json(newUser, 201);
    }
  )
  .delete(
    '/:id',
    describeRoute({
      summary: 'Delete user by ID',
      tags: ['Users'],
    }),
    (c) => {
      const id = c.req.param('id');
      const index = users.findIndex((u) => u.id === id);
      if (index === -1) {
        return c.json({ error: 'User not found' }, 404);
      }
      const [deleted] = users.splice(index, 1);
      return c.json({ success: true, deleted });
    }
  );

// 4. Mount Sub-Routes and System Endpoints onto Main App
export const routes = app
  .get(
    '/health',
    describeRoute({
      summary: 'Service health check',
      tags: ['System'],
    }),
    (c) => {
      return c.text('OK');
    }
  )
  .get(
    '/api/events',
    describeRoute({
      summary: 'Realtime Server-Sent Events stream',
      tags: ['Realtime'],
    }),
    (c) => {
      return c.streamSSE(async (stream) => {
        await stream.writeSSE({
          event: 'system',
          data: { status: 'online', timestamp: Date.now() },
          id: 1,
        });
      });
    }
  )
  .route('/api/users', usersApp);

export type AppType = typeof routes;
export default app;
