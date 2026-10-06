import type { Context } from '../context.js';

export interface SSEMessage {
  data: string | object;
  event?: string;
  id?: string | number;
  retry?: number;
}

export class StreamHelper {
  protected controller: ReadableStreamDefaultController<Uint8Array>;
  protected encoder = new TextEncoder();
  protected isClosed = false;
  protected abortHandlers: Array<() => void> = [];

  constructor(
    controller: ReadableStreamDefaultController<Uint8Array>,
    public readonly signal?: AbortSignal
  ) {
    this.controller = controller;
    if (signal) {
      if (signal.aborted) {
        this.isClosed = true;
      } else {
        signal.addEventListener(
          'abort',
          () => {
            this.isClosed = true;
            for (const handler of this.abortHandlers) {
              try {
                handler();
              } catch {
                // ignore handler errors
              }
            }
          },
          { once: true }
        );
      }
    }
  }

  public async write(chunk: string | Uint8Array): Promise<void> {
    if (this.isClosed) return;
    const bytes = typeof chunk === 'string' ? this.encoder.encode(chunk) : chunk;
    try {
      this.controller.enqueue(bytes);
    } catch {
      this.isClosed = true;
    }
  }

  public async writeln(text: string): Promise<void> {
    await this.write(text + '\n');
  }

  public async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public close(): void {
    if (!this.isClosed) {
      this.isClosed = true;
      try {
        this.controller.close();
      } catch {
        // already closed
      }
    }
  }

  public onAbort(handler: () => void): void {
    if (this.signal?.aborted) {
      handler();
    } else {
      this.abortHandlers.push(handler);
    }
  }
}

export class SSEStreamHelper extends StreamHelper {
  public async writeSSE(message: SSEMessage): Promise<void> {
    if (this.isClosed) return;
    let payload = '';
    if (message.id !== undefined) {
      payload += `id: ${message.id}\n`;
    }
    if (message.event !== undefined) {
      payload += `event: ${message.event}\n`;
    }
    if (message.retry !== undefined) {
      payload += `retry: ${message.retry}\n`;
    }

    const dataStr =
      typeof message.data === 'object'
        ? JSON.stringify(message.data)
        : String(message.data);

    // Multiline SSE format
    const lines = dataStr.split('\n');
    for (const line of lines) {
      payload += `data: ${line}\n`;
    }
    payload += '\n';

    await this.write(payload);
  }
}

export function stream(
  c: Context,
  cb: (stream: StreamHelper) => Promise<void> | void,
  headersInit?: HeadersInit
): Response {
  let streamHelper: StreamHelper;
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      streamHelper = new StreamHelper(controller, c.req.raw.signal);
      try {
        await cb(streamHelper);
      } catch (err) {
        try {
          controller.error(err);
        } catch {
          // ignore
        }
      } finally {
        streamHelper.close();
      }
    },
    cancel() {
      if (streamHelper) {
        streamHelper.close();
      }
    },
  });

  const headers = new Headers(headersInit);
  if (!headers.has('Transfer-Encoding')) {
    headers.set('Transfer-Encoding', 'chunked');
  }

  const response = new Response(readable, {
    status: 200,
    headers,
  });

  c.res = response;
  return response;
}

export function streamText(
  c: Context,
  cb: (stream: StreamHelper) => Promise<void> | void,
  headersInit?: HeadersInit
): Response {
  const headers = new Headers(headersInit);
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  return stream(c, cb, headers);
}

export function streamSSE(
  c: Context,
  cb: (stream: SSEStreamHelper) => Promise<void> | void,
  headersInit?: HeadersInit
): Response {
  let sseHelper: SSEStreamHelper;
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      sseHelper = new SSEStreamHelper(controller, c.req.raw.signal);
      try {
        await cb(sseHelper);
      } catch (err) {
        try {
          controller.error(err);
        } catch {
          // ignore
        }
      } finally {
        sseHelper.close();
      }
    },
    cancel() {
      if (sseHelper) {
        sseHelper.close();
      }
    },
  });

  const headers = new Headers(headersInit);
  headers.set('Content-Type', 'text/event-stream');
  headers.set('Cache-Control', 'no-cache, no-transform');
  headers.set('Connection', 'keep-alive');
  headers.set('X-Accel-Buffering', 'no');

  const response = new Response(readable, {
    status: 200,
    headers,
  });

  c.res = response;
  return response;
}
