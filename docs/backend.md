Status: Active
Owner: TBD
Last Updated: 2026-08-07
Dependencies: [Architecture](./architecture.md), [API Index](./api/README.md)

# Purpose

Document the NestJS backend application (`apps/api`), including its setup, modules, middleware, configuration, and API endpoints. Every claim is traced to a specific source file.

# Scope

This document covers the current implementation of the backend API. Features marked "Planned" do not exist in the code.

# Current State

## Overview

| Property | Value | Source |
|----------|-------|--------|
| Package name | `api` | `apps/api/package.json` line 2 |
| Version | `0.1.0` | `apps/api/package.json` line 3 |
| Framework | NestJS 11 | `apps/api/package.json` → `@nestjs/core: ^11.0.0` |
| Platform | Express | `apps/api/package.json` → `@nestjs/platform-express: ^11.0.0` |
| TypeScript | 5.8.0+ | `apps/api/package.json` → `typescript: ^5.8.0` |
| Default port | 3001 | `apps/api/.env.example` → `PORT=3001` |
| Global prefix | `/api` | `apps/api/src/main.ts` line 15 |

## Application Bootstrap (`main.ts`)

The entry point (`apps/api/src/main.ts`) configures the application in the following order:

1. **Create NestJS app** with `AppModule` (line 11)
2. **Global prefix** — `app.setGlobalPrefix('api')` (line 15)
3. **Helmet** — security headers middleware (line 18)
4. **Compression** — response compression middleware (line 21)
5. **Cookie parser** — cookie parsing middleware (line 24)
6. **CORS** — enabled with `origin: true, credentials: true` (lines 27–30)
7. **Global ValidationPipe** — request validation (lines 33–42)
8. **Swagger** — OpenAPI docs, development mode only (lines 44–55)
9. **Start server** — listens on configured port (lines 58–59)

### Global Validation Pipe

Configured in `apps/api/src/main.ts` lines 33–42:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strip properties not in DTO
    forbidNonWhitelisted: true,   // Throw error for unknown properties
    transform: true,              // Auto-transform payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: true, // Auto-convert primitive types
    },
  }),
);
```

Dependencies installed: `class-validator` (^0.14.1), `class-transformer` (^0.5.1).

### Swagger / OpenAPI

Configured in `apps/api/src/main.ts` lines 44–55. Only enabled when `NODE_ENV === 'development'`.

| Property | Value |
|----------|-------|
| Title | `OmniPost API` |
| Description | `OmniPost API documentation` |
| Version | `1.0` |
| URL | `http://localhost:3001/api/docs` |

Dependencies: `@nestjs/swagger` (^11.0.0), `swagger-ui-express` (^5.0.1).

### Security Middleware

| Middleware | Package | Purpose | Source |
|-----------|---------|---------|--------|
| Helmet | `helmet` (^8.1.0) | HTTP security headers | `main.ts` line 18 |
| Compression | `compression` (^1.8.0) | Response compression | `main.ts` line 21 |
| Cookie Parser | `cookie-parser` (^1.4.7) | Parse `Cookie` header | `main.ts` line 24 |
| CORS | Built-in NestJS | Cross-origin requests | `main.ts` lines 27–30 |

## Module Tree

```
AppModule
├── ConfigModule.forRoot({ isGlobal: true })
└── HealthModule
    ├── HealthController
    └── HealthService
```

Source: `apps/api/src/app.module.ts`

### Root Module (`AppModule`)

Defined in `apps/api/src/app.module.ts`:

- Imports `ConfigModule.forRoot()` with `isGlobal: true` and `envFilePath: ['.env', '.env.example']`
- Imports `HealthModule`

### Configuration Module

Uses `@nestjs/config` (^4.0.0). Registered globally in `AppModule`, meaning `ConfigService` is available in any module without re-importing `ConfigModule`.

Env file loading order: `.env` first, then `.env.example` as fallback.

> **Note:** The `src/config/` directory exists but contains only a `.gitkeep` placeholder. No custom configuration files (e.g., typed config namespaces) have been created yet.

### Health Module

Located at `apps/api/src/health/`:

| File | Class | Description |
|------|-------|-------------|
| `health.module.ts` | `HealthModule` | Registers controller and service |
| `health.controller.ts` | `HealthController` | Exposes `GET /api/health` |
| `health.service.ts` | `HealthService` | Returns health status object |
| `health.controller.spec.ts` | — | Unit tests for the controller |

#### `GET /api/health`

Returns the current health status of the API:

```json
{
  "status": "ok",
  "service": "OmniPost API",
  "timestamp": "2026-08-07T00:00:00.000Z"
}
```

Swagger decorators on the controller: `@ApiTags('Health')`, `@ApiOperation`, `@ApiResponse` (with schema definition).

## Folder Structure

```
apps/api/src/
├── main.ts              # Bootstrap, middleware, Swagger
├── app.module.ts         # Root module
├── health/               # Health check feature module
│   ├── health.module.ts
│   ├── health.controller.ts
│   ├── health.service.ts
│   └── health.controller.spec.ts
├── common/               # Empty — intended for shared utilities
│   └── .gitkeep          #   "decorators, filters, guards, interceptors, pipes"
├── config/               # Empty — intended for config files
│   └── .gitkeep          #   "Application configuration files"
└── modules/              # Empty — intended for feature modules
    └── .gitkeep          #   "Feature modules"
```

## Testing

### Unit Tests

- Framework: Jest (^29.7.0) with `ts-jest` (^29.3.0)
- Config: Inline in `apps/api/package.json` (`jest` field)
- Test pattern: `*.spec.ts`
- Existing test: `health.controller.spec.ts` — tests controller instantiation and health response shape

### E2E Tests

- Config: `apps/api/test/jest-e2e.json`
- Test pattern: `*.e2e-spec.ts`
- Existing test: `test/app.e2e-spec.ts` — tests `GET /api/health` returns 200 with expected body

### Running Tests

```bash
# Unit tests
pnpm --filter api test

# Unit tests with watch
pnpm --filter api test:watch

# Unit tests with coverage
pnpm --filter api test:cov

# E2E tests
pnpm --filter api test:e2e
```

## Environment Variables

Defined in `apps/api/.env.example`:

| Variable | Default | Used By |
|----------|---------|---------|
| `PORT` | `3001` | `main.ts` line 58 — `configService.get<number>('PORT', 3001)` |
| `NODE_ENV` | `development` | `main.ts` line 45 — `configService.get<string>('NODE_ENV', 'development')` |
| `APP_NAME` | `OmniPost` | Available via `ConfigService` but not currently referenced in code |

## Planned Modules

The following modules do not exist yet. They are inferred from the project roadmap:

- **Auth Module** — JWT authentication, user registration, login
- **Users Module** — User management, profiles
- **Posts Module** — Social media post creation and scheduling
- **Social Accounts Module** — OAuth connections to social platforms

# Future Work

- Implement authentication (JWT strategy, guards)
- Add feature modules under `src/modules/`
- Create shared utilities in `src/common/` (exception filters, interceptors, response DTOs)
- Add custom configuration files in `src/config/` (typed config namespaces)
- Set up database integration with Prisma
- Add rate limiting and request logging

# References

- [Architecture](./architecture.md)
- [API Index](./api/README.md)
- [Coding Standards](./coding-standards.md)
- [Setup](./setup.md)
