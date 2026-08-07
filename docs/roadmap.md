Status: Active
Owner: TBD
Last Updated: 2026-08-07
Dependencies: [Architecture](./architecture.md), [Backend](./backend.md), [Frontend](./frontend.md)

# Purpose

Define the development roadmap for OmniPost from initial foundation through MVP, with sprint-level milestones and their current status.

# Scope

This document outlines planned sprints and their objectives. Sprint status is based on verified repository state, not assumption.

# Current State

## Roadmap Overview

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 1 | Foundation | ✅ Complete |
| Sprint 2 | Database & ORM | 🔲 Not Started |
| Sprint 3 | Authentication | 🔲 Not Started |
| Sprint 4 | User Management | 🔲 Not Started |
| Sprint 5 | Social Accounts | 🔲 Not Started |
| Sprint 6 | Post Management | 🔲 Not Started |
| Sprint 7 | Infrastructure | 🔲 Not Started |
| Sprint 8 | MVP Polish | 🔲 Not Started |

## Sprint 1 — Foundation ✅ Complete

**Objective:** Set up the development environment, monorepo structure, and bootstrap both applications.

Completed deliverables (verified):
- pnpm workspace monorepo with `apps/*` and `packages/*`
- Next.js 15 frontend bootstrapped with App Router, Tailwind CSS v4, Turbopack
- NestJS 11 backend bootstrapped with health endpoint, Swagger, validation, security middleware
- Shared package scaffolds (`config`, `shared`, `ui`)
- Project documentation structure (`docs/`)
- Infrastructure directory scaffold (`infrastructure/docker/`)

See [Sprint 01](./sprints/sprint-01.md) for details.

## Sprint 2 — Database & ORM 🔲 Not Started

**Objective:** Set up Prisma ORM with PostgreSQL.

Planned deliverables:
- Install and configure Prisma
- Design initial database schema
- Set up database migrations
- Create seed scripts
- Docker Compose for local PostgreSQL

See [ADR-0004](./adr/0004-use-prisma.md) for the Prisma decision rationale.

## Sprint 3 — Authentication 🔲 Not Started

**Objective:** Implement JWT-based authentication.

Planned deliverables:
- Auth module (login, register, logout)
- JWT token generation and validation
- Password hashing
- Auth guards
- Protected routes (frontend)

## Sprint 4 — User Management 🔲 Not Started

**Objective:** Build user profile and management features.

Planned deliverables:
- User entity and CRUD operations
- Role-based access control
- Profile management pages (frontend)

## Sprint 5 — Social Accounts 🔲 Not Started

**Objective:** Enable connecting social media accounts.

Planned deliverables:
- OAuth integration with social platforms
- Social account entity and management
- Account linking/unlinking UI

## Sprint 6 — Post Management 🔲 Not Started

**Objective:** Core feature — create, schedule, and publish posts.

Planned deliverables:
- Post entity and CRUD operations
- Multi-platform post composition
- Post scheduling
- Post status tracking

## Sprint 7 — Infrastructure 🔲 Not Started

**Objective:** Production deployment setup.

Planned deliverables:
- Dockerfiles for web and API
- Docker Compose for full stack
- CI/CD pipeline
- Environment-specific configuration

## Sprint 8 — MVP Polish 🔲 Not Started

**Objective:** Final polish before MVP release.

Planned deliverables:
- Error handling and edge cases
- Performance optimization
- Documentation updates
- User acceptance testing

# Future Work

- Define detailed task breakdowns for each upcoming sprint
- Add timeline estimates once team velocity is established
- Create milestone tracking in project management tool

# References

- [Sprint 01](./sprints/sprint-01.md)
- [Architecture](./architecture.md)
- [ADR-0004: Prisma](./adr/0004-use-prisma.md)
