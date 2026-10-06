# jstype — Technical Architecture & Skill Orchestration Blueprint

## 1. Understanding Summary
- **Core Goal**: Membangun web backend framework modern berbasis TypeScript/JavaScript dengan end-to-end type safety, runtime universal berbasis Web Standards (Fetch API), router berkecepatan tinggi, dan zero-overhead typed RPC client.
- **Audience**: Fullstack TypeScript developers, API engineers, dan pembuat arsitektur microservices.
- **Key Flows**: Definisi rute backend dengan type-safe context -> ekspor tipe aplikasi -> konsumsi di frontend via `@jstype/client` proxy tanpa codegen manual.
- **Non-Goals**: Bukan renderer UI frontend; tidak memaksakan ORM tertentu.

---

## 2. Technical Architecture & Skill Delegation

```
jstype (Monorepo)
├── packages/
│   ├── core/           # @jstype/core: Router, Context, Middleware, App Type Builder
│   └── client/         # @jstype/client: Proxy-based typed RPC fetch client
├── examples/
│   └── basic-api/      # Real-world demo: Typed API + Client consumption
├── package.json        # Root pnpm workspaces configuration
├── pnpm-workspace.yaml
└── tsconfig.base.json  # Strict base TypeScript compiler options
```

### Skill Delegation Matrix
| Sub-sistem | Skill yang Diorkestrasikan | Deskripsi Tugas |
|---|---|---|
| **Core Routing & Context** | `js-backend-expert`, `bun-runtime-expert` | Implementasi Radix-tree router, Context wrapper untuk Request/Response, middleware stack execution |
| **Type System Engine** | `typescript-expert` | Algoritma type inference generics, path string parsing types (`/users/:id`), typed response return inference |
| **RPC Client Engine** | `senior-frontend`, `typescript-expert` | Proxy traps handler di runtime yang memetakan pemanggilan method `$get()`, `$post()` ke HTTP Fetch Request |
| **Pengujian & CI/CD** | `e2e-testing-expert`, `autonomous-tdd-debugger` | Setup Vitest untuk router unit tests, benchmarking type-check, dan pengujian runtime kompatibilitas |
| **Kualitas & Rilis** | `biome-linter-formatter-expert`, `zero-tech-debt-auditor` | Konfigurasi Biome untuk linting dan formatting, validasi zero technical debt |

---

## 3. Core Component & API Architecture

### 3.1. Engine Router (`@jstype/core`)
Menggunakan struktur data Radix Trie untuk performa matching $O(k)$ di mana $k$ adalah panjang segmen path:
```ts
interface RouteNode<T> {
  segment: string;
  isParam: boolean;
  paramName?: string;
  isWildcard: boolean;
  handlers: Map<string, RouteHandler>;
  children: Map<string, RouteNode<T>>;
}
```

### 3.2. Universal Context (`Context`)
Menyediakan method ergonomis dengan standar Web API murni:
```ts
export class Context {
  constructor(public req: JSTypeRequest, public env: Record<string, unknown> = {}) {}
  json<T>(data: T, status = 200, headers?: HeadersInit): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  }
  text(text: string, status = 200): Response { ... }
}
```

### 3.3. Type-Safe Client (`@jstype/client`)
Memanfaatkan JavaScript `Proxy` rekursif yang secara dinamis membangun URL dan mengeksekusi fetch:
```ts
export type ClientProxy<T> = ... // Recursive mapped type resolving paths & methods
export function createClient<T>(baseUrl: string, options?: ClientOptions): ClientProxy<T> {
  // Nested proxy traps
}
```

---

## 4. Decision Log

| # | Keputusan | Alternatif Dipertimbangkan | Rasional & Prinsip Web Modern | Skill yang Diorkestrasikan |
|---|---|---|---|---|
| 1 | Standard Fetch API (`Request`/`Response`) sebagai fondasi inti | Modul `http` bawaan Node.js | Portabilitas multi-runtime (Node.js, Bun, Deno, Edge Workers) tanpa adapter berlapis. | `js-backend-expert` |
| 2 | Monorepo modular berbasis `pnpm workspaces` | Single monolith npm package | Pemisahan tegas bundle backend dan client frontend; client tidak membawa ketergantungan core server. | `monorepo-architect` |
| 3 | Proxy-based RPC Client | Tooling Codegen (seperti OpenAPI-typescript / tRPC build) | Menghilangkan langkah build ekstra; perubahan backend langsung terdeteksi di frontend secara real-time. | `typescript-expert` |
| 4 | `tsup` untuk build bundling | `tsc` saja / Webpack | Kecepatan kompilasi berbasis esbuild, output ESM & CJS instan, dan auto-generated `.d.ts`. | `biome-linter-formatter-expert` |

---

## 5. Risk Assessment & Mitigation
- **Risiko 1: Kompleksitas Type Inference yang memperlambat IDE.**
  * *Mitigasi*: Gunakan *shallow type evaluation* dan batasi rekursi type resolver pada chain rute. Uji dengan compiler benchmarking.
- **Risiko 2: Kompatibilitas Node.js versi lama.**
  * *Mitigasi*: Menetapkan batas minimum Node.js v20 (yang sudah memiliki Fetch API native stabil) dan menyediakan adapter node server sederhana jika dijalankan di Node tradisional.
