import { describe, expect, it } from 'vitest';
import { JSType } from '@jstype/core';
import { serve, getRequestListener } from '../src/index.js';
import http from 'node:http';

describe('@jstype/node HTTP Server Adapter', () => {
  it('serves JSType app over native Node.js HTTP server', async () => {
    const app = new JSType()
      .get('/ping', (c) => c.text('pong'))
      .post('/echo', async (c) => {
        const body = await c.req.json<{ message: string }>();
        return c.json({ received: body?.message }, 201);
      });

    const server = serve(app, { port: 0 });

    await new Promise<void>((resolve) => {
      server.on('listening', resolve);
    });

    const addr = server.address() as any;
    const port = addr.port;
    const baseUrl = `http://localhost:${port}`;

    try {
      // Test GET /ping
      const getRes = await fetch(`${baseUrl}/ping`);
      expect(getRes.status).toBe(200);
      expect(await getRes.text()).toBe('pong');

      // Test POST /echo
      const postRes = await fetch(`${baseUrl}/echo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'hello from node' }),
      });
      expect(postRes.status).toBe(201);
      expect(await postRes.json()).toEqual({ received: 'hello from node' });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('works with getRequestListener for custom http.Server', async () => {
    const app = new JSType().get('/custom', (c) => c.json({ custom: true }));
    const listener = getRequestListener(app.fetch);

    const server = http.createServer(listener);
    server.listen(0);

    await new Promise<void>((resolve) => {
      server.on('listening', resolve);
    });

    const addr = server.address() as any;
    const baseUrl = `http://localhost:${addr.port}`;

    try {
      const res = await fetch(`${baseUrl}/custom`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ custom: true });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
