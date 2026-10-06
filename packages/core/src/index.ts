export { JSType } from './app.js';
export { Context } from './context.js';
export { JSTypeRequest } from './request.js';
export { RadixRouter, RadixNode, splitPath } from './router.js';
export { compose, matchPath } from './middleware.js';

// Built-in Middleware
export { cors, type CorsOptions } from './middleware/cors.js';
export { logger, type LoggerOptions, type LogInfo } from './middleware/logger.js';

// Schema Validation
export {
  validator,
  validateSchema,
  type StandardSchemaV1,
  type AnySchema,
  type InferSchemaOutput,
  type InferSchemaInput,
  type ValidationTarget,
  type ValidationHook,
  type ValidationIssue,
  type ValidationResult,
  type ValidatorMiddleware,
} from './validator/index.js';

// OpenAPI 3.1 & Interactive Docs
export {
  describeRoute,
  generateOpenAPISpec,
  convertPathToOpenAPI,
  schemaToJsonSchema,
  scalarDocs,
  swaggerUI,
  type RouteMetadata,
  type RouteParameter,
  type RouteRequestBody,
  type RouteResponse,
  type OpenAPIInfo,
  type OpenAPISpec,
  type OpenAPIServer,
  type OpenAPITag,
  type OpenAPIContact,
  type OpenAPILicense,
  type ScalarDocsOptions,
  type SwaggerUIOptions,
  type RegisteredRouteInfo,
} from './openapi/index.js';

// Core Types
export type {
  HTTPMethod,
  ExtractParams,
  TypedResponse,
  InferData,
  TypedClientResponse,
  ClientRequestOptions,
  Next,
  RouteHandler,
  MiddlewareHandler,
  RouteMap,
  Prettify,
} from './types.js';
