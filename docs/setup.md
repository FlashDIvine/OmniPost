Status: Active
Owner: TBD
Last Updated: 2026-08-07
Dependencies: [Development Workflow](./development-workflow.md)

# Purpose

Provide step-by-step instructions to set up the OmniPost development environment from scratch.

# Scope

This guide covers prerequisites, cloning, dependency installation, running the frontend and backend, and environment variable configuration. Only verified requirements and configurations are documented.

# Current State

## Prerequisites

| Requirement | Version | How to Verify | Source |
|-------------|---------|---------------|--------|
| Node.js | TBD — no `.nvmrc` or `engines` field found | `node -v` | Unknown |
| pnpm | 11.15.1 | `pnpm -v` | Root `package.json` → `"packageManager": "pnpm@11.15.1"` |
| Git | Any recent version | `git --version` | — |

> **Note:** The exact required Node.js version is not specified anywhere in the repository (no `.nvmrc`, no `engines` field in root `package.json`). Node.js 18+ is recommended based on the TypeScript and framework versions in use, but this is not enforced. Docker is **not** currently required for development.

### Installing pnpm

If pnpm is not installed, or the wrong version is installed:

```bash
# Using corepack (recommended — ships with Node.js 16+)
corepack enable
corepack prepare pnpm@11.15.1 --activate

# Or install globally
npm install -g pnpm@11.15.1
```

## Clone the Repository

```bash
git clone <repository-url>
cd OmniPost
```

> Replace `<repository-url>` with the actual Git remote URL. Note: as of this writing, no `.git` directory was found in the repository — git may need to be initialized.

## Install Dependencies

```bash
pnpm install
```

This installs dependencies for all workspace packages (`apps/*` and `packages/*`) using the pnpm lockfile.

## Environment Configuration

### Backend (`apps/api`)

Copy the example environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

The following environment variables are defined in `apps/api/.env.example`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the NestJS API server listens on |
| `NODE_ENV` | `development` | Application environment (`development` enables Swagger) |
| `APP_NAME` | `OmniPost` | Application name |

> **Note:** No `.env.example` exists for the frontend (`apps/web`). The frontend currently has no environment variable requirements.

## Run the Backend

```bash
# From the root
pnpm --filter api dev

# Or from apps/api/
cd apps/api
pnpm dev
```

The API will start at `http://localhost:3001/api` (default port).

- Health check: `http://localhost:3001/api/health`
- Swagger docs: `http://localhost:3001/api/docs` (development mode only)

## Run the Frontend

```bash
# From the root
pnpm --filter @omnipost/web dev

# Or from apps/web/
cd apps/web
pnpm dev
```

The web app will start at `http://localhost:3000` (Next.js default port).

## Run Everything

To start both apps simultaneously:

```bash
pnpm dev
```

This runs `pnpm --filter "*" --parallel dev`, starting all workspace apps in parallel.

## Verify the Setup

```bash
# 1. Check the backend health endpoint
curl http://localhost:3001/api/health
# Expected: {"status":"ok","service":"OmniPost API","timestamp":"..."}

# 2. Open the frontend in a browser
# http://localhost:3000

# 3. Open Swagger docs (backend must be running in development mode)
# http://localhost:3001/api/docs

# 4. Run linting across all workspaces
pnpm lint

# 5. Run backend tests
pnpm --filter api test
```

# Future Work

- Add `.nvmrc` or `engines` field to enforce Node.js version
- Add `.env.example` for the frontend if environment variables are needed
- Add Docker Compose setup for one-command development environment
- Add database setup instructions once PostgreSQL/Prisma are implemented

# References

- [Development Workflow](./development-workflow.md)
- [Backend](./backend.md)
- [Frontend](./frontend.md)
- [Architecture](./architecture.md)
