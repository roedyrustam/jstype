import { client } from './client.js';

async function main() {
  console.log('🚀 Running jstype basic-api demo...\n');

  // 1. Health check
  const healthRes = await client.health.$get();
  const healthText = await healthRes.text();
  console.log('1. GET /health:', healthRes.status, healthText);

  // 2. Fetch users list
  const usersRes = await client.api.users.$get();
  const users = await usersRes.json();
  console.log('2. GET /api/users:', usersRes.status, users);

  // 3. Create a new user
  const createRes = await client.api.users.$post({
    json: { name: 'Charlie', role: 'admin' },
  });
  const createdUser = await createRes.json();
  console.log('3. POST /api/users:', createRes.status, createdUser);

  // 4. Fetch the newly created user by ID
  const singleRes = await client.api.users[':id'].$get({
    param: { id: createdUser.id },
  });
  const singleUser = await singleRes.json();
  console.log(`4. GET /api/users/${createdUser.id}:`, singleRes.status, singleUser);

  // 5. Delete the user
  const deleteRes = await client.api.users[':id'].$delete({
    param: { id: createdUser.id },
  });
  const deleteResult = await deleteRes.json();
  console.log(`5. DELETE /api/users/${createdUser.id}:`, deleteRes.status, deleteResult);

  // 6. Check response headers injected by middleware
  console.log('6. X-Response-Time header:', deleteRes.headers.get('X-Response-Time'));

  console.log('\n✅ Demo completed successfully with 100% End-to-End Type Safety!');
}

main().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
