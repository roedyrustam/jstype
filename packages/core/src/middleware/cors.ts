import type { Context } from '../context.js';
import type { MiddlewareHandler, Next } from '../types.js';

export interface CorsOptions {
  origin?:
    | string
    | string[]
    | ((
        origin: string,
        c: Context
      ) => string | boolean | undefined | null | Promise<string | boolean | undefined | null>);
  allowMethods?: string[];
  methods?: string[];
  allowHeaders?: string[];
  headers?: string[];
  exposeHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function cors(options: CorsOptions = {}): MiddlewareHandler {
  const allowMethods = (
    options.allowMethods ??
    options.methods ?? ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH']
  ).join(', ');

  const exposeHeaders = options.exposeHeaders?.join(', ');
  const maxAge = options.maxAge !== undefined ? String(options.maxAge) : undefined;

  return async function corsMiddleware(c: Context, next: Next): Promise<Response | void> {
    const reqOrigin = c.req.header('origin') ?? '';

    // Determine Access-Control-Allow-Origin
    let allowOrigin: string | undefined;

    if (typeof options.origin === 'function') {
      const res = await options.origin(reqOrigin, c);
      if (typeof res === 'string') {
        allowOrigin = res;
      } else if (res === true) {
        allowOrigin = reqOrigin || '*';
      }
    } else if (Array.isArray(options.origin)) {
      if (options.origin.includes(reqOrigin)) {
        allowOrigin = reqOrigin;
      }
    } else if (typeof options.origin === 'string') {
      allowOrigin = options.origin;
    } else {
      // Default origin
      allowOrigin = options.credentials ? (reqOrigin || undefined) : '*';
    }

    // CORS specification forbids '*' when credentials is true
    if (options.credentials && allowOrigin === '*') {
      allowOrigin = reqOrigin || undefined;
    }

    const headersToSet: Record<string, string> = {};

    if (allowOrigin) {
      headersToSet['Access-Control-Allow-Origin'] = allowOrigin;
      if (allowOrigin !== '*') {
        headersToSet['Vary'] = 'Origin';
      }
    }

    if (options.credentials) {
      headersToSet['Access-Control-Allow-Credentials'] = 'true';
    }

    if (exposeHeaders) {
      headersToSet['Access-Control-Expose-Headers'] = exposeHeaders;
    }

    // Handle preflight OPTIONS request
    if (c.req.method === 'OPTIONS') {
      if (allowMethods) {
        headersToSet['Access-Control-Allow-Methods'] = allowMethods;
      }

      const reqHeaders = c.req.header('access-control-request-headers');
      const allowHeaders = (
        options.allowHeaders ??
        options.headers ??
        (reqHeaders ? [reqHeaders] : [])
      ).join(', ');

      if (allowHeaders) {
        headersToSet['Access-Control-Allow-Headers'] = allowHeaders;
      }

      if (maxAge !== undefined) {
        headersToSet['Access-Control-Max-Age'] = maxAge;
      }

      return new Response(null, {
        status: 204,
        headers: headersToSet,
      });
    }

    // Non-preflight: apply to context headers
    for (const [key, value] of Object.entries(headersToSet)) {
      c.header(key, value);
    }

    const res = await next();

    // Ensure headers are present on returned Response
    if (res instanceof Response) {
      for (const [key, value] of Object.entries(headersToSet)) {
        if (!res.headers.has(key)) {
          try {
            res.headers.set(key, value);
          } catch {
            // Safe guard in case response headers are immutable
          }
        }
      }
    }

    return res;
  };
}
