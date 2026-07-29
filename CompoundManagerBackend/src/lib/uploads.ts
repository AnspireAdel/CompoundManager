import path from 'path';
import fs from 'fs';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma';

export const uploadsRoot = path.join(process.cwd(), 'uploads');
export const chatUploadsDir = path.join(uploadsRoot, 'chats');
export const paymentUploadsDir = path.join(uploadsRoot, 'payments');

for (const dir of [chatUploadsDir, paymentUploadsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

const messagePublicSelect = {
  id: true,
  chatGroupId: true,
  userId: true,
  body: true,
  messageType: true,
  fileName: true,
  filePath: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
} as const;

export { messagePublicSelect };

function safeBasename(name: string) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '');
}

/** Serve /uploads/* from disk, falling back to DB-stored chat file blobs. */
export async function serveUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const rel = req.path.replace(/^\/+/, '');
    if (!rel || rel.includes('..')) {
      return res.status(400).type('text').send('Invalid path');
    }

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const diskPath = path.join(uploadsRoot, rel);
    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
      return res.sendFile(diskPath);
    }

    // Durable fallback: chat attachments stored in Turso after Render disk wipes
    if (rel.startsWith('chats/')) {
      const filename = safeBasename(rel.slice('chats/'.length));
      if (!filename) return res.status(404).type('text').send('File not found');

      const filePath = `/uploads/chats/${filename}`;
      const message = await prisma.chatMessage.findFirst({
        where: { filePath },
        select: { fileData: true, mimeType: true, fileName: true, fileSize: true },
      });

      if (!message?.fileData || message.fileData.length === 0) {
        return res.status(404).type('text').send('File not found');
      }

      const buf = Buffer.from(message.fileData);
      const mime = message.mimeType || 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      if (message.fileName) {
        res.setHeader(
          'Content-Disposition',
          `inline; filename*=UTF-8''${encodeURIComponent(message.fileName)}`
        );
      }

      const range = req.headers.range;
      if (range && (mime.startsWith('video/') || mime.startsWith('audio/'))) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match) {
          const size = buf.length;
          const start = match[1] ? parseInt(match[1], 10) : 0;
          const end = match[2] ? parseInt(match[2], 10) : size - 1;
          if (start >= size || end >= size || start > end) {
            res.status(416);
            res.setHeader('Content-Range', `bytes */${size}`);
            return res.end();
          }
          const chunk = buf.subarray(start, end + 1);
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Length', chunk.length);
          return res.send(chunk);
        }
      }

      res.setHeader('Content-Length', buf.length);
      if (mime.startsWith('video/') || mime.startsWith('audio/')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
      return res.send(buf);
    }

    return res.status(404).type('text').send('File not found');
  } catch (err) {
    next(err);
  }
}
