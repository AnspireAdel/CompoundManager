import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { get, put } from '@vercel/blob';
import type { Response } from 'express';
import { decodeUploadName } from './uploadName';

export type UploadedFile = {
  /** Display name (original, UTF-8 fixed). */
  originalName: string;
  /** Public URL or local `/uploads/...` path stored in DB. */
  url: string;
  mimeType: string;
  size: number;
};

type MulterFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
};

function uniqueName(originalName: string): string {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = path.extname(originalName).toLowerCase() || '.bin';
  return `${unique}${ext}`;
}

function ensureLocalDir(folder: string): string {
  const dir = path.join(process.cwd(), 'uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isPrivateBlobUrl(url?: string | null): boolean {
  return Boolean(url && url.includes('.private.blob.vercel-storage.com'));
}

/** Persist an uploaded file to Vercel Blob when configured, otherwise local disk. */
export async function saveUpload(folder: 'chats' | 'payments', file: MulterFile): Promise<UploadedFile> {
  const originalName = decodeUploadName(file.originalname);
  const storedName = uniqueName(originalName);
  const mimeType = file.mimetype || 'application/octet-stream';
  const size = file.size;

  const buffer =
    file.buffer ||
    (file.path ? fs.readFileSync(file.path) : null);

  if (!buffer) {
    throw new Error('ملف الرفع فارغ');
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    // Store is private — public access is rejected by Vercel Blob.
    const blob = await put(`${folder}/${storedName}`, buffer, {
      access: 'private',
      token,
      contentType: mimeType,
      addRandomSuffix: false,
    });
    if (file.path) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
    }
    return { originalName, url: blob.url, mimeType, size };
  }

  const dir = ensureLocalDir(folder);
  const dest = path.join(dir, storedName);
  fs.writeFileSync(dest, buffer);
  if (file.path && file.path !== dest) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
  }
  return { originalName, url: `/uploads/${folder}/${storedName}`, mimeType, size };
}

/** Stream a private Vercel Blob to an Express response. */
export async function streamPrivateBlob(url: string, res: Response): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'Blob storage is not configured' });
    return;
  }
  if (!isPrivateBlobUrl(url) && !url.includes('blob.vercel-storage.com')) {
    res.status(400).json({ error: 'Invalid media URL' });
    return;
  }

  const result = await get(url, { access: 'private', token });
  if (!result?.stream) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const contentType =
    (typeof result.headers?.get === 'function' ? result.headers.get('content-type') : null) ||
    'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const nodeStream = Readable.fromWeb(result.stream as import('stream/web').ReadableStream);
  nodeStream.pipe(res);
}
