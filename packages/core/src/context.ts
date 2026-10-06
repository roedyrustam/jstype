import { JSTypeRequest } from './request.js';
import type { TypedResponse } from './types.js';

export class Context<
  P extends string = string,
  V extends Record<string, any> = Record<string, any>
> {
  public readonly req: JSTypeRequest<P, V>;
  public readonly env: Record<string, unknown>;
  public readonly var: Record<string, any>;
  public res?: Response;

  private _responseHeaders: Headers = new Headers();
  private _status?: number;

  constructor(
    req: JSTypeRequest<P, V>,
    env: Record<string, unknown> = {},
    initialVar: Record<string, any> = {}
  ) {
    this.req = req;
    this.env = env;
    this.var = initialVar;
  }

  public set(key: string, value: any): void {
    this.var[key] = value;
  }

  public get<T = any>(key: string): T {
    return this.var[key] as T;
  }

  public header(name: string, value: string): void {
    this._responseHeaders.set(name, value);
    if (this.res) {
      try {
        this.res.headers.set(name, value);
      } catch {
        // Safe guard in case headers are immutable
      }
    }
  }

  public status(code: number): void {
    this._status = code;
  }

  private mergeHeaders(headers?: HeadersInit): Headers {
    const merged = new Headers(this._responseHeaders);
    if (headers) {
      const incoming = new Headers(headers);
      incoming.forEach((val, key) => {
        merged.set(key, val);
      });
    }
    return merged;
  }

  public json<T, S extends number = 200>(
    data: T,
    status?: S,
    headers?: HeadersInit
  ): TypedResponse<T, S> {
    const finalStatus = (status ?? this._status ?? 200) as S;
    const finalHeaders = this.mergeHeaders(headers);
    if (!finalHeaders.has('content-type')) {
      finalHeaders.set('content-type', 'application/json');
    }

    const response = new Response(JSON.stringify(data), {
      status: finalStatus,
      headers: finalHeaders,
    }) as TypedResponse<T, S>;

    this.res = response;
    return response;
  }

  public text<T extends string = string, S extends number = 200>(
    text: T,
    status?: S,
    headers?: HeadersInit
  ): TypedResponse<T, S> {
    const finalStatus = (status ?? this._status ?? 200) as S;
    const finalHeaders = this.mergeHeaders(headers);
    if (!finalHeaders.has('content-type')) {
      finalHeaders.set('content-type', 'text/plain; charset=utf-8');
    }

    const response = new Response(text, {
      status: finalStatus,
      headers: finalHeaders,
    }) as TypedResponse<T, S>;

    this.res = response;
    return response;
  }

  public html<T extends string = string, S extends number = 200>(
    html: T,
    status?: S,
    headers?: HeadersInit
  ): TypedResponse<T, S> {
    const finalStatus = (status ?? this._status ?? 200) as S;
    const finalHeaders = this.mergeHeaders(headers);
    if (!finalHeaders.has('content-type')) {
      finalHeaders.set('content-type', 'text/html; charset=utf-8');
    }

    const response = new Response(html, {
      status: finalStatus,
      headers: finalHeaders,
    }) as TypedResponse<T, S>;

    this.res = response;
    return response;
  }

  public redirect(url: string, status: number = 302): Response {
    const finalHeaders = this.mergeHeaders({
      Location: url,
    });
    const response = new Response(null, {
      status,
      headers: finalHeaders,
    });
    this.res = response;
    return response;
  }

  public notFound(message: string = 'Not Found'): Response {
    return this.json({ error: message }, 404 as any);
  }

  public error(err: unknown = 'Internal Server Error', status: number = 500): Response {
    const message = err instanceof Error ? err.message : String(err);
    return this.json({ error: message }, status as any);
  }
}
