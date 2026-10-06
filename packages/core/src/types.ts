import type { Context } from './context.js';

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type HTTPMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'
  | 'ALL';

type ExtractRawParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractRawParams<`/${Rest}`>
    : T extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : T extends `${infer _Start}*${infer Wildcard}`
    ? { [K in Wildcard extends '' ? 'wildcard' : Wildcard]: string }
    : {};

export type ExtractParams<T extends string> = Prettify<ExtractRawParams<T>>;

export interface TypedResponse<T = unknown, Status extends number = number> extends Response {
  readonly _data?: T;
  readonly _status?: Status;
}

export type InferData<R> = R extends Promise<infer U>
  ? InferData<U>
  : R extends TypedResponse<infer T, any>
  ? T
  : R extends Response
  ? unknown
  : R;

export interface TypedClientResponse<T = unknown> extends Response {
  json(): Promise<T>;
}

export interface ClientRequestOptions<
  P = Record<string, string>,
  Q = Record<string, string | number | boolean>,
  B = any
> {
  param?: P;
  query?: Q;
  json?: B;
  body?: BodyInit | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

export type Next = () => Promise<Response | void>;

export type RouteHandler<
  P extends string = string,
  V extends Record<string, any> = Record<string, any>,
  R = any
> = (
  c: Context<P, V>
) => R | Promise<R>;

export type MiddlewareHandler = (
  c: Context<any>,
  next: Next
) => Promise<Response | void> | Response | void;

export type RouteMap = Record<string, Record<string, any>>;

export type MergePath<A extends string, B extends string> =
  B extends '/' ? (A extends '' ? '/' : A) :
  B extends '' ? (A extends '' ? '/' : A) :
  A extends '/' ? (B extends '/' ? '/' : B) :
  `${A extends `${infer ATrim}/` ? ATrim : A}/${B extends `/${infer BTrim}` ? BTrim : B}`;

export type PrefixedRoutes<Prefix extends string, Routes> = {
  [K in keyof Routes as K extends string ? MergePath<Prefix, K> : never]: Routes[K];
};
