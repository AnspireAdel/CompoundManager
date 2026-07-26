/**
 * Normalize passwords before send:
 * - Arabic-Indic digits → Latin 0-9
 * - Latin letters → UPPERCASE
 * - Drop Arabic letters while typing
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC = '۰۱۲۳۴۵۶۷۸۹';

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
  }
  return out;
}
