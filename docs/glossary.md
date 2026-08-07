Status: Active
Owner: TBD
Last Updated: 2026-08-07
Dependencies: None

# Purpose

Define terms and concepts used throughout the OmniPost project and its documentation.

# Scope

Covers terminology related to the monorepo, frontend, backend, and planned components. Terms for components not yet implemented are explicitly annotated.

# Current State

## General Terms

| Term | Definition |
|------|-----------|
| **OmniPost** | The project name. A social media management platform. Also referred to as "Social Hub" in some legacy internal packages and UI text. |
| **Monorepo** | A single repository containing multiple packages and applications, managed by a workspace tool (pnpm workspaces in this project). |
| **Workspace** | A pnpm workspace — the mechanism that allows multiple packages to coexist in a single repository with shared dependency management. Defined in `pnpm-workspace.yaml`. |
| **Package** | A discrete unit within the monorepo that has its own `package.json`. Can be an application (`apps/*`) or a library (`packages/*`). |

## Frontend Terms

| Term | Definition |
|------|-----------|
| **App Router** | Next.js routing system based on the filesystem (`src/app/` directory). Routes are defined by `page.tsx` files in nested folders. Used in this project (not the legacy Pages Router). |
| **Layout** | A React component (`layout.tsx`) in the App Router that wraps page content and persists across route navigations. The root layout sets the HTML structure and global metadata. |
| **Page** | A React component (`page.tsx`) in the App Router that defines the UI for a specific route. |
| **Turbopack** | Next.js's Rust-based bundler used for faster development builds. Enabled via `next dev --turbo` in this project. |

## Backend Terms

| Term | Definition |
|------|-----------|
| **Module** | A NestJS organizational unit (`@Module()` decorator) that groups related controllers, services, and providers. Example: `HealthModule`. |
| **Controller** | A NestJS class (`@Controller()` decorator) that handles incoming HTTP requests and returns responses. Example: `HealthController` handles `GET /api/health`. |
| **Service** | A NestJS class (`@Injectable()` decorator) that encapsulates business logic. Injected into controllers via constructor injection. Example: `HealthService`. |
| **Provider** | Any class registered with NestJS's dependency injection container. Services are the most common type of provider. |
| **Pipe** | A NestJS middleware that transforms or validates request data before it reaches the controller. The `ValidationPipe` is registered globally in this project. |
| **Guard** | A NestJS middleware that determines whether a request should be handled (e.g., authentication checks). *Will apply once authentication is implemented — no guards exist yet.* |
| **Interceptor** | A NestJS middleware that can transform the response after the controller handler executes (e.g., response mapping, logging). *Will apply once interceptors are added — none exist yet.* |
| **Filter** | A NestJS exception filter that handles errors thrown during request processing. *Will apply once custom exception filters are added — none exist yet.* |
| **Decorator** | A TypeScript decorator used by NestJS for metadata annotation (e.g., `@Controller()`, `@Get()`, `@Injectable()`). Custom decorators will be placed in `src/common/`. |
| **Global Prefix** | A URL prefix applied to all routes. Set to `/api` in this project via `app.setGlobalPrefix('api')`. |

## API Documentation Terms

| Term | Definition |
|------|-----------|
| **Swagger / OpenAPI** | An API documentation standard. The project uses `@nestjs/swagger` to auto-generate interactive API docs at `/api/docs` (development mode only). |
| **API Tag** | A Swagger grouping label applied to controllers via `@ApiTags()`. The health controller uses the tag `'Health'`. |

## Configuration Terms

| Term | Definition |
|------|-----------|
| **ConfigModule** | NestJS module (`@nestjs/config`) that loads environment variables and makes them available via `ConfigService`. Registered globally in this project. |
| **ConfigService** | Injectable service from `@nestjs/config` that provides typed access to environment variables. |

## Terms for Planned Components

The following terms are defined for reference but apply to components that **do not yet exist** in the codebase.

| Term | Definition | Status |
|------|-----------|--------|
| **DTO (Data Transfer Object)** | A class that defines the shape of data for API requests/responses. Validated using `class-validator` decorators. | Will apply once DTOs are created. Dependencies (`class-validator`, `class-transformer`) are installed. |
| **Entity** | A class that maps to a database table. | Will apply once Prisma schema is implemented. |
| **Repository** | A data access layer that abstracts database queries. | Will apply once the database layer is implemented. In Prisma, this role is typically filled by Prisma Client. |
| **Migration** | A versioned change to the database schema. | Will apply once Prisma is set up. |
| **Seed** | A script that populates the database with initial or test data. | Will apply once Prisma is set up. |
| **Docker Compose** | A tool for defining multi-container Docker applications. | Will apply once Docker infrastructure is implemented. |

# Future Work

- Add terms for authentication concepts (JWT, refresh token, access token) once auth is implemented
- Add terms for social media integration concepts once the social accounts module is built
- Update Entity/Repository/Migration definitions with project-specific details once Prisma schema exists

# References

- [Architecture](./architecture.md)
- [Backend](./backend.md)
- [Frontend](./frontend.md)
- [Coding Standards](./coding-standards.md)
