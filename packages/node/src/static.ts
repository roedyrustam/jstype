import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { Context, MiddlewareHandler } from 'jstype-core';

export interface ServeStaticOptions {
  /** Root directory to serve files from */
  root: string;
  /** Path prefix to match in request (e.g. '/static') */
  path?: string;
  /** Default index file (default: 'index.html') */
  index?: string;
  /** Rewrite request path before resolving file */
  rewriteRequestPath?: (path: string) => string;
  /** Custom Content-Type mapper */
  mimes?: Record<string, string>;
}

const DEFAULT_MIMES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
};

function getMimeType(filePath: string, customMimes?: Record<string, string>): string {
  const ext = path.extname(filePath).toLowerCase();
  if (customMimes && customMimes[ext]) {
    return customMimes[ext];
  }
  return DEFAULT_MIMES[ext] || 'application/octet-stream';
}

export function serveStatic(options: ServeStaticOptions): MiddlewareHandler {
  const { root, path: prefixPath, index = 'index.html', rewriteRequestPath, mimes } = options;
  const absoluteRoot = path.resolve(root);

  return async (c: Context, next) => {
    let reqPath = c.req.path;

    if (prefixPath && !reqPath.startsWith(prefixPath)) {
      return await next();
    }

    if (prefixPath) {
      reqPath = reqPath.slice(prefixPath.length) || '/';
    }

    if (rewriteRequestPath) {
      reqPath = rewriteRequestPath(reqPath);
    }

    // Prevent path traversal
    const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
    let targetPath = path.join(absoluteRoot, safePath);

    try {
      let stat = await fs.promises.stat(targetPath);

      if (stat.isDirectory()) {
        targetPath = path.join(targetPath, index);
        stat = await fs.promises.stat(targetPath);
      }

      if (stat.isFile()) {
        const mimeType = getMimeType(targetPath, mimes);
        const nodeStream = fs.createReadStream(targetPath);
        const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

        const headers = new Headers();
        headers.set('content-type', mimeType);
        headers.set('content-length', String(stat.size));

        return new Response(webStream, {
          status: 200,
          headers,
        });
      }
    } catch {
      // File not found, fall through to next middleware or route
    }

    return await next();
  };
}
