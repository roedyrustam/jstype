import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { JSType } from '@jstype/core';
import { serveStatic } from '../src/static.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('@jstype/node serveStatic Middleware', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jstype-static-'));
    await fs.promises.writeFile(
      path.join(tempDir, 'index.html'),
      '<h1>Welcome to jstype</h1>',
      'utf-8'
    );
    await fs.promises.writeFile(
      path.join(tempDir, 'style.css'),
      'body { background: black; }',
      'utf-8'
    );
  });

  afterAll(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('serves files with proper MIME types and handles fallback', async () => {
    const app = new JSType();
    app.use(serveStatic({ root: tempDir }));
    app.get('/fallback', (c) => c.text('fallback'));

    // Test index.html via root /
    const indexRes = await app.fetch(new Request('http://localhost/'));
    expect(indexRes.status).toBe(200);
    expect(indexRes.headers.get('content-type')).toContain('text/html');
    expect(await indexRes.text()).toBe('<h1>Welcome to jstype</h1>');

    // Test style.css
    const cssRes = await app.fetch(new Request('http://localhost/style.css'));
    expect(cssRes.status).toBe(200);
    expect(cssRes.headers.get('content-type')).toContain('text/css');
    expect(await cssRes.text()).toBe('body { background: black; }');

    // Test fallback route
    const fallbackRes = await app.fetch(new Request('http://localhost/fallback'));
    expect(fallbackRes.status).toBe(200);
    expect(await fallbackRes.text()).toBe('fallback');
  });
});
