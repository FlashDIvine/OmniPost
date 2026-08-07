---
description: Bootstrap a production-ready Next.js application following the OmniPost architecture and project standards.
---

# Bootstrap Next.js Workflow

## Goal

Create a new Next.js application that follows the OmniPost architecture, coding standards, and monorepo conventions.

---

## Requirements

Before starting:

- Read README.md
- Read AGENTS.md
- Read package.json
- Inspect workspace structure
- Never overwrite existing configuration without confirmation.

---

## Tech Stack

- Next.js 15+
- TypeScript
- App Router
- Tailwind CSS v4
- ESLint
- Prettier
- Turborepo Workspace
- pnpm

---

## Directory Structure

Create or verify:

apps/
    web/

Inside web:

app/
components/
features/
hooks/
lib/
services/
types/
styles/
public/

---

## Configuration

Ensure:

- TypeScript strict mode enabled
- Path alias configured
- Tailwind configured
- ESLint configured
- Prettier configured
- Environment variables documented

---

## Install Dependencies

Install only required packages.

Examples:

Core
- next
- react
- react-dom

Developer
- typescript
- eslint
- prettier

UI
- tailwindcss

Never install unnecessary packages.

---

## Code Standards

Follow:

- Functional Components
- Server Components by default
- Client Components only when required
- No duplicated logic
- No inline styles
- Reusable components
- Strong typing

---

## Folder Rules

components/
Reusable UI.

features/
Business modules.

hooks/
Custom hooks.

lib/
Utilities.

services/
API layer.

types/
Global types.

---

## Environment

Create:

.env.example

Include:

NEXT_PUBLIC_API_URL=

Never commit secrets.

---

## Validation

Verify:

- Project builds successfully
- No TypeScript errors
- No ESLint errors
- No unused files
- No unused dependencies

---

## Deliverables

After completion provide:

- Summary
- Files created
- Dependencies installed
- Configuration changed
- Next recommended step