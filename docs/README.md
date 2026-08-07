# OmniPost Documentation

Welcome to the OmniPost project documentation. This directory contains all project documentation, architectural decisions, API references, and developer guides.

> **Note:** This project is also referred to as "Social Hub" in some internal packages and UI components. The canonical project name is **OmniPost**.

## How This Documentation Is Organized

Documentation is grouped into the following categories:

### Core Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System architecture, diagrams, and technical overview |
| [Project Structure](./project-structure.md) | Repository folder layout and purpose of each directory |
| [Setup](./setup.md) | Getting started — prerequisites, installation, and running locally |
| [Development Workflow](./development-workflow.md) | Development process, scripts, and contribution workflow |

### Technical References

| Document | Description |
|----------|-------------|
| [Backend](./backend.md) | NestJS API — modules, middleware, configuration |
| [Frontend](./frontend.md) | Next.js web app — routing, styling, structure |
| [API Index](./api/README.md) | Index of implemented API endpoints |
| [Coding Standards](./coding-standards.md) | TypeScript conventions, naming, formatting, architecture principles |

### Project Management

| Document | Description |
|----------|-------------|
| [Roadmap](./roadmap.md) | MVP roadmap with sprint milestones and status |
| [Sprint 01](./sprints/sprint-01.md) | Sprint 1 — Foundation setup |

### Architecture Decision Records (ADRs)

ADRs document significant technical decisions and their rationale. See the [adr/](./adr/) directory.

| ADR | Decision | Status |
|-----|----------|--------|
| [ADR-0001](./adr/0001-use-monorepo.md) | Use pnpm workspace monorepo | Accepted |
| [ADR-0002](./adr/0002-use-nextjs.md) | Use Next.js for the frontend | Accepted |
| [ADR-0003](./adr/0003-use-nestjs.md) | Use NestJS for the backend | Accepted |
| [ADR-0004](./adr/0004-use-prisma.md) | Use Prisma with PostgreSQL for the database | Proposed |

### Reference

| Document | Description |
|----------|-------------|
| [Glossary](./glossary.md) | Definitions of terms used across the project |

## Documentation Principles

- Documentation is part of the codebase and must evolve with the implementation.
- Every document reflects the **current, actual** state of the code — not aspirational plans (unless explicitly marked as "Planned" or "Future Work").
- When unsure about a fact, it is marked as "Unknown" or "TBD" rather than guessed.
- Documentation should be reviewable in Pull Requests.
