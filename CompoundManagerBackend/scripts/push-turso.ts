/**
 * Apply current Prisma schema SQL to Turso (Prisma CLI can't push to libsql://).
 * Usage: npx tsx scripts/push-turso.ts
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!url) {
  console.error('TURSO_DATABASE_URL is required');
  process.exit(1);
}

const sql = execSync(
  'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
  { encoding: 'utf8', cwd: process.cwd() }
);

const client = createClient({ url, authToken });

async function main() {
  // Split on statement boundaries; libsql executeMultiple handles batches
  console.log('Pushing schema to Turso...');
  await client.executeMultiple(sql);
  console.log('Schema applied successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.close());
