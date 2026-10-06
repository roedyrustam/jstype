import type { MiddlewareHandler } from '../types.js';

export interface ETagOptions {
  /** Generate weak ETag (prefix with W/). Default: false */
  weak?: boolean;
}

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function etag(options: ETagOptions = {}): MiddlewareHandler {
  const { weak = false } = options;

  return async (c, next) => {
    await next();

    const method = c.req.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      return;
    }

    const res = c.res;
    if (!res || res.status !== 200) {
      return;
    }

    if (res.headers.has('etag')) {
      return;
    }

    // Clone response to inspect body without consuming the original stream
    const clone = res.clone();
    const text = await clone.text();
    const hash = fnv1a(text);
    const tag = weak ? `W/"${hash}"` : `"${hash}"`;

    c.header('ETag', tag);

    const clientETag = c.req.header('if-none-match');
    if (clientETag) {
      const clientTags = clientETag.split(',').map((t) => t.trim());
      const isMatch = clientTags.some((t) => {
        if (t === '*') return true;
        if (t === tag) return true;
        // Compare stripped weak tags
        const cleanClient = t.replace(/^W\//, '');
        const cleanServer = tag.replace(/^W\//, '');
        return cleanClient === cleanServer;
      });

      if (isMatch) {
        const headers = new Headers(res.headers);
        headers.set('ETag', tag);
        c.res = new Response(null, {
          status: 304,
          headers,
        });
        return c.res;
      }
    }
  };
}
