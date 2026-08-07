Status: Active
Owner: TBD
Last Updated: 2026-08-07
Dependencies: [Setup](./setup.md), [Coding Standards](./coding-standards.md)

# Purpose

Describe the development workflow for OmniPost, including the sprint cycle, development commands, and contribution process.

# Scope

This document covers the iterative development process, available workspace scripts, and per-app commands. Only commands verified to exist in `package.json` files are listed.

# Current State

## Development Cycle

```
Planning → Sprint → Development → Verification → Review → Documentation → Commit → Next Sprint
```

| Phase | Description |
|-------|-------------|
| **Planning** | Define sprint objectives and tasks |
| **Sprint** | Time-boxed iteration focused on specific deliverables |
| **Development** | Write code following [Coding Standards](./coding-standards.md) |
| **Verification** | Run linting, tests, and build to confirm correctness |
| **Review** | Code review via Pull Requests |
| **Documentation** | Update docs to reflect changes (see [Documentation Index](./README.md)) |
| **Commit** | Merge approved changes |
| **Next Sprint** | Begin the next iteration |

## Workspace Commands (Root)

These commands are defined in the root `package.json` and fan out to all workspace packages:

| Command | What It Does | Source |
|---------|-------------|--------|
| `pnpm dev` | Starts all apps in development mode (parallel) | Root `package.json` → `pnpm --filter "*" --parallel dev` |
| `pnpm build` | Builds all workspace packages | Root `package.json` → `pnpm --filter "*" build` |
| `pnpm lint` | Lints all workspace packages | Root `package.json` → `pnpm --filter "*" lint` |

## Backend Commands (`apps/api`)

Run from the repository root using `pnpm --filter api <script>`, or from `apps/api/` directly.

| Command | What It Does |
|---------|-------------|
| `pnpm dev` | Start NestJS in watch mode (`nest start --watch`) |
| `pnpm build` | Build the NestJS application (`nest build`) |
| `pnpm start` | Start NestJS without watch mode |
| `pnpm start:dev` | Start NestJS in watch mode |
| `pnpm start:debug` | Start NestJS in debug + watch mode |
| `pnpm start:prod` | Run compiled output (`node dist/main`) |
| `pnpm lint` | Lint source and test files with ESLint (auto-fix) |
| `pnpm format` | Format source and test files with Prettier |
| `pnpm test` | Run unit tests with Jest |
| `pnpm test:watch` | Run unit tests in watch mode |
| `pnpm test:cov` | Run tests with coverage report |
| `pnpm test:e2e` | Run end-to-end tests |

## Frontend Commands (`apps/web`)

Run from the repository root using `pnpm --filter @omnipost/web <script>`, or from `apps/web/` directly.

| Command | What It Does |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server with Turbopack (`next dev --turbo`) |
| `pnpm build` | Build the Next.js production bundle |
| `pnpm start` | Start the production server |
| `pnpm lint` | Lint with ESLint (Next.js config) |

## Verification Checklist

Before committing changes, verify:

```bash
# 1. Lint all workspaces
pnpm lint

# 2. Run backend unit tests
pnpm --filter api test

# 3. Run backend E2E tests
pnpm --filter api test:e2e

# 4. Build all workspaces
pnpm build
```

> **Note:** No root-level `test` script exists. Tests must be run per-app using `--filter`.

## Branch Strategy

TBD — No branch strategy is formally defined yet. This section will be updated once a branching convention is established.

## Commit Convention

TBD — No commit message convention (e.g., Conventional Commits) is formally enforced. This section will be updated once a convention is adopted.

# Future Work

- Define and document a branch strategy (e.g., GitFlow, trunk-based)
- Adopt a commit message convention (e.g., Conventional Commits)
- Add CI/CD pipeline configuration
- Add pre-commit hooks (e.g., Husky + lint-staged)
- Add a root-level `test` script

# References

- [Setup](./setup.md)
- [Coding Standards](./coding-standards.md)
- [Backend](./backend.md)
- [Frontend](./frontend.md)
