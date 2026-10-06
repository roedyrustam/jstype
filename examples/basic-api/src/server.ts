import { JSType } from '@jstype/core';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
}

export const initialUsers: User[] = [
  { id: '1', name: 'Alice', role: 'admin' },
  { id: '2', name: 'Bob', role: 'user' },
];

const users: User[] = [...initialUsers];

export const app = new JSType();

// Global timing middleware
app.use(async (_c, next) => {
  const start = Date.now();
  const res = await next();
  const duration = Date.now() - start;
  res?.headers.set('X-Response-Time', `${duration}ms`);
  return res;
});

export const routes = app
  .get('/health', (c) => {
    return c.text('OK');
  })
  .get('/api/users', (c) => {
    return c.json(users);
  })
  .get('/api/users/:id', (c) => {
    const id = c.req.param('id');
    const user = users.find((u) => u.id === id);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    return c.json(user);
  })
  .post('/api/users', async (c) => {
    const body = await c.req.json<{ name: string; role?: 'admin' | 'user' }>();
    const newUser: User = {
      id: String(users.length + 1),
      name: body.name,
      role: body.role ?? 'user',
    };
    users.push(newUser);
    return c.json(newUser, 201);
  })
  .delete('/api/users/:id', (c) => {
    const id = c.req.param('id');
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      return c.json({ error: 'User not found' }, 404);
    }
    const [deleted] = users.splice(index, 1);
    return c.json({ success: true, deleted });
  });

export type AppType = typeof routes;
export default app;
