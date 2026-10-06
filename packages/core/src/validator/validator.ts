import type { Context } from '../context.js';
import type { Next } from '../types.js';
import type {
  AnySchema,
  InferSchemaInput,
  InferSchemaOutput,
  ValidationHook,
  ValidationIssue,
  ValidationResult,
  ValidationTarget,
  ValidatorMiddleware,
} from './types.js';

export async function validateSchema(
  schema: any,
  value: unknown
): Promise<ValidationResult> {
  if (!schema) {
    return { success: true, data: value };
  }

  // 1. Standard Schema v1 (~standard)
  if (typeof schema === 'object' && schema !== null && '~standard' in schema) {
    const stdResult = await schema['~standard'].validate(value);
    if (stdResult.issues && stdResult.issues.length > 0) {
      const issues: ValidationIssue[] = stdResult.issues.map((i: any) => ({
        message: i.message,
        path: Array.isArray(i.path) && i.path.length > 0
          ? i.path
              .map((p: any) =>
                typeof p === 'object' && p !== null && 'key' in p ? String(p.key) : String(p)
              )
              .join('.')
          : undefined,
      }));
      return { success: false, issues };
    }
    return { success: true, data: stdResult.value };
  }

  // 2. safeParseAsync
  if (typeof schema.safeParseAsync === 'function') {
    const res = await schema.safeParseAsync(value);
    if (res.success) {
      return { success: true, data: res.data };
    }
    const rawIssues = res.error?.issues ?? [{ message: res.error?.message ?? 'Validation failed' }];
    const issues: ValidationIssue[] = rawIssues.map((i: any) => ({
      message: i.message,
      path: Array.isArray(i.path) ? i.path.join('.') : undefined,
    }));
    return { success: false, issues };
  }

  // 3. safeParse
  if (typeof schema.safeParse === 'function') {
    const res = schema.safeParse(value);
    if (res.success) {
      return { success: true, data: res.data };
    }
    const rawIssues = res.error?.issues ?? [{ message: res.error?.message ?? 'Validation failed' }];
    const issues: ValidationIssue[] = rawIssues.map((i: any) => ({
      message: i.message,
      path: Array.isArray(i.path) ? i.path.join('.') : undefined,
    }));
    return { success: false, issues };
  }

  // 4. parse
  if (typeof schema.parse === 'function') {
    try {
      const data = await schema.parse(value);
      return { success: true, data };
    } catch (err: any) {
      const rawIssues = err?.issues ?? [{ message: err?.message ?? 'Validation failed' }];
      const issues: ValidationIssue[] = rawIssues.map((i: any) => ({
        message: i.message,
        path: Array.isArray(i.path) ? i.path.join('.') : undefined,
      }));
      return { success: false, issues };
    }
  }

  // 5. functional validator
  if (typeof schema === 'function') {
    try {
      const res = await schema(value);
      if (res && typeof res === 'object' && 'success' in res) {
        if (!res.success) {
          return { success: false, issues: res.issues ?? [{ message: 'Validation failed' }] };
        }
        return { success: true, data: res.data ?? value };
      }
      return { success: true, data: res ?? value };
    } catch (err: any) {
      return { success: false, issues: [{ message: err?.message ?? 'Validation failed' }] };
    }
  }

  return { success: true, data: value };
}

export function validator<
  Target extends ValidationTarget,
  TSchema extends AnySchema,
  Out = InferSchemaOutput<TSchema>,
  In = InferSchemaInput<TSchema>
>(
  target: Target,
  schema: TSchema,
  hook?: ValidationHook<Out>
): ValidatorMiddleware<Target, Out, In> {
  const handler: any = async function (c: Context, next: Next): Promise<Response | void> {
    let value: unknown;

    if (target === 'json') {
      try {
        const text = await c.req.text();
        if (!text || text.trim() === '') {
          value = undefined;
        } else {
          value = JSON.parse(text);
        }
      } catch (_err) {
        const issues: ValidationIssue[] = [{ message: 'Malformed JSON payload' }];
        if (hook) {
          const hookRes = await hook({ success: false, errors: issues, target }, c);
          if (hookRes instanceof Response) return hookRes;
        }
        return c.json(
          {
            success: false,
            target,
            error: 'Malformed JSON payload',
            issues,
          },
          400
        );
      }
    } else if (target === 'query') {
      value = c.req.query();
    } else if (target === 'param') {
      value = c.req.param();
    } else if (target === 'header') {
      const rawHeaders = c.req.header();
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawHeaders)) {
        normalized[k] = v;
        normalized[k.toLowerCase()] = v;
      }
      value = new Proxy(normalized, {
        get(tgt, prop) {
          if (typeof prop === 'string') {
            return tgt[prop] ?? tgt[prop.toLowerCase()];
          }
          return (tgt as any)[prop];
        },
      });
    }

    const result = await validateSchema(schema, value);

    if (!result.success) {
      if (hook) {
        const hookRes = await hook(
          { success: false, errors: result.issues ?? [], target },
          c
        );
        if (hookRes instanceof Response) return hookRes;
      }
      return c.json(
        {
          success: false,
          target,
          error: 'Validation failed',
          issues: result.issues,
        },
        400
      );
    }

    if (hook) {
      const hookRes = await hook(
        { success: true, data: result.data as Out, target },
        c
      );
      if (hookRes instanceof Response) return hookRes;
    }

    c.req.setValid(target, result.data);
    return await next();
  };

  handler._target = target;
  handler.schema = schema;

  return handler;
}
