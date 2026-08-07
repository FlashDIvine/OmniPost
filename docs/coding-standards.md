Status: Active
Owner: TBD
Last Updated: 2026-08-07
Dependencies: [Backend](./backend.md), [Frontend](./frontend.md)

# Purpose

Document the coding conventions, naming standards, and architectural principles used in the OmniPost codebase. Conventions are either **observed** (inferred from existing code and config) or **proposed** (intended for future development but not yet enforced or exemplified in code).

# Scope

Covers TypeScript configuration, naming conventions, file organization, formatting, and architecture principles for both the frontend and backend applications.

# Current State

## TypeScript Conventions

### Backend (`apps/api/tsconfig.json`) — Observed

| Setting | Value | Implication |
|---------|-------|-------------|
| `target` | `ES2021` | Modern JavaScript output |
| `module` | `commonjs` | CommonJS module system (NestJS default) |
| `strictNullChecks` | `true` | Null/undefined must be handled explicitly |
| `noImplicitAny` | `true` | All variables must have explicit or inferred types |
| `strictBindCallApply` | `true` | Strict checking of `bind`, `call`, `apply` |
| `forceConsistentCasingInFileNames` | `true` | File name casing must match imports |
| `noFallthroughCasesInSwitch` | `true` | Switch statements require `break`/`return` |
| `emitDecoratorMetadata` | `true` | Required for NestJS dependency injection |
| `experimentalDecorators` | `true` | Required for NestJS decorators |
| `skipLibCheck` | `true` | Skip type checking of `.d.ts` files |
| Path alias | `@/*` → `src/*` | Absolute imports from `src/` |

### Frontend (`apps/web/tsconfig.json`) — Observed

| Setting | Value | Implication |
|---------|-------|-------------|
| `target` | `ES2017` | Broader browser compatibility |
| `module` | `esnext` | ESModules (required by Next.js) |
| `moduleResolution` | `bundler` | Modern bundler-aware resolution |
| `strict` | `true` | All strict checks enabled |
| `jsx` | `preserve` | JSX handled by Next.js/SWC |
| Path alias | `@/*` → `./src/*` | Absolute imports from `src/` |

## Folder Naming — Observed

- **Lowercase kebab-case** for all folders: `health/`, `common/`, `src/app/`
- Observed consistently across both `apps/api/src/` and `apps/web/src/`

## File Naming — Observed

### Backend

NestJS conventional dot-separated naming is used:

| Pattern | Example | Purpose |
|---------|---------|---------|
| `*.module.ts` | `health.module.ts` | NestJS module |
| `*.controller.ts` | `health.controller.ts` | NestJS controller |
| `*.service.ts` | `health.service.ts` | NestJS service |
| `*.controller.spec.ts` | `health.controller.spec.ts` | Unit test |
| `*.e2e-spec.ts` | `app.e2e-spec.ts` | E2E test |

### Frontend

Next.js App Router conventions are used:

| Pattern | Example | Purpose |
|---------|---------|---------|
| `page.tsx` | `app/page.tsx` | Route page component |
| `layout.tsx` | `app/layout.tsx` | Route layout component |
| `globals.css` | `app/globals.css` | Global stylesheet |

## Function and Variable Naming — Observed

| Convention | Example | Where Seen |
|-----------|---------|-----------|
| `camelCase` for functions | `getHealth()`, `bootstrap()` | `health.service.ts`, `main.ts` |
| `PascalCase` for classes | `HealthService`, `HealthController`, `AppModule` | All NestJS modules |
| `PascalCase` for React components | `Home`, `RootLayout` | `page.tsx`, `layout.tsx` |
| `UPPER_CASE` for env vars | `PORT`, `NODE_ENV`, `APP_NAME` | `.env.example` |

## DTO Naming — Proposed

No DTOs exist in the codebase yet. The following conventions are proposed for future development:

- File: `<name>.dto.ts` (e.g., `create-user.dto.ts`)
- Class: `<Action><Entity>Dto` (e.g., `CreateUserDto`)
- Use `class-validator` decorators for validation (dependency is already installed)
- Use `class-transformer` for transformation (dependency is already installed)

## Module Naming — Observed

NestJS modules follow the convention:

- File: `<feature>.module.ts`
- Class: `<Feature>Module`
- Example: `health.module.ts` → `HealthModule`
- Root module: `app.module.ts` → `AppModule`

## Error Handling — Proposed

No custom error handling is implemented yet. The global `ValidationPipe` provides automatic request validation errors. Custom exception filters, guards, and interceptors are proposed for the `common/` directory (currently empty — see `.gitkeep` comment: *"Common utilities, decorators, filters, guards, interceptors, and pipes will be organized here"*).

## Formatting — Partially Observed

| Tool | Config File | Status |
|------|------------|--------|
| Prettier | None found at root level | No `.prettierrc` exists. Backend `package.json` includes a `format` script (`prettier --write "src/**/*.ts" "test/**/*.ts"`) but no Prettier config file defines formatting rules — Prettier's defaults are used. |
| ESLint (frontend) | `apps/web/eslint.config.mjs` | Flat config extending `next/core-web-vitals` and `next/typescript` |
| ESLint (backend) | None found | Backend `lint` script references `eslint "{src,apps,libs,test}/**/*.ts" --fix` but no ESLint config file was found in `apps/api/`. ESLint defaults or peer config may be in effect. |

## SOLID Principles — Proposed

The codebase structure suggests intent to follow SOLID principles:

- **Single Responsibility**: Each NestJS module encapsulates a single feature (e.g., `HealthModule` handles only health checks)
- **Dependency Inversion**: NestJS's built-in DI container is used (`@Injectable()`, constructor injection in `HealthController`)
- **Open/Closed, Liskov Substitution, Interface Segregation**: Not yet demonstrable with the current minimal codebase

These will become more evident as feature modules are added.

## Clean Architecture — Proposed

The backend folder structure indicates intent toward a layered architecture:

```
src/
├── common/          # Cross-cutting concerns (guards, filters, interceptors, pipes)
├── config/          # Application configuration
├── health/          # Feature module (Controller → Service pattern)
└── modules/         # Future feature modules
```

The Controller → Service pattern is observed in the `health/` module. Full Clean Architecture layers (entities, use-cases, repositories) will apply once the database layer is implemented.

# Future Work

- Add a root `.prettierrc` configuration file for consistent formatting
- Add an ESLint configuration for the backend
- Create a shared ESLint config in `packages/config` for monorepo-wide consistency
- Add Husky + lint-staged for pre-commit enforcement
- Document DTO, Entity, and Repository naming once Prisma is implemented
- Formalize error handling patterns (custom exception filters, response format)

# References

- [Backend](./backend.md) — NestJS implementation details
- [Frontend](./frontend.md) — Next.js implementation details
- [Project Structure](./project-structure.md) — Folder layout
