import { Router, type Response } from 'express';
import { db } from '../db.ts';
import { requireAuth, requireRole, type AuthRequest, logActivity } from '../auth.ts';

const router = Router();

// GET all Drop Points (filtered by scope)
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;

  let dropPoints: any[];
  if (user.role === 'SALES_ADMIN_NATIONAL') {
    dropPoints = db.prepare(`
      SELECT dp.*,
             (SELECT COUNT(*) FROM users u WHERE u.drop_point_id = dp.id AND u.role = 'VRS') as vrsCount,
             (SELECT COUNT(*) FROM users u WHERE u.drop_point_id = dp.id AND u.role = 'FSS') as fssCount,
             (SELECT COUNT(*) FROM points_of_sale pos WHERE pos.drop_point_id = dp.id) as posCount,
             (SELECT u.first_name || ' ' || u.last_name FROM users u WHERE u.drop_point_id = dp.id AND u.role = 'SALES_ADMIN' LIMIT 1) as salesAdminName
      FROM drop_points dp
      ORDER BY dp.name ASC
    `).all();
  } else {
    if (!user.dropPointId) {
      return res.json({ dropPoints: [] });
    }
    dropPoints = db.prepare(`
      SELECT dp.*,
             (SELECT COUNT(*) FROM users u WHERE u.drop_point_id = dp.id AND u.role = 'VRS') as vrsCount,
             (SELECT COUNT(*) FROM users u WHERE u.drop_point_id = dp.id AND u.role = 'FSS') as fssCount,
             (SELECT COUNT(*) FROM points_of_sale pos WHERE pos.drop_point_id = dp.id) as posCount,
             (SELECT u.first_name || ' ' || u.last_name FROM users u WHERE u.drop_point_id = dp.id AND u.role = 'SALES_ADMIN' LIMIT 1) as salesAdminName
      FROM drop_points dp
      WHERE dp.id = ?
    `).all(user.dropPointId);
  }

  res.json({ dropPoints });
});

// GET single Drop Point
router.get('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const dpId = parseInt(req.params.id, 10);

  if (user.role !== 'SALES_ADMIN_NATIONAL' && user.dropPointId !== dpId) {
    return res.status(403).json({ error: 'Accès refusé. Ce Drop Point est hors de votre périmètre.' });
  }

  const dropPoint = db.prepare('SELECT * FROM drop_points WHERE id = ?').get(dpId);
  if (!dropPoint) {
    return res.status(404).json({ error: 'Drop Point non trouvé.' });
  }

  const sectors = db.prepare('SELECT * FROM sectors WHERE drop_point_id = ? ORDER BY code ASC').all(dpId);
  const staff = db.prepare(`
    SELECT id, public_id as publicId, role, first_name as firstName, last_name as lastName, email, phone, status
    FROM users WHERE drop_point_id = ?
  `).all(dpId);

  res.json({ dropPoint, sectors, staff });
});

// CREATE Drop Point (SAN only)
router.post('/', requireAuth, requireRole('SALES_ADMIN_NATIONAL'), (req: AuthRequest, res: Response) => {
  const { name, code, city, neighborhood, address, phone, latitude, longitude, status } = req.body;

  if (!name || !code || !city || !address) {
    return res.status(400).json({ error: 'Nom, code, ville et adresse sont obligatoires.' });
  }

  const cleanCode = String(code).trim().toUpperCase();

  const existing = db.prepare('SELECT id FROM drop_points WHERE code = ?').get(cleanCode);
  if (existing) {
    return res.status(400).json({ error: `Le code Drop Point '${cleanCode}' est déjà utilisé.` });
  }

  try {
    const insertStmt = db.prepare(`
      INSERT INTO drop_points (code, name, city, neighborhood, address, phone, latitude, longitude, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      cleanCode,
      name,
      city,
      neighborhood || '',
      address,
      phone || '',
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      status || 'ACTIF'
    );

    const newId = result.lastInsertRowid as number;

    // Create a default sector
    db.prepare(`
      INSERT INTO sectors (drop_point_id, neighborhood, code, name)
      VALUES (?, ?, 'SEC-01', ?)
    `).run(newId, neighborhood || city, `Secteur 01 - ${neighborhood || city} Central`);

    // Initialize stock records for all active products with 0 cartons
    const products = db.prepare('SELECT id FROM products').all() as { id: number }[];
    const stockStmt = db.prepare(`
      INSERT OR IGNORE INTO drop_point_stocks (drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
      VALUES (?, ?, 0, 0, 20)
    `);
    for (const prod of products) {
      stockStmt.run(newId, prod.id);
    }

    logActivity(req.user!, 'CREATE_DROP_POINT', `DROP_POINT_${cleanCode}`, `Création du Drop Point ${name} (${cleanCode})`, req);

    const created = db.prepare('SELECT * FROM drop_points WHERE id = ?').get(newId);
    res.status(201).json({ dropPoint: created, message: 'Drop Point créé avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la création du Drop Point.' });
  }
});

// UPDATE Drop Point (SAN only)
router.patch('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const dpId = parseInt(req.params.id, 10);

  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès non autorisé. Seul le Sales Admin National (SAN) peut modifier un Drop Point.' });
  }

  const { name, city, neighborhood, address, phone, latitude, longitude, status } = req.body;

  db.prepare(`
    UPDATE drop_points
    SET name = COALESCE(?, name),
        city = COALESCE(?, city),
        neighborhood = COALESCE(?, neighborhood),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        status = COALESCE(?, status)
    WHERE id = ?
  `).run(name || null, city || null, neighborhood || null, address || null, phone || null, latitude || null, longitude || null, status || null, dpId);

  logActivity(user, 'UPDATE_DROP_POINT', `DROP_POINT_${dpId}`, `Mise à jour du Drop Point #${dpId}`, req);

  const updated = db.prepare('SELECT * FROM drop_points WHERE id = ?').get(dpId);
  res.json({ dropPoint: updated, message: 'Drop Point mis à jour avec succès.' });
});

// GET Sectors for Drop Point
router.get('/:id/sectors', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const dpId = parseInt(req.params.id, 10);

  if (user.role !== 'SALES_ADMIN_NATIONAL' && user.dropPointId !== dpId) {
    return res.status(403).json({ error: 'Accès refusé pour ce Drop Point.' });
  }

  const sectors = db.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM points_of_sale WHERE sector_id = s.id) as posCount,
           (SELECT COUNT(*) FROM users WHERE sector_id = s.id) as vrsCount
    FROM sectors s
    WHERE s.drop_point_id = ?
    ORDER BY s.code ASC
  `).all(dpId);

  res.json({ sectors });
});

// POST new Sector (SAN only)
router.post('/:id/sectors', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const dpId = parseInt(req.params.id, 10);

  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès non autorisé. Seul le Sales Admin National (SAN) peut créer des secteurs.' });
  }

  const { name, code, neighborhood } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Nom et code du secteur requis.' });
  }

  const cleanCode = String(code).trim().toUpperCase();

  try {
    const result = db.prepare(`
      INSERT INTO sectors (drop_point_id, neighborhood, code, name)
      VALUES (?, ?, ?, ?)
    `).run(dpId, neighborhood || '', cleanCode, name);

    const sector = db.prepare('SELECT * FROM sectors WHERE id = ?').get(result.lastInsertRowid);
    logActivity(user, 'CREATE_SECTOR', `SECTOR_${cleanCode}`, `Création du secteur ${name} dans DP #${dpId}`, req);

    res.status(201).json({ sector, message: 'Secteur créé avec succès.' });
  } catch (err: any) {
    res.status(400).json({ error: 'Ce code de secteur existe déjà pour ce Drop Point.' });
  }
});

export default router;
