import { Role } from '@prisma/client';
import { prisma } from './prisma';

/** Roles that share a residential unit (owner + dependents). */
export function isResidentUser(role?: Role | null) {
  return role === 'OWNER' || role === 'DEPENDENT';
}

export const DEFAULT_TEMP_PASSWORD = '123';

/** Copy owner chat memberships onto a dependent user. */
export async function syncDependentChatsFromOwner(ownerUserId: number, dependentUserId: number) {
  const memberships = await prisma.chatMember.findMany({
    where: { userId: ownerUserId },
    select: { chatGroupId: true },
  });
  for (const m of memberships) {
    await prisma.chatMember.upsert({
      where: {
        chatGroupId_userId: { chatGroupId: m.chatGroupId, userId: dependentUserId },
      },
      create: { chatGroupId: m.chatGroupId, userId: dependentUserId },
      update: {},
    });
  }
}

/** When an owner joins a chat, add all dependent users of the same unit. */
export async function addHouseholdDependentsToChat(chatGroupId: number, userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, residentId: true },
  });
  if (!user || user.role !== 'OWNER' || !user.residentId) return;

  const dependents = await prisma.user.findMany({
    where: { role: 'DEPENDENT', residentId: user.residentId, status: 'APPROVED' },
    select: { id: true },
  });
  for (const d of dependents) {
    await prisma.chatMember.upsert({
      where: { chatGroupId_userId: { chatGroupId, userId: d.id } },
      create: { chatGroupId, userId: d.id },
      update: {},
    });
  }
}

/** When an owner leaves a chat, remove household dependents from that chat. */
export async function removeHouseholdDependentsFromChat(chatGroupId: number, userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, residentId: true },
  });
  if (!user || user.role !== 'OWNER' || !user.residentId) return;

  const dependents = await prisma.user.findMany({
    where: { role: 'DEPENDENT', residentId: user.residentId },
    select: { id: true },
  });
  if (dependents.length === 0) return;
  await prisma.chatMember.deleteMany({
    where: {
      chatGroupId,
      userId: { in: dependents.map((d) => d.id) },
    },
  });
}
