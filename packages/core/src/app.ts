import { Context } from './context.js';
import { compose, matchPath } from './middleware.js';
import { generateOpenAPISpec, type RegisteredRouteInfo } from './openapi/generator.js';
import { scalarDocs, type ScalarDocsOptions } from './openapi/scalar.js';
import { swaggerUI, type SwaggerUIOptions } from './openapi/swagger.js';
import type { OpenAPIInfo, OpenAPISpec, RouteMetadata } from './openapi/types.js';
import { JSTypeRequest } from './request.js';
import { RadixRouter, mergePaths } from './router.js';
import type {
  ClientRequestOptions,
  ExtractParams,
  HTTPMethod,
  InferData,
  MiddlewareHandler,
  PrefixedRoutes,
  RouteHandler,
  TypedClientResponse,
} from './types.js';
import type { ValidationTarget, ValidatorMiddleware } from './validator/types.js';

interface RegisteredMiddleware {
  path?: string;
  handler: MiddlewareHandler;
}

interface RawRouteRecord {
  method: HTTPMethod;
  path: string;
  handlers: any[];
}

export class JSType<TRoutes extends Record<string, any> = {}> {
  public readonly router: RadixRouter<RouteHandler> = new RadixRouter<RouteHandler>();
  private readonly middlewares: RegisteredMiddleware[] = [];
  private readonly _rawRoutes: RawRouteRecord[] = [];
  private readonly _registeredRoutes: RegisteredRouteInfo[] = [];
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

    // Extract metadata and validators for OpenAPI registration
    let routeMetadata: RouteMetadata | undefined;
    const validators: Array<{ target: ValidationTarget; schema: any }> = [];

    for (const h of handlers) {
      if (h && (typeof h === 'object' || typeof h === 'function')) {
        if ('_routeMetadata' in h && h._routeMetadata) {
          routeMetadata = { ...routeMetadata, ...h._routeMetadata };
        }
        if ('_target' in h && 'schema' in h) {
          validators.push({ target: h._target, schema: h.schema });
        }
      }
    }

    this._registeredRoutes.push({
      method,
      path,
      metadata: routeMetadata,
      validators,
    });

    this._rawRoutes.push({ method, path, handlers });

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

  public route<SubRoutes extends Record<string, any>, Prefix extends string>(
    prefix: Prefix,
    subApp: JSType<SubRoutes>
  ): JSType<TRoutes & PrefixedRoutes<Prefix, SubRoutes>> {
    // 1. Merge subApp middlewares
    for (const mw of (subApp as any).middlewares) {
      const mergedPath = mw.path ? mergePaths(prefix, mw.path) : prefix;
      this.middlewares.push({ path: mergedPath, handler: mw.handler });
    }

    // 2. Merge subApp routes
    for (const route of (subApp as any)._rawRoutes) {
      const mergedPath = mergePaths(prefix, route.path);
      this.addRoute(route.method, mergedPath, route.handlers);
    }

    return this as unknown as JSType<TRoutes & PrefixedRoutes<Prefix, SubRoutes>>;
  }

  public getRegisteredRoutes(): RegisteredRouteInfo[] {
    return [...this._registeredRoutes];
  }

  public getOpenAPISpec(
    specInfo?: Partial<OpenAPIInfo> & {
      servers?: OpenAPISpec['servers'];
      tags?: OpenAPISpec['tags'];
      components?: OpenAPISpec['components'];
      security?: OpenAPISpec['security'];
    }
  ): OpenAPISpec {
    return generateOpenAPISpec(this._registeredRoutes, specInfo);
  }

  public doc(
    path: string,
    specInfo?: Partial<OpenAPIInfo> & {
      servers?: OpenAPISpec['servers'];
      tags?: OpenAPISpec['tags'];
      components?: OpenAPISpec['components'];
      security?: OpenAPISpec['security'];
    }
  ): this {
    this.get(path, (c) => {
      const spec = this.getOpenAPISpec(specInfo);
      return c.json(spec);
    });
    return this;
  }

  public scalarDocs(path: string, options?: ScalarDocsOptions): this {
    const handler = scalarDocs(path, options);
    this.get(path, handler);
    return this;
  }

  public swaggerUI(path: string, options?: SwaggerUIOptions): this {
    const handler = swaggerUI(path, options);
    this.get(path, handler);
    return this;
  }

  // GET Overloads
  public get<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $get: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public get<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    mw: MiddlewareHandler,
    v1: ValidatorMiddleware<T1, O1>,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $get: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public get<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $get: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public get<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    mw: MiddlewareHandler,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $get: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public get<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    mw: MiddlewareHandler,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $get: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public get<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    mw: MiddlewareHandler,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $get: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
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
  >;
  public get(path: string, ...handlers: any[]): any {
    this.addRoute('GET', path, handlers);
    return this;
  }

  // POST Overloads
  public post<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $post: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public post<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    mw: MiddlewareHandler,
    v1: ValidatorMiddleware<T1, O1>,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $post: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public post<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $post: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public post<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    mw: MiddlewareHandler,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $post: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public post<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    mw: MiddlewareHandler,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $post: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public post<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    mw: MiddlewareHandler,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $post: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
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
  >;
  public post(path: string, ...handlers: any[]): any {
    this.addRoute('POST', path, handlers);
    return this;
  }

  // PUT Overloads
  public put<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $put: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public put<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    mw: MiddlewareHandler,
    v1: ValidatorMiddleware<T1, O1>,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $put: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public put<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $put: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public put<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    mw: MiddlewareHandler,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $put: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public put<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    mw: MiddlewareHandler,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $put: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public put<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    mw: MiddlewareHandler,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $put: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
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
  >;
  public put(path: string, ...handlers: any[]): any {
    this.addRoute('PUT', path, handlers);
    return this;
  }

  // DELETE Overloads
  public delete<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $delete: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public delete<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    mw: MiddlewareHandler,
    v1: ValidatorMiddleware<T1, O1>,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $delete: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public delete<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $delete: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public delete<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    mw: MiddlewareHandler,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $delete: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public delete<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    mw: MiddlewareHandler,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $delete: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public delete<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    mw: MiddlewareHandler,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $delete: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
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
  >;
  public delete(path: string, ...handlers: any[]): any {
    this.addRoute('DELETE', path, handlers);
    return this;
  }

  // PATCH Overloads
  public patch<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $patch: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public patch<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    mw: MiddlewareHandler,
    v1: ValidatorMiddleware<T1, O1>,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $patch: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public patch<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $patch: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public patch<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    mw: MiddlewareHandler,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $patch: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public patch<Path extends string, T1 extends ValidationTarget, O1, R>(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    mw: MiddlewareHandler,
    handler: (c: Context<Path, { [K in T1]: O1 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $patch: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
  public patch<
    Path extends string,
    T1 extends ValidationTarget,
    O1,
    T2 extends ValidationTarget,
    O2,
    R
  >(
    path: Path,
    v1: ValidatorMiddleware<T1, O1>,
    v2: ValidatorMiddleware<T2, O2>,
    mw: MiddlewareHandler,
    handler: (c: Context<Path, { [K in T1]: O1 } & { [K in T2]: O2 }>) => R
  ): JSType<
    TRoutes & {
      [P in Path]: {
        $patch: (
          options?: ClientRequestOptions<
            ExtractParams<P>,
            'query' extends T1 ? O1 : 'query' extends T2 ? O2 : Record<string, string | number | boolean>,
            'json' extends T1 ? O1 : 'json' extends T2 ? O2 : any
          >
        ) => Promise<TypedClientResponse<InferData<R>>>;
      };
    }
  >;
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
  >;
  public patch(path: string, ...handlers: any[]): any {
    this.addRoute('PATCH', path, handlers);
    return this;
  }

  // ALL Overloads
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
  >;
  public all(path: string, ...handlers: any[]): any {
    this.addRoute('ALL', path, handlers);
    return this;
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
