/**
 * Add SHOW_ON_REGISTER to UNIT_TYPES (default true).
 * Usage: npx tsx scripts/add-unit-type-show-on-register.ts
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!url) {
  console.error('TURSO_DATABASE_URL is required');
  process.exit(1);
}

const client = createClient({ url, authToken });

async function main() {
  const cols = await client.execute('PRAGMA table_info(UNIT_TYPES)');
  const hasCol = cols.rows.some((r) => String(r.name) === 'SHOW_ON_REGISTER');
  if (!hasCol) {
    console.log('Adding SHOW_ON_REGISTER column...');
    await client.execute(
      'ALTER TABLE UNIT_TYPES ADD COLUMN SHOW_ON_REGISTER INTEGER NOT NULL DEFAULT 1'
    );
  } else {
    console.log('SHOW_ON_REGISTER already exists');
  }

  const types = await client.execute('SELECT * FROM UNIT_TYPES ORDER BY id ASC');
  console.log('Unit types:', types.rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.close());
