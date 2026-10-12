import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';
import * as relations from './relations.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected idle PostgreSQL client error:', err.message);
});

export const db = drizzle(pool, {
  schema: { ...schema, ...relations },
});

export const closeDbPool = async () => {
  try {
    await pool.end();
    console.log('🔌 PostgreSQL connection pool cleanly closed.');
  } catch (error) {
    console.error('❌ Error closing PostgreSQL connection pool:', error.message);
  }
};
