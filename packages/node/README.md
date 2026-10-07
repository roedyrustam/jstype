# jstype-node

> Official Node.js HTTP Server Adapter & Static File Middleware for [jstype](https://github.com/roedyrustam/jstype).

## Installation

```bash
npm install jstype-node jstype-core
# or
pnpm add jstype-node jstype-core
# or
bun add jstype-node jstype-core
```

## Usage

```ts
import { serve, serveStatic } from 'jstype-node';
import { JSType } from 'jstype-core';

const app = new JSType();

// Serve static assets from public folder
app.use(serveStatic({ root: './public' }));

app.get('/api/ping', (c) => c.text('pong'));

// Start native Node.js HTTP server
serve(app, { port: 3000 }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
```

## Documentation

Full documentation at [github.com/roedyrustam/jstype](https://github.com/roedyrustam/jstype).

## License

MIT © 2026 Roedy Rustam
