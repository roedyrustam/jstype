import type { Context } from '../context.js';
import type { RouteHandler } from '../types.js';

export interface SwaggerUIOptions {
  specUrl?: string;
  spec?: Record<string, any>;
  title?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function swaggerUI(
  pathOrOptions?: string | SwaggerUIOptions,
  maybeOptions?: SwaggerUIOptions
): RouteHandler {
  let options: SwaggerUIOptions = {};

  if (typeof pathOrOptions === 'string') {
    options = maybeOptions ?? {};
  } else if (pathOrOptions && typeof pathOrOptions === 'object') {
    options = pathOrOptions;
  }

  const specUrl = options.specUrl ?? '/openapi.json';
  const title = options.title ?? 'Swagger UI';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      ${
        options.spec
          ? `SwaggerUIBundle({
        spec: ${JSON.stringify(options.spec)},
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout"
      });`
          : `SwaggerUIBundle({
        url: "${escapeHtml(specUrl)}",
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout"
      });`
      }
    };
  </script>
</body>
</html>`;

  return function swaggerUIHandler(c: Context) {
    return c.html(html);
  };
}
