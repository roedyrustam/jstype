import type { ValidationTarget } from '../validator/types.js';
import { schemaToJsonSchema } from './schema-converter.js';
import type { OpenAPIInfo, OpenAPISpec, RouteMetadata, RouteParameter } from './types.js';

export interface RegisteredRouteInfo {
  method: string;
  path: string;
  metadata?: RouteMetadata;
  validators: Array<{ target: ValidationTarget; schema: any }>;
}

export function convertPathToOpenAPI(path: string): string {
  if (path === '*' || path === '/*') {
    return '/{wildcard}';
  }
  let openApiPath = path;
  if (!openApiPath.startsWith('/')) {
    openApiPath = `/${openApiPath}`;
  }
  // Convert :param to {param}
  openApiPath = openApiPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
  // Convert *wildcard to {wildcard}
  openApiPath = openApiPath.replace(/\*([a-zA-Z0-9_]+)/g, '{$1}');
  // Convert trailing /* to /{wildcard}
  openApiPath = openApiPath.replace(/\/\*$/g, '/{wildcard}');
  return openApiPath;
}

export function generateOpenAPISpec(
  routes: RegisteredRouteInfo[],
  specInfo?: Partial<OpenAPIInfo> & {
    servers?: OpenAPISpec['servers'];
    tags?: OpenAPISpec['tags'];
    components?: OpenAPISpec['components'];
    security?: OpenAPISpec['security'];
  }
): OpenAPISpec {
  const spec: OpenAPISpec = {
    openapi: '3.1.0',
    info: {
      title: specInfo?.title ?? 'JSType API',
      version: specInfo?.version ?? '1.0.0',
      description: specInfo?.description ?? 'OpenAPI 3.1.0 specification generated automatically by JSType',
      summary: specInfo?.summary,
      termsOfService: specInfo?.termsOfService,
      contact: specInfo?.contact,
      license: specInfo?.license,
    },
    servers: specInfo?.servers ?? [{ url: '/' }],
    paths: {},
  };

  if (specInfo?.tags) spec.tags = specInfo.tags;
  if (specInfo?.components) spec.components = specInfo.components;
  if (specInfo?.security) spec.security = specInfo.security;

  for (const route of routes) {
    const openApiPath = convertPathToOpenAPI(route.path);
    if (!spec.paths[openApiPath]) {
      spec.paths[openApiPath] = {};
    }

    const methods =
      route.method === 'ALL'
        ? ['get', 'post', 'put', 'delete', 'patch']
        : [route.method.toLowerCase()];

    // Collect parameters
    const paramMap = new Map<string, RouteParameter>();

    // 1. Path parameters from URL path
    const pathParamMatches = openApiPath.match(/{([a-zA-Z0-9_]+)}/g);
    if (pathParamMatches) {
      for (const m of pathParamMatches) {
        const paramName = m.slice(1, -1);
        paramMap.set(`path:${paramName}`, {
          name: paramName,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        });
      }
    }

    // 2. Validators
    let requestBody: Record<string, any> | undefined;

    for (const v of route.validators) {
      if (v.target === 'json') {
        const jsonSchema = schemaToJsonSchema(v.schema);
        requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: jsonSchema,
            },
          },
        };
      } else if (v.target === 'param') {
        const jsonSchema = schemaToJsonSchema(v.schema);
        if (jsonSchema.properties) {
          for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
            const key = `path:${propName}`;
            paramMap.set(key, {
              name: propName,
              in: 'path',
              required: true,
              schema: propSchema as Record<string, any>,
              description: (propSchema as any)?.description,
            });
          }
        }
      } else if (v.target === 'query') {
        const jsonSchema = schemaToJsonSchema(v.schema);
        if (jsonSchema.properties) {
          const requiredProps = (jsonSchema.required as string[]) ?? [];
          for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
            const key = `query:${propName}`;
            paramMap.set(key, {
              name: propName,
              in: 'query',
              required: requiredProps.includes(propName),
              schema: propSchema as Record<string, any>,
              description: (propSchema as any)?.description,
            });
          }
        }
      } else if (v.target === 'header') {
        const jsonSchema = schemaToJsonSchema(v.schema);
        if (jsonSchema.properties) {
          const requiredProps = (jsonSchema.required as string[]) ?? [];
          for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
            const key = `header:${propName}`;
            paramMap.set(key, {
              name: propName,
              in: 'header',
              required: requiredProps.includes(propName),
              schema: propSchema as Record<string, any>,
              description: (propSchema as any)?.description,
            });
          }
        }
      }
    }

    // 3. Merge manual parameters from describeRoute
    if (route.metadata?.parameters) {
      for (const p of route.metadata.parameters) {
        paramMap.set(`${p.in}:${p.name}`, p);
      }
    }

    // 4. Merge manual requestBody
    if (route.metadata?.requestBody) {
      requestBody = route.metadata.requestBody;
    }

    // 5. Responses
    let responses: Record<string | number, any> = {
      200: { description: 'Successful response' },
    };
    if (route.metadata?.responses) {
      responses = { ...route.metadata.responses };
    } else if (route.method === 'POST') {
      responses = {
        201: { description: 'Created' },
      };
    }

    // Auto-document 400 Bad Request if route has validators and 400 is not explicitly defined
    if (route.validators.length > 0 && !responses[400] && !responses['400']) {
      responses[400] = {
        description: 'Bad Request - Validation failed',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [false] },
                target: { type: 'string' },
                error: { type: 'string' },
                issues: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      path: { type: 'string' },
                    },
                  },
                },
              },
              required: ['success', 'error'],
            },
          },
        },
      };
    }

    // Build operation object
    const parameters = Array.from(paramMap.values());

    for (const m of methods) {
      const operation: Record<string, any> = {
        summary: route.metadata?.summary ?? `${route.method} ${route.path}`,
        responses,
      };

      if (route.metadata?.description) operation.description = route.metadata.description;
      if (route.metadata?.tags) operation.tags = route.metadata.tags;
      if (route.metadata?.operationId) operation.operationId = route.metadata.operationId;
      if (route.metadata?.deprecated !== undefined) operation.deprecated = route.metadata.deprecated;
      if (route.metadata?.security) operation.security = route.metadata.security;
      if (parameters.length > 0) operation.parameters = parameters;
      if (requestBody) operation.requestBody = requestBody;

      // Copy other arbitrary metadata fields
      if (route.metadata) {
        for (const [key, val] of Object.entries(route.metadata)) {
          if (
            ![
              'summary',
              'description',
              'tags',
              'operationId',
              'deprecated',
              'security',
              'parameters',
              'requestBody',
              'responses',
            ].includes(key)
          ) {
            operation[key] = val;
          }
        }
      }

      spec.paths[openApiPath][m] = operation;
    }
  }

  return spec;
}
