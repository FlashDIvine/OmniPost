# ADR-0003: Use NestJS for the Backend

Status: Accepted
Date: 2026-08-07 (documented retroactively — exact decision date unknown)

## Context

OmniPost needs a backend API to handle business logic, data persistence, authentication, and integration with social media platform APIs. The team needed a backend framework that supports:

- TypeScript-first development (consistent with the Next.js frontend)
- Modular architecture for scaling feature development
- Built-in dependency injection
- OpenAPI/Swagger documentation generation
- Request validation
- Testability (unit and E2E)

Alternatives considered:
1. **NestJS** — Opinionated, modular Node.js framework with DI, decorators, and rich ecosystem
2. **Express + custom structure** — Minimal, flexible, but requires manual architecture decisions
3. **Fastify** — High-performance HTTP framework, less opinionated than NestJS
4. **tRPC** — End-to-end type-safe API, tight coupling with frontend

## Decision

Use **NestJS 11** with **Express** as the HTTP platform for the backend API.

Current implementation (verified from `apps/api/`):

| Choice | Detail |
|--------|--------|
| NestJS version | 11.0.0 |
| HTTP platform | Express (`@nestjs/platform-express`) |
| API documentation | Swagger (`@nestjs/swagger` v11, dev-only) |
| Validation | Global `ValidationPipe` with `class-validator` / `class-transformer` |
| Configuration | `@nestjs/config` v4 (global) |
| Security | Helmet, compression, cookie-parser, CORS |
| Testing | Jest (unit + E2E) |
| Global prefix | `/api` |

## Consequences

**Positive:**
- Modular architecture with `@Module()` enables organized feature development
- Built-in dependency injection promotes loose coupling and testability
- `@nestjs/swagger` generates interactive API docs from decorators
- Global `ValidationPipe` provides automatic request validation with class-validator
- Strong TypeScript support with decorators and metadata reflection
- Large ecosystem of official modules (@nestjs/config, @nestjs/passport, @nestjs/jwt, etc.)
- Convention-based file naming (`*.module.ts`, `*.controller.ts`, `*.service.ts`)

**Negative:**
- Opinionated structure may feel heavy for simple CRUD operations
- Decorator-based approach has a learning curve
- Express platform is slower than Fastify (but easier to integrate with middleware ecosystem)
- `emitDecoratorMetadata` and `experimentalDecorators` required in `tsconfig.json`

**Risks:**
- NestJS 11 is a major version — ensure compatibility with third-party modules
- Express middleware ecosystem is well-established but some packages may lag on types
