import { prisma } from '../src/lib/prisma';

/** Multer often stores UTF-8 filenames as Latin-1 mojibake. */
function fixMojibake(name: string | null | undefined): string | null {
  if (!name) return name ?? null;
  try {
    const fixed = Buffer.from(name, 'latin1').toString('utf8');
    // Only apply if it looks like a real repair (contains Arabic / fewer replacement junk patterns)
    if (fixed !== name && /[\u0600-\u06FF]/.test(fixed)) return fixed;
    return name;
  } catch {
    return name;
  }
}

async function main() {
  const missingIds = [6, 7, 8, 11, 12, 13, 14, 15, 16];

  const deleted = await prisma.chatMessage.deleteMany({
    where: { id: { in: missingIds } },
  });
  console.log(`Deleted messages with missing files: ${deleted.count}`);

  const withFiles = await prisma.chatMessage.findMany({
    where: { fileName: { not: null } },
    select: { id: true, fileName: true, body: true },
  });

  let fixedCount = 0;
  for (const m of withFiles) {
    const fixedName = fixMojibake(m.fileName);
    const fixedBody = fixMojibake(m.body);
    if (fixedName !== m.fileName || fixedBody !== m.body) {
      await prisma.chatMessage.update({
        where: { id: m.id },
        data: {
          fileName: fixedName,
          body: fixedBody && fixedBody === fixedName ? fixedName : m.body === m.fileName ? fixedName : m.body,
        },
      });
      console.log(`Fixed #${m.id}: ${m.fileName} -> ${fixedName}`);
      fixedCount++;
    }
  }
  console.log(`Fixed Arabic filenames: ${fixedCount}`);

  const remaining = await prisma.chatMessage.findMany({
    where: { OR: [{ filePath: { not: null } }, { messageType: { not: 'TEXT' } }] },
    orderBy: { id: 'asc' },
    select: { id: true, messageType: true, fileName: true, filePath: true, mimeType: true },
  });
  console.log('Remaining file messages:');
  for (const m of remaining) console.log(JSON.stringify(m));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
