import type { Context } from '../context.js';
import type { MiddlewareHandler, Next } from '../types.js';

export namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output>;
  }

  export type Result<Output = unknown> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output = unknown> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment>;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  export type InferInput<Schema extends StandardSchemaV1> =
    Schema extends StandardSchemaV1<infer Input, unknown> ? Input : never;

  export type InferOutput<Schema extends StandardSchemaV1> =
    Schema extends StandardSchemaV1<unknown, infer Output> ? Output : never;
}

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export type AnySchema =
  | StandardSchemaV1<any, any>
  | { safeParse: (data: unknown) => { success: true; data: any } | { success: false; error: any } }
  | { safeParseAsync: (data: unknown) => Promise<{ success: true; data: any } | { success: false; error: any }> }
  | { parse: (data: unknown) => any }
  | ((data: unknown) => any);

export type InferSchemaOutput<T> =
  T extends StandardSchemaV1<any, infer Output>
    ? Output
    : T extends { '~standard': { types?: { output: infer Output } } }
    ? Output
    : T extends { _output: infer Output }
    ? Output
    : T extends { safeParse: (data: unknown) => { success: true; data: infer Output } | any }
    ? Output
    : T extends { safeParseAsync: (data: unknown) => Promise<{ success: true; data: infer Output } | any> }
    ? Output
    : T extends { parse: (data: unknown) => infer Output }
    ? Output
    : any;

export type InferSchemaInput<T> =
  T extends StandardSchemaV1<infer Input, any>
    ? Input
    : T extends { '~standard': { types?: { input: infer Input } } }
    ? Input
    : T extends { _input: infer Input }
    ? Input
    : InferSchemaOutput<T>;

export type ValidationTarget = 'json' | 'query' | 'param' | 'header';

export type ValidationHook<T = any> = (
  result:
    | { success: true; data: T; target: ValidationTarget }
    | { success: false; errors: any[]; target: ValidationTarget },
  c: Context
) => Response | void | Promise<Response | void>;

export interface ValidationIssue {
  message: string;
  path?: string;
}

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  issues?: ValidationIssue[];
}

export interface ValidatorMiddleware<
  Target extends ValidationTarget = ValidationTarget,
  Out = any,
  In = Out
> extends MiddlewareHandler {
  readonly _target: Target;
  readonly _output: Out;
  readonly _input: In;
  readonly schema: any;
  (c: Context<any>, next: Next): Promise<Response | void> | Response | void;
}
