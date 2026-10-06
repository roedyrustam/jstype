import type { MiddlewareHandler } from '../types.js';

export interface SecureHeadersOptions {
  /** Value for Content-Security-Policy header, or false to disable */
  contentSecurityPolicy?: string | false;
  /** Value for Cross-Origin-Opener-Policy header, or false to disable (default: 'same-origin') */
  crossOriginOpenerPolicy?: string | false;
  /** Value for Cross-Origin-Resource-Policy header, or false to disable (default: 'same-origin') */
  crossOriginResourcePolicy?: string | false;
  /** Whether to set Origin-Agent-Cluster: ?1 (default: true) */
  originAgentCluster?: boolean;
  /** Value for Referrer-Policy header, or false to disable (default: 'no-referrer') */
  referrerPolicy?: string | false;
  /** Value for Strict-Transport-Security header, or false to disable (default: 'max-age=15552000; includeSubDomains') */
  strictTransportSecurity?: string | false;
  /** Whether to set X-Content-Type-Options: nosniff (default: true) */
  xContentTypeOptions?: boolean;
  /** Whether to set X-DNS-Prefetch-Control: off (default: true) */
  xDnsPrefetchControl?: boolean;
  /** Whether to set X-Download-Options: noopen (default: true) */
  xDownloadOptions?: boolean;
  /** Value for X-Frame-Options header, or false to disable (default: 'SAMEORIGIN') */
  xFrameOptions?: string | false;
  /** Value for X-Permitted-Cross-Domain-Policies header, or false to disable (default: 'none') */
  xPermittedCrossDomainPolicies?: string | false;
  /** Value for X-XSS-Protection header, or false to disable (default: '0') */
  xXssProtection?: string | false;
}

export function secureHeaders(options: SecureHeadersOptions = {}): MiddlewareHandler {
  const {
    contentSecurityPolicy,
    crossOriginOpenerPolicy = 'same-origin',
    crossOriginResourcePolicy = 'same-origin',
    originAgentCluster = true,
    referrerPolicy = 'no-referrer',
    strictTransportSecurity = 'max-age=15552000; includeSubDomains',
    xContentTypeOptions = true,
    xDnsPrefetchControl = true,
    xDownloadOptions = true,
    xFrameOptions = 'SAMEORIGIN',
    xPermittedCrossDomainPolicies = 'none',
    xXssProtection = '0',
  } = options;

  return async (c, next) => {
    await next();

    // Set headers on context/response
    if (xContentTypeOptions) {
      c.header('X-Content-Type-Options', 'nosniff');
    }
    if (xDnsPrefetchControl) {
      c.header('X-DNS-Prefetch-Control', 'off');
    }
    if (xDownloadOptions) {
      c.header('X-Download-Options', 'noopen');
    }
    if (xFrameOptions) {
      c.header('X-Frame-Options', xFrameOptions);
    }
    if (xPermittedCrossDomainPolicies) {
      c.header('X-Permitted-Cross-Domain-Policies', xPermittedCrossDomainPolicies);
    }
    if (xXssProtection) {
      c.header('X-XSS-Protection', xXssProtection);
    }
    if (strictTransportSecurity) {
      c.header('Strict-Transport-Security', strictTransportSecurity);
    }
    if (referrerPolicy) {
      c.header('Referrer-Policy', referrerPolicy);
    }
    if (crossOriginOpenerPolicy) {
      c.header('Cross-Origin-Opener-Policy', crossOriginOpenerPolicy);
    }
    if (crossOriginResourcePolicy) {
      c.header('Cross-Origin-Resource-Policy', crossOriginResourcePolicy);
    }
    if (originAgentCluster) {
      c.header('Origin-Agent-Cluster', '?1');
    }
    if (contentSecurityPolicy) {
      c.header('Content-Security-Policy', contentSecurityPolicy);
    }
  };
}
