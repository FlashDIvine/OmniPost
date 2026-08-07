# ADR-0001: Use pnpm Workspace Monorepo

Status: Accepted
Date: 2026-08-07 (documented retroactively — exact decision date unknown)

## Context

OmniPost requires multiple applications (a Next.js frontend and a NestJS backend) along with shared libraries (types, utilities, UI components, configuration). The team needed to decide between:

1. **Monorepo** — all applications and packages in a single repository
2. **Polyrepo** — separate repositories for each application and package

Key considerations:
- Code sharing between frontend and backend (types, validation, constants)
- Consistent tooling and dependency management
- Simplified CI/CD and version management
- Developer experience for a small team

## Decision

Use a **pnpm workspace monorepo** to house all applications and shared packages.

The workspace is defined in `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

The structure is:

- `apps/web` — Next.js frontend
- `apps/api` — NestJS backend
- `packages/config` — Shared tooling configuration
- `packages/shared` — Shared types, utilities, constants
- `packages/ui` — Shared UI component library

pnpm was chosen over npm/yarn for its:
- Strict dependency resolution (prevents phantom dependencies)
- Efficient disk usage via content-addressable storage
- Built-in workspace support
- `packageManager` field enforcement (`pnpm@11.15.1`)

No build orchestrator (Turborepo, Nx) is used at this time.

## Consequences

**Positive:**
- Single repository for all code — simplified development workflow
- Easy cross-package imports and type sharing
- Unified dependency management with a single lockfile
- Root-level scripts fan out to all workspaces (`pnpm --filter "*" --parallel dev`)
- Consistent tooling versions across all packages

**Negative:**
- Repository size grows with all applications
- CI/CD must handle selective builds as the repo scales
- No build orchestrator means no intelligent caching or task scheduling (may need Turborepo/Nx later)
- All team members need pnpm installed (mitigated by `corepack`)

**Risks:**
- Without a build orchestrator, build times may increase as the number of packages grows
- Dependency conflicts between packages sharing the same workspace
