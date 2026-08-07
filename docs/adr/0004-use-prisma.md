# ADR-0004: Use Prisma with PostgreSQL for the Database

Status: Proposed
Date: 2026-08-07 (documented — decision not yet implemented)

## Context

OmniPost will need a persistent data store for users, social media accounts, posts, and related entities. The team needs to decide on a database engine and an ORM/query builder.

Requirements:
- Relational data with foreign keys (users → accounts → posts)
- Type-safe database queries (consistent with the TypeScript-first approach)
- Schema migrations
- Seed data support
- Good developer experience

Alternatives considered:
1. **Prisma + PostgreSQL** — Type-safe ORM with auto-generated client, declarative schema, migrations
2. **TypeORM + PostgreSQL** — Decorator-based ORM, closer to NestJS patterns
3. **Drizzle + PostgreSQL** — Lightweight, SQL-like query builder with type safety
4. **MongoDB + Mongoose** — Document database, flexible schema

## Decision

Use **Prisma ORM** with **PostgreSQL** as the database engine.

> ⚠️ **This decision has not been implemented.** No Prisma dependency is installed, no Prisma schema exists, and no PostgreSQL configuration is present in the repository. This ADR documents the intended decision for future implementation.

Planned approach:
- Prisma schema in `apps/api/prisma/schema.prisma` (or potentially at monorepo root)
- PostgreSQL as the production database
- Docker Compose for local PostgreSQL instance
- Prisma Client for type-safe database access
- Prisma Migrate for schema migrations
- Prisma seed scripts for development data

## Consequences

**Positive (anticipated):**
- Auto-generated Prisma Client provides full type safety from schema to query
- Declarative schema definition (single source of truth for database structure)
- Built-in migration tool with versioned migration files
- Prisma Studio for visual database management during development
- Strong Next.js and NestJS community support

**Negative (anticipated):**
- Prisma generates a client that must be regenerated after schema changes
- Prisma's query API is different from raw SQL — complex queries may need `$queryRaw`
- Additional dependency and build step (`prisma generate`)
- PostgreSQL requires a running database instance (mitigated by Docker)

**Risks:**
- Schema design decisions are hard to reverse once migrations are applied
- Prisma's abstraction may not cover all PostgreSQL-specific features
- Need to coordinate schema changes across team members
