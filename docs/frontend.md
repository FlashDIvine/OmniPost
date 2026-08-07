Status: Active
Owner: TBD
Last Updated: 2026-08-07
Dependencies: [Architecture](./architecture.md)

# Purpose

Document the Next.js frontend application (`apps/web`), including its setup, routing, styling, and project structure. Every claim is traced to a specific source file.

# Scope

This document covers the current implementation of the frontend web application. Features marked "Planned" do not exist in the code.

# Current State

## Overview

| Property | Value | Source |
|----------|-------|--------|
| Package name | `@omnipost/web` | `apps/web/package.json` line 2 |
| Version | `0.1.0` | `apps/web/package.json` line 3 |
| Framework | Next.js 15.1.7 | `apps/web/package.json` → `next: ^15.1.7` |
| React | 19.0.0 | `apps/web/package.json` → `react: ^19.0.0` |
| React DOM | 19.0.0 | `apps/web/package.json` → `react-dom: ^19.0.0` |
| TypeScript | 5.7.3+ | `apps/web/package.json` → `typescript: ^5.7.3` |
| Default port | 3000 | Next.js default |

## Router

The application uses the **Next.js App Router** (not Pages Router).

Evidence: Source files are located in `apps/web/src/app/` (not `pages/`), and the directory contains `layout.tsx` and `page.tsx` — the App Router convention.

## Styling — Tailwind CSS v4

| Property | Value | Source |
|----------|-------|--------|
| Tailwind CSS | v4.0.7 | `apps/web/package.json` → `tailwindcss: ^4.0.7` |
| PostCSS plugin | `@tailwindcss/postcss` v4.0.7 | `apps/web/package.json`, `postcss.config.mjs` |
| Config file | `tailwind.config.ts` | Exists at `apps/web/tailwind.config.ts` |

### Tailwind Configuration (`tailwind.config.ts`)

- Content paths: `./src/pages/**/*`, `./src/components/**/*`, `./src/app/**/*`
- Custom colors: `background` and `foreground` mapped to CSS custom properties

### Global Styles (`globals.css`)

Located at `apps/web/src/app/globals.css`:

- Imports Tailwind via `@import "tailwindcss"`
- Defines CSS custom properties for light and dark mode:
  - Light: `--background: #ffffff`, `--foreground: #171717`
  - Dark: `--background: #0a0a0a`, `--foreground: #ededed`
- Dark mode is based on `prefers-color-scheme` media query
- Body font: `Arial, Helvetica, sans-serif`

### PostCSS Configuration (`postcss.config.mjs`)

Uses the `@tailwindcss/postcss` plugin (Tailwind CSS v4's PostCSS integration approach).

## Dev Server — Turbopack

The development server uses **Turbopack** for faster compilation:

```json
"dev": "next dev --turbo"
```

Source: `apps/web/package.json` line 6

## Linting — ESLint

ESLint is configured via flat config (`eslint.config.mjs`), extending:

- `next/core-web-vitals` — Next.js performance rules
- `next/typescript` — TypeScript-specific Next.js rules

Using `@eslint/eslintrc` FlatCompat adapter for backwards compatibility.

Source: `apps/web/eslint.config.mjs`

## Next.js Configuration (`next.config.ts`)

The Next.js configuration file exists but is currently empty (no custom options configured).

Source: `apps/web/next.config.ts`

## Project Structure

```
apps/web/
├── package.json               # @omnipost/web
├── next.config.ts             # Next.js config (empty)
├── tailwind.config.ts         # Tailwind CSS config
├── postcss.config.mjs         # PostCSS config
├── eslint.config.mjs          # ESLint flat config
├── tsconfig.json              # TypeScript config
├── next-env.d.ts              # Next.js type declarations
├── public/                    # Static assets (empty)
└── src/
    └── app/                   # App Router
        ├── globals.css        # Global styles + Tailwind
        ├── layout.tsx         # Root layout
        └── page.tsx           # Home page (/)
```

## Current Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Home page — displays "Social Hub" heading and welcome message |

### Root Layout (`layout.tsx`)

- Sets HTML `lang="en"`
- Applies `antialiased` class to body
- Metadata: `title: "Social Hub"`, `description: "Social Hub web application"`

Source: `apps/web/src/app/layout.tsx`

### Home Page (`page.tsx`)

A simple landing page with:

- Flexbox layout (full height, centered)
- `<h1>` heading: "Social Hub" (styled with `text-4xl font-bold`)
- Welcome banner: "Welcome to Social Hub Web App" (with gradient background and dark mode support)

Source: `apps/web/src/app/page.tsx`

## Planned Pages

The following pages do not exist yet. They are inferred from the project roadmap:

- `/login` — User login
- `/register` — User registration
- `/dashboard` — Main dashboard
- `/posts` — Post management
- `/accounts` — Social account connections
- `/settings` — User settings

# Future Work

- Add frontend-backend API integration (e.g., fetch from `/api/health`)
- Create additional pages and routes
- Build reusable components (import from `packages/ui` when populated)
- Add state management solution
- Configure API base URL environment variable
- Set up authentication flow (JWT token handling)
- Update metadata from "Social Hub" to "OmniPost"

# References

- [Architecture](./architecture.md)
- [Backend](./backend.md)
- [Coding Standards](./coding-standards.md)
- [Setup](./setup.md)
