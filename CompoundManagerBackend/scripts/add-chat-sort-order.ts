/**
 * Add SORT_ORDER to CHAT_GROUPS and backfill by id.
 * Usage: npx tsx scripts/add-chat-sort-order.ts
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
  const cols = await client.execute("PRAGMA table_info(CHAT_GROUPS)");
  const hasSort = cols.rows.some((r) => String(r.name) === 'SORT_ORDER');
  if (!hasSort) {
    console.log('Adding SORT_ORDER column...');
    await client.execute(
      'ALTER TABLE CHAT_GROUPS ADD COLUMN SORT_ORDER INTEGER NOT NULL DEFAULT 0'
    );
  } else {
    console.log('SORT_ORDER already exists');
  }

  const groups = await client.execute('SELECT id FROM CHAT_GROUPS ORDER BY id ASC');
  let i = 0;
  for (const row of groups.rows) {
    await client.execute({
      sql: 'UPDATE CHAT_GROUPS SET SORT_ORDER = ? WHERE id = ?',
      args: [i, row.id as number],
    });
    i += 1;
  }
  console.log(`Backfilled sort order for ${i} groups.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.close());
