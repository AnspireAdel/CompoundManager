/**
 * Create expense tables on Turso (incremental).
 * Usage: npx tsx scripts/push-expense-tables.ts
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

const sql = `
CREATE TABLE IF NOT EXISTS EXPENSE_TYPES (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  ACTIVE_FLAG TEXT NOT NULL DEFAULT 'Y',
  CREATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS EXPENSE_TYPES_name_key ON EXPENSE_TYPES(name);

CREATE TABLE IF NOT EXISTS EXPENSES (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  EXPENSE_TYPE_ID INTEGER NOT NULL,
  AMOUNT REAL NOT NULL,
  EXPENSE_DATE DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  NOTES TEXT,
  RESIDENNT_ID INTEGER,
  CREATED_BY_ID INTEGER,
  CREATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT EXPENSES_expenseTypeId_fkey FOREIGN KEY (EXPENSE_TYPE_ID) REFERENCES EXPENSE_TYPES(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT EXPENSES_residentId_fkey FOREIGN KEY (RESIDENNT_ID) REFERENCES RESIDENNTS(RESIDENNT_ID) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT EXPENSES_createdById_fkey FOREIGN KEY (CREATED_BY_ID) REFERENCES USERS(id) ON DELETE SET NULL ON UPDATE CASCADE
);
`;

async function main() {
  console.log('Creating expense tables on Turso...');
  await client.executeMultiple(sql);
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('EXPENSE_TYPES','EXPENSES')"
  );
  console.log('OK:', tables.rows.map((r) => r.name).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.close());
