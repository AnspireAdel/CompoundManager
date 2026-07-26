/**
 * Normalize passwords before hash/compare:
 * - Arabic-Indic digits → Latin 0-9
 * - Latin letters → UPPERCASE
 * - Reject Arabic (and other non-Latin) letters
 * Allowed: A–Z, 0–9, and optional ASCII punctuation/symbols
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC = '۰۱۲۳۴۵۶۷۸۹';

export function normalizePassword(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const ai = ARABIC_INDIC.indexOf(ch);
    if (ai >= 0) {
      out += String(ai);
      continue;
    }
    const ea = EASTERN_ARABIC.indexOf(ch);
    if (ea >= 0) {
      out += String(ea);
      continue;
    }
    // Latin letters → upper
    if (/[a-zA-Z]/.test(ch)) {
      out += ch.toUpperCase();
      continue;
    }
    // Digits / ASCII punctuation & symbols
    if (/[0-9\x20-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/.test(ch)) {
      out += ch;
      continue;
    }
    // Anything else (Arabic letters, emoji, …) → reject via caller
    throw new Error('كلمة المرور يجب أن تكون بحروف إنجليزية وأرقام إنجليزية فقط (بدون حروف عربية)');
  }
  return out;
}

/** Soft normalize for typing UX: convert digits/case, strip Arabic letters. */
export function normalizePasswordInput(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const ai = ARABIC_INDIC.indexOf(ch);
    if (ai >= 0) {
      out += String(ai);
      continue;
    }
    const ea = EASTERN_ARABIC.indexOf(ch);
    if (ea >= 0) {
      out += String(ea);
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      out += ch.toUpperCase();
      continue;
    }
    if (/[0-9\x20-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/.test(ch)) {
      out += ch;
      continue;
    }
    // drop Arabic letters / invalid chars silently while typing
  }
  return out;
}

export function tryNormalizePassword(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  try {
    const value = normalizePassword(raw);
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'كلمة مرور غير صالحة' };
  }
}
