import type { Context } from './context.js';
import type { MiddlewareHandler, RouteHandler } from './types.js';

export function matchPath(pattern: string, path: string): boolean {
  if (!pattern || pattern === '*' || pattern === '/*') {
    return true;
  }
  const normPattern = pattern.replace(/\/+$/, '') || '/';
  const normPath = path.replace(/\/+$/, '') || '/';

  if (normPattern.endsWith('/*')) {
    const prefix = normPattern.slice(0, -2);
    return normPath === prefix || normPath.startsWith(prefix + '/');
  }
  return normPath === normPattern || normPath.startsWith(normPattern + '/');
}

function toResponse(res: unknown, context: Context): Response {
  if (res instanceof Response) {
    context.res = res;
    return res;
  }
  if (typeof res === 'string') {
    return context.text(res);
  }
  if (
    res !== undefined &&
    (typeof res === 'object' || typeof res === 'number' || typeof res === 'boolean')
  ) {
    return context.json(res);
  }
  return context.res ?? context.notFound();
}

export function compose(
  middlewares: MiddlewareHandler[],
  handler?: RouteHandler
) {
  return function (context: Context): Promise<Response> {
    let index = -1;

    function dispatch(i: number): Promise<Response> {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;

      if (i === middlewares.length) {
        if (!handler) {
          return Promise.resolve(context.res ?? context.notFound());
        }
        try {
          return Promise.resolve(handler(context)).then((res) => {
            return toResponse(res, context);
          });
        } catch (err) {
          return Promise.reject(err);
        }
      }

      const fn = middlewares[i];
      let nextRes: Response | undefined;
      try {
        return Promise.resolve(
          fn(context, async () => {
            nextRes = await dispatch(i + 1);
            return nextRes;
          })
        ).then((res) => {
          if (res !== undefined) {
            return toResponse(res, context);
          }
          return nextRes ?? context.res ?? context.notFound();
        });
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}
