import { describe, expect, it } from 'vitest';
import { JSType } from '../src/app.js';
import { stream, streamSSE, streamText } from '../src/streaming/index.js';

describe('JSType Streaming & Server-Sent Events (SSE)', () => {
  it('streams chunked text response using c.streamText', async () => {
    const app = new JSType().get('/stream-text', (c) => {
      return c.streamText(async (stream) => {
        await stream.write('Hello ');
        await stream.sleep(10);
        await stream.writeln('World!');
      });
    });

    const res = await app.fetch(new Request('http://localhost/stream-text'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');

    const text = await res.text();
    expect(text).toBe('Hello World!\n');
  });

  it('streams formatted Server-Sent Events using c.streamSSE', async () => {
    const app = new JSType().get('/sse', (c) => {
      return c.streamSSE(async (stream) => {
        await stream.writeSSE({
          event: 'greeting',
          data: { message: 'welcome' },
          id: 1,
        });
        await stream.writeSSE({
          event: 'chat',
          data: 'Line 1\nLine 2',
          id: 2,
          retry: 5000,
        });
      });
    });

    const res = await app.fetch(new Request('http://localhost/sse'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-cache');

    const sseOutput = await res.text();
    expect(sseOutput).toContain('id: 1\n');
    expect(sseOutput).toContain('event: greeting\n');
    expect(sseOutput).toContain('data: {"message":"welcome"}\n\n');

    expect(sseOutput).toContain('id: 2\n');
    expect(sseOutput).toContain('event: chat\n');
    expect(sseOutput).toContain('retry: 5000\n');
    expect(sseOutput).toContain('data: Line 1\ndata: Line 2\n\n');
  });

  it('handles client abort cleanly via signal and onAbort', async () => {
    let aborted = false;
    const controller = new AbortController();

    const app = new JSType().get('/abortable', (c) => {
      return stream(c, async (s) => {
        s.onAbort(() => {
          aborted = true;
        });
        await s.write('first');
        await s.sleep(50);
        await s.write('second');
      });
    });

    const reqPromise = app.fetch(
      new Request('http://localhost/abortable', {
        signal: controller.signal,
      })
    );

    controller.abort();
    const res = await reqPromise;
    expect(res.status).toBe(200);
    expect(aborted).toBe(true);
  });
});
