import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config/env';

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  residentId?: number | null;
}

/** Admin-level roles (includes SUPERADMIN). */
export const ADMIN_ROLES: Role[] = ['ADMIN', 'SUPERADMIN'];

/** Staff roles used across management APIs. */
export const STAFF_ROLES: Role[] = ['ADMIN', 'SUPERADMIN', 'ACCOUNTANT'];

export function isAdminRole(role?: Role | null) {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

export function isStaffRole(role?: Role | null) {
  return role === 'ADMIN' || role === 'SUPERADMIN' || role === 'ACCOUNTANT';
}

export function isSuperAdminRole(role?: Role | null) {
  return role === 'SUPERADMIN';
}

/** Owner or dependent linked to a residential unit. */
export function isResidentUser(role?: Role | null) {
  return role === 'OWNER' || role === 'DEPENDENT';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '7d' });
}
