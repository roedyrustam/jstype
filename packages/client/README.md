# @jstype/client

> Zero-Overhead Typed RPC Client for [jstype](https://github.com/roedyrustam/jstype).

Provides instant end-to-end type safety, autocompletion on paths, parameters, query strings, and return types directly derived from your backend without manual codegen.

## Installation

```bash
npm install @jstype/client
# or
pnpm add @jstype/client
# or
bun add @jstype/client
```

## Usage

```ts
import { createClient } from '@jstype/client';
import type { AppType } from './server'; // Exported from backend

const client = createClient<AppType>('http://localhost:3000');

// Fully type-safe!
const res = await client.api.users.$get();
const users = await res.json();

// Path parameters & typed body
const createRes = await client.api.users.$post({
  json: { name: 'Alice', role: 'admin' },
});
```

## Documentation

Full documentation at [github.com/roedyrustam/jstype](https://github.com/roedyrustam/jstype).

## License

MIT © 2026 Roedy Rustam
