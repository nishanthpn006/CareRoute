import pg from 'pg';
import 'dotenv/config';
import { PostgresStorageAdapter } from './PostgresAdapter.js';
import { runMigrations } from './migrate.js';

const { Pool } = pg;

export async function seedDatabase(pool) {
  // Ensure schema is migrated first
  await runMigrations(pool);

  const adapter = new PostgresStorageAdapter(pool);
  console.log('[CareRoute Seed] Checking database seed state...');
  await adapter.seedIfEmpty();
  console.log('[CareRoute Seed] Database seed completed idempotently.');
}

// CLI entrypoint
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[CareRoute Seed] DATABASE_URL is not defined in environment.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  seedDatabase(pool)
    .then(async () => {
      console.log('[CareRoute Seed] Finished.');
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[CareRoute Seed] Failed to seed database:', err);
      await pool.end();
      process.exit(1);
    });
}
