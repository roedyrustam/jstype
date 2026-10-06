import { Context } from './context.js';
import { compose, matchPath } from './middleware.js';
import { JSTypeRequest } from './request.js';
import { RadixRouter } from './router.js';
import type {
  ClientRequestOptions,
  ExtractParams,
  HTTPMethod,
  InferData,
  MiddlewareHandler,
  RouteHandler,
  TypedClientResponse,
} from './types.js';

interface RegisteredMiddleware {
  path?: string;
  handler: MiddlewareHandler;
}

export class JSType<TRoutes extends Record<string, any> = {}> {
  public readonly router: RadixRouter<RouteHandler> = new RadixRouter<RouteHandler>();
  private readonly middlewares: RegisteredMiddleware[] = [];
  private _customNotFound?: (c: Context) => Response | Promise<Response>;
  private _customOnError?: (err: unknown, c: Context) => Response | Promise<Response>;

  /** Phantom property for compile-time route type reflection */
  public readonly _routes!: TRoutes;

  public use(handler: MiddlewareHandler): this;
  public use(path: string, handler: MiddlewareHandler): this;
  public use(arg1: string | MiddlewareHandler, arg2?: MiddlewareHandler): this {
    if (typeof arg1 === 'string' && typeof arg2 === 'function') {
      this.middlewares.push({ path: arg1, handler: arg2 });
    } else if (typeof arg1 === 'function') {
      this.middlewares.push({ handler: arg1 });
    }
    return this;
  }

  public notFound(handler: (c: Context) => Response | Promise<Response>): this {
    this._customNotFound = handler;
    return this;
  }

  public onError(handler: (err: unknown, c: Context) => Response | Promise<Response>): this {
    this._customOnError = handler;
    return this;
  }

  private addRoute(method: HTTPMethod, path: string, handlers: any[]): void {
    if (handlers.length === 0) {
      throw new Error(`Route handler required for ${method} ${path}`);
    }
    const mainHandler = handlers[handlers.length - 1];
    const routeMiddlewares = handlers.slice(0, -1);

    if (routeMiddlewares.length > 0) {
      const composed: RouteHandler = (c: Context<any>) => {
        const runner = compose(routeMiddlewares, mainHandler);
        return runner(c);
      };
      this.router.insert(method, path, composed);
    } else {
      this.router.insert(method, path, mainHandler);
    }
  }

  public get<Path extends string, R>(
    path: Path,
    ...handlers: [...MiddlewareHandler[], (c: Context<Path>) => R]
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $get: (
          options?: ClientRequestOptions<ExtractParams<P>>
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  > {
    this.addRoute('GET', path, handlers);
    return this as any;
  }

  public post<Path extends string, R>(
    path: Path,
    ...handlers: [...MiddlewareHandler[], (c: Context<Path>) => R]
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $post: (
          options?: ClientRequestOptions<ExtractParams<P>>
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  > {
    this.addRoute('POST', path, handlers);
    return this as any;
  }

  public put<Path extends string, R>(
    path: Path,
    ...handlers: [...MiddlewareHandler[], (c: Context<Path>) => R]
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $put: (
          options?: ClientRequestOptions<ExtractParams<P>>
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  > {
    this.addRoute('PUT', path, handlers);
    return this as any;
  }

  public delete<Path extends string, R>(
    path: Path,
    ...handlers: [...MiddlewareHandler[], (c: Context<Path>) => R]
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $delete: (
          options?: ClientRequestOptions<ExtractParams<P>>
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  > {
    this.addRoute('DELETE', path, handlers);
    return this as any;
  }

  public patch<Path extends string, R>(
    path: Path,
    ...handlers: [...MiddlewareHandler[], (c: Context<Path>) => R]
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $patch: (
          options?: ClientRequestOptions<ExtractParams<P>>
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  > {
    this.addRoute('PATCH', path, handlers);
    return this as any;
  }

  public all<Path extends string, R>(
    path: Path,
    ...handlers: [...MiddlewareHandler[], (c: Context<Path>) => R]
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $all: (
          options?: ClientRequestOptions<ExtractParams<P>>
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  > {
    this.addRoute('ALL', path, handlers);
    return this as any;
  }

  public fetch = async (
    input: RequestInfo | URL,
    initOrEnv?: RequestInit | Record<string, unknown>,
    env?: Record<string, unknown>
  ): Promise<Response> => {
    let request: Request;
    let finalEnv: Record<string, unknown> = env ?? {};

    if (input instanceof Request) {
      request = input;
      if (
        initOrEnv &&
        !('method' in initOrEnv || 'headers' in initOrEnv || 'body' in initOrEnv || 'signal' in initOrEnv)
      ) {
        finalEnv = initOrEnv as Record<string, unknown>;
      }
    } else {
      const init = initOrEnv as RequestInit | undefined;
      let urlInput: RequestInfo | URL = input;
      if (typeof input === 'string' && !/^https?:\/\//i.test(input)) {
        urlInput = input.startsWith('/') ? `http://localhost${input}` : `http://localhost/${input}`;
      }
      request = new Request(urlInput, init);
    }

    let context: Context | undefined;
    try {
      const jstypeReq = new JSTypeRequest(request);
      const match = this.router.match(request.method, jstypeReq.path);

      if (match) {
        jstypeReq.params = match.params;
      }

      context = new Context(jstypeReq, finalEnv);

      // Collect scoped middlewares
      const matchingMiddlewares: MiddlewareHandler[] = [];
      for (const mw of this.middlewares) {
        if (!mw.path || matchPath(mw.path, jstypeReq.path)) {
          matchingMiddlewares.push(mw.handler);
        }
      }

      const defaultHandler: RouteHandler | undefined = match
        ? match.handler
        : this._customNotFound
        ? (c) => this._customNotFound!(c)
        : undefined;

      const runner = compose(matchingMiddlewares, defaultHandler);
      const res = await runner(context);

      if (res instanceof Response) {
        return res;
      }

      if (this._customNotFound) {
        return await this._customNotFound(context);
      }

      return context.notFound();
    } catch (err) {
      if (this._customOnError && context) {
        try {
          return await this._customOnError(err, context);
        } catch (innerErr) {
          return context.error(innerErr);
        }
      }
      const fallbackCtx = context ?? new Context(new JSTypeRequest(request), finalEnv);
      return fallbackCtx.error(err);
    }
  };
}
