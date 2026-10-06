import type { ExtractParams } from './types.js';

export class JSTypeRequest<P extends string = string> {
  public readonly raw: Request;
  public params: Record<string, string>;
  private _urlObj?: URL;
  private _queryCache?: Record<string, string>;
  private _bodyText?: string;
  private _bodyJson?: unknown;

  constructor(raw: Request, params: Record<string, string> = {}) {
    this.raw = raw;
    this.params = params;
  }

  public get url(): string {
    return this.raw.url;
  }

  public get method(): string {
    return this.raw.method;
  }

  public get headers(): Headers {
    return this.raw.headers;
  }

  public header(): Record<string, string>;
  public header(name: string): string | null;
  public header(name?: string): any {
    if (!name) {
      const h: Record<string, string> = {};
      this.raw.headers.forEach((val, key) => {
        h[key] = val;
      });
      return h;
    }
    return this.raw.headers.get(name);
  }

  private get urlObj(): URL {
    if (!this._urlObj) {
      try {
        this._urlObj = new URL(this.raw.url);
      } catch {
        this._urlObj = new URL(this.raw.url, 'http://localhost');
      }
    }
    return this._urlObj;
  }

  public get path(): string {
    return this.urlObj.pathname;
  }

  public param(): ExtractParams<P>;
  public param<K extends keyof ExtractParams<P>>(name: K): ExtractParams<P>[K];
  public param(name: string): string | undefined;
  public param(name?: string): any {
    if (!name) {
      return { ...this.params } as ExtractParams<P>;
    }
    return this.params[name];
  }

  public query(): Record<string, string>;
  public query(name: string): string | undefined;
  public query(name?: string): any {
    if (!this._queryCache) {
      const q: Record<string, string> = {};
      this.urlObj.searchParams.forEach((val, key) => {
        q[key] = val;
      });
      this._queryCache = q;
    }
    if (!name) {
      return { ...this._queryCache };
    }
    return this._queryCache[name];
  }

  public queries(name: string): string[] {
    return this.urlObj.searchParams.getAll(name);
  }

  public async text(): Promise<string> {
    if (this._bodyText !== undefined) {
      return this._bodyText;
    }
    this._bodyText = await this.raw.text();
    return this._bodyText;
  }

  public async json<T = unknown>(): Promise<T> {
    if (this._bodyJson !== undefined) {
      return this._bodyJson as T;
    }
    const txt = await this.text();
    this._bodyJson = JSON.parse(txt);
    return this._bodyJson as T;
  }

  public async formData(): Promise<FormData> {
    return await this.raw.formData();
  }

  public async arrayBuffer(): Promise<ArrayBuffer> {
    return await this.raw.arrayBuffer();
  }

  public async blob(): Promise<Blob> {
    return await this.raw.blob();
  }
}
