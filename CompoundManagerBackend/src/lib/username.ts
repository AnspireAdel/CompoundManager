import { prisma } from './prisma';

export const USERNAME_MIN_LENGTH = 5;
export const USERNAME_MAX_LENGTH = 32;
export const SEQUENTIAL_MIN = 1;
export const SEQUENTIAL_MAX = 99999;

const CUSTOM_USERNAME_RE = /^[a-z0-9]+$/i;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function formatSequentialUsername(n: number): string {
  if (n < SEQUENTIAL_MIN || n > SEQUENTIAL_MAX) {
    throw new Error('نفدت أرقام أسماء المستخدم المتاحة (00001–99999)');
  }
  return String(n).padStart(5, '0');
}

export function isSequentialUsername(username: string): boolean {
  return /^\d{5}$/.test(username);
}

export function validateCustomUsername(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = normalizeUsername(raw);
  if (value.length < USERNAME_MIN_LENGTH) {
    return { ok: false, error: `اسم المستخدم يجب ألا يقل عن ${USERNAME_MIN_LENGTH} أحرف` };
  }
  if (value.length > USERNAME_MAX_LENGTH) {
    return { ok: false, error: `اسم المستخدم يجب ألا يزيد عن ${USERNAME_MAX_LENGTH} حرفاً` };
  }
  if (!CUSTOM_USERNAME_RE.test(value)) {
    return { ok: false, error: 'اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط' };
  }
  return { ok: true, value };
}

export async function isUsernameTaken(username: string, excludeUserId?: number): Promise<boolean> {
  const normalized = normalizeUsername(username);
  const existing = await prisma.user.findUnique({ where: { username: normalized } });
  if (!existing) return false;
  if (excludeUserId !== undefined && existing.id === excludeUserId) return false;
  return true;
}

/** Next available 00001–99999 (based on numeric usernames already assigned). */
export async function allocateNextSequentialUsername(): Promise<string> {
  const users = await prisma.user.findMany({
    select: { username: true },
  });

  let max = 0;
  for (const u of users) {
    if (isSequentialUsername(u.username)) {
      const n = parseInt(u.username, 10);
      if (n > max) max = n;
    }
  }

  return formatSequentialUsername(max + 1);
}

export async function assertUsernameAvailable(
  raw: string,
  excludeUserId?: number
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const validated = validateCustomUsername(raw);
  if (!validated.ok) return validated;

  if (await isUsernameTaken(validated.value, excludeUserId)) {
    return { ok: false, error: 'اسم المستخدم مستخدم بالفعل' };
  }

  return validated;
}
