import type { Context } from '../context.js';
import type { RouteHandler } from '../types.js';

export interface ScalarDocsOptions {
  specUrl?: string;
  spec?: Record<string, any>;
  title?: string;
  theme?: string;
  customCss?: string;
  proxyUrl?: string;
  layout?: 'modern' | 'classic';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function scalarDocs(
  pathOrOptions?: string | ScalarDocsOptions,
  maybeOptions?: ScalarDocsOptions
): RouteHandler {
  let options: ScalarDocsOptions = {};

  if (typeof pathOrOptions === 'string') {
    options = maybeOptions ?? {};
  } else if (pathOrOptions && typeof pathOrOptions === 'object') {
    options = pathOrOptions;
  }

  const specUrl = options.specUrl ?? '/openapi.json';
  const title = options.title ?? 'API Reference';
  const customCss = options.customCss ?? '';

  const html = `<!doctype html>
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; padding: 0; }
      ${customCss}
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      ${!options.spec ? `data-url="${escapeHtml(specUrl)}"` : ''}
      ${options.theme ? `data-theme="${escapeHtml(options.theme)}"` : ''}
      ${options.proxyUrl ? `data-proxy-url="${escapeHtml(options.proxyUrl)}"` : ''}
      ${options.layout ? `data-layout="${escapeHtml(options.layout)}"` : ''}
    >${options.spec ? JSON.stringify(options.spec) : ''}</script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

  return function scalarDocsHandler(c: Context) {
    return c.html(html);
  };
}
