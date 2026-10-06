import type { Context } from '../context.js';
import type { MiddlewareHandler } from '../types.js';

export interface BasicAuthOptions {
  /** Expected username */
  username?: string;
  /** Expected password */
  password?: string;
  /** Custom user/password verification callback */
  verifyUser?: (
    username: string,
    password: string,
    c: Context
  ) => boolean | Promise<boolean>;
  /** Auth realm name (default: 'jstype') */
  realm?: string;
}

function decodeBase64(str: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(str);
    }
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

export function basicAuth(options: BasicAuthOptions): MiddlewareHandler {
  const { username, password, verifyUser, realm = 'jstype' } = options;

  return async (c, next) => {
    const authHeader = c.req.header('authorization');

    const unauthorized = () => {
      c.header('WWW-Authenticate', `Basic realm="${realm}"`);
      return c.json({ error: 'Unauthorized' }, 401 as any);
    };

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return unauthorized();
    }

    const base64Credentials = authHeader.slice(6).trim();
    const decoded = decodeBase64(base64Credentials);
    const colonIndex = decoded.indexOf(':');

    if (colonIndex === -1) {
      return unauthorized();
    }

    const parsedUser = decoded.slice(0, colonIndex);
    const parsedPass = decoded.slice(colonIndex + 1);

    let isValid = false;

    if (verifyUser) {
      isValid = await verifyUser(parsedUser, parsedPass, c);
    } else if (username !== undefined && password !== undefined) {
      isValid = parsedUser === username && parsedPass === password;
    }

    if (!isValid) {
      return unauthorized();
    }

    return await next();
  };
}
