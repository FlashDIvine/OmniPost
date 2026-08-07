Status: Active
Owner: TBD
Last Updated: 2026-08-07
Dependencies: [Backend](../backend.md)

# Purpose

Provide an index of all implemented API endpoints in the OmniPost backend.

# Scope

This document lists only endpoints that are verified to exist in the codebase. Planned endpoints are listed in a separate section.

# Current State

## Base URL

```
http://localhost:3001/api
```

The global prefix `/api` is set in `apps/api/src/main.ts` line 15.

## Swagger / OpenAPI Documentation

Interactive API documentation is available at:

```
http://localhost:3001/api/docs
```

> **Note:** Swagger is only enabled in development mode (`NODE_ENV=development`). See `apps/api/src/main.ts` lines 44–55.

## Implemented Endpoints

| Method | Path | Controller | Description | Source |
|--------|------|-----------|-------------|--------|
| `GET` | `/api/health` | `HealthController` | Returns API health status | `apps/api/src/health/health.controller.ts` |

### `GET /api/health`

Returns the current health status of the API.

**Response (200 OK):**

```json
{
  "status": "ok",
  "service": "OmniPost API",
  "timestamp": "2026-08-07T00:00:00.000Z"
}
```

**Swagger tags:** `Health`

## Planned Endpoints

The following endpoints do not exist yet. They are anticipated based on the project roadmap:

| Module | Endpoints (anticipated) | Sprint |
|--------|------------------------|--------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh` | Sprint 3 |
| Users | `GET /api/users/me`, `PATCH /api/users/me`, `GET /api/users/:id` | Sprint 4 |
| Social Accounts | `GET /api/accounts`, `POST /api/accounts`, `DELETE /api/accounts/:id` | Sprint 5 |
| Posts | `GET /api/posts`, `POST /api/posts`, `GET /api/posts/:id`, `PATCH /api/posts/:id`, `DELETE /api/posts/:id` | Sprint 6 |

> ⚠️ These are anticipated endpoints, not commitments. Actual API design will be determined during implementation.

# Future Work

- Update this document as new endpoints are implemented
- Link to Swagger-generated documentation once it covers more endpoints
- Add request/response schema details for each endpoint
- Add authentication requirements per endpoint

# References

- [Backend](../backend.md)
- [Architecture](../architecture.md)
- [Roadmap](../roadmap.md)
