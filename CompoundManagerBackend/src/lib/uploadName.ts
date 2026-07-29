/** Multer parses multipart headers as Latin-1; restore UTF-8 for Arabic filenames. */
export function decodeUploadName(name: string): string {
  try {
    const fixed = Buffer.from(name, 'latin1').toString('utf8');
    return /[\u0600-\u06FF]/.test(fixed) ? fixed : name;
  } catch {
    return name;
  }
}
