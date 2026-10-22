import { Router, type Response } from 'express';
import { db, backupPointsOfSale } from '../db.ts';
import { requireAuth, type AuthRequest, logActivity, createNotification } from '../auth.ts';

const router = Router();

// GET all Points of Sale (filtered by role & scope)
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { status, sectorId, dropPointId, vrsId, search, deletionStatus, includeDeleted } = req.query;

  let query = `
    SELECT pos.*,
           pos.owner_name as ownerName,
           pos.drop_point_id as dropPointId,
           pos.sector_id as sectorId,
           pos.assigned_vrs_id as assignedVrsId,
           pos.created_by_user_id as createdByUserId,
           pos.created_at as createdAt,
           pos.updated_at as updatedAt,
           pos.is_deleted as isDeleted,
           pos.deleted_at as deletedAt,
           pos.deleted_by as deletedBy,
           pos.deletion_status as deletionStatus,
           pos.deletion_reason as deletionReason,
           pos.deletion_requested_by as deletionRequestedBy,
           pos.deletion_requested_at as deletionRequestedAt,
           pos.deletion_reviewed_by as deletionReviewedBy,
           pos.deletion_reviewed_at as deletionReviewedAt,
           pos.deletion_review_note as deletionReviewNote,
           dp.name as dropPointName, dp.code as dropPointCode,
           s.name as sectorName, s.code as sectorCode,
           COALESCE(vrs.first_name || ' ' || vrs.last_name, (SELECT u.first_name || ' ' || u.last_name FROM sales s2 JOIN users u ON s2.vrs_id = u.id WHERE s2.point_of_sale_id = pos.id ORDER BY s2.created_at DESC LIMIT 1)) as vrsName,
           COALESCE(vrs.public_id, (SELECT u.public_id FROM sales s2 JOIN users u ON s2.vrs_id = u.id WHERE s2.point_of_sale_id = pos.id ORDER BY s2.created_at DESC LIMIT 1)) as vrsPublicId,
           del_user.first_name || ' ' || del_user.last_name as deletionRequesterName,
           (SELECT COUNT(*) FROM sales WHERE point_of_sale_id = pos.id AND status = 'COMPLETED') as totalSalesCount,
           (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE point_of_sale_id = pos.id AND status = 'COMPLETED') as totalSalesAmount,
           (SELECT COUNT(*) FROM sales WHERE point_of_sale_id = pos.id AND status = 'COMPLETED' AND vrs_id = ${user.id}) as mySalesCount,
           (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE point_of_sale_id = pos.id AND status = 'COMPLETED' AND vrs_id = ${user.id}) as mySalesAmount,
           (SELECT MAX(created_at) FROM visits WHERE point_of_sale_id = pos.id) as lastVisitDate
    FROM points_of_sale pos
    JOIN drop_points dp ON pos.drop_point_id = dp.id
    LEFT JOIN sectors s ON pos.sector_id = s.id
    LEFT JOIN users vrs ON pos.assigned_vrs_id = vrs.id
    LEFT JOIN users del_user ON pos.deletion_requested_by = del_user.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Hide deleted points of sale unless explicitly requested by SAN
  if (includeDeleted !== 'true' || user.role !== 'SALES_ADMIN_NATIONAL') {
    query += " AND (pos.is_deleted IS NULL OR pos.is_deleted = 0) AND pos.status != 'SUPPRIME'";
  }

  if (user.role === 'SALES_ADMIN_NATIONAL') {
    if (dropPointId) {
      query += ' AND pos.drop_point_id = ?';
      params.push(dropPointId);
    }
  } else if (user.role === 'SALES_ADMIN' || user.role === 'FSS') {
    if (user.dropPointId) {
      query += ' AND pos.drop_point_id = ?';
      params.push(user.dropPointId);
    }
  } else {
    // VRS sees PDVs in their drop point, or assigned to them, or created by them
    if (user.dropPointId) {
      query += ' AND (pos.drop_point_id = ? OR pos.assigned_vrs_id = ? OR pos.created_by_user_id = ?)';
      params.push(user.dropPointId, user.id, user.id);
    } else {
      query += ' AND (pos.assigned_vrs_id = ? OR pos.created_by_user_id = ?)';
      params.push(user.id, user.id);
    }
  }

  if (vrsId) {
    query += ' AND pos.assigned_vrs_id = ?';
    params.push(vrsId);
  }

  if (sectorId) {
    query += ' AND pos.sector_id = ?';
    params.push(sectorId);
  }

  if (deletionStatus) {
    query += ' AND pos.deletion_status = ?';
    params.push(deletionStatus);
  }

  if (status) {
    query += ' AND pos.status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (UPPER(pos.name) LIKE ? OR UPPER(pos.code) LIKE ? OR UPPER(pos.owner_name) LIKE ? OR pos.phone LIKE ?)';
    const term = `%${String(search).trim().toUpperCase()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY (pos.deletion_status = \'EN_ATTENTE_APPROBATION\') DESC, pos.status = \'EN ATTENTE\' DESC, pos.created_at DESC';

  const pointsOfSale = db.prepare(query).all(...params);

  // Compute pending deletion requests count for SAN / supervisors
  let pendingDeletionCount = 0;
  try {
    const countRes = db.prepare(`
      SELECT COUNT(*) as c FROM points_of_sale
      WHERE (is_deleted IS NULL OR is_deleted = 0)
        AND deletion_status = 'EN_ATTENTE_APPROBATION'
    `).get() as { c: number };
    pendingDeletionCount = countRes?.c || 0;
  } catch {}

  res.json({ pointsOfSale, pendingDeletionCount });
});

// GET single Point of Sale with history
router.get('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const posId = parseInt(req.params.id, 10);

  const pos = db.prepare(`
    SELECT pos.*,
           pos.owner_name as ownerName,
           pos.drop_point_id as dropPointId,
           pos.sector_id as sectorId,
           pos.assigned_vrs_id as assignedVrsId,
           pos.created_by_user_id as createdByUserId,
           pos.created_at as createdAt,
           pos.updated_at as updatedAt,
           dp.name as dropPointName, dp.code as dropPointCode,
           s.name as sectorName, s.code as sectorCode,
           COALESCE(vrs.first_name || ' ' || vrs.last_name, (SELECT u.first_name || ' ' || u.last_name FROM sales s2 JOIN users u ON s2.vrs_id = u.id WHERE s2.point_of_sale_id = pos.id ORDER BY s2.created_at DESC LIMIT 1)) as vrsName,
           COALESCE(vrs.public_id, (SELECT u.public_id FROM sales s2 JOIN users u ON s2.vrs_id = u.id WHERE s2.point_of_sale_id = pos.id ORDER BY s2.created_at DESC LIMIT 1)) as vrsPublicId,
           creator.first_name || ' ' || creator.last_name as createdByName,
           (SELECT COUNT(*) FROM sales WHERE point_of_sale_id = pos.id AND status = 'COMPLETED') as totalSalesCount,
           (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE point_of_sale_id = pos.id AND status = 'COMPLETED') as totalSalesAmount,
           (SELECT COUNT(*) FROM sales WHERE point_of_sale_id = pos.id AND status = 'COMPLETED' AND vrs_id = ${user.id}) as mySalesCount,
           (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE point_of_sale_id = pos.id AND status = 'COMPLETED' AND vrs_id = ${user.id}) as mySalesAmount,
           (SELECT MAX(created_at) FROM visits WHERE point_of_sale_id = pos.id) as lastVisitDate
    FROM points_of_sale pos
    JOIN drop_points dp ON pos.drop_point_id = dp.id
    LEFT JOIN sectors s ON pos.sector_id = s.id
    LEFT JOIN users vrs ON pos.assigned_vrs_id = vrs.id
    LEFT JOIN users creator ON pos.created_by_user_id = creator.id
    WHERE pos.id = ?
  `).get(posId) as any;

  if (!pos) {
    return res.status(404).json({ error: 'Point de vente introuvable.' });
  }

  if (user.role !== 'SALES_ADMIN_NATIONAL' && user.dropPointId !== pos.drop_point_id) {
    return res.status(403).json({ error: 'Accès refusé pour ce point de vente.' });
  }

  const salesHistory = db.prepare(`
    SELECT s.id,
           s.sale_number as saleNumber,
           s.vrs_id as vrsId,
           s.drop_point_id as dropPointId,
           s.point_of_sale_id as pointOfSaleId,
           s.total_amount as totalAmount,
           s.discount,
           s.notes,
           s.status,
           s.created_at as createdAt,
           vrs.first_name || ' ' || vrs.last_name as vrsName,
           vrs.public_id as vrsPublicId,
           (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as itemCount,
           (SELECT COALESCE(SUM(quantity_cartons), 0) FROM sale_items WHERE sale_id = s.id) as totalCartons
    FROM sales s
    JOIN users vrs ON s.vrs_id = vrs.id
    WHERE s.point_of_sale_id = ?
    ORDER BY s.created_at DESC LIMIT 50
  `).all(posId);

  const visitsHistory = db.prepare(`
    SELECT v.*, vrs.first_name || ' ' || vrs.last_name as vrsName
    FROM visits v
    JOIN users vrs ON v.vrs_id = vrs.id
    WHERE v.point_of_sale_id = ?
    ORDER BY v.started_at DESC LIMIT 10
  `).all(posId);

  // Compute rolling 6 months sales evolution for this point of sale
  const monthlySalesRaw = db.prepare(`
    SELECT 
      strftime('%Y-%m', s.created_at) as month,
      COALESCE(SUM(s.total_amount), 0) as totalAmount,
      COUNT(s.id) as salesCount,
      COALESCE(SUM((SELECT SUM(quantity_cartons) FROM sale_items WHERE sale_id = s.id)), 0) as cartonsSold
    FROM sales s
    WHERE s.point_of_sale_id = ? AND s.status = 'COMPLETED'
    GROUP BY strftime('%Y-%m', s.created_at)
    ORDER BY month ASC
  `).all(posId) as Array<{ month: string; totalAmount: number; salesCount: number; cartonsSold: number }>;

  const monthlyMap = new Map<string, { totalAmount: number; salesCount: number; cartonsSold: number }>();
  monthlySalesRaw.forEach((row) => {
    monthlyMap.set(row.month, {
      totalAmount: Number(row.totalAmount) || 0,
      salesCount: Number(row.salesCount) || 0,
      cartonsSold: Number(row.cartonsSold) || 0,
    });
  });

  const monthsFrenchShort: Record<string, string> = {
    '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr',
    '05': 'Mai', '06': 'Juin', '07': 'Juil', '08': 'Août',
    '09': 'Sept', '10': 'Oct', '11': 'Nov', '12': 'Déc'
  };

  const monthsFrenchFull: Record<string, string> = {
    '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
    '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
    '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre'
  };

  const now = new Date();
  const targetYear = now.getFullYear();
  const targetMonth = now.getMonth();
  const monthlySales: Array<{
    month: string;
    monthLabel: string;
    shortLabel: string;
    totalAmount: number;
    salesCount: number;
    cartonsSold: number;
    growthRate?: number;
  }> = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(targetYear, targetMonth - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const key = `${yyyy}-${mm}`;
    const raw = monthlyMap.get(key) || { totalAmount: 0, salesCount: 0, cartonsSold: 0 };
    monthlySales.push({
      month: key,
      monthLabel: `${monthsFrenchFull[mm] || mm} ${yyyy}`,
      shortLabel: monthsFrenchShort[mm] || mm,
      totalAmount: raw.totalAmount,
      salesCount: raw.salesCount,
      cartonsSold: raw.cartonsSold,
    });
  }

  for (let i = 0; i < monthlySales.length; i++) {
    if (i > 0 && monthlySales[i - 1].totalAmount > 0) {
      const prev = monthlySales[i - 1].totalAmount;
      const curr = monthlySales[i].totalAmount;
      monthlySales[i].growthRate = Math.round(((curr - prev) / prev) * 100);
    } else {
      monthlySales[i].growthRate = 0;
    }
  }

  res.json({ pos, salesHistory, visitsHistory, monthlySales });
});

// POST create Point of Sale (VRS / SA / SAN)
router.post('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { name, ownerName, phone, address, neighborhood, sectorId, dropPointId, assignedVrsId, latitude, longitude, photo } = req.body;

  if (!name || !ownerName || !phone || !address) {
    return res.status(400).json({ error: 'Nom du PDV, propriétaire, téléphone et adresse sont requis.' });
  }

  const targetDpId = user.role === 'SALES_ADMIN_NATIONAL' ? (dropPointId ? parseInt(dropPointId, 10) : null) : user.dropPointId;
  if (!targetDpId) {
    return res.status(400).json({ error: 'Drop Point requis.' });
  }

  // Generate public ID and code
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const publicId = `PDV-${randomSuffix}`;
  const code = `POS-${Date.now().toString().slice(-5)}`;

  // Status: Points of sale must NEVER be activated automatically upon creation.
  // Validation by Sales Admin or Sales Admin National is strictly mandatory.
  const initialStatus = 'EN ATTENTE';

  try {
    const result = db.prepare(`
      INSERT INTO points_of_sale (
        public_id, name, code, owner_name, phone, photo, address, neighborhood,
        sector_id, drop_point_id, assigned_vrs_id, created_by_user_id,
        latitude, longitude, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      publicId,
      name,
      code,
      ownerName,
      phone,
      photo || null,
      address,
      neighborhood || '',
      sectorId ? parseInt(sectorId, 10) : user.sectorId || null,
      targetDpId,
      assignedVrsId ? parseInt(assignedVrsId, 10) : (user.role === 'VRS' ? user.id : null),
      user.id,
      latitude != null && !isNaN(Number(latitude)) ? parseFloat(latitude) : null,
      longitude != null && !isNaN(Number(longitude)) ? parseFloat(longitude) : null,
      initialStatus
    );

    const newId = result.lastInsertRowid as number;

    logActivity(user, 'CREATE_PDV', publicId, `Création du PDV '${name}' (${publicId}) en attente de validation obligatoire`, req);

    // Notify Sales Admin & Sales Admin National for mandatory validation
    createNotification(
      null,
      'SALES_ADMIN',
      targetDpId,
      'Nouveau PDV à valider',
      `Le point de vente '${name}' (${publicId}) a été créé par ${user.firstName} ${user.lastName} et attend votre validation obligatoire.`,
      'POS',
      'pos'
    );
    createNotification(
      null,
      'SALES_ADMIN_NATIONAL',
      null,
      'Nouveau PDV à valider',
      `Le point de vente '${name}' (${publicId}) a été créé et attend la validation (Drop Point ID: ${targetDpId}).`,
      'POS',
      'pos'
    );

    const created = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(newId);

    // Persist to JSON backup to guarantee permanent survival
    backupPointsOfSale();

    res.status(201).json({
      pos: created,
      message: 'Point de vente créé avec succès et immédiatement actif.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la création du point de vente.' });
  }
});

// PATCH validate or reject Point of Sale (Section 14, Acceptance Scenario 8)
router.patch('/:id/status', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const posId = parseInt(req.params.id, 10);
  const { newStatus, notes } = req.body;

  if (user.role !== 'SALES_ADMIN_NATIONAL' && user.role !== 'SALES_ADMIN') {
    return res.status(403).json({ error: 'Seul un Sales Admin ou Sales Admin National peut valider les PDV.' });
  }

  const pos = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(posId) as any;
  if (!pos) {
    return res.status(404).json({ error: 'Point de vente introuvable.' });
  }

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== pos.drop_point_id) {
    return res.status(403).json({ error: 'Ce PDV n\'appartient pas à votre Drop Point.' });
  }

  const validStatuses = ['ACTIF', 'VALIDE', 'REJETE', 'SUSPENDU', 'INACTIF', 'EN ATTENTE'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  db.prepare(`
    UPDATE points_of_sale
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newStatus, posId);

  logActivity(user, `PDV_${newStatus}`, pos.public_id, `Mise à jour statut PDV '${pos.name}' -> ${newStatus}`, req);

  if (pos.created_by_user_id) {
    createNotification(
      pos.created_by_user_id,
      'VRS',
      pos.drop_point_id,
      `PDV ${newStatus === 'ACTIF' || newStatus === 'VALIDE' ? 'validé' : 'rejeté'}`,
      `Votre point de vente '${pos.name}' a été ${newStatus === 'ACTIF' || newStatus === 'VALIDE' ? 'validé et activé' : 'rejeté'}.`,
      'POS',
      'pos'
    );
  }

  // Persist to JSON backup
  backupPointsOfSale();

  const updated = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(posId);
  res.json({
    pos: updated,
    message: `Le point de vente '${pos.name}' est maintenant ${newStatus}.`
  });
});

// PATCH update photo and GPS coordinates of a Point of Sale
router.patch('/:id/photo', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const posId = parseInt(req.params.id, 10);
  const { photo, latitude, longitude } = req.body;

  if (!photo) {
    return res.status(400).json({ error: 'Photo requise.' });
  }

  const pos = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(posId) as any;
  if (!pos) {
    return res.status(404).json({ error: 'Point de vente introuvable.' });
  }

  // Update photo and GPS coordinates if provided
  const newLat = latitude != null && !isNaN(Number(latitude)) ? Number(latitude) : pos.latitude;
  const newLng = longitude != null && !isNaN(Number(longitude)) ? Number(longitude) : pos.longitude;

  db.prepare(`
    UPDATE points_of_sale
    SET photo = ?,
        latitude = ?,
        longitude = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(photo, newLat, newLng, posId);

  logActivity(user, 'UPDATE_PDV_PHOTO', pos.public_id, `Mise à jour photo et coordonnées GPS pour PDV '${pos.name}' (${newLat}, ${newLng})`, req);

  // Persist to JSON backup
  backupPointsOfSale();

  const updated = db.prepare(`
    SELECT pos.*,
           pos.owner_name as ownerName,
           pos.drop_point_id as dropPointId,
           pos.sector_id as sectorId,
           pos.assigned_vrs_id as assignedVrsId,
           pos.created_by_user_id as createdByUserId,
           pos.created_at as createdAt,
           pos.updated_at as updatedAt,
           dp.name as dropPointName, dp.code as dropPointCode,
           s.name as sectorName, s.code as sectorCode
    FROM points_of_sale pos
    JOIN drop_points dp ON pos.drop_point_id = dp.id
    LEFT JOIN sectors s ON pos.sector_id = s.id
    WHERE pos.id = ?
  `).get(posId);

  res.json({
    pos: updated,
    message: 'Photo et coordonnées GPS enregistrées avec succès.'
  });
});

// POST request Point of Sale deletion (VRS or user requesting deletion with required SAN approval)
router.post('/:id/request-deletion', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const posId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Le motif de la demande de suppression est obligatoire.' });
  }

  const pos = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(posId) as any;
  if (!pos || pos.is_deleted === 1 || pos.status === 'SUPPRIME') {
    return res.status(404).json({ error: 'Point de vente introuvable ou déjà supprimé.' });
  }

  if (pos.deletion_status === 'EN_ATTENTE_APPROBATION') {
    return res.status(400).json({ error: 'Une demande de suppression est déjà en cours d\'approbation par le SAN pour ce point de vente.' });
  }

  db.prepare(`
    UPDATE points_of_sale
    SET deletion_status = 'EN_ATTENTE_APPROBATION',
        deletion_reason = ?,
        deletion_requested_by = ?,
        deletion_requested_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reason.trim(), user.id, posId);

  logActivity(
    user,
    'DEMANDE_SUPPRESSION_PDV',
    pos.public_id,
    `Demande de suppression soumise par ${user.firstName} ${user.lastName} (${user.role}) pour le PDV '${pos.name}'. Motif : ${reason.trim()}`,
    req
  );

  // Notify all Sales Admin National (SAN) users
  const sanList = db.prepare("SELECT id FROM users WHERE role = 'SALES_ADMIN_NATIONAL'").all() as { id: number }[];
  for (const san of sanList) {
    createNotification(
      san.id,
      'SALES_ADMIN_NATIONAL',
      null,
      'Demande de suppression PDV',
      `Le vendeur ${user.firstName} ${user.lastName} a soumis une demande de suppression pour le PDV '${pos.name}'. Motif : "${reason.trim()}". Votre approbation est requise.`,
      'POS',
      'pos'
    );
  }

  backupPointsOfSale();

  const updated = db.prepare(`
    SELECT pos.*,
           pos.owner_name as ownerName,
           pos.drop_point_id as dropPointId,
           pos.sector_id as sectorId,
           pos.assigned_vrs_id as assignedVrsId,
           pos.created_by_user_id as createdByUserId,
           pos.created_at as createdAt,
           pos.updated_at as updatedAt,
           pos.is_deleted as isDeleted,
           pos.deletion_status as deletionStatus,
           pos.deletion_reason as deletionReason,
           pos.deletion_requested_by as deletionRequestedBy,
           pos.deletion_requested_at as deletionRequestedAt,
           del_user.first_name || ' ' || del_user.last_name as deletionRequesterName
    FROM points_of_sale pos
    LEFT JOIN users del_user ON pos.deletion_requested_by = del_user.id
    WHERE pos.id = ?
  `).get(posId);

  res.json({
    pos: updated,
    message: 'Votre demande de suppression a été soumise avec succès au Sales Admin National (SAN) pour approbation.'
  });
});

// POST approve or reject Point of Sale deletion (SAN ONLY)
router.post('/:id/approve-deletion', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const posId = parseInt(req.params.id, 10);
  const { approved, note } = req.body;

  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({
      error: 'Seul le Sales Admin National (SAN) a le privilège d\'approuver ou de rejeter les demandes de suppression de points de vente.'
    });
  }

  const pos = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(posId) as any;
  if (!pos) {
    return res.status(404).json({ error: 'Point de vente introuvable.' });
  }

  if (approved) {
    // Approved -> Mark soft deleted
    db.prepare(`
      UPDATE points_of_sale
      SET is_deleted = 1,
          status = 'SUPPRIME',
          deletion_status = 'APPROUVEE',
          deleted_at = CURRENT_TIMESTAMP,
          deleted_by = ?,
          deletion_reviewed_by = ?,
          deletion_reviewed_at = CURRENT_TIMESTAMP,
          deletion_review_note = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id, user.id, note || 'Approuvé par le SAN', posId);

    logActivity(
      user,
      'APPROBATION_SUPPRESSION_PDV',
      pos.public_id,
      `Approbation de la suppression du PDV '${pos.name}' par le SAN ${user.firstName} ${user.lastName}`,
      req
    );

    // Notify requester
    if (pos.deletion_requested_by) {
      createNotification(
        pos.deletion_requested_by,
        'VRS',
        pos.drop_point_id,
        'Suppression de PDV approuvée',
        `La suppression du PDV '${pos.name}' a été approuvée par le Sales Admin National. Le PDV a été retiré.`,
        'POS',
        'pos'
      );
    }

    backupPointsOfSale();

    res.json({
      success: true,
      id: posId,
      message: `La suppression du point de vente '${pos.name}' a été approuvée et validée par le SAN.`
    });
  } else {
    // Rejected -> restore to active / rejected deletion status
    db.prepare(`
      UPDATE points_of_sale
      SET deletion_status = 'REJETEE',
          deletion_reviewed_by = ?,
          deletion_reviewed_at = CURRENT_TIMESTAMP,
          deletion_review_note = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id, note || 'Demande de suppression rejetée par le SAN', posId);

    logActivity(
      user,
      'REJET_SUPPRESSION_PDV',
      pos.public_id,
      `Rejet de la demande de suppression du PDV '${pos.name}' par le SAN ${user.firstName} ${user.lastName}. Note : ${note || 'N/A'}`,
      req
    );

    // Notify requester
    if (pos.deletion_requested_by) {
      createNotification(
        pos.deletion_requested_by,
        'VRS',
        pos.drop_point_id,
        'Suppression de PDV refusée',
        `La demande de suppression du PDV '${pos.name}' a été refusée par le Sales Admin National. Note : ${note || 'Aucune'}. Le point de vente est conservé.`,
        'POS',
        'pos'
      );
    }

    backupPointsOfSale();

    const updated = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(posId);
    res.json({
      success: true,
      pos: updated,
      message: `La demande de suppression pour '${pos.name}' a été refusée. Le point de vente reste conservé.`
    });
  }
});

// DELETE Point of Sale (DIRECT DELETION - SAN ONLY)
router.delete('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const posId = parseInt(req.params.id, 10);

  // Strict check: ONLY SALES_ADMIN_NATIONAL can delete directly
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({
      error: 'Action non autorisée. Seul le Sales Admin National (SAN) a le privilège de supprimer directement un point de vente. Les vendeurs (VRS) doivent soumettre une demande de suppression soumise à approbation du SAN.'
    });
  }

  const pos = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(posId) as any;
  if (!pos) {
    return res.status(404).json({ error: 'Point de vente introuvable.' });
  }

  // Mark soft deleted
  db.prepare(`
    UPDATE points_of_sale
    SET is_deleted = 1,
        status = 'SUPPRIME',
        deletion_status = 'APPROUVEE',
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id, posId);

  logActivity(
    user,
    'SUPPRESSION_DIRECTE_PDV_SAN',
    pos.public_id,
    `Suppression directe du point de vente '${pos.name}' par le Sales Admin National (${user.firstName} ${user.lastName})`,
    req
  );

  // If created by a VRS or user, notify them
  if (pos.created_by_user_id) {
    createNotification(
      pos.created_by_user_id,
      'VRS',
      pos.drop_point_id,
      'PDV supprimé par le SAN',
      `Le point de vente '${pos.name}' a été supprimé par le Sales Admin National.`,
      'POS',
      'pos'
    );
  }

  backupPointsOfSale();

  res.json({
    success: true,
    id: posId,
    message: `Le point de vente '${pos.name}' a été supprimé avec succès par le Sales Admin National.`
  });
});

export default router;
