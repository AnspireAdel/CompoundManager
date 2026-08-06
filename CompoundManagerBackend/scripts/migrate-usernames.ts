/**
 * Add username columns and backfill existing users with sequential IDs (00001, 00002, …).
 * Safe to run multiple times.
 *
 * Usage: npx tsx scripts/migrate-usernames.ts
 */
import 'dotenv/config';
import { createPrismaClient } from '../src/lib/createPrismaClient';
import { formatSequentialUsername } from '../src/lib/username';

const prisma = createPrismaClient();

type UserRow = { id: number; email: string; username: string | null };

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info(${table});`
  );
  return rows.some((r) => r.name === column);
}

function isSequentialUsername(username: string): boolean {
  return /^\d{5}$/.test(username);
}

async function main() {
  const hasUsername = await columnExists('USERS', 'username');
  const hasMustChange = await columnExists('USERS', 'MUST_CHANGE_USERNAME');

  if (!hasUsername) {
    console.log('Adding username column...');
    await prisma.$executeRawUnsafe(`ALTER TABLE USERS ADD COLUMN username TEXT;`);
  }

  if (!hasMustChange) {
    console.log('Adding MUST_CHANGE_USERNAME column...');
    await prisma.$executeRawUnsafe(
      `ALTER TABLE USERS ADD COLUMN MUST_CHANGE_USERNAME INTEGER NOT NULL DEFAULT 0;`
    );
  }

  const users = await prisma.$queryRawUnsafe<UserRow[]>(
    `SELECT id, email, username FROM USERS ORDER BY id ASC;`
  );

  let seq = 1;
  for (const user of users) {
    const current = user.username?.trim();
    if (current) {
      if (isSequentialUsername(current)) {
        const n = parseInt(current, 10);
        if (n >= seq) seq = n + 1;
      }
      continue;
    }

    const username = formatSequentialUsername(seq);
    seq += 1;

    await prisma.$executeRawUnsafe(
      `UPDATE USERS SET username = ? WHERE id = ?;`,
      username,
      user.id
    );
    console.log(`User #${user.id} (${user.email}) → ${username}`);
  }

  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS USERS_username_key ON USERS(username);`
    );
  } catch (e) {
    console.warn('Index note:', e instanceof Error ? e.message : e);
  }

  console.log('Username migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
