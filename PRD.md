# Product Requirements Document (PRD)

**Project**: `jstype`  
**Version**: 1.0.0  
**Status**: Approved  
**Created**: 2026-10-07  
**Last Updated**: 2026-10-07  

---

## 1. Executive Summary
`jstype` adalah modern TypeScript & JavaScript web framework dengan fokus utama pada **End-to-End Type Safety** dan kepatuhan penuh terhadap **Web Standards (Fetch API)**. Dirancang untuk developer yang menginginkan performa ultra-tinggi dan Developer Experience (DX) instan, `jstype` menyediakan router cepat berbasis Radix-tree serta built-in **Zero-overhead Typed RPC Client** (`@jstype/client`) yang memungkinkan klien frontend (React, Vue, Svelte, dsb.) secara otomatis menginferensikan rute backend tanpa proses codegen manual.

---

## 2. Problem Statement
* **Problem**: Framework web tradisional sering kali terpecah antara performa tinggi (namun minim type safety) atau type-safety yang rumit (membutuhkan pipeline build/codegen tambahan seperti tRPC atau generator OpenAPI yang membebani alur kerja developer). Selain itu, keterikatan pada runtime Node.js klasik menyulitkan deployment lintas edge runtimes.
* **Target Users**: Fullstack developers, API engineers, library authors, dan tim pengembang modern yang menggunakan TypeScript dan mengutamakan kecepatan eksekusi serta DX yang mulus di multi-runtime.
* **Current Pain Points**:
  1. *Schema & Type Drift*: Ketidaksesuaian tipe data antara backend response dengan frontend consumer.
  2. *Build Lag*: Penggunaan tooling codegen manual memperlambat siklus *hot reload*.
  3. *Vendor Lock-in Runtime*: Sulit memindahkan kode dari Node.js ke Bun, Deno, atau Cloudflare Workers tanpa mengubah handler request/response.

---

## 3. Goals & Success Metrics
| Goal | Metric | Target |
|---|---|---|
| **Zero Codegen RPC** | Waktu inferensi tipe frontend dari server schema | 0 ms (Instan via TypeScript type engine) |
| **Multi-Runtime Portability** | Kompatibilitas runtime standard | Node.js (20+), Bun, Deno, Cloudflare Workers 100% lulus tes |
| **Routing Performance** | Latensi pencarian rute dinamis (Radix Tree) | < 0.05 ms per request match |
| **Bundle Footprint** | Ukuran package core (`@jstype/core`) | < 15 KB minified & gzipped |
| **Type Rigor** | Strict Mode & isolatedDeclarations compliance | 100% zero any leaks pada exported types |

---

## 4. User Personas
### Persona 1: Fullstack TypeScript Developer (Rian)
- **Role**: Senior Fullstack Engineer
- **Goals**: Membangun API backend yang langsung terhubung ke aplikasi frontend dengan autocompletion rute, query params, request body, dan response JSON otomatis.
- **Frustrations**: Bosan menulis DTO duplikat antara backend dan frontend atau menjalankan perintah `npm run codegen` berulang-ulang setiap kali endpoint berubah.
- **Key Behaviors**: Mengimpor `type App = typeof app` di frontend dan memanggil client dengan `client.api.users.$get()`.

---

## 5. Feature Requirements

### MVP Features (Must Have — v1.0)
- [ ] **Universal Request / Response Context (`@jstype/core`)**: Abstraksi context `c` yang membungkus native standard `Request` dan menghasilkan standard `Response` (`c.json()`, `c.text()`, `c.html()`, `c.req.param()`, `c.req.query()`).
- [ ] **Ultra-Fast Radix Router**: Pencocokan rute berkecepatan tinggi dengan parameter dinamis (`/users/:id`), wildcards (`/static/*`), dan method filtering (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`).
- [ ] **Middleware Chain Engine**: Dukungan middleware asinkron bergaya Koa/Hono (`await next()`) dengan typed variables context (`c.var`).
- [ ] **Zero-overhead Typed RPC Client (`@jstype/client`)**: Proxy-based client yang membaca skema tipe generic rute `JSType<Routes>` dan menyediakan fungsi HTTP yang aman secara tipe (`$get`, `$post`, `$put`, `$delete`).
- [ ] **Multi-Runtime Adapters**: Adapter resmi untuk Node.js HTTP (`@jstype/node`), native Bun export (`fetch: app.fetch`), dan edge workers.

### Phase 2 Features (Should Have — v1.x)
- [ ] **Schema Validation Adapters**: Integrasi first-class dengan Zod, TypeBox, dan Valibot untuk validasi payload runtime dan inferensi skema otomatis.
- [ ] **Auto OpenAPI 3.1 & Scalar Docs**: Endpoint otomatis untuk menghasilkan spesifikasi OpenAPI dan dokumentasi interaktif tanpa overhead manual.
- [ ] **Server-Sent Events (SSE) & WebSocket Handler**: Helper streaming respon waktu-nyata type-safe.

### Future Features (Nice to Have — v2.0+)
- [ ] **File-based Routing Meta-Engine**: Opsi routing berbasis direktori file untuk arsitektur fullstack app.
- [ ] **Zero-Trust Microservice RPC**: Transport adapter via WebSockets atau gRPC over typed fetch.

---

## 6. Technical Architecture

### Stack Decision
| Layer | Technology | Rationale |
|---|---|---|
| **Language** | TypeScript 5.8+ | Sistem tipe mutakhir dengan inferensi rekursif dan isolatedDeclarations. |
| **Monorepo Manager** | pnpm workspaces + Turborepo | Ekosistem dependensi terisolasi, hemat disk, dan caching build cepat. |
| **Compiler / Bundler** | `tsup` (esbuild) | Kompilasi instan dual format (ESM & CJS) lengkap dengan `.d.ts`. |
| **Test Runner** | Vitest | Pengujian unit, e2e, dan type-testing berkecepatan tinggi. |
| **Standards** | WinterCG / Web Fetch API | `Request`, `Response`, `Headers`, `URLPattern`/Radix. |

### Architecture Decisions (ADRs)
- **ADR-001**: Menggunakan Web Standard Fetch API sebagai fondasi inti — memastikan framework tidak terikat pada modul `http` Node.js kuno.
- **ADR-002**: Desain Monorepo Modular (`packages/core`, `packages/client`) — pemisahan bersih antara runtime server dan package client frontend agar bundle client tetap nol-dependensi server.
- **ADR-003**: Proxy Type Inference untuk Client RPC — memanfaatkan JavaScript `Proxy` di runtime dengan arsitektur generic TypeScript untuk mencapai *zero codegen*.

---

## 7. Data & Type Model (High-Level Architecture)

```
[ HTTP Request (Fetch API) ]
           │
           ▼
[ @jstype/core: JSType App ]
   ├── [ Middleware Stack (c.var, logger, cors) ]
   ├── [ Radix Tree Router (path + method matching) ]
   └── [ Route Handler (c.json<T> / c.text) ]
           │
           ▼
[ Type Inference Layer: InferRoutes<App> ]
           │
           ▼ (Shared via TypeScript Types)
[ @jstype/client: jstypeClient<App> ]
   └── Proxy Traps: client.api.v1.users[":id"].$get() ──► Fetch Request
```

---

## 8. Developer Flows

### Primary Flow: Membangun Backend & Mengonsumsi di Frontend
1. **Server (`server.ts`)**:
   ```ts
   import { JSType } from '@jstype/core';

   const app = new JSType();

   const routes = app
     .get('/api/users', (c) => {
       return c.json([
         { id: '1', name: 'Alice', role: 'admin' }
       ]);
     })
     .post('/api/users', async (c) => {
       const body = await c.req.json<{ name: string }>();
       return c.json({ id: '2', name: body.name }, 201);
     });

   export type AppType = typeof routes;
   export default app;
   ```

2. **Frontend (`client.ts`)**:
   ```ts
   import { createClient } from '@jstype/client';
   import type { AppType } from './server';

   const client = createClient<AppType>('http://localhost:3000');

   // Fully type-safe! Autocomplete on path, methods, and return types:
   const res = await client.api.users.$get();
   const users = await res.json(); // Type is: { id: string; name: string; role: string }[]
   ```

---

## 9. Non-Functional Requirements (NFR)
| Requirement | Target |
|---|---|
| **Throughput / Latency** | > 80,000 req/sec pada Bun/Node 22, p99 latency < 1.5ms |
| **Type Check Speed** | Inferensi tipe rute tidak menyebabkan tsc compile lag (< 100ms per deep type resolution) |
| **Memory Footprint** | Idle RAM < 20 MB |
| **Code Coverage** | > 90% unit test coverage pada router, context, dan RPC client |
| **Zero Dependencies** | `@jstype/core` dan `@jstype/client` tidak memiliki *heavy runtime dependencies* eksternal |

---

## 10. Out of Scope
- Framework UI client rendering internal (jstype fokus sebagai web backend & typed RPC engine).
- Built-in ORM bawaan (pengembang bebas menggunakan Drizzle, Prisma, atau Kysely).

---

## 11. Open Questions & Roadmap Check
- [x] Runtime target: Universal Web Standards.
- [x] Package architecture: Modular monorepo (`pnpm`).
- [ ] Penambahan adapter streaming chunked response (diprioritaskan pada iterasi berikutnya).

---

## 12. Approval & Sign-off
| Stakeholder | Role | Status |
|---|---|---|
| User | Product Owner & Lead Architect | Approved |
| Antigravity AI | Principal Framework Architect | Approved |
