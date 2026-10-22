import { Router, type Response } from 'express';
import { db } from '../db.ts';
import { requireAuth, type AuthRequest } from '../auth.ts';

const router = Router();

// GET notifications
router.get('/notifications', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const isSAN = user.role === 'SALES_ADMIN_NATIONAL';
  const dpId = user.dropPointId || -1;

  const whereClause = isSAN
    ? `
      (user_id = ?)
      OR (
        user_id IS NULL
        AND role IN ('SALES_ADMIN_NATIONAL', 'SALES_ADMIN', 'ALL')
      )
    `
    : `
      (user_id = ?)
      OR (
        user_id IS NULL
        AND (role = ? OR role = 'ALL')
        AND (drop_point_id IS NULL OR drop_point_id = ?)
      )
    `;
  const params = isSAN ? [user.id] : [user.id, user.role, dpId];

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE ${whereClause}
    ORDER BY created_at DESC LIMIT 40
  `).all(...params);

  const unreadCount = (db.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE is_read = 0 AND (${whereClause})
  `).get(...params) as any).count;

  res.json({ notifications, unreadCount });
});

// Mark notification as read
router.patch('/notifications/:id/read', requireAuth, (req: AuthRequest, res: Response) => {
  const notifId = parseInt(req.params.id, 10);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notifId);
  res.json({ success: true });
});

// Mark all as read
router.post('/notifications/read-all', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const isSAN = user.role === 'SALES_ADMIN_NATIONAL';
  const dpId = user.dropPointId || -1;

  const whereClause = isSAN
    ? `
      (user_id = ?)
      OR (
        user_id IS NULL
        AND role IN ('SALES_ADMIN_NATIONAL', 'SALES_ADMIN', 'ALL')
      )
    `
    : `
      (user_id = ?)
      OR (
        user_id IS NULL
        AND (role = ? OR role = 'ALL')
        AND (drop_point_id IS NULL OR drop_point_id = ?)
      )
    `;
  const params = isSAN ? [user.id] : [user.id, user.role, dpId];

  db.prepare(`
    UPDATE notifications
    SET is_read = 1
    WHERE ${whereClause}
  `).run(...params);
  res.json({ success: true });
});

// GET Activity Logs (Section 36)
router.get('/activity-logs', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { action, limit } = req.query;

  let query = 'SELECT * FROM activity_logs WHERE 1=1';
  const params: any[] = [];

  if (user.role === 'SALES_ADMIN_NATIONAL') {
    // SAN sees everything
  } else if (user.role === 'SALES_ADMIN') {
    // SA sees logs related to their DP or team
    query += ' AND (user_id IN (SELECT id FROM users WHERE drop_point_id = ?) OR details LIKE ?)';
    params.push(user.dropPointId, `%${user.dropPointId}%`);
  } else {
    // FSS & VRS see only their own actions
    query += ' AND user_id = ?';
    params.push(user.id);
  }

  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit ? parseInt(String(limit), 10) : 50);

  const logs = db.prepare(query).all(...params);
  res.json({ logs });
});

export function logActivity(
  userOrId: any,
  action: string,
  resource: string,
  details?: string,
  reqOrIp?: any
) {
  try {
    let userId: number | null = null;
    let userPublicId = 'SYSTEM';
    let ip = typeof reqOrIp === 'string' ? reqOrIp : (reqOrIp?.ip || reqOrIp?.headers?.['x-forwarded-for'] || '127.0.0.1');

    if (typeof userOrId === 'number') {
      userId = userOrId;
      userPublicId = String(userOrId);
    } else if (userOrId && typeof userOrId === 'object') {
      userId = userOrId.id || null;
      userPublicId = userOrId.publicId || userOrId.public_id || 'UNKNOWN';
    }

    db.prepare(`
      INSERT INTO activity_logs (user_id, user_public_id, action, resource, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, userPublicId, action, resource, details || null, String(ip));
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

export function createNotification(
  userId: number | null,
  role: string | null,
  dropPointId: number | null,
  title: string,
  message: string,
  type = 'SYSTEM',
  link?: string
) {
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, role, drop_point_id, title, message, type, link)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, role, dropPointId, title, message, type, link || null);
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

export default router;
