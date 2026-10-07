# jstype-core

> Ultra-Fast Web Standards Web Framework with End-to-End Type Safety, Radix Router, Schema Validation & Auto OpenAPI 3.1.

Part of the [jstype](https://github.com/roedyrustam/jstype) web framework.

## Installation

```bash
npm install jstype-core
# or
pnpm add jstype-core
# or
bun add jstype-core
```

## Quickstart

```ts
import { JSType, cors, secureHeaders, etag, logger, validator, describeRoute } from 'jstype-core';
import { z } from 'zod';

const app = new JSType();

app.use(secureHeaders());
app.use(cors());
app.use(etag());
app.use(logger());

app.doc('/openapi.json', { title: 'My API', version: '1.0.0' });
app.scalarDocs('/docs');

const userSchema = z.object({
  name: z.string().min(2),
  role: z.enum(['admin', 'user']),
});

export const routes = app
  .get('/health', (c) => c.text('OK'))
  .post('/users', validator('json', userSchema), (c) => {
    const user = c.req.valid('json');
    return c.json({ id: '1', ...user }, 201);
  });

export type AppType = typeof routes;
export default app;
```

## Documentation

Full documentation and guides are available at [github.com/roedyrustam/jstype](https://github.com/roedyrustam/jstype).

## License

MIT © 2026 Roedy Rustam
