/**
 * Re-hash known user passwords with uppercase/normalized form.
 * Usage: npx tsx scripts/normalize-passwords.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createPrismaClient } from '../src/lib/createPrismaClient';
import { normalizePassword } from '../src/lib/password';

const prisma = createPrismaClient();

/** Known plaintext passwords currently in DB (before normalization). */
const KNOWN: Array<{ email: string; plaintext: string }> = [
  { email: 'superadmin@gmail.com', plaintext: 'sa123' },
  { email: 'admin@gmail.com', plaintext: 'admin123' },
  { email: 'acc@gmail.com', plaintext: 'acc123' },
  { email: 'nagy.tharwat@gmail.com', plaintext: '123456' },
  // legacy seed accounts if still present
  { email: 'superadmin@compound.com', plaintext: 'superadmin123' },
  { email: 'admin@compound.com', plaintext: 'admin123' },
  { email: 'accountant@compound.com', plaintext: 'accountant123' },
  { email: 'ahmed@example.com', plaintext: '123456' },
];

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, password: true } });
  let updated = 0;

  for (const user of users) {
    const known = KNOWN.find((k) => k.email.toLowerCase() === user.email.toLowerCase());
    if (!known) {
      console.log(`skip (unknown plaintext): ${user.email}`);
      continue;
    }

    const oldMatches = await bcrypt.compare(known.plaintext, user.password);
    const normalized = normalizePassword(known.plaintext);
    const alreadyNormalized = await bcrypt.compare(normalized, user.password);

    if (alreadyNormalized && normalized === known.plaintext.toUpperCase()) {
      // may already be fine for digit-only; still ensure hash of normalized
      if (normalized === known.plaintext) {
        console.log(`ok (digits-only): ${user.email}`);
        continue;
      }
    }

    if (oldMatches || alreadyNormalized) {
      const hash = await bcrypt.hash(normalized, 10);
      await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
      updated += 1;
      console.log(`updated: ${user.email} → ${normalized}`);
    } else {
      // Password was changed by user — try matching common variants
      const variants = [known.plaintext, known.plaintext.toUpperCase(), known.plaintext.toLowerCase()];
      let matched = false;
      for (const v of variants) {
        if (await bcrypt.compare(v, user.password)) {
          const hash = await bcrypt.hash(normalizePassword(v), 10);
          await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
          updated += 1;
          matched = true;
          console.log(`updated (variant): ${user.email} → ${normalizePassword(v)}`);
          break;
        }
      }
      if (!matched) console.log(`skip (password changed): ${user.email}`);
    }
  }

  console.log(`Done. Updated ${updated}/${users.length} users.`);
  console.log('Logins (type any case / Arabic digits — stored uppercase Latin):');
  console.log('  superadmin@gmail.com / SA123');
  console.log('  admin@gmail.com / ADMIN123');
  console.log('  acc@gmail.com / ACC123');
  console.log('  nagy.tharwat@gmail.com / 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
