import type { Context } from '../context.js';
import type { MiddlewareHandler, Next } from '../types.js';
import type { RouteMetadata } from './types.js';

export interface RouteMetadataMiddleware extends MiddlewareHandler {
  readonly _routeMetadata: RouteMetadata;
  (c: Context<any>, next: Next): Promise<Response | void> | Response | void;
}

export function describeRoute(metadata: RouteMetadata): RouteMetadataMiddleware {
  const handler: any = async function (_c: Context, next: Next): Promise<Response | void> {
    return await next();
  };
  handler._routeMetadata = metadata;
  return handler;
}
