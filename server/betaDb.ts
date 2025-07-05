
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as betaSchema from '../shared/betaSchema';

// For now, use the same database with different schema prefix
// In production, this would be a completely separate database
const databaseUrl = process.env.BETA_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('BETA_DATABASE_URL or DATABASE_URL environment variable is required');
}

const sql = neon(databaseUrl);
export const betaDb = drizzle(sql, { schema: betaSchema });
