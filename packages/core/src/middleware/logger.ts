import type { Context } from '../context.js';
import type { MiddlewareHandler, Next } from '../types.js';

export interface LogInfo {
  method: string;
  path: string;
  status: number;
  duration: number; // in milliseconds
}

export interface LoggerOptions {
  fn?: (message: string, info: LogInfo) => void;
  format?: (info: LogInfo) => string;
}

export function logger(options: LoggerOptions = {}): MiddlewareHandler {
  const printFn = options.fn ?? ((msg: string) => console.log(msg));

  return async function loggerMiddleware(c: Context, next: Next): Promise<Response | void> {
    const start = performance.now();
    let status = 200;

    try {
      const res = await next();
      if (res instanceof Response) {
        status = res.status;
      } else if (c.res) {
        status = c.res.status;
      }
      return res;
    } catch (err) {
      status = 500;
      throw err;
    } finally {
      const duration = Math.round((performance.now() - start) * 100) / 100;
      const info: LogInfo = {
        method: c.req.method,
        path: c.req.path,
        status,
        duration,
      };

      const message = options.format
        ? options.format(info)
        : `[${info.method}] ${info.path} - ${info.status} (${info.duration}ms)`;

      printFn(message, info);
    }
  };
}
