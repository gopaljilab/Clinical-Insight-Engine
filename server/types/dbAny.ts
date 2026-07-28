import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@shared/schema";

// Pragmatic typing escape hatch for Drizzle query builders.
// This repo's Drizzle type inference has been observed to drift from
// the actual schema, causing excessive TSC failures.
//
// Use only at repository boundaries.
export type TypedDbAny = NodePgDatabase<typeof schema> & any;

