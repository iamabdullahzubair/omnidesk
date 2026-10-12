import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in environment!');
  process.exit(1);
}

const maxRetries = 30;
let attempts = 0;

async function checkConnection() {
  while (attempts < maxRetries) {
    attempts++;
    try {
      const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 3000 });
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      console.log('✅ Connected to PostgreSQL successfully!');
      process.exit(0);
    } catch (err) {
      console.log(`⏳ [${attempts}/${maxRetries}] Waiting for database (${err.message || err.code}). Retrying in 2s...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.error('❌ Timed out waiting for PostgreSQL after 60 seconds.');
  process.exit(1);
}

checkConnection();
