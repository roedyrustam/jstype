import { createClient } from 'jstype-client';
import { app, type AppType } from './server.js';

// Create a typed client bound in-memory directly to app.fetch for zero-latency testing
export const client = createClient<AppType>('http://localhost:3000', {
  fetch: app.fetch,
});
