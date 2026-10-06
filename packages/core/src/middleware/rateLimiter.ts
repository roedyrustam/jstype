import type { Context } from '../context.js';
import type { MiddlewareHandler } from '../types.js';

export interface RateLimiterOptions {
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
  /** Maximum number of requests allowed within the window (default: 100) */
  limit?: number;
  /** Function to generate a unique key per client (default: IP from headers or localhost) */
  keyGenerator?: (c: Context) => string | Promise<string>;
  /** Custom error message or JSON payload (default: { error: 'Too Many Requests' }) */
  message?: string | Record<string, any>;
  /** Whether to send standard RateLimit headers (default: true) */
  standardHeaders?: boolean;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

export function rateLimiter(options: RateLimiterOptions = {}): MiddlewareHandler {
  const {
    windowMs = 60_000,
    limit = 100,
    keyGenerator = (c) => {
      const forwarded = c.req.header('x-forwarded-for');
      if (forwarded) {
        return forwarded.split(',')[0].trim();
      }
      return c.req.header('x-real-ip') || '127.0.0.1';
    },
    message = { error: 'Too Many Requests' },
    standardHeaders = true,
  } = options;

  const hits = new Map<string, ClientRecord>();

  // Periodically clean expired keys to avoid memory leaks
  let lastCleanup = Date.now();

  return async (c, next) => {
    const now = Date.now();

    // Occasional cleanup
    if (now - lastCleanup > windowMs) {
      for (const [key, record] of hits.entries()) {
        if (now > record.resetTime) {
          hits.delete(key);
        }
      }
      lastCleanup = now;
    }

    const key = await keyGenerator(c);
    let record = hits.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      hits.set(key, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, limit - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    if (standardHeaders) {
      c.header('RateLimit-Limit', String(limit));
      c.header('RateLimit-Remaining', String(remaining));
      c.header('RateLimit-Reset', String(resetSeconds));
    }

    if (record.count > limit) {
      c.header('Retry-After', String(resetSeconds));
      if (typeof message === 'string') {
        return c.text(message, 429 as any);
      }
      return c.json(message, 429 as any);
    }

    return await next();
  };
}
