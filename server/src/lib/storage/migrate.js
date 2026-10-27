import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Runs pending PostgreSQL migrations in alphabetical order.
 * @param {import('pg').Pool} pool
 * @returns {Promise<string[]>} list of applied migration IDs
 */
export async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(128) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch already applied migrations
    const { rows } = await client.query('SELECT id FROM schema_migrations');
    const appliedSet = new Set(rows.map((r) => r.id));

    // 3. Read migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const appliedThisRun = [];

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`[CareRoute Migrate] Applying migration: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
        await client.query('COMMIT');
        appliedThisRun.push(file);
        console.log(`[CareRoute Migrate] Successfully applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[CareRoute Migrate] Failed to apply ${file}:`, err.message);
        throw err;
      }
    }

    if (appliedThisRun.length === 0) {
      console.log('[CareRoute Migrate] Schema is already up to date.');
    }

    return appliedThisRun;
  } finally {
    client.release();
  }
}

// CLI entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[CareRoute Migrate] DATABASE_URL is not defined in environment.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  runMigrations(pool)
    .then(async (applied) => {
      console.log(`[CareRoute Migrate] Complete. Applied ${applied.length} migrations.`);
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[CareRoute Migrate] Fatal migration error:', err);
      await pool.end();
      process.exit(1);
    });
}
