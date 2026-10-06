<p align="center">
  <img src="assets/jstype_logo.jpg" alt="jstype Logo" width="180" style="border-radius: 16px;" />
</p>

<h1 align="center">jstype</h1>

<p align="center">
  <b>Ultra-Fast, Universal Web Standards Framework with Zero-Overhead End-to-End Type Safety</b>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quickstart">Quickstart</a> •
  <a href="#monorepo-structure">Monorepo</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#license">License</a>
</p>

---

## ⚡ Overview

**jstype** adalah modern web framework berbasis JavaScript & TypeScript yang dibangun di atas standar Fetch API Web murni (`Request`, `Response`, `Headers`). 

Framework ini dirancang untuk kompatibilitas universal lintas runtime modern (**Node.js 20+**, **Bun**, **Deno**, dan **Cloudflare Workers**) dengan performa tinggi berkat router berbasis **Radix Trie** serta **Zero-overhead Typed RPC Client** (`@jstype/client`) yang langsung menginferensikan tipe rute backend di frontend tanpa perlu proses codegen manual.

---

## ✨ Features

- 🌐 **Universal Web Standards**: Beroperasi di mana saja Fetch API tersedia — Node.js, Bun, Deno, Edge runtimes.
- 🚀 **Ultra-Fast Radix Router**: Pencocokan rute $O(k)$ berkecepatan tinggi dengan parameter dinamis (`:param`) dan wildcards (`*`).
- 🔒 **End-to-End Type Safety**: Autocomplete rute, HTTP methods, route params, query string, dan payload JSON secara otomatis di sisi client.
- 🛡️ **Schema Validation Adapter**: Validasi runtime first-class dengan dukungan Standard Schema v1 (`~standard`), Zod, TypeBox, dan Valibot via `validator('json' | 'query' | 'param' | 'header', schema)`.
- 📖 **OpenAPI 3.1 & Interactive Docs**: Auto-generate spesifikasi OpenAPI 3.1 dan dokumentasi interaktif dengan UI modern (**Scalar** & **Swagger UI**) via `app.doc()`, `scalarDocs()`, dan `describeRoute()`.
- ⚡ **Built-in Standard Middleware**: Middleware utilitas standar siap pakai: `cors()` (origin detection, credentials, preflight OPTIONS) dan `logger()` (latency, method, status).
- 📦 **Zero-Overhead Typed RPC Client (`@jstype/client`)**: Proxy-based client tanpa build/codegen step terpisah. Cukup ekspor `type AppType = typeof app`.
- 🧩 **Ergonomic Middleware Stack**: Mendukung middleware asinkron (`await next()`), typed context variables (`c.var`), dan header injection.
- 🛡️ **Zero Runtime Dependencies**: Package `@jstype/core` dan `@jstype/client` sangat ringan dan mengandalkan native web primitives.

---

## 🚀 Quickstart

### 1. Definisi Server (`server.ts`)

```ts
import { JSType, cors, logger, validator, describeRoute } from '@jstype/core';
import { z } from 'zod';

const app = new JSType();

// Built-in Middleware
app.use(cors());
app.use(logger());

// OpenAPI 3.1 & Interactive Scalar Docs
app.doc('/openapi.json', { title: 'My API', version: '1.0.0' });
app.scalarDocs('/docs', { specUrl: '/openapi.json', title: 'Interactive Docs' });

// Zod Schema
const createUserSchema = z.object({
  name: z.string().min(2),
  role: z.enum(['admin', 'user']),
});

// Routes with Validation & Metadata
const routes = app
  .get(
    '/api/users',
    describeRoute({ summary: 'List all users', tags: ['Users'] }),
    (c) => c.json([{ id: '1', name: 'Alice', role: 'admin' }])
  )
  .post(
    '/api/users',
    describeRoute({ summary: 'Create user', tags: ['Users'] }),
    validator('json', createUserSchema),
    (c) => {
      const user = c.req.valid('json'); // 100% Type-Safe derived from Zod!
      return c.json({ id: '2', ...user }, 201);
    }
  );

export type AppType = typeof routes;
export default app;
```

### 2. Konsumsi di Client Frontend (`client.ts`)

```ts
import { createClient } from '@jstype/client';
import type { AppType } from './server';

// Inisialisasi client type-safe
const client = createClient<AppType>('http://localhost:3000');

// 1. GET /api/users -> Full autocomplete & typed response
const usersRes = await client.api.users.$get();
const users = await usersRes.json(); // Type: { id: string; name: string; role: string }[]

// 2. GET /api/users/:id -> Typed path parameters
const userRes = await client.api.users[':id'].$get({
  param: { id: '1' }
});

// 3. POST /api/users -> Typed JSON body & status code
const createRes = await client.api.users.$post({
  json: { name: 'Charlie', role: 'admin' }
});
```

---

## 📁 Struktur Monorepo

```
jstype/
├── packages/
│   ├── core/           # @jstype/core: Router, Context, Middleware, App Engine
│   └── client/         # @jstype/client: Proxy-based Typed RPC Client
├── examples/
│   └── basic-api/      # Contoh aplikasi lengkap Server + Client
├── assets/
│   └── jstype_logo.jpg # Brand logo jstype
├── PRD.md              # Product Requirements Document
├── BLUEPRINT.md        # Technical Architecture Blueprint
├── ROADMAP.md          # Execution Roadmap
└── package.json        # pnpm workspaces root
```

---

## 🛠️ Perintah Workspace

```bash
# Install seluruh dependensi workspace
pnpm install

# Jalankan seluruh test suite (Vitest)
pnpm test

# Verifikasi type check TypeScript
pnpm typecheck

# Build semua package (ESM, CJS, .d.ts)
pnpm build

# Menjalankan demo interaktif basic-api
pnpm --filter example-basic-api start
```

---

## 📄 Dokumen Arsitektur
- [Product Requirements Document (PRD.md)](PRD.md)
- [Technical Architecture Blueprint (BLUEPRINT.md)](BLUEPRINT.md)
- [Roadmap & Progress (ROADMAP.md)](ROADMAP.md)

---

## ⚖️ License
MIT License © 2026 Roedy Rustam & Kontributor jstype.
