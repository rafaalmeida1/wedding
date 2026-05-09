import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

config({ path: resolve(__dirname, '../../.env') });
config({ path: resolve(__dirname, '../../.env.local'), override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required (loaded from root .env)');
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
