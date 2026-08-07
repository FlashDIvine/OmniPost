# ADR-0002: Use Next.js for the Frontend

Status: Accepted
Date: 2026-08-07 (documented retroactively — exact decision date unknown)

## Context

OmniPost needs a web frontend for users to manage their social media accounts and posts. The team evaluated frontend frameworks and needed to decide on a technology that supports:

- Server-side rendering (SEO, performance)
- Modern React features (React 19, Server Components)
- TypeScript-first development
- Built-in routing
- Integration with the pnpm monorepo

Alternatives considered:
1. **Next.js** — Full-featured React framework with SSR, App Router, and built-in optimizations
2. **Vite + React** — Lightweight SPA with fast HMR, no SSR out of the box
3. **Remix** — Full-stack React framework with nested routes and loaders

## Decision

Use **Next.js 15** with the **App Router** for the frontend application.

Current implementation (verified from `apps/web/`):

| Choice | Detail |
|--------|--------|
| Next.js version | 15.1.7 |
| React version | 19.0.0 |
| Router | App Router (`src/app/`) |
| CSS framework | Tailwind CSS v4.0.7 |
| Dev bundler | Turbopack (`next dev --turbo`) |
| TypeScript | 5.7.3+ (strict mode) |
| Linting | ESLint flat config with `next/core-web-vitals`, `next/typescript` |

## Consequences

**Positive:**
- App Router provides file-based routing with layouts, loading states, and error boundaries
- Server Components reduce client-side JavaScript bundle size
- Turbopack provides fast development builds
- Strong TypeScript support and type-safe routing
- Large ecosystem and community support
- Built-in image optimization, font optimization, and metadata API

**Negative:**
- App Router is relatively new — some patterns are still evolving
- Server Components introduce complexity in data fetching patterns
- Larger framework overhead compared to a plain Vite + React setup
- Tied to Vercel's ecosystem for some optimizations (though deployable anywhere)

**Risks:**
- React 19 is still relatively new — potential for breaking changes in minor updates
- Tailwind CSS v4 is also new and uses a different configuration approach than v3
