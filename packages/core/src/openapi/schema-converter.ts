export function schemaToJsonSchema(schema: any): Record<string, any> {
  if (!schema) {
    return { type: 'object' };
  }

  // 1. Check for intersection schemas to preserve canonical OpenAPI allOf composition
  if (schema && typeof schema === 'object' && '_def' in schema) {
    const def = schema._def;
    if (def.type === 'intersection' || def.typeName === 'ZodIntersection') {
      return {
        allOf: [schemaToJsonSchema(def.left), schemaToJsonSchema(def.right)],
      };
    }
  }

  // 2. If schema has explicit toJSONSchema method
  if (typeof schema.toJSONSchema === 'function') {
    try {
      const generated = schema.toJSONSchema();
      if (generated && typeof generated === 'object') {
        const clean = { ...generated };
        delete clean.$schema;
        if (clean.properties && Array.isArray(clean.required)) {
          clean.required = clean.required.filter((prop: string) => {
            const propSchema = clean.properties[prop];
            return !propSchema || propSchema.default === undefined;
          });
        }
        return clean;
      }
      return generated;
    } catch {
      // Continue to next resolvers
    }
  }

  // 2. If schema already has jsonSchema property
  if (schema.jsonSchema && typeof schema.jsonSchema === 'object') {
    return schema.jsonSchema;
  }

  // 3. If schema is already JSON Schema (e.g. TypeBox or raw JSON schema)
  if (typeof schema === 'object' && ('type' in schema || 'properties' in schema || 'anyOf' in schema || 'oneOf' in schema)) {
    return schema;
  }

  // 4. Zod schema inspection via _def
  if (schema && typeof schema === 'object' && '_def' in schema) {
    const def = schema._def;
    const typeName: string = def.typeName ?? '';
    let result: Record<string, any> | undefined;

    switch (typeName) {
      case 'ZodString': {
        const s: Record<string, any> = { type: 'string' };
        if (def.checks && Array.isArray(def.checks)) {
          for (const check of def.checks) {
            if (check.kind === 'min') s.minLength = check.value;
            if (check.kind === 'max') s.maxLength = check.value;
            if (check.kind === 'length') {
              s.minLength = check.value;
              s.maxLength = check.value;
            }
            if (check.kind === 'email') s.format = 'email';
            if (check.kind === 'url') s.format = 'uri';
            if (check.kind === 'uuid') s.format = 'uuid';
            if (check.kind === 'datetime') s.format = 'date-time';
            if (check.kind === 'cuid') s.format = 'cuid';
            if (check.kind === 'ip') s.format = 'ipv4';
            if (check.kind === 'regex') s.pattern = check.regex.source;
          }
          if (s.format) {
            delete s.pattern;
          }
        }
        result = s;
        break;
      }

      case 'ZodNumber': {
        const s: Record<string, any> = { type: 'number' };
        if (def.checks && Array.isArray(def.checks)) {
          for (const check of def.checks) {
            if (check.kind === 'int') s.type = 'integer';
            if (check.kind === 'min') {
              if (check.inclusive === false) s.exclusiveMinimum = check.value;
              else s.minimum = check.value;
            }
            if (check.kind === 'max') {
              if (check.inclusive === false) s.exclusiveMaximum = check.value;
              else s.maximum = check.value;
            }
            if (check.kind === 'multipleOf') s.multipleOf = check.value;
          }
        }
        result = s;
        break;
      }

      case 'ZodBigInt':
        result = { type: 'integer', format: 'int64' };
        break;

      case 'ZodBoolean':
        result = { type: 'boolean' };
        break;

      case 'ZodArray': {
        const arr: Record<string, any> = {
          type: 'array',
          items: schemaToJsonSchema(def.type),
        };
        if (def.minLength !== null && def.minLength !== undefined) {
          arr.minItems = def.minLength.value;
        }
        if (def.maxLength !== null && def.maxLength !== undefined) {
          arr.maxItems = def.maxLength.value;
        }
        if (def.exactLength !== null && def.exactLength !== undefined) {
          arr.minItems = def.exactLength.value;
          arr.maxItems = def.exactLength.value;
        }
        result = arr;
        break;
      }

      case 'ZodObject': {
        const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
        const properties: Record<string, any> = {};
        const required: string[] = [];

        if (shape && typeof shape === 'object') {
          for (const [key, propSchema] of Object.entries(shape as Record<string, any>)) {
            properties[key] = schemaToJsonSchema(propSchema);
            const propDef = propSchema?._def;
            const isOptional =
              propDef?.typeName === 'ZodOptional' ||
              propDef?.typeName === 'ZodDefault' ||
              (typeof propSchema?.isOptional === 'function' && propSchema.isOptional());
            if (!isOptional) {
              required.push(key);
            }
          }
        }

        const res: Record<string, any> = {
          type: 'object',
          properties,
        };
        if (required.length > 0) {
          res.required = required;
        }
        result = res;
        break;
      }

      case 'ZodEnum':
        result = {
          type: 'string',
          enum: def.values,
        };
        break;

      case 'ZodNativeEnum':
        result = {
          type: 'string',
          enum: Object.values(def.values),
        };
        break;

      case 'ZodLiteral':
        result = {
          type: typeof def.value,
          enum: [def.value],
        };
        break;

      case 'ZodOptional':
        result = schemaToJsonSchema(def.innerType);
        break;

      case 'ZodNullable': {
        const inner = schemaToJsonSchema(def.innerType);
        result = {
          anyOf: [inner, { type: 'null' }],
        };
        break;
      }

      case 'ZodDefault': {
        const inner = schemaToJsonSchema(def.innerType);
        const defaultVal = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
        result = {
          ...inner,
          default: defaultVal,
        };
        break;
      }

      case 'ZodUnion':
      case 'ZodDiscriminatedUnion': {
        const options = def.options ?? [];
        result = {
          anyOf: options.map((opt: any) => schemaToJsonSchema(opt)),
        };
        break;
      }

      case 'ZodIntersection':
        result = {
          allOf: [schemaToJsonSchema(def.left), schemaToJsonSchema(def.right)],
        };
        break;

      case 'ZodTuple': {
        const items = def.items ?? [];
        result = {
          type: 'array',
          prefixItems: items.map((it: any) => schemaToJsonSchema(it)),
          items: def.rest ? schemaToJsonSchema(def.rest) : false,
        };
        break;
      }

      case 'ZodRecord':
        result = {
          type: 'object',
          additionalProperties: schemaToJsonSchema(def.valueType),
        };
        break;

      case 'ZodLazy':
        if (typeof def.getter === 'function') {
          result = schemaToJsonSchema(def.getter());
        } else {
          result = { type: 'object' };
        }
        break;

      case 'ZodAny':
      case 'ZodUnknown':
        result = {};
        break;

      case 'ZodEffects':
        // Refinement or transform
        result = schemaToJsonSchema(def.schema);
        break;

      case 'ZodNull':
        result = { type: 'null' };
        break;

      case 'ZodDate':
        result = { type: 'string', format: 'date-time' };
        break;

      default:
        break;
    }

    if (result) {
      const description = schema.description ?? def.description;
      if (description && typeof result === 'object') {
        result.description = description;
      }
      return result;
    }
  }

  // Fallback
  return { type: 'object' };
}
