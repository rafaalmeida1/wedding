import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../../../.env.local'), override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

async function main() {
  const folder = resolve(__dirname, '../drizzle');
  console.log('[migrate] applying migrations from', folder, 'against', databaseUrl);
  await migrate(db, { migrationsFolder: folder });
  console.log('[migrate] done');
  await sql.end();
}

main().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
