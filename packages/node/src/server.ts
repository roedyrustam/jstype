import http from 'node:http';
import { getRequestListener } from './adapter.js';

export interface ServerOptions {
  /** Port number to listen on (default: 3000) */
  port?: number;
  /** Hostname/IP address to bind to (default: '0.0.0.0') */
  hostname?: string;
  /** Existing http.Server instance to attach to */
  server?: http.Server;
}

export interface ServerInfo {
  port: number;
  address: string;
  family: string;
}

export interface Fetchable {
  fetch: (request: Request, env?: Record<string, unknown>) => Promise<Response>;
}

export function serve(
  optionsOrApp:
    | Fetchable
    | ({ fetch: (req: Request) => Promise<Response> } & ServerOptions),
  optionsOrCallback?: ServerOptions | ((info: ServerInfo) => void),
  callback?: (info: ServerInfo) => void
): http.Server {
  let fetchFn: (request: Request) => Promise<Response>;
  let opts: ServerOptions = {};
  let cb: ((info: ServerInfo) => void) | undefined;

  if (typeof (optionsOrApp as any).fetch === 'function') {
    fetchFn = (optionsOrApp as any).fetch.bind(optionsOrApp);
    if ('port' in optionsOrApp || 'hostname' in optionsOrApp) {
      opts = { ...(optionsOrApp as ServerOptions) };
    }
  } else {
    throw new Error('JSType app or object with fetch function is required for serve()');
  }

  if (typeof optionsOrCallback === 'function') {
    cb = optionsOrCallback;
  } else if (typeof optionsOrCallback === 'object' && optionsOrCallback !== null) {
    opts = { ...opts, ...optionsOrCallback };
    cb = callback;
  } else if (typeof callback === 'function') {
    cb = callback;
  }

  const port = opts.port ?? 3000;
  const hostname = opts.hostname ?? '0.0.0.0';

  const requestListener = getRequestListener(fetchFn);
  const server = opts.server ?? http.createServer();

  server.on('request', requestListener);

  server.listen(port, hostname, () => {
    if (cb) {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        cb({
          port: addr.port,
          address: addr.address,
          family: addr.family,
        });
      } else {
        cb({
          port,
          address: hostname,
          family: 'IPv4',
        });
      }
    }
  });

  return server;
}
