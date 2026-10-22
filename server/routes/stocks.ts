import { Router, type Response } from 'express';
import { db, backupVrsStocksAndSales, triggerMasterBackup } from '../db.ts';
import { requireAuth, requireRole, type AuthRequest, logActivity, createNotification } from '../auth.ts';

const router = Router();

// GET Drop Point stocks
router.get('/drop-point', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { dropPointId } = req.query;

  let query = `
    SELECT dps.id,
           dps.drop_point_id as dropPointId,
           dps.drop_point_id,
           dps.product_id as productId,
           dps.product_id,
           dps.available_quantity as availableQuantity,
           dps.available_quantity,
           dps.reserved_quantity as reservedQuantity,
           dps.reserved_quantity,
           dps.alert_threshold as alertThreshold,
           dps.alert_threshold,
           dps.updated_at as updatedAt,
           p.name as productName, p.reference as productRef, p.sub_category as subCategory,
           p.unit, p.units_per_carton as unitsPerCarton, p.unit_price as unitPrice,
           c.name as categoryName,
           dp.name as dropPointName, dp.code as dropPointCode,
           (dps.available_quantity <= dps.alert_threshold) as isLowStock
    FROM drop_point_stocks dps
    JOIN products p ON dps.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN drop_points dp ON dps.drop_point_id = dp.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'SALES_ADMIN_NATIONAL') {
    if (dropPointId) {
      query += ' AND dps.drop_point_id = ?';
      params.push(dropPointId);
    }
  } else {
    query += ' AND dps.drop_point_id = ?';
    params.push(user.dropPointId);
  }

  query += ' ORDER BY dp.name, c.name, p.name ASC';

  const stocks = db.prepare(query).all(...params);
  res.json({ stocks });
});

// GET VRS personal stock
router.get('/vrs', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { vrsId, dropPointId } = req.query;

  let query = `
    SELECT MAX(vs.id) as id,
           vs.vrs_id as vrsId,
           vs.vrs_id,
           vs.drop_point_id as dropPointId,
           vs.drop_point_id,
           vs.product_id as productId,
           vs.product_id,
           MAX(vs.available_quantity) as availableQuantity,
           MAX(vs.available_quantity) as available_quantity,
           MAX(vs.reserved_quantity) as reservedQuantity,
           MAX(vs.reserved_quantity) as reserved_quantity,
           MAX(vs.alert_threshold) as alertThreshold,
           MAX(vs.alert_threshold) as alert_threshold,
           MAX(vs.updated_at) as updatedAt,
           p.name as productName, p.reference as productRef, p.sub_category as subCategory,
           p.unit, p.units_per_carton as unitsPerCarton, p.unit_price as unitPrice,
           c.name as categoryName,
           u.first_name || ' ' || u.last_name as vrsName,
           u.public_id as vrsPublicId,
           dp.name as dropPointName,
           (MAX(vs.available_quantity) <= MAX(vs.alert_threshold)) as isLowStock,
           COALESCE((
             SELECT dps.available_quantity
             FROM drop_point_stocks dps
             WHERE dps.drop_point_id = COALESCE(u.drop_point_id, vs.drop_point_id) AND dps.product_id = vs.product_id
             LIMIT 1
           ), 0) as dropPointAvailableQuantity,
           COALESCE((
             SELECT SUM(si.quantity_cartons)
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE s.vrs_id = vs.vrs_id
               AND si.product_id = vs.product_id
               AND s.created_at >= datetime('now', '-30 days')
           ), 0) as sales30dCartons,
           EXISTS(
             SELECT 1
             FROM supply_request_items sri
             JOIN supply_requests sr ON sri.request_id = sr.id
             WHERE sr.vrs_id = vs.vrs_id
               AND sri.product_id = vs.product_id
               AND UPPER(sr.status) IN ('DEMANDEE', 'DEMANDÉE')
           ) as hasPendingRequest
    FROM vrs_stocks vs
    JOIN products p ON vs.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN users u ON vs.vrs_id = u.id
    JOIN drop_points dp ON vs.drop_point_id = dp.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'VRS') {
    query += ' AND vs.vrs_id = ?';
    params.push(user.id);
  } else if (user.role === 'FSS') {
    query += ' AND vs.drop_point_id = ? AND (u.fss_id = ? OR vs.vrs_id = ?)';
    params.push(user.dropPointId, user.id, user.id);
  } else if (user.role === 'SALES_ADMIN') {
    query += ' AND vs.drop_point_id = ?';
    params.push(user.dropPointId);
    if (vrsId) {
      query += ' AND vs.vrs_id = ?';
      params.push(vrsId);
    }
  } else {
    // SALES_ADMIN_NATIONAL
    if (dropPointId) {
      query += ' AND vs.drop_point_id = ?';
      params.push(dropPointId);
    }
    if (vrsId) {
      query += ' AND vs.vrs_id = ?';
      params.push(vrsId);
    }
  }

  query += ' GROUP BY vs.vrs_id, vs.product_id';
  query += ' ORDER BY u.first_name, c.name, p.name ASC';

  const stocks = db.prepare(query).all(...params);
  res.json({ stocks });
});

// POST new stock receipt (BL) (Section 18)
router.post('/receipts', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;

  if (user.role !== 'SALES_ADMIN_NATIONAL' && user.role !== 'SALES_ADMIN') {
    return res.status(403).json({
      error: "Seul le Sales Admin ou le Sales Admin National peut enregistrer les réceptions de stock."
    });
  }

  const { dropPointId, deliveryNoteNumber, supplier, receiptDate, observations, attachmentUrl, items } = req.body;

  if (!deliveryNoteNumber || !supplier || !receiptDate || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (numéro BL, fournisseur, date, produits).' });
  }

  const targetDpId = user.role === 'SALES_ADMIN_NATIONAL'
    ? (dropPointId ? parseInt(dropPointId, 10) : null)
    : (user.dropPointId || (dropPointId ? parseInt(dropPointId, 10) : null));
  if (!targetDpId) {
    return res.status(400).json({ error: 'Drop Point requis.' });
  }

  // Generate unique receipt number
  const receiptNumber = `RCPT-${Date.now().toString().slice(-6)}`;

  // Atomic transaction
  const executeReceipt = db.transaction(() => {
    const rcptStmt = db.prepare(`
      INSERT INTO stock_receipts (receipt_number, delivery_note_number, drop_point_id, supplier, receipt_date, observations, attachment_url, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const rcptResult = rcptStmt.run(receiptNumber, deliveryNoteNumber, targetDpId, supplier, receiptDate, observations || '', attachmentUrl || null, user.id);
    const receiptId = rcptResult.lastInsertRowid as number;

    const itemStmt = db.prepare(`
      INSERT INTO stock_receipt_items (receipt_id, product_id, quantity_cartons)
      VALUES (?, ?, ?)
    `);

    for (const item of items) {
      const prodId = parseInt(item.productId, 10);
      const qty = parseInt(item.quantityCartons, 10);

      if (isNaN(qty) || qty <= 0) {
        throw new Error('La quantité en cartons doit être supérieure à zéro.');
      }

      // Check product exists
      const prod = db.prepare('SELECT name FROM products WHERE id = ?').get(prodId) as { name: string } | undefined;
      if (!prod) {
        throw new Error(`Produit #${prodId} introuvable.`);
      }

      // Insert item
      itemStmt.run(receiptId, prodId, qty);

      // Get current stock
      let currentStock = db.prepare(`
        SELECT available_quantity FROM drop_point_stocks WHERE drop_point_id = ? AND product_id = ?
      `).get(targetDpId, prodId) as { available_quantity: number } | undefined;

      const before = currentStock ? currentStock.available_quantity : 0;
      const after = before + qty;

      // Update or insert stock
      db.prepare(`
        INSERT INTO drop_point_stocks (drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
        VALUES (?, ?, ?, 0, 20)
        ON CONFLICT(drop_point_id, product_id)
        DO UPDATE SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP
      `).run(targetDpId, prodId, qty, qty);

      // Record movement
      db.prepare(`
        INSERT INTO stock_movements (
          reference, movement_type, target_role, target_id, drop_point_id, product_id,
          quantity, stock_before, stock_after, related_entity_type, related_entity_id, notes, created_by_user_id
        ) VALUES (?, 'RECEIPT', 'DROP_POINT', ?, ?, ?, ?, ?, ?, 'STOCK_RECEIPT', ?, ?, ?)
      `).run(
        `MVT-BL-${receiptId}-${prodId}`,
        targetDpId,
        targetDpId,
        prodId,
        qty,
        before,
        after,
        receiptId,
        `Réception BL ${deliveryNoteNumber} - ${prod.name} (+${qty} cartons)`,
        user.id
      );
    }

    return receiptId;
  });

  try {
    const receiptId = executeReceipt();

    logActivity(user, 'CREATE_RECEIPT', `BL_${deliveryNoteNumber}`, `Enregistrement réception BL ${deliveryNoteNumber} (${items.length} produits)`, req);
    createNotification(null, 'SALES_ADMIN', targetDpId, 'Nouvelle réception BL enregistrée', `Le BL ${deliveryNoteNumber} a été validé et le stock mis à jour.`, 'RECEIPT', '/receipts');
    triggerMasterBackup(false);

    res.status(201).json({
      receiptId,
      receiptNumber,
      message: `Réception BL ${deliveryNoteNumber} enregistrée avec succès. Le stock du Drop Point a été augmenté.`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la validation du bon de livraison.' });
  }
});

// GET stock receipts / BLs (Section 19)
router.get('/receipts', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { blNumber, date, dropPointId } = req.query;

  let query = `
    SELECT sr.id,
           sr.receipt_number as receiptNumber,
           sr.receipt_number,
           sr.delivery_note_number as deliveryNoteNumber,
           sr.delivery_note_number,
           sr.drop_point_id as dropPointId,
           sr.drop_point_id,
           sr.supplier,
           sr.receipt_date as receiptDate,
           sr.receipt_date,
           sr.observations,
           sr.attachment_url as attachmentUrl,
           sr.created_by_user_id as createdByUserId,
           sr.created_at as createdAt,
           sr.created_at,
           dp.name as dropPointName, dp.code as dropPointCode,
           u.first_name || ' ' || u.last_name as createdByName,
           (SELECT COUNT(*) FROM stock_receipt_items WHERE receipt_id = sr.id) as itemCount,
           (SELECT SUM(quantity_cartons) FROM stock_receipt_items WHERE receipt_id = sr.id) as totalCartons
    FROM stock_receipts sr
    JOIN drop_points dp ON sr.drop_point_id = dp.id
    JOIN users u ON sr.created_by_user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'SALES_ADMIN_NATIONAL') {
    if (dropPointId) {
      query += ' AND sr.drop_point_id = ?';
      params.push(dropPointId);
    }
  } else {
    query += ' AND sr.drop_point_id = ?';
    params.push(user.dropPointId);
  }

  if (blNumber) {
    query += ' AND UPPER(sr.delivery_note_number) LIKE ?';
    params.push(`%${String(blNumber).trim().toUpperCase()}%`);
  }

  if (date) {
    query += ' AND sr.receipt_date = ?';
    params.push(date);
  }

  query += ' ORDER BY sr.receipt_date DESC, sr.id DESC';

  const receipts = db.prepare(query).all(...params) as any[];

  // Attach items for each receipt
  for (const r of receipts) {
    r.items = db.prepare(`
      SELECT sri.*, p.name as productName, p.reference as productRef, c.name as categoryName
      FROM stock_receipt_items sri
      JOIN products p ON sri.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE sri.receipt_id = ?
    `).all(r.id);
  }

  res.json({ receipts });
});

// GET supply requests badge counts for realtime notification bubbles
router.get('/supply-requests/badge-counts', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;

  let pendingApprovalCount = 0;
  let readyForReceptionCount = 0;
  let pendingSaRequestsCount = 0;
  let pendingVrsRequestsCount = 0;
  let myPendingRequestsCount = 0;

  if (user.role === 'SALES_ADMIN_NATIONAL') {
    // SAN validates all Drop Point requests submitted by Sales Admins, plus can oversee VRS requests
    pendingSaRequestsCount = (db.prepare(`
      SELECT COUNT(*) as count FROM supply_requests
      WHERE status IN ('Demandée', 'DEMANDEE', 'ENVOYÉE', 'EN ATTENTE') AND requester_role = 'SALES_ADMIN'
    `).get() as any)?.count || 0;

    pendingVrsRequestsCount = (db.prepare(`
      SELECT COUNT(*) as count FROM supply_requests
      WHERE status IN ('Demandée', 'DEMANDEE', 'ENVOYÉE', 'EN ATTENTE') AND (requester_role = 'VRS' OR requester_role IS NULL)
    `).get() as any)?.count || 0;

    pendingApprovalCount = pendingSaRequestsCount + pendingVrsRequestsCount;
  } else if (user.role === 'SALES_ADMIN') {
    // SA ONLY validates pending requests from VRS (cannot validate their own SA requests)
    pendingApprovalCount = (db.prepare(`
      SELECT COUNT(*) as count FROM supply_requests
      WHERE status IN ('Demandée', 'DEMANDEE', 'ENVOYÉE', 'EN ATTENTE') AND drop_point_id = ? AND (requester_role = 'VRS' OR requester_role IS NULL)
    `).get(user.dropPointId || -1) as any)?.count || 0;

    // SA's own requests pending SAN approval
    myPendingRequestsCount = (db.prepare(`
      SELECT COUNT(*) as count FROM supply_requests
      WHERE status IN ('Demandée', 'DEMANDEE', 'ENVOYÉE', 'EN ATTENTE') AND vrs_id = ? AND requester_role = 'SALES_ADMIN'
    `).get(user.id) as any)?.count || 0;

    // SA's approved requests ready for Drop Point reception
    readyForReceptionCount = (db.prepare(`
      SELECT COUNT(*) as count FROM supply_requests
      WHERE status IN ('Validée', 'Partiellement validée', 'VALIDÉE', 'PARTIELLEMENT_VALIDÉE', 'APPROUVÉE', 'PRÉPARÉE', 'LIVRÉE') AND vrs_id = ? AND requester_role = 'SALES_ADMIN'
    `).get(user.id) as any)?.count || 0;
  } else if (user.role === 'FSS') {
    pendingApprovalCount = (db.prepare(`
      SELECT COUNT(*) as count FROM supply_requests sr
      JOIN users vrs ON sr.vrs_id = vrs.id
      WHERE sr.status IN ('Demandée', 'DEMANDEE', 'ENVOYÉE', 'EN ATTENTE') AND sr.drop_point_id = ? AND vrs.fss_id = ?
    `).get(user.dropPointId || -1, user.id) as any)?.count || 0;
  } else if (user.role === 'VRS') {
    pendingApprovalCount = (db.prepare(`
      SELECT COUNT(*) as count FROM supply_requests
      WHERE status IN ('Demandée', 'DEMANDEE', 'ENVOYÉE', 'EN ATTENTE') AND vrs_id = ?
    `).get(user.id) as any)?.count || 0;

    readyForReceptionCount = (db.prepare(`
      SELECT COUNT(*) as count FROM supply_requests
      WHERE status IN ('Validée', 'Partiellement validée', 'VALIDÉE', 'PARTIELLEMENT_VALIDÉE', 'APPROUVÉE', 'PRÉPARÉE', 'LIVRÉE') AND vrs_id = ?
    `).get(user.id) as any)?.count || 0;
  }

  res.json({
    pendingApprovalCount,
    readyForReceptionCount,
    pendingSaRequestsCount,
    pendingVrsRequestsCount,
    myPendingRequestsCount,
    totalBadgeCount: user.role === 'VRS' ? (pendingApprovalCount + readyForReceptionCount) : (pendingApprovalCount + readyForReceptionCount)
  });
});

// GET supply requests
router.get('/supply-requests', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { status, dropPointId, requesterRole } = req.query;

  let query = `
    SELECT sr.id,
           sr.request_number as requestNumber,
           sr.request_number,
           sr.vrs_id as vrsId,
           sr.vrs_id,
           COALESCE(sr.requester_role, 'VRS') as requesterRole,
           COALESCE(sr.requester_role, 'VRS') as requester_role,
           sr.drop_point_id as dropPointId,
           sr.drop_point_id,
           sr.status,
           sr.total_cartons as totalCartons,
           sr.total_cartons,
           sr.desired_loading_date as desiredLoadingDate,
           sr.rejection_reason as rejectionReason,
           sr.notes,
           sr.bl_number as blNumber,
           sr.bl_attachment as blAttachment,
           sr.bl_file_name as blFileName,
           sr.bl_file_type as blFileType,
           sr.processed_by_user_id as processedByUserId,
           sr.created_at as createdAt,
           sr.created_at,
           sr.updated_at as updatedAt,
           vrs.first_name || ' ' || vrs.last_name as vrsName,
           vrs.first_name || ' ' || vrs.last_name as requesterName,
           vrs.public_id as vrsPublicId,
           vrs.public_id as requesterPublicId,
           vrs.role as requesterUserRole,
           dp.name as dropPointName, dp.code as dropPointCode
    FROM supply_requests sr
    JOIN users vrs ON sr.vrs_id = vrs.id
    JOIN drop_points dp ON sr.drop_point_id = dp.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'VRS') {
    query += ' AND sr.vrs_id = ?';
    params.push(user.id);
  } else if (user.role === 'FSS') {
    query += ' AND sr.drop_point_id = ? AND vrs.fss_id = ?';
    params.push(user.dropPointId, user.id);
  } else if (user.role === 'SALES_ADMIN') {
    query += ' AND sr.drop_point_id = ?';
    params.push(user.dropPointId);
  } else {
    // SAN
    if (dropPointId) {
      query += ' AND sr.drop_point_id = ?';
      params.push(dropPointId);
    }
  }

  if (requesterRole) {
    query += ' AND sr.requester_role = ?';
    params.push(requesterRole);
  }

  if (status) {
    query += ' AND sr.status = ?';
    params.push(status);
  }

  query += ' ORDER BY sr.created_at DESC';

  const requests = db.prepare(query).all(...params) as any[];

  for (const r of requests) {
    r.items = db.prepare(`
      SELECT sri.id,
             sri.request_id as requestId,
             sri.request_id,
             sri.product_id as productId,
             sri.product_id,
             sri.quantity_requested as quantityRequested,
             sri.quantity_requested as quantityCartons,
             sri.quantity_requested,
             sri.quantity_approved as quantityApproved,
             sri.quantity_approved,
             p.name as productName, p.reference as productRef, c.name as categoryName,
             COALESCE(dps.available_quantity, 0) as availableDropPointStock
      FROM supply_request_items sri
      JOIN products p ON sri.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN drop_point_stocks dps ON dps.drop_point_id = ? AND dps.product_id = sri.product_id
      WHERE sri.request_id = ?
    `).all(r.dropPointId || r.drop_point_id, r.id);
  }

  res.json({ requests });
});

// POST new supply request (VRS or SA)
router.post('/supply-requests', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;

  if (user.role === 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({
      error: 'Le Sales Admin National n\'a pas besoin de faire de demande d\'approvisionnement. Il consulte, valide ou rejette les demandes du réseau.'
    });
  }

  const { items, notes, desiredLoadingDate, blNumber, blAttachment, blFileName, blFileType } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La demande doit contenir au moins un produit.' });
  }

  const isSA = user.role === 'SALES_ADMIN';
  const requesterRole = isSA ? 'SALES_ADMIN' : 'VRS';
  const vrsId = user.id; // Requester user id
  const dpId = user.dropPointId;

  if (!dpId) {
    return res.status(400).json({ error: 'Drop Point requis pour cette demande.' });
  }

  const dp = db.prepare('SELECT name, code FROM drop_points WHERE id = ?').get(dpId) as { name: string; code: string } | undefined;
  const dpName = dp ? dp.name : 'Dépôt';

  const requestNumber = `APP-${Date.now().toString().slice(-6)}`;

  let totalCartons = 0;
  for (const it of items) {
    const qty = parseInt(it.quantityRequested, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Toutes les quantités demandées doivent être supérieures à 0.' });
    }
    totalCartons += qty;
  }

  const createRequestTx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO supply_requests (request_number, vrs_id, drop_point_id, requester_role, status, total_cartons, notes, desired_loading_date, bl_number, bl_attachment, bl_file_name, bl_file_type)
      VALUES (?, ?, ?, ?, 'Demandée', ?, ?, ?, ?, ?, ?, ?)
    `).run(requestNumber, vrsId, dpId, requesterRole, totalCartons, notes || '', desiredLoadingDate || null, blNumber || null, blAttachment || null, blFileName || null, blFileType || null);

    const reqId = result.lastInsertRowid as number;

    const itemStmt = db.prepare(`
      INSERT INTO supply_request_items (request_id, product_id, quantity_requested, quantity_approved)
      VALUES (?, ?, ?, ?)
    `);

    for (const it of items) {
      const prodId = parseInt(it.productId, 10);
      const qty = parseInt(it.quantityRequested, 10);
      itemStmt.run(reqId, prodId, qty, qty);
    }

    return reqId;
  });

  try {
    const reqId = createRequestTx();

    logActivity(user, 'CREATE_SUPPLY_REQUEST', requestNumber, `Demande d'approvisionnement #${requestNumber} (${totalCartons} cartons, statut : Demandée) initiée par ${isSA ? 'Sales Admin' : 'VRS'} ${user.firstName} ${user.lastName}`, req);

    if (isSA) {
      // SA to SAN workflow: Transmitted to Sales Admin National (SAN)
      createNotification(
        null,
        'SALES_ADMIN_NATIONAL',
        null,
        'Nouvelle demande d\'approvisionnement Dépôt',
        `Le Sales Admin ${user.firstName} ${user.lastName} a envoyé une demande d'approvisionnement de ${totalCartons} carton(s) pour le Dépôt ${dpName} (${requestNumber}). Statut initial : Demandée.`,
        'SUPPLY',
        'supply-requests'
      );

      res.status(201).json({
        requestId: reqId,
        requestNumber,
        requesterRole: 'SALES_ADMIN',
        status: 'Demandée',
        message: `Demande d'approvisionnement ${requestNumber} pour le Dépôt ${dpName} transmise au Sales Admin National (SAN) pour validation.`
      });
    } else {
      // VRS to SA workflow: Transmitted to Sales Admin of the Drop Point
      createNotification(
        null,
        'SALES_ADMIN',
        dpId,
        'Nouveau chargement Vendeur (VRS)',
        `Le vendeur ${user.firstName} ${user.lastName} a soumis un chargement de ${totalCartons} carton(s) (${requestNumber})${desiredLoadingDate ? ` (date souhaitée : ${desiredLoadingDate})` : ''}. Statut : Demandée.`,
        'SUPPLY',
        'supply-requests'
      );

      res.status(201).json({
        requestId: reqId,
        requestNumber,
        requesterRole: 'VRS',
        status: 'Demandée',
        message: `Demande d'approvisionnement ${requestNumber} enregistrée avec succès (Statut : Demandée). Transmise au Sales Admin.`
      });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la création de la demande.' });
  }
});

// PATCH supply request status (Workflow approval & reception)
router.patch('/supply-requests/:id/status', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const reqId = parseInt(req.params.id, 10);
  const { newStatus, approvedItems, blNumber, blAttachment, blFileName, blFileType, rejectionReason } = req.body;

  const validStatuses = [
    'Demandée',
    'Validée',
    'Partiellement validée',
    'Rejetée',
    'Chargée',
    'APPROUVÉE',
    'PRÉPARÉE',
    'LIVRÉE',
    'RÉCEPTIONNÉE',
    'REJETÉE'
  ];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: `Statut invalide. Statuts acceptés: ${validStatuses.join(', ')}` });
  }

  // Normalize status for consistent processing
  let targetStatus = newStatus;
  if (newStatus === 'APPROUVÉE') targetStatus = 'Validée';
  if (newStatus === 'REJETÉE') targetStatus = 'Rejetée';
  if (newStatus === 'RÉCEPTIONNÉE') targetStatus = 'Chargée';

  const supplyReq = db.prepare(`
    SELECT sr.*,
           vrs.first_name as requesterFirstName,
           vrs.last_name as requesterLastName,
           vrs.public_id as requesterPublicId,
           vrs.role as requesterRoleInUsers,
           dp.name as dropPointName
    FROM supply_requests sr
    JOIN users vrs ON sr.vrs_id = vrs.id
    JOIN drop_points dp ON sr.drop_point_id = dp.id
    WHERE sr.id = ?
  `).get(reqId) as any;

  if (!supplyReq) {
    return res.status(404).json({ error: 'Demande d\'approvisionnement introuvable.' });
  }

  const isSaRequest = (supplyReq.requester_role === 'SALES_ADMIN' || supplyReq.requesterRoleInUsers === 'SALES_ADMIN');

  // Permission check:
  if (isSaRequest) {
    if (targetStatus === 'Validée' || targetStatus === 'Partiellement validée' || targetStatus === 'Rejetée') {
      if (user.role !== 'SALES_ADMIN_NATIONAL') {
        return res.status(403).json({
          error: 'Action non autorisée. La demande d\'approvisionnement d\'un Dépôt par son Sales Admin doit obligatoirement être validée ou rejetée par le Sales Admin National (SAN). Le Sales Admin ne peut pas s\'auto-valider.'
        });
      }
    } else if (targetStatus === 'Chargée') {
      if (user.role !== 'SALES_ADMIN' && user.role !== 'SALES_ADMIN_NATIONAL') {
        return res.status(403).json({ error: 'Seul le Sales Admin du Dépôt ou le SAN peut confirmer la réception du réapprovisionnement Dépôt.' });
      }
      if (user.role === 'SALES_ADMIN' && user.dropPointId !== supplyReq.drop_point_id) {
        return res.status(403).json({ error: 'Ce Dépôt n\'est pas rattaché à votre compte Sales Admin.' });
      }
    }
  } else {
    // VRS request:
    if (user.role === 'VRS') {
      if (Number(supplyReq.vrs_id) !== Number(user.id)) {
        return res.status(403).json({ error: 'Cette demande ne vous appartient pas.' });
      }
      if (targetStatus !== 'Chargée') {
        return res.status(403).json({ error: 'En tant que vendeur (VRS), vous ne pouvez que confirmer que la marchandise est chargée.' });
      }
    } else if (user.role === 'SALES_ADMIN') {
      if (user.dropPointId !== supplyReq.drop_point_id) {
        return res.status(403).json({ error: 'Cette demande n\'appartient pas à votre Drop Point.' });
      }
    } else if (user.role !== 'SALES_ADMIN_NATIONAL') {
      return res.status(403).json({ error: 'Action non autorisée sur cette demande d\'approvisionnement.' });
    }
  }

  const items = db.prepare('SELECT * FROM supply_request_items WHERE request_id = ?').all(reqId) as any[];

  // Execute workflow transaction
  const executeStatusChange = db.transaction(() => {
    // If approved or partially approved, update approved quantities if provided
    let totalApproved = 0;
    let isPartial = false;

    if (Array.isArray(approvedItems) && approvedItems.length > 0) {
      for (const ai of approvedItems) {
        const approvedQty = Math.max(0, parseInt(ai.quantityApproved, 10) || 0);
        db.prepare('UPDATE supply_request_items SET quantity_approved = ? WHERE id = ?').run(approvedQty, ai.id);
        totalApproved += approvedQty;
        const origItem = items.find((it) => it.id === ai.id);
        if (origItem && approvedQty < origItem.quantity_requested) {
          isPartial = true;
        }
      }
      if (isPartial && targetStatus === 'Validée') {
        targetStatus = 'Partiellement validée';
      }
    } else {
      for (const it of items) {
        const curAppr = it.quantity_approved !== null && it.quantity_approved !== undefined ? it.quantity_approved : it.quantity_requested;
        totalApproved += curAppr;
        if (curAppr < it.quantity_requested) {
          isPartial = true;
        }
      }
      if (isPartial && targetStatus === 'Validée') {
        targetStatus = 'Partiellement validée';
      }
    }

    // RULE: Le stock du VRS n'augmente qu'au statut "Chargée", JAMAIS à la simple demande ni à la validation.
    // IF CHARGÉE:
    if (targetStatus === 'Chargée') {
      const nowTs = Date.now();

      // Case A: Sales Admin Drop Point supply request (Restocking the Drop Point from National supply)
      if (isSaRequest) {
        for (const it of items) {
          const prodId = it.product_id;
          const qtyReceived = it.quantity_approved !== null && it.quantity_approved !== undefined ? it.quantity_approved : it.quantity_requested;

          const dpStock = db.prepare(`
            SELECT available_quantity FROM drop_point_stocks WHERE drop_point_id = ? AND product_id = ?
          `).get(supplyReq.drop_point_id, prodId) as { available_quantity: number } | undefined;

          const currentDpQty = dpStock ? dpStock.available_quantity : 0;
          const newDpQty = currentDpQty + qtyReceived;

          db.prepare(`
            INSERT INTO drop_point_stocks (drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
            VALUES (?, ?, ?, 0, 10)
            ON CONFLICT(drop_point_id, product_id)
            DO UPDATE SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP
          `).run(supplyReq.drop_point_id, prodId, newDpQty, qtyReceived);

          db.prepare(`
            INSERT INTO stock_movements (
              reference, movement_type, source_role, source_id, target_role, target_id,
              drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type, related_entity_id, notes, created_by_user_id
            ) VALUES (?, 'RECEIPT', 'NATIONAL', 1, 'DROP_POINT', ?, ?, ?, ?, ?, ?, 'SUPPLY_REQUEST', ?, ?, ?)
          `).run(
            `MVT-SUPP-DP-IN-${reqId}-${prodId}-${nowTs}`,
            supplyReq.drop_point_id,
            supplyReq.drop_point_id,
            prodId,
            qtyReceived,
            currentDpQty,
            newDpQty,
            reqId,
            `Réception 6C Distribution #${supplyReq.request_number} validé par le SAN (+${qtyReceived} cartons)`,
            user.id
          );
        }
      }

      // Case B: VRS supply request -> Decrements Drop Point stock and increments VRS personal stock!
      if (!isSaRequest) {
        for (const it of items) {
          const prodId = it.product_id;
          const qtyToTransfer = it.quantity_approved !== null && it.quantity_approved !== undefined ? it.quantity_approved : it.quantity_requested;

          if (qtyToTransfer <= 0) continue;

          // 1. Verify Drop Point stock
          const dpStock = db.prepare(`
            SELECT available_quantity FROM drop_point_stocks WHERE drop_point_id = ? AND product_id = ?
          `).get(supplyReq.drop_point_id, prodId) as { available_quantity: number } | undefined;

          const currentDpQty = dpStock ? dpStock.available_quantity : 0;
          if (currentDpQty < qtyToTransfer) {
            const prod = db.prepare('SELECT name FROM products WHERE id = ?').get(prodId) as any;
            const prodName = prod ? prod.name : `Produit #${prodId}`;
            throw new Error(
              `Chargement impossible : Stock magasin insuffisant pour '${prodName}'. ` +
              `Stock disponible au dépôt : ${currentDpQty} carton(s), quantité à charger : ${qtyToTransfer} carton(s). ` +
              `Le ravitaillement du stock n'est pas automatique : le Sales Admin doit commander auprès de 6C Distribution via 'Mes commandes'.`
            );
          }

          // 2. Decrement Drop Point stock
          const newDpQty = Math.max(0, currentDpQty - qtyToTransfer);
          db.prepare(`
            UPDATE drop_point_stocks
            SET available_quantity = ?, updated_at = CURRENT_TIMESTAMP
            WHERE drop_point_id = ? AND product_id = ?
          `).run(newDpQty, supplyReq.drop_point_id, prodId);

          // Movement DP -> OUT
          db.prepare(`
            INSERT INTO stock_movements (
              reference, movement_type, source_role, source_id, target_role, target_id,
              drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type, related_entity_id, notes, created_by_user_id
            ) VALUES (?, 'SUPPLY', 'DROP_POINT', ?, 'VRS', ?, ?, ?, ?, ?, ?, 'SUPPLY_REQUEST', ?, ?, ?)
          `).run(
            `MVT-SUPP-DP-${reqId}-${prodId}-${nowTs}`,
            supplyReq.drop_point_id,
            supplyReq.vrs_id,
            supplyReq.drop_point_id,
            prodId,
            -qtyToTransfer,
            currentDpQty,
            newDpQty,
            reqId,
            `Chargement approvisionnement VRS #${supplyReq.request_number} (-${qtyToTransfer} cartons)`,
            user.id
          );

          // 3. Increment VRS stock (ONLY HERE at status Chargée!)
          const vrsStock = db.prepare(`
            SELECT available_quantity FROM vrs_stocks WHERE vrs_id = ? AND product_id = ?
          `).get(supplyReq.vrs_id, prodId) as { available_quantity: number } | undefined;

          const currentVrsQty = vrsStock ? vrsStock.available_quantity : 0;
          const newVrsQty = currentVrsQty + qtyToTransfer;

          db.prepare(`
            INSERT INTO vrs_stocks (vrs_id, drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
            VALUES (?, ?, ?, ?, 0, 3)
            ON CONFLICT(vrs_id, product_id)
            DO UPDATE SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP
          `).run(supplyReq.vrs_id, supplyReq.drop_point_id, prodId, qtyToTransfer, qtyToTransfer);

          // Movement VRS -> IN
          db.prepare(`
            INSERT INTO stock_movements (
              reference, movement_type, source_role, source_id, target_role, target_id,
              drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type, related_entity_id, notes, created_by_user_id
            ) VALUES (?, 'SUPPLY', 'DROP_POINT', ?, 'VRS', ?, ?, ?, ?, ?, ?, 'SUPPLY_REQUEST', ?, ?, ?)
          `).run(
            `MVT-SUPP-VRS-${reqId}-${prodId}-${nowTs}`,
            supplyReq.drop_point_id,
            supplyReq.vrs_id,
            supplyReq.drop_point_id,
            prodId,
            qtyToTransfer,
            currentVrsQty,
            newVrsQty,
            reqId,
            `Stock chargé pour le vendeur #${supplyReq.request_number} (+${qtyToTransfer} cartons)`,
            user.id
          );
        }
      }
    }

    const updatedNotes = rejectionReason
      ? (supplyReq.notes ? `${supplyReq.notes}\n[Motif Rejet: ${rejectionReason}]` : `[Motif Rejet: ${rejectionReason}]`)
      : supplyReq.notes;

    db.prepare(`
      UPDATE supply_requests
      SET status = ?,
          processed_by_user_id = ?,
          notes = ?,
          rejection_reason = COALESCE(?, rejection_reason),
          bl_number = COALESCE(?, bl_number),
          bl_attachment = COALESCE(?, bl_attachment),
          bl_file_name = COALESCE(?, bl_file_name),
          bl_file_type = COALESCE(?, bl_file_type),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(targetStatus, user.id, updatedNotes, rejectionReason || null, blNumber || null, blAttachment || null, blFileName || null, blFileType || null, reqId);

    // Auto-create VRS invoice if validated and not already created
    if (!isSaRequest && (targetStatus === 'Validée' || targetStatus === 'Partiellement validée' || targetStatus === 'Chargée' || targetStatus === 'APPROUVÉE' || targetStatus === 'LIVRÉE')) {
      const existingVrsInv = db.prepare('SELECT id FROM vrs_invoices WHERE request_id = ?').get(reqId);
      if (!existingVrsInv) {
        const itemsWithPrices = db.prepare(`
          SELECT sri.quantity_approved, sri.quantity_requested, COALESCE(p.vrs_cession_price, p.unit_price) as price
          FROM supply_request_items sri
          JOIN products p ON sri.product_id = p.id
          WHERE sri.request_id = ?
        `).all(reqId) as any[];

        let invTotal = 0;
        for (const it of itemsWithPrices) {
          const q = it.quantity_approved !== null && it.quantity_approved !== undefined ? it.quantity_approved : it.quantity_requested;
          invTotal += (q || 0) * (it.price || 0);
        }
        if (invTotal > 0) {
          const vrsInvNum = `FAC-VRS-2026-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
          db.prepare(`
            INSERT INTO vrs_invoices (
              invoice_number, request_id, vrs_id, drop_point_id, total_amount, paid_amount, remaining_amount, payment_status
            ) VALUES (?, ?, ?, ?, ?, 0, ?, 'A_PAYER')
          `).run(vrsInvNum, reqId, supplyReq.vrs_id, supplyReq.drop_point_id, invTotal, invTotal);
        }
      }
    }
  });

  try {
    executeStatusChange();

    backupVrsStocksAndSales();

    logActivity(user, `SUPPLY_${targetStatus}`, supplyReq.request_number, `Demande #${supplyReq.request_number} (${isSaRequest ? 'Dépôt/SA' : 'VRS'}) passée au statut ${targetStatus}${rejectionReason ? ` (Motif: ${rejectionReason})` : ''}`, req);

    let message = `Demande mise à jour: ${targetStatus}.`;
    const validatorName = user ? `${user.firstName} ${user.lastName} (${user.role === 'SALES_ADMIN_NATIONAL' ? 'Sales Admin National' : 'Sales Admin'})` : 'le validateur';

    if (isSaRequest) {
      // Notifications for SA-initiated Drop Point supply request
      if (targetStatus === 'Validée') {
        message = 'Demande de réapprovisionnement auprès de 6C Distribution approuvée par le SAN ! Le Sales Admin a été notifié.';
        createNotification(
          supplyReq.vrs_id,
          null,
          supplyReq.drop_point_id,
          'Demande d\'approvisionnement 6C Distribution approuvée',
          `Votre commande #${supplyReq.request_number} (${supplyReq.total_cartons} carton(s)) auprès de 6C Distribution pour le Dépôt ${supplyReq.dropPointName} a été validée par le Sales Admin National. Les marchandises peuvent être expédiées.`,
          'SUPPLY',
          'dp-supply-requests'
        );
      } else if (targetStatus === 'Rejetée') {
        message = 'Demande de réapprovisionnement 6C Distribution rejetée par le SAN.';
        createNotification(
          supplyReq.vrs_id,
          null,
          supplyReq.drop_point_id,
          'Demande d\'approvisionnement 6C Distribution rejetée',
          `Votre commande #${supplyReq.request_number} (${supplyReq.total_cartons} carton(s)) auprès de 6C Distribution a été rejetée par le Sales Admin National.${rejectionReason ? ` Motif: ${rejectionReason}` : ''}`,
          'SUPPLY',
          'dp-supply-requests'
        );
      } else if (targetStatus === 'Chargée') {
        message = 'Réception 6C Distribution confirmée avec succès ! Le stock du Dépôt a été crédité.';
        createNotification(
          supplyReq.vrs_id,
          null,
          supplyReq.drop_point_id,
          'Stock Dépôt crédité (Réception 6C Distribution)',
          `Réception 6C Distribution confirmée : +${supplyReq.total_cartons} carton(s) ajoutés au stock du Dépôt ${supplyReq.dropPointName} (Demande #${supplyReq.request_number}).`,
          'SUPPLY',
          'stocks'
        );
        createNotification(
          null,
          'SALES_ADMIN_NATIONAL',
          null,
          'Réception 6C Distribution confirmée par le Sales Admin',
          `Le Sales Admin ${user.firstName} ${user.lastName} a confirmé la Réception 6C Distribution de ${supplyReq.total_cartons} carton(s) au Dépôt ${supplyReq.dropPointName} (${supplyReq.request_number}).`,
          'SUPPLY',
          'dp-supply-requests'
        );
      }
    } else {
      // Notifications for VRS-initiated supply request
      // RULE 3: Le VRS est notifié de chaque décision de son SA.
      if (targetStatus === 'Validée') {
        message = 'Chargement validé avec succès ! Le vendeur a été notifié.';
        createNotification(
          supplyReq.vrs_id,
          null,
          supplyReq.drop_point_id,
          'Chargement validé',
          `Votre chargement #${supplyReq.request_number} (${supplyReq.total_cartons} carton(s)) a été validé par ${validatorName}. Les marchandises sont prêtes pour le chargement physique.`,
          'SUPPLY',
          'supply-requests'
        );
      } else if (targetStatus === 'Partiellement validée') {
        message = 'Chargement partiellement validé ! Le vendeur a été notifié.';
        createNotification(
          supplyReq.vrs_id,
          null,
          supplyReq.drop_point_id,
          'Chargement partiellement validé',
          `Votre chargement #${supplyReq.request_number} a été partiellement validé par ${validatorName}. Veuillez consulter le détail des quantités approuvées.`,
          'SUPPLY',
          'supply-requests'
        );
      } else if (targetStatus === 'Rejetée') {
        message = 'Chargement rejeté avec notification au vendeur.';
        createNotification(
          supplyReq.vrs_id,
          null,
          supplyReq.drop_point_id,
          'Chargement rejeté',
          `Votre chargement #${supplyReq.request_number} (${supplyReq.total_cartons} carton(s)) a été rejeté par ${validatorName}.${rejectionReason ? ` Motif : ${rejectionReason}` : ''}`,
          'SUPPLY',
          'supply-requests'
        );
      } else if (targetStatus === 'Chargée') {
        message = 'Marchandise chargée avec succès ! Le stock VRS a été crédité (+Stock disponible).';
        createNotification(
          supplyReq.vrs_id,
          null,
          supplyReq.drop_point_id,
          'Marchandises chargées • Stock disponible augmenté',
          `Chargement confirmé ! Votre stock personnel a été augmenté pour le chargement #${supplyReq.request_number}.`,
          'SUPPLY',
          'stocks'
        );
        createNotification(
          null,
          'SALES_ADMIN',
          supplyReq.drop_point_id,
          'Chargement effectué',
          `La marchandise du chargement #${supplyReq.request_number} pour le vendeur ${supplyReq.requesterFirstName} ${supplyReq.requesterLastName} est chargée.`,
          'SUPPLY',
          'supply-requests'
        );
      }
    }

    res.json({ message, status: targetStatus });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors du traitement de la demande.' });
  }
});

// PATCH modify supply request before validation (VRS or SA)
router.patch('/supply-requests/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const reqId = parseInt(req.params.id, 10);
  const { notes, desiredLoadingDate, items } = req.body;

  const currentReq = db.prepare('SELECT * FROM supply_requests WHERE id = ?').get(reqId) as any;
  if (!currentReq) {
    return res.status(404).json({ error: 'Demande introuvable.' });
  }

  // Permission check: only the requester (VRS), the SA of the drop point, or SAN can modify
  if (user.role === 'VRS' && currentReq.vrs_id !== user.id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }
  if (user.role === 'SALES_ADMIN' && user.dropPointId !== currentReq.drop_point_id) {
    return res.status(403).json({ error: 'Action non autorisée sur un autre Drop Point.' });
  }

  const editableStatuses = ['Demandée', 'ENVOYÉE', 'EN ATTENTE', 'BROUILLON', 'DEMANDEE'];
  if (!editableStatuses.includes(currentReq.status)) {
    return res.status(400).json({ error: `Impossible de modifier une demande au statut "${currentReq.status}". Seules les demandes en attente de validation peuvent être modifiées.` });
  }

  if (Array.isArray(items) && items.length > 0) {
    const validItems = items.filter((it: any) => it.productId && Number(it.quantityRequested) > 0);
    if (validItems.length === 0) {
      return res.status(400).json({ error: 'Au moins un produit doit avoir une quantité supérieure à zéro.' });
    }

    let totalCartons = 0;
    for (const it of validItems) {
      totalCartons += parseInt(it.quantityRequested, 10);
    }

    db.transaction(() => {
      db.prepare('DELETE FROM supply_request_items WHERE request_id = ?').run(reqId);
      const insertItem = db.prepare(`
        INSERT INTO supply_request_items (request_id, product_id, quantity_requested, quantity_approved)
        VALUES (?, ?, ?, ?)
      `);
      for (const it of validItems) {
        const qty = parseInt(it.quantityRequested, 10);
        insertItem.run(reqId, it.productId, qty, qty);
      }
      db.prepare(`
        UPDATE supply_requests
        SET notes = COALESCE(?, notes),
            desired_loading_date = COALESCE(?, desired_loading_date),
            total_cartons = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(notes !== undefined ? notes : null, desiredLoadingDate || null, totalCartons, reqId);
    })();
  } else {
    db.prepare(`
      UPDATE supply_requests
      SET notes = COALESCE(?, notes),
          desired_loading_date = COALESCE(?, desired_loading_date),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(notes !== undefined ? notes : null, desiredLoadingDate || null, reqId);
  }

  logActivity(user, 'UPDATE_SUPPLY_REQUEST', currentReq.request_number, `Modification de la demande #${currentReq.request_number}`, req);

  res.json({ message: 'Demande modifiée avec succès.' });
});

// POST cancel supply request before loading (VRS or SA)
router.post('/supply-requests/:id/cancel', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const reqId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  const currentReq = db.prepare('SELECT * FROM supply_requests WHERE id = ?').get(reqId) as any;
  if (!currentReq) {
    return res.status(404).json({ error: 'Demande introuvable.' });
  }

  if (user.role === 'VRS' && currentReq.vrs_id !== user.id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }
  if (user.role === 'SALES_ADMIN' && user.dropPointId !== currentReq.drop_point_id) {
    return res.status(403).json({ error: 'Action non autorisée sur un autre Drop Point.' });
  }

  const cancelableStatuses = ['Demandée', 'ENVOYÉE', 'EN ATTENTE', 'BROUILLON', 'DEMANDEE', 'Validée', 'Partiellement validée'];
  if (!cancelableStatuses.includes(currentReq.status)) {
    return res.status(400).json({ error: `Impossible d'annuler une demande au statut "${currentReq.status}".` });
  }

  db.prepare(`
    UPDATE supply_requests
    SET status = 'ANNULÉE',
        rejection_reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reason || 'Annulée par l\'utilisateur', reqId);

  // If a vrs_invoice was created and is unpaid, cancel it as well
  db.prepare(`
    UPDATE vrs_invoices
    SET status = 'ANNULEE_AVOIR',
        payment_status = 'ANNULEE',
        credit_note_reason = ?
    WHERE request_id = ? AND is_generated = 0
  `).run(reason || 'Demande annulée', reqId);

  logActivity(user, 'CANCEL_SUPPLY_REQUEST', currentReq.request_number, `Annulation de la demande #${currentReq.request_number}${reason ? ` (Motif: ${reason})` : ''}`, req);

  if (user.role === 'VRS') {
    createNotification(
      null,
      'SALES_ADMIN',
      currentReq.drop_point_id,
      'Demande de chargement annulée',
      `Le vendeur ${user.firstName} ${user.lastName} a annulé sa demande #${currentReq.request_number}.${reason ? ` Motif: ${reason}` : ''}`,
      'SUPPLY',
      'supply-requests'
    );
  } else {
    createNotification(
      currentReq.vrs_id,
      null,
      currentReq.drop_point_id,
      'Demande de chargement annulée',
      `Votre demande #${currentReq.request_number} a été annulée par ${user.firstName} ${user.lastName}.${reason ? ` Motif: ${reason}` : ''}`,
      'SUPPLY',
      'supply-requests'
    );
  }

  res.json({ message: 'Demande annulée avec succès.' });
});

// POST direct manual stock allocation from Drop Point to VRS (strict manual control, no auto-allocation)
router.post('/transfer', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;

  if (user.role !== 'SALES_ADMIN' && user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Seul le Sales Admin ou le SAN peut effectuer une allocation manuelle de stock.' });
  }

  const { targetVrsId, items, notes } = req.body;

  if (!targetVrsId) {
    return res.status(400).json({ error: 'Vendeur (VRS) cible requis.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Au moins un produit doit être spécifié pour l\'allocation.' });
  }

  const targetVrs = db.prepare('SELECT id, first_name, last_name, public_id, drop_point_id, role FROM users WHERE id = ?').get(targetVrsId) as any;
  if (!targetVrs) {
    return res.status(404).json({ error: 'Vendeur cible introuvable.' });
  }

  const dropPointId = user.role === 'SALES_ADMIN' ? user.dropPointId : (targetVrs.drop_point_id || req.body.dropPointId);
  if (!dropPointId) {
    return res.status(400).json({ error: 'Drop Point non spécifié ou introuvable.' });
  }

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== targetVrs.drop_point_id) {
    return res.status(403).json({ error: 'Ce vendeur n\'est pas rattaché à votre Dépôt.' });
  }

  let totalCartons = 0;
  for (const it of items) {
    const qty = parseInt(it.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Chaque quantité allouée doit être supérieure à 0.' });
    }
    totalCartons += qty;
  }

  const executeTransfer = db.transaction(() => {
    const nowTs = Date.now();
    for (const it of items) {
      const prodId = parseInt(it.productId, 10);
      const qty = parseInt(it.quantity, 10);

      // Check Drop Point stock availability
      const dpStock = db.prepare(`
        SELECT available_quantity FROM drop_point_stocks WHERE drop_point_id = ? AND product_id = ?
      `).get(dropPointId, prodId) as { available_quantity: number } | undefined;

      const currentDpQty = dpStock ? dpStock.available_quantity : 0;
      if (currentDpQty < qty) {
        const prod = db.prepare('SELECT name FROM products WHERE id = ?').get(prodId) as any;
        const prodName = prod ? prod.name : `Produit #${prodId}`;
        throw new Error(
          `Stock Dépôt insuffisant pour '${prodName}'. Disponible : ${currentDpQty} carton(s), demandé pour allocation : ${qty} carton(s).`
        );
      }

      // Decrement Drop Point stock
      const newDpQty = currentDpQty - qty;
      db.prepare(`
        UPDATE drop_point_stocks
        SET available_quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE drop_point_id = ? AND product_id = ?
      `).run(newDpQty, dropPointId, prodId);

      // Increment VRS stock
      const vrsStock = db.prepare(`
        SELECT available_quantity FROM vrs_stocks WHERE vrs_id = ? AND product_id = ?
      `).get(targetVrsId, prodId) as { available_quantity: number } | undefined;

      const currentVrsQty = vrsStock ? vrsStock.available_quantity : 0;
      const newVrsQty = currentVrsQty + qty;

      db.prepare(`
        INSERT INTO vrs_stocks (vrs_id, drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
        VALUES (?, ?, ?, ?, 0, 3)
        ON CONFLICT(vrs_id, product_id)
        DO UPDATE SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP
      `).run(targetVrsId, dropPointId, prodId, qty, qty);

      // Record DP OUT movement
      db.prepare(`
        INSERT INTO stock_movements (
          reference, movement_type, source_role, source_id, target_role, target_id,
          drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type, notes, created_by_user_id
        ) VALUES (?, 'TRANSFER', 'DROP_POINT', ?, 'VRS', ?, ?, ?, ?, ?, ?, 'MANUAL_ALLOCATION', ?, ?)
      `).run(
        `MVT-ALLOC-DP-${nowTs}-${prodId}`,
        dropPointId,
        targetVrsId,
        dropPointId,
        prodId,
        -qty,
        currentDpQty,
        newDpQty,
        `Allocation manuelle Dépôt -> VRS ${targetVrs.first_name} ${targetVrs.last_name}: ${notes || 'Dotation manuelle directe'}`,
        user.id
      );

      // Record VRS IN movement
      db.prepare(`
        INSERT INTO stock_movements (
          reference, movement_type, source_role, source_id, target_role, target_id,
          drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type, notes, created_by_user_id
        ) VALUES (?, 'TRANSFER', 'DROP_POINT', ?, 'VRS', ?, ?, ?, ?, ?, ?, 'MANUAL_ALLOCATION', ?, ?)
      `).run(
        `MVT-ALLOC-VRS-${nowTs}-${prodId}`,
        dropPointId,
        targetVrsId,
        dropPointId,
        prodId,
        qty,
        currentVrsQty,
        newVrsQty,
        `Dotation de stock manuelle allouée par le Sales Admin: ${notes || 'Allocation directe'}`,
        user.id
      );
    }
  });

  try {
    executeTransfer();

    backupVrsStocksAndSales();

    logActivity(user, 'MANUAL_STOCK_ALLOCATION', targetVrs.public_id, `Allocation manuelle de ${totalCartons} cartons alloués au VRS ${targetVrs.first_name} ${targetVrs.last_name}`, req);

    createNotification(
      targetVrsId,
      'VRS',
      dropPointId,
      'Allocation manuelle de stock reçue',
      `Le Sales Admin ${user.firstName} ${user.lastName} vous a alloué manuellement ${totalCartons} carton(s) de stock.`,
      'SUPPLY',
      'stocks'
    );

    res.json({
      success: true,
      message: `Allocation manuelle de ${totalCartons} carton(s) réussie vers ${targetVrs.first_name} ${targetVrs.last_name}.`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de l\'allocation manuelle du stock.' });
  }
});

// PATCH supply request BL document (allow attaching/editing BL by SA, SAN or VRS)
router.patch('/supply-requests/:id/bl', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const reqId = parseInt(req.params.id, 10);
  const { blNumber, blAttachment, blFileName, blFileType } = req.body;

  const sr = db.prepare('SELECT * FROM supply_requests WHERE id = ?').get(reqId) as any;
  if (!sr) {
    return res.status(404).json({ error: 'Demande introuvable.' });
  }

  // Permission check: VRS can edit their own request, SA/SAN can edit requests in their purview
  const isOwner = Number(sr.vrs_id) === Number(user.id);
  const isSameDropPoint = user.dropPointId && Number(sr.drop_point_id) === Number(user.dropPointId);
  if (user.role === 'VRS' && !isOwner && !isSameDropPoint) {
    return res.status(403).json({ error: 'Non autorisé à modifier cette demande.' });
  }

  db.prepare(`
    UPDATE supply_requests
    SET bl_number = ?,
        bl_attachment = ?,
        bl_file_name = ?,
        bl_file_type = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(blNumber || null, blAttachment || null, blFileName || null, blFileType || null, reqId);

  logActivity(user, 'UPDATE_SUPPLY_BL', sr.request_number, `Mise à jour du Bon de Livraison (BL) pour la demande #${sr.request_number}`, req);

  if (user.role === 'VRS') {
    createNotification(null, 'SALES_ADMIN', sr.drop_point_id, 'Bon de Livraison joint par le VRS', `Le vendeur a ajouté ou mis à jour le Bon de Livraison pour la demande #${sr.request_number}.`, 'SUPPLY', 'supply-requests');
  }

  res.json({
    success: true,
    message: 'Bon de Livraison enregistré avec succès.',
    blNumber,
    blAttachment,
    blFileName,
    blFileType
  });
});

// GET stock movements audit trail (Section 37)
router.get('/movements', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { movementType, productId, dropPointId, limit } = req.query;

  let query = `
    SELECT sm.id,
           sm.reference,
           sm.movement_type as movementType,
           sm.movement_type,
           sm.source_role as sourceRole,
           sm.source_id as sourceId,
           sm.target_role as targetRole,
           sm.target_id as targetId,
           sm.drop_point_id as dropPointId,
           sm.product_id as productId,
           sm.quantity,
           sm.stock_before as stockBefore,
           sm.stock_before,
           sm.stock_after as stockAfter,
           sm.stock_after,
           sm.related_entity_type as relatedEntityType,
           sm.related_entity_id as relatedEntityId,
           sm.notes,
           sm.created_by_user_id as createdByUserId,
           sm.created_at as createdAt,
           sm.created_at,
           p.name as productName, p.reference as productRef, c.name as categoryName,
           dp.name as dropPointName,
           u.first_name || ' ' || u.last_name as createdByName,
           u.public_id as createdByPublicId
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN drop_points dp ON sm.drop_point_id = dp.id
    LEFT JOIN users u ON sm.created_by_user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'VRS') {
    query += ' AND (sm.source_id = ? OR sm.target_id = ? OR sm.created_by_user_id = ?)';
    params.push(user.id, user.id, user.id);
  } else if (user.role === 'SALES_ADMIN_NATIONAL') {
    if (dropPointId) {
      query += ' AND sm.drop_point_id = ?';
      params.push(dropPointId);
    }
  } else {
    query += ' AND sm.drop_point_id = ?';
    params.push(user.dropPointId);
  }

  if (movementType) {
    query += ' AND sm.movement_type = ?';
    params.push(movementType);
  }

  if (productId) {
    query += ' AND sm.product_id = ?';
    params.push(productId);
  }

  query += ' ORDER BY sm.created_at DESC LIMIT ?';
  params.push(limit ? parseInt(String(limit), 10) : 100);

  const movements = db.prepare(query).all(...params);
  res.json({ movements });
});

export default router;
