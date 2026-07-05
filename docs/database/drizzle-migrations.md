# Drizzle ORM Migrations

## Workflow Overview

We use Drizzle ORM to maintain type-safety between our PostgreSQL database and the TypeScript server backend. 

### Development Commands
- **Generate Migrations:** When you modify the `schema.ts` file, run:
  ```bash
  npm run db:generate
  ```
  This creates SQL migration files in the `drizzle/` directory. Check these files into version control.

- **Push Migrations (Development only):**
  ```bash
  npm run db:push
  ```
  This rapidly syncs the database schema without maintaining a formal migration history.

### Production Migrations
For production deployment, migrations should be applied programmatically on server startup using the `migrate()` function from `drizzle-orm/postgres-js/migrator`. Never use `db:push` in production, as it can cause destructive schema changes.
