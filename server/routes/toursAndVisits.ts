import { Router, type Response } from 'express';
import { db } from '../db.ts';
import { requireAuth, type AuthRequest, logActivity } from '../auth.ts';

const router = Router();

// GET Tour Plans
router.get('/tour-plans', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { vrsId, dropPointId, dayOfWeek } = req.query;

  let query = `
    SELECT tp.id,
           tp.name,
           tp.status,
           tp.vrs_id as vrsId,
           tp.vrs_id,
           tp.sector_id as sectorId,
           tp.sector_id,
           tp.drop_point_id as dropPointId,
           tp.drop_point_id,
           tp.day_of_week as dayOfWeek,
           tp.day_of_week,
           COALESCE(tp.target_visits_count, (SELECT COUNT(*) FROM points_of_sale WHERE sector_id = tp.sector_id)) as targetVisitsCount,
           COALESCE(tp.notes, '') as notes,
           tp.created_at as createdAt,
           tp.created_at,
           tp.reviewed_at as reviewedAt,
           tp.reviewed_at,
           tp.reviewed_by as reviewedBy,
           tp.reviewed_by,
           reviewer.first_name || ' ' || reviewer.last_name as reviewedByName,
           dp.name as dropPointName, dp.code as dropPointCode,
           s.name as sectorName, s.code as sectorCode,
           vrs.first_name || ' ' || vrs.last_name as vrsName,
           vrs.public_id as vrsPublicId,
           (SELECT COUNT(*) FROM points_of_sale WHERE sector_id = tp.sector_id) as pdvCount
    FROM tour_plans tp
    JOIN drop_points dp ON tp.drop_point_id = dp.id
    JOIN sectors s ON tp.sector_id = s.id
    JOIN users vrs ON tp.vrs_id = vrs.id
    LEFT JOIN users reviewer ON tp.reviewed_by = reviewer.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'VRS') {
    query += ' AND tp.vrs_id = ?';
    params.push(user.id);
  } else if (user.role === 'FSS') {
    query += ' AND tp.drop_point_id = ? AND (vrs.fss_id = ? OR tp.vrs_id = ?)';
    params.push(user.dropPointId, user.id, user.id);
  } else if (user.role === 'SALES_ADMIN') {
    query += ' AND tp.drop_point_id = ?';
    params.push(user.dropPointId);
    if (vrsId) {
      query += ' AND tp.vrs_id = ?';
      params.push(vrsId);
    }
  } else {
    // SAN
    if (dropPointId) {
      query += ' AND tp.drop_point_id = ?';
      params.push(dropPointId);
    }
    if (vrsId) {
      query += ' AND tp.vrs_id = ?';
      params.push(vrsId);
    }
  }

  if (dayOfWeek) {
    query += ' AND tp.day_of_week = ?';
    params.push(dayOfWeek);
  }

  // Pending proposals at the top, and all validated/rejected/active tours sorted by recency descending (most recent at top)
  query += ` ORDER BY 
    CASE WHEN tp.status IN ('EN_ATTENTE_APPROBATION', 'EN_ATTENTE') THEN 0 ELSE 1 END ASC,
    CASE WHEN tp.status IN ('EN_ATTENTE_APPROBATION', 'EN_ATTENTE') THEN tp.id END ASC,
    tp.id DESC`;

  const tourPlans = db.prepare(query).all(...params);
  res.json({ tourPlans });
});

// POST create Tour Plan (SA / SAN)
router.post('/tour-plans', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { name, dayOfWeek, dropPointId, sectorId, vrsId, neighborhood } = req.body;

  if (user.role !== 'SALES_ADMIN_NATIONAL' && user.role !== 'SALES_ADMIN') {
    return res.status(403).json({ error: 'Permission refusée pour créer un plan de tournée.' });
  }

  if (!name || !dayOfWeek || !sectorId || !vrsId) {
    return res.status(400).json({ error: 'Nom, jour, secteur et vendeur sont requis.' });
  }

  const targetDpId = user.role === 'SALES_ADMIN_NATIONAL' ? (dropPointId ? parseInt(dropPointId, 10) : null) : user.dropPointId;
  if (!targetDpId) {
    return res.status(400).json({ error: 'Drop Point requis.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO tour_plans (name, day_of_week, drop_point_id, neighborhood, sector_id, vrs_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIF')
    `).run(name, dayOfWeek, targetDpId, neighborhood || '', parseInt(sectorId, 10), parseInt(vrsId, 10));

    logActivity(user, 'CREATE_TOUR_PLAN', name, `Création de la tournée ${name} (${dayOfWeek})`, req);

    const created = db.prepare('SELECT * FROM tour_plans WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ tourPlan: created, message: 'Plan de tournée créé avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la création du plan de tournée.' });
  }
});

// GET Visits
router.get('/visits', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { vrsId, pointOfSaleId, dropPointId, date } = req.query;

  let query = `
    SELECT v.id,
           v.point_of_sale_id as pointOfSaleId,
           v.point_of_sale_id,
           v.vrs_id as vrsId,
           v.vrs_id,
           v.drop_point_id as dropPointId,
           v.drop_point_id,
           v.started_at as startedAt,
           v.started_at,
           v.ended_at as endedAt,
           v.ended_at,
           v.latitude,
           v.longitude,
           v.status,
           v.notes,
           COALESCE(v.stock_check_notes, '') as stockCheckNotes,
           v.sale_id as saleId,
           v.created_at as createdAt,
           v.created_at,
           pos.name as posName, pos.code as posCode, pos.owner_name as posOwner, pos.phone as posPhone,
           pos.address as posAddress,
           vrs.first_name || ' ' || vrs.last_name as vrsName,
           vrs.public_id as vrsPublicId,
           dp.name as dropPointName,
           s.sale_number as saleNumber, s.total_amount as saleAmount
    FROM visits v
    JOIN points_of_sale pos ON v.point_of_sale_id = pos.id
    JOIN users vrs ON v.vrs_id = vrs.id
    JOIN drop_points dp ON v.drop_point_id = dp.id
    LEFT JOIN sales s ON v.sale_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'VRS') {
    query += ' AND v.vrs_id = ?';
    params.push(user.id);
  } else if (user.role === 'FSS') {
    query += ' AND v.drop_point_id = ? AND (vrs.fss_id = ? OR v.vrs_id = ?)';
    params.push(user.dropPointId, user.id, user.id);
  } else if (user.role === 'SALES_ADMIN') {
    query += ' AND v.drop_point_id = ?';
    params.push(user.dropPointId);
    if (vrsId) {
      query += ' AND v.vrs_id = ?';
      params.push(vrsId);
    }
  } else {
    // SAN
    if (dropPointId) {
      query += ' AND v.drop_point_id = ?';
      params.push(dropPointId);
    }
    if (vrsId) {
      query += ' AND v.vrs_id = ?';
      params.push(vrsId);
    }
  }

  if (pointOfSaleId) {
    query += ' AND v.point_of_sale_id = ?';
    params.push(pointOfSaleId);
  }

  if (date) {
    query += ' AND date(v.started_at) = ?';
    params.push(date);
  }

  query += ' ORDER BY v.started_at DESC';

  const visits = db.prepare(query).all(...params);
  res.json({ visits });
});

// POST Start a visit (Section 27)
router.post('/visits/start', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { pointOfSaleId, latitude, longitude } = req.body;

  if (!pointOfSaleId) {
    return res.status(400).json({ error: 'Point de vente requis.' });
  }

  const posId = parseInt(pointOfSaleId, 10);
  const pos = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(posId) as any;
  if (!pos) {
    return res.status(404).json({ error: 'Point de vente introuvable.' });
  }

  const vrsId = user.id;
  const dpId = user.dropPointId || pos.drop_point_id;

  try {
    const result = db.prepare(`
      INSERT INTO visits (
        vrs_id, point_of_sale_id, drop_point_id, started_at,
        latitude, longitude, status
      ) VALUES (?, ?, ?, datetime('now'), ?, ?, 'EN_COURS')
    `).run(vrsId, posId, dpId, latitude ? parseFloat(latitude) : pos.latitude, longitude ? parseFloat(longitude) : pos.longitude);

    const visitId = result.lastInsertRowid;

    logActivity(user, 'START_VISIT', `VISIT_${visitId}`, `Début de visite au PDV ${pos.name}`, req);

    res.status(201).json({
      visitId,
      message: `Visite démarrée avec succès au PDV ${pos.name}. Enregistrement GPS actif.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors du démarrage de la visite.' });
  }
});

// POST Finish a visit (Section 27)
router.post('/visits/:id/finish', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const visitId = parseInt(req.params.id, 10);
  const { durationMinutes, notes, photo, saleId } = req.body;

  const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId) as any;
  if (!visit) {
    return res.status(404).json({ error: 'Visite introuvable.' });
  }

  if (user.role === 'VRS' && visit.vrs_id !== user.id) {
    return res.status(403).json({ error: 'Cette visite ne vous appartient pas.' });
  }

  try {
    db.prepare(`
      UPDATE visits
      SET ended_at = datetime('now'),
          duration_minutes = COALESCE(?, 15),
          notes = COALESCE(?, notes),
          photo = COALESCE(?, photo),
          sale_id = COALESCE(?, sale_id),
          status = 'TERMINEE'
      WHERE id = ?
    `).run(
      durationMinutes ? parseInt(durationMinutes, 10) : null,
      notes || null,
      photo || null,
      saleId ? parseInt(saleId, 10) : null,
      visitId
    );

    logActivity(user, 'FINISH_VISIT', `VISIT_${visitId}`, `Fin de visite #${visitId}`, req);

    res.json({ message: 'Visite clôturée avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la clôture de la visite.' });
  }
});

// POST Propose Tour Plan (VRS)
router.post('/tour-plans/propose', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { sectorId, dayOfWeek, plannedDate, executionDate, date, name, neighborhood, notes, targetVisitsCount } = req.body;
  const tourDate = plannedDate || executionDate || date || dayOfWeek;

  if (!tourDate || !sectorId) {
    return res.status(400).json({ error: 'La date d\'intervention prévue et le secteur sont requis pour la proposition de tournée.' });
  }

  const vrsId = user.id;
  const targetDpId = user.dropPointId;

  if (!targetDpId) {
    return res.status(400).json({ error: 'Aucun Dépôt (Drop Point) associé à votre compte.' });
  }

  // Fetch sector name
  const sector = db.prepare('SELECT name FROM sectors WHERE id = ?').get(parseInt(sectorId, 10)) as any;
  const sectorName = sector ? sector.name : `Secteur #${sectorId}`;
  const tourName = name || `Proposition Tournée - ${sectorName} (${tourDate})`;

  try {
    const result = db.prepare(`
      INSERT INTO tour_plans (name, day_of_week, drop_point_id, neighborhood, sector_id, vrs_id, status, notes, target_visits_count)
      VALUES (?, ?, ?, ?, ?, ?, 'EN_ATTENTE_APPROBATION', ?, ?)
    `).run(
      tourName,
      tourDate,
      targetDpId,
      neighborhood || sectorName,
      parseInt(sectorId, 10),
      vrsId,
      notes || 'Proposition soumise par le VRS',
      targetVisitsCount ? parseInt(targetVisitsCount, 10) : 0
    );

    const tourId = result.lastInsertRowid;
    const vrsFullName = `${user.firstName} ${user.lastName}`;

    // Single notification for the tour proposal (visible to Drop Point Sales Admin and Sales Admin National)
    db.prepare(`
      INSERT INTO notifications (role, drop_point_id, title, message, type, link)
      VALUES ('SALES_ADMIN', ?, 'Nouvelle proposition de tournée', ?, 'TOUR_PROPOSAL', '/tours')
    `).run(targetDpId, `Le vendeur ${vrsFullName} a soumis une proposition de tournée pour le ${tourDate} (${sectorName}).`);

    logActivity(user, 'PROPOSE_TOUR_PLAN', tourName, `Proposition de tournée soumise pour le ${tourDate} par ${vrsFullName}`, req);

    const created = db.prepare('SELECT * FROM tour_plans WHERE id = ?').get(tourId);
    res.status(201).json({
      tourPlan: created,
      message: 'Votre proposition de tournée a été soumise avec succès au Sales Admin et Sales Admin National pour approbation.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la soumission de la proposition.' });
  }
});

// POST Approve Tour Proposal (SA / SAN)
router.post('/tour-plans/:id/approve', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const tourId = parseInt(req.params.id, 10);

  if (user.role !== 'SALES_ADMIN_NATIONAL' && user.role !== 'SALES_ADMIN') {
    return res.status(403).json({ error: 'Permission refusée pour approuver les propositions de tournée.' });
  }

  const tour = db.prepare(`
    SELECT tp.*, u.first_name, u.last_name, u.id as seller_id
    FROM tour_plans tp
    JOIN users u ON tp.vrs_id = u.id
    WHERE tp.id = ?
  `).get(tourId) as any;

  if (!tour) {
    return res.status(404).json({ error: 'Plan de tournée introuvable.' });
  }

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== tour.drop_point_id) {
    return res.status(403).json({ error: 'Vous ne pouvez approuver que les tournées de votre Dépôt.' });
  }

  try {
    const now = new Date().toISOString();
    db.prepare("UPDATE tour_plans SET status = 'ACTIF', reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(now, user.id, tourId);

    // Notify the proposing VRS
    db.prepare(`
      INSERT INTO notifications (user_id, role, drop_point_id, title, message, type, link)
      VALUES (?, 'VRS', ?, 'Tournée Approuvée !', ?, 'TOUR_APPROVED', '/tours')
    `).run(
      tour.seller_id,
      tour.drop_point_id,
      `Votre proposition de tournée "${tour.name}" pour ${tour.day_of_week} a été approuvée par ${user.firstName} ${user.lastName}.`
    );

    logActivity(user, 'APPROVE_TOUR_PLAN', tour.name, `Approbation de la proposition de tournée #${tourId}`, req);

    res.json({ message: 'Proposition de tournée approuvée avec succès !' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de l\'approbation.' });
  }
});

// POST Reject Tour Proposal (SA / SAN)
router.post('/tour-plans/:id/reject', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const tourId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  if (user.role !== 'SALES_ADMIN_NATIONAL' && user.role !== 'SALES_ADMIN') {
    return res.status(403).json({ error: 'Permission refusée pour rejeter les propositions de tournée.' });
  }

  const tour = db.prepare(`
    SELECT tp.*, u.first_name, u.last_name, u.id as seller_id
    FROM tour_plans tp
    JOIN users u ON tp.vrs_id = u.id
    WHERE tp.id = ?
  `).get(tourId) as any;

  if (!tour) {
    return res.status(404).json({ error: 'Plan de tournée introuvable.' });
  }

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== tour.drop_point_id) {
    return res.status(403).json({ error: 'Vous ne pouvez rejeter que les tournées de votre Dépôt.' });
  }

  try {
    const now = new Date().toISOString();
    const updatedNotes = (tour.notes ? `${tour.notes} | ` : '') + `Rejet: ${reason || 'Non spécifié'}`;
    db.prepare("UPDATE tour_plans SET status = 'REJETEE', notes = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(updatedNotes, now, user.id, tourId);

    // Notify the proposing VRS
    db.prepare(`
      INSERT INTO notifications (user_id, role, drop_point_id, title, message, type, link)
      VALUES (?, 'VRS', ?, 'Proposition de Tournée Rejetée', ?, 'TOUR_REJECTED', '/tours')
    `).run(
      tour.seller_id,
      tour.drop_point_id,
      `Votre proposition pour ${tour.day_of_week} a été rejetée. Motif : ${reason || 'Non précisé'}.`
    );

    logActivity(user, 'REJECT_TOUR_PLAN', tour.name, `Rejet de la proposition de tournée #${tourId}`, req);

    res.json({ message: 'Proposition de tournée rejetée.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors du rejet.' });
  }
});

// PATCH update Tour Plan status
router.patch('/tour-plans/:id/status', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const tourId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Statut requis.' });
  }

  try {
    db.prepare('UPDATE tour_plans SET status = ? WHERE id = ?').run(status, tourId);
    logActivity(user, 'UPDATE_TOUR_PLAN', `TOUR_${tourId}`, `Mise à jour statut tournée: ${status}`, req);
    res.json({ message: `Statut de la tournée mis à jour (${status}).` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur mise à jour tournée.' });
  }
});

// POST Record / Check-in visit GPS and notes
router.post('/visits/:id/record', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const visitId = parseInt(req.params.id, 10);
  const { latitude, longitude, notes, stockCheckNotes, status } = req.body;

  try {
    db.prepare(`
      UPDATE visits
      SET latitude = COALESCE(?, latitude),
          longitude = COALESCE(?, longitude),
          notes = COALESCE(?, notes),
          stock_check_notes = COALESCE(?, stock_check_notes),
          status = COALESCE(?, 'EFFECTUEE'),
          ended_at = datetime('now')
      WHERE id = ?
    `).run(
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      notes || null,
      stockCheckNotes || null,
      status || 'EFFECTUEE',
      visitId
    );

    logActivity(user, 'RECORD_VISIT', `VISIT_${visitId}`, `Pointage visite terrain #${visitId}`, req);
    res.json({ message: 'Pointage de visite enregistré avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur enregistrement visite.' });
  }
});

export default router;
