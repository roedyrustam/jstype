import type { ClientRequestOptions, TypedClientResponse } from '@jstype/core';

export type CleanPath<P extends string> = P extends `/${infer Rest}` ? CleanPath<Rest> : P;

export type SplitPath<P extends string> =
  CleanPath<P> extends `${infer Head}/${infer Tail}`
    ? [Head, ...SplitPath<Tail>]
    : CleanPath<P> extends ''
    ? []
    : [CleanPath<P>];

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type BuildNested<Segments extends string[], Leaf> =
  Segments extends [infer Head extends string, ...infer Rest extends string[]]
    ? {
        [K in Head | (Head extends `:${string}` | `*${string}` | '*' ? string : never)]: BuildNested<Rest, Leaf>;
      }
    : Leaf;

export type RouteEntryToTree<Path extends string, Methods> = BuildNested<
  SplitPath<Path>,
  Methods
>;

export type TransformRoutes<Routes> = UnionToIntersection<
  {
    [Path in keyof Routes]: Path extends string
      ? RouteEntryToTree<Path, Routes[Path]>
      : never;
  }[keyof Routes]
>;

export type ExtractRoutes<T> = T extends { _routes: infer R }
  ? R
  : T extends Record<string, any>
  ? T
  : {};

export type ClientProxy<T = any> = [T] extends [never]
  ? any
  : [keyof ExtractRoutes<T>] extends [never]
  ? any
  : TransformRoutes<ExtractRoutes<T>> & ExtractRoutes<T>;

export interface ClientOptions {
  headers?: HeadersInit;
  fetch?: typeof fetch;
}

export type { ClientRequestOptions, TypedClientResponse };
