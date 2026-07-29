import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import type { AuthUser } from '../middleware/auth';
import { streamPrivateBlob, isPrivateBlobUrl } from '../lib/storage';

const router = Router();

/** Allow Bearer header or ?access_token= for <img>/<video>/<audio> tags. */
function authenticateMedia(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : null;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(token, config.jwtSecret) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.get('/', authenticateMedia, async (req, res) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }
  if (!isPrivateBlobUrl(url) && !url.includes('blob.vercel-storage.com')) {
    return res.status(400).json({ error: 'Invalid media URL' });
  }
  try {
    await streamPrivateBlob(url, res);
  } catch (err) {
    console.error('media proxy error', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to load media' });
    }
  }
});

export default router;
