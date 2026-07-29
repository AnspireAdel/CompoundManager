/**
 * Add FILE_DATA blob column to CHAT_MESSAGES for durable chat attachments.
 * Usage: npx tsx scripts/add-chat-file-data.ts
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
  const cols = await client.execute('PRAGMA table_info(CHAT_MESSAGES)');
  const has = cols.rows.some((r) => String(r.name) === 'FILE_DATA');
  if (!has) {
    console.log('Adding FILE_DATA column...');
    await client.execute('ALTER TABLE CHAT_MESSAGES ADD COLUMN FILE_DATA BLOB');
    console.log('FILE_DATA added.');
  } else {
    console.log('FILE_DATA already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.close());
