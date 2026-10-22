import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'default_6c_distribution_jwt_secret_change_in_prod';

export interface AuthenticatedUser {
  id: number;
  publicId: string;
  role: 'SALES_ADMIN_NATIONAL' | 'SALES_ADMIN' | 'FSS' | 'VRS';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photo?: string;
  dropPointId: number | null;
  salesAdminId: number | null;
  fssId: number | null;
  sectorId: number | null;
  status: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      publicId: user.publicId,
      role: user.role,
      dropPointId: user.dropPointId,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accès refusé. Jeton d\'authentification manquant.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const user = db.prepare(`
      SELECT id, public_id as publicId, role, first_name as firstName, last_name as lastName,
             email, phone, photo, drop_point_id as dropPointId, sales_admin_id as salesAdminId,
             fss_id as fssId, sector_id as sectorId, status
      FROM users WHERE id = ?
    `).get(decoded.id) as AuthenticatedUser | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable ou session révoquée.' });
    }

    if (user.status === 'SUSPENDU' || user.status === 'INACTIF') {
      return res.status(403).json({ error: 'Votre compte est suspendu ou inactif. Veuillez contacter votre administrateur.' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Jeton expiré ou invalide. Veuillez vous reconnecter.' });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Accès non autorisé pour le rôle ${req.user.role}. Rôles requis: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

export function checkDropPointScope(user: AuthenticatedUser, targetDropPointId: number): boolean {
  if (user.role === 'SALES_ADMIN_NATIONAL') {
    return true;
  }
  return user.dropPointId === targetDropPointId;
}

export function logActivity(
  user: AuthenticatedUser | { id?: number; publicId: string },
  action: string,
  resource: string,
  details?: string,
  req?: Request
) {
  try {
    const ip = req?.ip || req?.socket?.remoteAddress || '127.0.0.1';
    db.prepare(`
      INSERT INTO activity_logs (user_id, user_public_id, action, resource, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id || null, user.publicId, action, resource, details || null, String(ip));
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

export function createNotification(
  userId: number | null,
  role: string | null,
  dropPointId: number | null,
  title: string,
  message: string,
  type: string,
  link?: string
) {
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, role, drop_point_id, title, message, type, link)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, role, dropPointId, title, message, type, link || null);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}
