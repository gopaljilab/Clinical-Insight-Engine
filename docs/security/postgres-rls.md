# PostgreSQL Row-Level Security (RLS) for Multi-Tenant Data Isolation

## Architecture

Application User ↓ Express API ↓ PostgreSQL Session Context ↓ RLS Policies ↓ Authorized Records Only

## Overview

PostgreSQL Row-Level Security (RLS) enforces data isolation directly at the database layer. Every query against the `assessments` table is automatically filtered based on the authenticated user's identity, providing defense-in-depth beyond application-layer authorization checks.

## How It Works

### 1. Session Context

When an authenticated request reaches the server, the `rlsContextMiddleware` extracts the user's identity from the session or JWT and sets PostgreSQL session variables:

| Setting | Source | Purpose |
|---|---|---|
| `app.current_user_id` | User UUID (from `users` or `patient_users` table) | Matches `owner_id` on assessments |
| `app.current_user_email` | User email | Matches `created_by` on assessments |
| `app.current_user_role` | User role (e.g., DOCTOR, ADMIN, PATIENT) | Admin bypass policy |
| `app.current_user_patient_name` | Patient name (from `patient_users` table) | Matches `patient_name` for patient portal access |

These are set using `set_config('app.current_user_id', $1, true)` within a dedicated database connection obtained from the pool for the duration of the request.

### 2. RLS Policies

The migration `migrations/0004_enable_rls.sql` enables RLS on the `assessments` table and creates four policies:

- **SELECT**: Users can only view records where they are the owner (`owner_id`), creator (`created_by`), patient (`patient_name`), or an admin.
- **INSERT**: Users can only create records with their email as `created_by` or their UUID as `owner_id`.
- **UPDATE**: Users can only update records they own (same criteria as SELECT).
- **DELETE**: Users can only delete records they own (same criteria as SELECT).

### 3. Per-Request Connection

Each authenticated request gets a dedicated PostgreSQL connection from the pool. Session variables are set via `SET LOCAL` (scoped to the transaction/connection) to prevent cross-request contamination. The connection is released back to the pool when the response completes.

## Code Structure

### `server/db-rls.ts`

Core RLS infrastructure:
- `RlsUserContext` — interface for user identity data
- `createRlsClient(context)` — obtains a dedicated connection and sets session variables
- `runWithRlsDb(db, fn)` — runs a function within an AsyncLocalStorage context
- `getRlsDb()` — returns the per-request RLS-enabled database instance

### `server/middleware/rlsContext.ts`

Express middleware that:
1. Extracts user identity from session (`req.session.user`) or JWT (`Authorization: Bearer <token>`)
2. Resolves patient name if role is PATIENT
3. Creates a dedicated database client with session variables
4. Wraps the request in AsyncLocalStorage so all subsequent `getDb()` calls return the RLS-enabled connection
5. Releases the client on response finish/close

### `server/db.ts`

Modified `getDb()` function:
1. Checks for an RLS database instance in AsyncLocalStorage
2. If present, returns the per-request connection
3. Otherwise, falls back to the global pool-based connection

## Route Coverage

RLS middleware is applied to the following route groups in `server/index.ts`:

```
/api/assessments  — Assessment CRUD, search, export, trends
/api/patients     — EMR/EHR integration
/api/patient      — Patient portal
/api/admin        — Admin operations
```

## Testing

Run the RLS isolation tests:

```bash
npm test -- tests/security/rls.spec.ts
```

Key test scenarios:
- `getDb()` returns RLS-scoped database within `runWithRlsDb` context
- `getDb()` falls back to global instance outside RLS context
- Session variables are set correctly for providers and patients
- AsyncLocalStorage context persists through async operations
- Context is properly cleaned up after completion

## Migration

To apply the RLS migration:

```bash
npx drizzle-kit push
```

Or run the SQL manually:

```bash
psql $DATABASE_URL -f migrations/0004_enable_rls.sql
```

## Security Considerations

- RLS is a defense-in-depth layer; application-layer authorization in `patient-access.ts` remains active
- The `ADMIN` role bypasses RLS via policy, not `BYPASSRLS` attribute — this ensures admin access is controlled by the application
- Session variables are set per-request on dedicated connections to prevent information leakage between requests
- If session variables are not set (unauthenticated requests), all RLS policy conditions evaluate to NULL, blocking all access
- The `current_setting(name, true)` call uses `missing_ok=true` to safely return NULL when settings are absent
