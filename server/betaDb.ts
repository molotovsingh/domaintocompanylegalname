
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as betaSchema from '../shared/betaSchema';

if (!process.env.BETA_DATABASE_URL) {
  throw new Error('BETA_DATABASE_URL environment variable is required');
}

const sql = neon(process.env.BETA_DATABASE_URL);
export const betaDb = drizzle(sql, { schema: betaSchema });
