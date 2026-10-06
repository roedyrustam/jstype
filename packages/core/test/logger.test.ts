import { describe, it, expect, vi } from 'vitest';
import { JSType } from '../src/app.js';
import { logger, type LogInfo } from '../src/middleware/logger.js';

describe('Logger Middleware', () => {
  it('logs incoming requests with method, path, status, and duration', async () => {
    const logs: string[] = [];
    const logInfos: LogInfo[] = [];

    const printFn = (msg: string, info: LogInfo) => {
      logs.push(msg);
      logInfos.push(info);
    };

    const app = new JSType();
    app.use(logger({ fn: printFn }));

    app.get('/api/ping', (c) => c.text('pong'));

    const res = await app.fetch('http://localhost/api/ping');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('pong');

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain('[GET] /api/ping - 200');

    expect(logInfos.length).toBe(1);
    expect(logInfos[0].method).toBe('GET');
    expect(logInfos[0].path).toBe('/api/ping');
    expect(logInfos[0].status).toBe(200);
    expect(typeof logInfos[0].duration).toBe('number');
  });

  it('supports custom format function', async () => {
    const logs: string[] = [];
    const app = new JSType();

    app.use(
      logger({
        fn: (msg) => logs.push(msg),
        format: (info) => `CUSTOM: ${info.method} -> ${info.path} (${info.status})`,
      })
    );

    app.post('/api/users', (c) => c.json({ id: 1 }, 201));

    const res = await app.fetch('http://localhost/api/users', { method: 'POST' });
    expect(res.status).toBe(201);
    expect(logs.length).toBe(1);
    expect(logs[0]).toBe('CUSTOM: POST -> /api/users (201)');
  });

  it('correctly tracks status on error', async () => {
    const logInfos: LogInfo[] = [];
    const app = new JSType();

    app.use(
      logger({
        fn: (_msg, info) => logInfos.push(info),
      })
    );

    app.get('/crash', () => {
      throw new Error('Explosion');
    });

    const res = await app.fetch('http://localhost/crash');
    expect(res.status).toBe(500);
    expect(logInfos.length).toBe(1);
    expect(logInfos[0].status).toBe(500);
    expect(logInfos[0].method).toBe('GET');
    expect(logInfos[0].path).toBe('/crash');
  });
});
