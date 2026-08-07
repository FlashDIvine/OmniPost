Status: Active
Owner: TBD
Last Updated: 2026-08-07
Dependencies: [Architecture](./architecture.md)

# Purpose

Describe the repository folder structure and explain the role of every directory, as it actually exists on disk.

# Scope

This document covers the top-level layout and the internal structure of `apps/`, `packages/`, `infrastructure/`, and `docs/`. Only directories and files that actually exist are described.

# Current State

## Top-Level Structure

```
OmniPost/
├── .agents/                  # Agent workflows and configuration
├── .gitignore                # Git ignore rules
├── README.md                 # Root project README
├── package.json              # Root workspace package.json
├── pnpm-lock.yaml            # pnpm lockfile
├── pnpm-workspace.yaml       # Workspace definition (apps/*, packages/*)
│
├── apps/                     # Application packages
│   ├── api/                  # NestJS backend API
│   └── web/                  # Next.js frontend web app
│
├── packages/                 # Shared library packages
│   ├── config/               # Shared tooling configuration (scaffold)
│   ├── shared/               # Shared utilities, types, constants (scaffold)
│   └── ui/                   # Shared UI component library (scaffold)
│
├── infrastructure/           # Infrastructure configuration
│   └── docker/               # Docker setup (placeholder only)
│
└── docs/                     # Project documentation
    ├── README.md             # Documentation index
    ├── adr/                  # Architecture Decision Records
    ├── api/                  # API endpoint documentation
    └── sprints/              # Sprint history
```

## apps/

Contains the main runnable applications. Each subdirectory is a separate workspace package.

### apps/api/ — NestJS Backend

```
apps/api/
├── .env.example              # Example environment variables
├── nest-cli.json             # NestJS CLI configuration
├── package.json              # Package: "api" (v0.1.0)
├── tsconfig.json             # TypeScript config (ES2021, strict checks)
├── tsconfig.build.json       # Build-specific TypeScript config
├── src/
│   ├── main.ts               # Application entry point (bootstrap, middleware, Swagger)
│   ├── app.module.ts          # Root module (ConfigModule, HealthModule)
│   ├── health/                # Health check module
│   │   ├── health.module.ts
│   │   ├── health.controller.ts
│   │   ├── health.service.ts
│   │   └── health.controller.spec.ts
│   ├── common/                # Shared utilities placeholder (.gitkeep)
│   ├── config/                # Application config placeholder (.gitkeep)
│   └── modules/               # Feature modules placeholder (.gitkeep)
└── test/
    ├── app.e2e-spec.ts        # E2E test for /api/health
    └── jest-e2e.json          # Jest E2E configuration
```

### apps/web/ — Next.js Frontend

```
apps/web/
├── README.md                  # Package README
├── package.json               # Package: "@omnipost/web" (v0.1.0)
├── next.config.ts             # Next.js configuration (empty)
├── tailwind.config.ts         # Tailwind CSS configuration
├── postcss.config.mjs         # PostCSS config (@tailwindcss/postcss plugin)
├── eslint.config.mjs          # ESLint flat config
├── tsconfig.json              # TypeScript config (strict, bundler resolution)
├── next-env.d.ts              # Next.js TypeScript declarations
├── public/                    # Static assets (empty — contains .gitkeep)
└── src/
    └── app/                   # App Router directory
        ├── globals.css        # Global styles (Tailwind import, CSS variables)
        ├── layout.tsx         # Root layout (metadata, HTML structure)
        └── page.tsx           # Home page (/)
```

## packages/

Shared libraries intended to be consumed by applications in `apps/`. All three packages are currently **empty scaffolds** — they contain a `package.json`, a `README.md`, and in some cases an `index.ts` with only a comment.

| Package | npm Name | Has Code? | Purpose |
|---------|----------|-----------|---------|
| `packages/config` | `@social-hub/config` | No | Shared ESLint, TypeScript, and formatting configuration |
| `packages/shared` | `@social-hub/shared` | No (empty `index.ts`) | Shared utilities, types, and constants |
| `packages/ui` | `@social-hub/ui` | No (empty `index.ts`) | Shared React UI component library |

> **Note:** The package scope `@social-hub` is a legacy naming convention. The project is now referred to as OmniPost.

## infrastructure/

Contains infrastructure-as-code and deployment configuration.

```
infrastructure/
└── docker/
    └── README.md              # Placeholder — no Dockerfiles or compose files exist
```

This directory is reserved for future Docker, CI/CD, and deployment configurations. Currently, it contains only a placeholder README.

## docs/

Contains all project documentation. See the [Documentation Index](./README.md) for a full listing of available documents.

# Future Work

- **`packages/`**: Populate `config`, `shared`, and `ui` packages with actual shared code as the application grows.
- **`infrastructure/docker/`**: Add `Dockerfile`, `docker-compose.yml`, and related configuration files once Docker support is implemented.
- **`apps/web/src/`**: Additional directories (e.g., `components/`, `lib/`, `hooks/`) will be created as frontend features are built.
- **`apps/api/src/modules/`**: Feature modules (e.g., auth, users, posts) will be added here.
- **`apps/api/src/common/`**: Shared guards, filters, interceptors, pipes, and decorators will be added here.

# References

- [Architecture](./architecture.md)
- [Setup](./setup.md)
- [Backend](./backend.md)
- [Frontend](./frontend.md)
