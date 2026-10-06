export interface RouteParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: Record<string, any>;
  example?: any;
}

export interface RouteRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, { schema: Record<string, any>; example?: any }>;
}

export interface RouteResponse {
  description: string;
  content?: Record<string, { schema: Record<string, any>; example?: any }>;
  headers?: Record<string, any>;
}

export interface RouteMetadata {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  security?: Record<string, string[]>[];
  parameters?: RouteParameter[];
  requestBody?: RouteRequestBody;
  responses?: Record<string | number, RouteResponse>;
  [key: string]: any;
}

export interface OpenAPIContact {
  name?: string;
  url?: string;
  email?: string;
}

export interface OpenAPILicense {
  name: string;
  url?: string;
  identifier?: string;
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  summary?: string;
  termsOfService?: string;
  contact?: OpenAPIContact;
  license?: OpenAPILicense;
}

export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<string, any>;
}

export interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: { description?: string; url: string };
}

export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
    parameters?: Record<string, any>;
    responses?: Record<string, any>;
    requestBodies?: Record<string, any>;
    headers?: Record<string, any>;
  };
  security?: Record<string, string[]>[];
  tags?: OpenAPITag[];
  externalDocs?: { description?: string; url: string };
}
