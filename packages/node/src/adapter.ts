import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

export function getRequestListener(
  fetch: (request: Request) => Promise<Response>
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const protocol = (req.socket as any)?.encrypted ? 'https' : 'http';
      const host = req.headers['host'] || 'localhost';
      const url = `${protocol}://${host}${req.url}`;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            headers.append(key, v);
          }
        } else {
          headers.set(key, value);
        }
      }

      const method = req.method || 'GET';
      const hasBody = method !== 'GET' && method !== 'HEAD';

      let body: ReadableStream<Uint8Array> | null = null;
      if (hasBody) {
        body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
      }

      const webRequest = new Request(url, {
        method,
        headers,
        body,
        // @ts-ignore Node.js 18+ duplex option required for streaming request bodies
        duplex: hasBody ? 'half' : undefined,
      });

      const webResponse = await fetch(webRequest);

      res.statusCode = webResponse.status;
      if (webResponse.statusText) {
        res.statusMessage = webResponse.statusText;
      }

      webResponse.headers.forEach((val, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          // Preserve all set-cookie headers
          const rawCookies =
            (webResponse.headers as any).getSetCookie?.() ?? [val];
          res.setHeader('set-cookie', rawCookies);
        } else {
          res.setHeader(key, val);
        }
      });

      if (webResponse.body) {
        const nodeStream = Readable.fromWeb(webResponse.body as any);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      } else {
        res.destroy(err as Error);
      }
    }
  };
}
