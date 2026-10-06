import type { ClientOptions, ClientProxy, ClientRequestOptions } from './types.js';

export function createClient<T = any>(
  baseUrl: string = '',
  clientOptions: ClientOptions = {}
): ClientProxy<T> {
  const customFetch = clientOptions.fetch ?? globalThis.fetch.bind(globalThis);
  const baseHeaders = clientOptions.headers;

  const cleanBase = baseUrl.replace(/\/+$/, '');

  function createProxy(pathSegments: string[]): any {
    return new Proxy(
      function () {},
      {
        get(_target, prop: string | symbol) {
          if (typeof prop === 'symbol') {
            return undefined;
          }

          if (prop.startsWith('$')) {
            const method = prop.slice(1).toUpperCase();
            return async (options?: ClientRequestOptions) => {
              let joinedPath = '';
              for (const segment of pathSegments) {
                const cleanSeg = segment.replace(/^\/+|\/+$/g, '');
                if (cleanSeg) {
                  joinedPath += `/${cleanSeg}`;
                }
              }

              if (!joinedPath) {
                joinedPath = '/';
              }

              if (options?.param) {
                for (const [key, val] of Object.entries(options.param)) {
                  const strVal = String(val);
                  const encodedVal = encodeURIComponent(strVal);
                  const wildcardVal = strVal.split('/').map(encodeURIComponent).join('/');

                  // Replace :param
                  joinedPath = joinedPath.replace(
                    new RegExp(`:${key}(?=[/?]|$)`, 'g'),
                    encodedVal
                  );

                  // Replace *param
                  joinedPath = joinedPath.replace(
                    new RegExp(`\\*${key}(?=[/?]|$)`, 'g'),
                    wildcardVal
                  );

                  // If param key is 'wildcard' or '*', also replace anonymous wildcard '*'
                  if (key === 'wildcard' || key === '*') {
                    joinedPath = joinedPath.replace(
                      new RegExp(`\\*(?=[/?]|$)`, 'g'),
                      wildcardVal
                    );
                  }
                }
              }

              let url = `${cleanBase}${joinedPath}`;

              if (options?.query) {
                const searchParams = new URLSearchParams();
                for (const [key, val] of Object.entries(options.query)) {
                  if (val !== undefined && val !== null) {
                    if (Array.isArray(val)) {
                      for (const item of val) {
                        searchParams.append(key, String(item));
                      }
                    } else {
                      searchParams.set(key, String(val));
                    }
                  }
                }
                const qs = searchParams.toString();
                if (qs) {
                  url += (url.includes('?') ? '&' : '?') + qs;
                }
              }

              const headers = new Headers(baseHeaders);
              if (options?.headers) {
                const incoming = new Headers(options.headers);
                incoming.forEach((val, key) => headers.set(key, val));
              }

              const fetchInit: RequestInit = {
                method,
                headers,
                signal: options?.signal,
              };

              let body = options?.body;
              if (options?.json !== undefined) {
                if (!headers.has('content-type')) {
                  headers.set('content-type', 'application/json');
                }
                body = JSON.stringify(options.json);
              }

              if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
                fetchInit.body = body;
              }

              const response = await customFetch(url, fetchInit);

              return response;
            };
          }

          return createProxy([...pathSegments, prop]);
        },
      }
    );
  }

  return createProxy([]) as ClientProxy<T>;
}
