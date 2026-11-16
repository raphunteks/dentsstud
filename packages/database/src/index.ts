import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export * as schema from './schema/index.js';
export * from './schema/index.js';
export { STYLE_CATEGORIES, AGENTS, PRODUCTION_WORKFLOW, ROLE_PERMISSIONS, HELP_ARTICLES } from './catalog.js';

export type Database = NodePgDatabase<typeof schema> & { $client: pg.Pool };

/** Create a pooled Drizzle client. One instance per process. */
export function createDatabase(connectionString = process.env.DATABASE_URL, max = Number(process.env.DATABASE_POOL_MAX ?? 10)): Database {
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new pg.Pool({ connectionString, max, ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: true } : undefined });
  return drizzle({ client: pool, schema, casing: 'snake_case' }) as Database;
}
