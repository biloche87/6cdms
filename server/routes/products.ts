import { Router, type Response } from 'express';
import { db } from '../db.ts';
import { requireAuth, requireRole, type AuthRequest, logActivity } from '../auth.ts';

const router = Router();

// GET all products
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { dropPointId } = req.query;

  const dpId = (dropPointId && dropPointId !== 'ALL')
    ? parseInt(String(dropPointId), 10)
    : (user.dropPointId || null);

  const stockSubquery = dpId
    ? `(SELECT COALESCE(SUM(dps.available_quantity), 0) FROM drop_point_stocks dps WHERE dps.product_id = p.id AND dps.drop_point_id = ${dpId}) as availableStock,
       (SELECT COALESCE(SUM(dps.available_quantity), 0) FROM drop_point_stocks dps WHERE dps.product_id = p.id AND dps.drop_point_id = ${dpId}) as dropPointAvailableStock,
       (SELECT COALESCE(SUM(vs.available_quantity), 0) FROM vrs_stocks vs WHERE vs.product_id = p.id AND vs.vrs_id = ${user.id}) as vrsStock`
    : `(SELECT COALESCE(SUM(dps.available_quantity), 0) FROM drop_point_stocks dps WHERE dps.product_id = p.id) as availableStock,
       (SELECT COALESCE(SUM(dps.available_quantity), 0) FROM drop_point_stocks dps WHERE dps.product_id = p.id) as dropPointAvailableStock,
       (SELECT COALESCE(SUM(vs.available_quantity), 0) FROM vrs_stocks vs WHERE vs.product_id = p.id AND vs.vrs_id = ${user.id}) as vrsStock`;

  let query = `
    SELECT p.id,
           p.category_id as categoryId,
           p.category_id,
           p.drop_point_id as dropPointId,
           p.drop_point_id,
           p.sub_category as subCategory,
           p.sub_category,
           p.name,
           p.reference,
           p.unit,
           p.units_per_carton as unitsPerCarton,
           p.units_per_carton,
           p.unit_price as unitPrice,
           p.unit_price,
           p.dp_cession_price as dpCessionPrice,
           p.dp_cession_price,
           p.vrs_cession_price as vrsCessionPrice,
           p.vrs_cession_price,
           p.status,
           p.created_at as createdAt,
           p.created_at,
           c.name as categoryName,
           c.name as category_name,
           dp.name as dropPointName,
           dp.name as drop_point_name,
           dp.code as dropPointCode,
           dp.code as drop_point_code,
           ${stockSubquery}
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN drop_points dp ON p.drop_point_id = dp.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (dropPointId && dropPointId !== 'ALL') {
    query += ` AND (p.drop_point_id = ? OR EXISTS (SELECT 1 FROM drop_point_stocks dps WHERE dps.product_id = p.id AND dps.drop_point_id = ? AND dps.available_quantity > 0))`;
    params.push(dropPointId, dropPointId);
  }

  query += ` ORDER BY c.name, p.name ASC`;

  const products = db.prepare(query).all(...params);
  res.json({ products });
});

// GET categories
router.get('/categories', requireAuth, (_req, res) => {
  const categories = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as productCount
    FROM categories c
    ORDER BY c.name ASC
  `).all();

  res.json({ categories });
});

// POST new product (SAN only - linked to a Drop Point)
router.post('/', requireAuth, requireRole('SALES_ADMIN_NATIONAL'), (req: AuthRequest, res: Response) => {
  const {
    categoryId,
    categoryName,
    subCategory,
    name,
    reference,
    unit,
    unitsPerCarton,
    unitPrice,
    status,
    dropPointId,
    initialStockQuantity,
    alertThreshold,
  } = req.body;

  if (!name || !subCategory || !unitsPerCarton || !unitPrice) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (Désignation, Sous-catégorie, Conditionnement, Prix).' });
  }

  if (!dropPointId) {
    return res.status(400).json({ error: 'Le Drop Point (Dépôt) de rattachement est obligatoire.' });
  }

  const targetDp = db.prepare('SELECT id, name, code FROM drop_points WHERE id = ?').get(parseInt(dropPointId, 10)) as
    | { id: number; name: string; code: string }
    | undefined;
  if (!targetDp) {
    return res.status(400).json({ error: 'Drop Point sélectionné invalide ou introuvable.' });
  }

  let finalCatId = categoryId;
  if (!finalCatId && categoryName) {
    const existingCat = db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryName) as { id: number } | undefined;
    if (existingCat) {
      finalCatId = existingCat.id;
    } else {
      const newCat = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(categoryName, `Gamme ${categoryName}`);
      finalCatId = newCat.lastInsertRowid;
    }
  }

  if (!finalCatId) {
    return res.status(400).json({ error: 'Catégorie requise.' });
  }

  const cleanRef = reference ? String(reference).trim().toUpperCase() : `PRD-${Date.now().toString().slice(-6)}`;

  try {
    const result = db.prepare(`
      INSERT INTO products (category_id, drop_point_id, sub_category, name, reference, unit, units_per_carton, unit_price, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finalCatId,
      targetDp.id,
      subCategory,
      name,
      cleanRef,
      unit || 'Carton',
      parseInt(unitsPerCarton, 10),
      parseFloat(unitPrice),
      status || 'ACTIF'
    );

    const newProductId = result.lastInsertRowid as number;
    const initialQty = Math.max(0, parseInt(initialStockQuantity, 10) || 0);
    const threshold = Math.max(1, parseInt(alertThreshold, 10) || 20);

    // Stock initial pour le Drop Point sélectionné
    db.prepare(`
      INSERT OR REPLACE INTO drop_point_stocks (drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
      VALUES (?, ?, ?, 0, ?)
    `).run(targetDp.id, newProductId, initialQty, threshold);

    // Initialiser les autres Drop Points avec stock 0
    const otherDropPoints = db.prepare('SELECT id FROM drop_points WHERE id != ?').all(targetDp.id) as { id: number }[];
    const otherDpStockStmt = db.prepare(`
      INSERT OR IGNORE INTO drop_point_stocks (drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
      VALUES (?, ?, 0, 0, 20)
    `);
    for (const dp of otherDropPoints) {
      otherDpStockStmt.run(dp.id, newProductId);
    }

    if (initialQty > 0) {
      const mvtRef = `REC-INIT-${Date.now().toString().slice(-6)}`;
      db.prepare(`
        INSERT INTO stock_movements (
          reference, movement_type, target_role, target_id, drop_point_id, product_id,
          quantity, stock_before, stock_after, related_entity_type, notes, created_by_user_id
        ) VALUES (?, 'RECEIPT', 'DROP_POINT', ?, ?, ?, ?, 0, ?, 'INITIAL_PRODUCT_STOCK', ?, ?)
      `).run(
        mvtRef,
        targetDp.id,
        targetDp.id,
        newProductId,
        initialQty,
        initialQty,
        `Stock initial de ${initialQty} cartons alloué au Drop Point ${targetDp.name} lors de la création du produit`,
        req.user?.id
      );
    }

    logActivity(
      req.user!,
      'CREATE_PRODUCT',
      cleanRef,
      `Création du produit ${name} (${cleanRef}) rattaché au Drop Point ${targetDp.name} [${targetDp.code}] (Stock initial: ${initialQty} cartons)`,
      req
    );

    const created = db.prepare(`
      SELECT p.id,
             p.category_id as categoryId,
             p.category_id,
             p.drop_point_id as dropPointId,
             p.drop_point_id,
             p.sub_category as subCategory,
             p.sub_category,
             p.name,
             p.reference,
             p.unit,
             p.units_per_carton as unitsPerCarton,
             p.units_per_carton,
             p.unit_price as unitPrice,
             p.unit_price,
             p.status,
             p.created_at as createdAt,
             p.created_at,
             c.name as categoryName,
             c.name as category_name,
             dp.name as dropPointName,
             dp.name as drop_point_name,
             dp.code as dropPointCode,
             dp.code as drop_point_code,
             ? as availableStock
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN drop_points dp ON p.drop_point_id = dp.id
      WHERE p.id = ?
    `).get(initialQty, newProductId);

    res.status(201).json({
      product: created,
      message: `Produit rattaché avec succès au Drop Point ${targetDp.name} (${initialQty} cartons en stock).`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de l\'ajout du produit.' });
  }
});

// PATCH product (SAN only)
router.patch('/:id', requireAuth, requireRole('SALES_ADMIN_NATIONAL'), (req: AuthRequest, res: Response) => {
  const prodId = parseInt(req.params.id, 10);
  const { name, subCategory, unitsPerCarton, unitPrice, status, dropPointId } = req.body;

  db.prepare(`
    UPDATE products
    SET name = COALESCE(?, name),
        sub_category = COALESCE(?, sub_category),
        units_per_carton = COALESCE(?, units_per_carton),
        unit_price = COALESCE(?, unit_price),
        status = COALESCE(?, status),
        drop_point_id = COALESCE(?, drop_point_id)
    WHERE id = ?
  `).run(
    name || null,
    subCategory || null,
    unitsPerCarton !== undefined ? parseInt(unitsPerCarton, 10) : null,
    unitPrice !== undefined ? parseFloat(unitPrice) : null,
    status || null,
    dropPointId !== undefined ? parseInt(dropPointId, 10) : null,
    prodId
  );

  logActivity(req.user!, 'UPDATE_PRODUCT', `PRODUCT_${prodId}`, `Mise à jour produit #${prodId}`, req);

  const updated = db.prepare(`
    SELECT p.id,
           p.category_id as categoryId,
           p.category_id,
           p.drop_point_id as dropPointId,
           p.drop_point_id,
           p.sub_category as subCategory,
           p.sub_category,
           p.name,
           p.reference,
           p.unit,
           p.units_per_carton as unitsPerCarton,
           p.units_per_carton,
           p.unit_price as unitPrice,
           p.unit_price,
           p.status,
           p.created_at as createdAt,
           p.created_at,
           c.name as categoryName,
           c.name as category_name,
           dp.name as dropPointName,
           dp.name as drop_point_name,
           dp.code as dropPointCode,
           dp.code as drop_point_code,
           (SELECT COALESCE(SUM(dps.available_quantity), 0) FROM drop_point_stocks dps WHERE dps.product_id = p.id) as availableStock
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN drop_points dp ON p.drop_point_id = dp.id
    WHERE p.id = ?
  `).get(prodId);
  res.json({ product: updated, message: 'Produit mis à jour avec succès.' });
});

export default router;
