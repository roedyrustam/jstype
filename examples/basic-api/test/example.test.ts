import { describe, it, expect } from 'vitest';
import { client } from '../src/client.js';

describe('Basic API Example End-to-End', () => {
  it('correctly executes full CRUD cycle with typed client', async () => {
    // 1. Health check
    const healthRes = await client.health.$get();
    expect(healthRes.status).toBe(200);
    expect(await healthRes.text()).toBe('OK');

    // 2. Initial users
    const usersRes = await client.api.users.$get();
    expect(usersRes.status).toBe(200);
    const users = await usersRes.json();
    expect(users.length).toBeGreaterThanOrEqual(2);

    // 3. Create user
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

    // 6. Verify middleware header
    expect(deleteRes.headers.get('x-response-time')).toBeDefined();
  });
});
