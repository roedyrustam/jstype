import type { Context } from '../context.js';
import type { MiddlewareHandler } from '../types.js';

export interface BearerAuthOptions {
  /** Static valid token or array of valid tokens */
  token?: string | string[];
  /** Custom async token verification function */
  verifyToken?: (token: string, c: Context) => boolean | Promise<boolean>;
  /** Custom header name (default: 'Authorization') */
  headerName?: string;
  /** Prefix before token (default: 'Bearer') */
  prefix?: string;
  /** Auth realm name (default: 'jstype') */
  realm?: string;
}

export function bearerAuth(options: BearerAuthOptions): MiddlewareHandler {
  const {
    token,
    verifyToken,
    headerName = 'Authorization',
    prefix = 'Bearer',
    realm = 'jstype',
  } = options;

  const validTokens = token ? (Array.isArray(token) ? token : [token]) : [];

  return async (c, next) => {
    const authHeader = c.req.header(headerName.toLowerCase());

    const unauthorized = () => {
      c.header('WWW-Authenticate', `Bearer realm="${realm}"`);
      return c.json({ error: 'Unauthorized' }, 401 as any);
    };

    if (!authHeader) {
      return unauthorized();
    }

    const expectedPrefix = `${prefix} `;
    if (!authHeader.startsWith(expectedPrefix)) {
      return unauthorized();
    }

    const extractedToken = authHeader.slice(expectedPrefix.length).trim();
    if (!extractedToken) {
      return unauthorized();
    }

    let isValid = false;

    if (verifyToken) {
      isValid = await verifyToken(extractedToken, c);
    } else if (validTokens.length > 0) {
      isValid = validTokens.includes(extractedToken);
    }

    if (!isValid) {
      return unauthorized();
    }

    return await next();
  };
}
