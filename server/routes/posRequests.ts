import { Router, type Response } from 'express';
import { db, backupPointsOfSale } from '../db.ts';
import { requireAuth, type AuthRequest, logActivity, createNotification } from '../auth.ts';

const router = Router();

// 1. GET POS creation requests
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { status, dropPointId } = req.query;

  let query = `
    SELECT pr.*,
           dp.name as dropPointName, dp.code as dropPointCode, dp.city as dropPointCity,
           s.name as sectorName, s.code as sectorCode,
           vrs.first_name || ' ' || vrs.last_name as vrsName, vrs.public_id as vrsPublicId,
           fss.first_name || ' ' || fss.last_name as fssReviewerName,
           rev.first_name || ' ' || rev.last_name as reviewerName,
           pos.code as posCode, pos.public_id as posPublicId
    FROM pos_creation_requests pr
    JOIN drop_points dp ON pr.drop_point_id = dp.id
    LEFT JOIN sectors s ON pr.sector_id = s.id
    JOIN users vrs ON pr.vrs_id = vrs.id
    LEFT JOIN users fss ON pr.fss_reviewed_by = fss.id
    LEFT JOIN users rev ON pr.reviewed_by_user_id = rev.id
    LEFT JOIN points_of_sale pos ON pr.created_pos_id = pos.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'VRS') {
    query += ' AND pr.vrs_id = ?';
    params.push(user.id);
  } else if (user.role === 'SALES_ADMIN' || user.role === 'FSS') {
    if (user.dropPointId) {
      query += ' AND pr.drop_point_id = ?';
      params.push(user.dropPointId);
    }
  } else if (dropPointId) {
    query += ' AND pr.drop_point_id = ?';
    params.push(dropPointId);
  }

  if (status) {
    query += ' AND pr.status = ?';
    params.push(status);
  }

  query += ' ORDER BY pr.created_at DESC';

  const requests = db.prepare(query).all(...params);

  // Compute pending count
  let pendingCount = 0;
  try {
    let countQ = "SELECT COUNT(*) as c FROM pos_creation_requests WHERE status = 'EN_ATTENTE'";
    const countP: any[] = [];
    if (user.role === 'SALES_ADMIN' || user.role === 'FSS') {
      countQ += ' AND drop_point_id = ?';
      countP.push(user.dropPointId);
    } else if (user.role === 'VRS') {
      countQ += ' AND vrs_id = ?';
      countP.push(user.id);
    }
    const resCount = db.prepare(countQ).get(...countP) as any;
    pendingCount = resCount?.c || 0;
  } catch {}

  res.json({ requests, pendingCount });
});

// 2. POST create POS request (VRS)
router.post('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const {
    name,
    ownerName,
    phone,
    storeType,
    neighborhood,
    address,
    latitude,
    longitude,
    photo,
    sectorId,
    dropPointId,
  } = req.body;

  if (!name || !name.trim() || !ownerName || !ownerName.trim() || !phone || !phone.trim()) {
    return res.status(400).json({ error: 'Nom du PDV, propriétaire et téléphone sont obligatoires.' });
  }

  const targetDpId = user.dropPointId || (dropPointId ? parseInt(dropPointId, 10) : 1);
  const targetSectorId = sectorId ? parseInt(sectorId, 10) : user.sectorId || null;

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const requestNumber = `REQ-PDV-${Date.now().toString().slice(-4)}-${randomNum}`;

  try {
    const result = db.prepare(`
      INSERT INTO pos_creation_requests (
        request_number, name, owner_name, phone, store_type, neighborhood, address,
        latitude, longitude, photo, vrs_id, drop_point_id, sector_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE')
    `).run(
      requestNumber,
      name.trim(),
      ownerName.trim(),
      phone.trim(),
      storeType?.trim() || 'Épicerie / Boutique',
      neighborhood?.trim() || '',
      address?.trim() || '',
      latitude != null && !isNaN(Number(latitude)) ? parseFloat(latitude) : 12.6392,
      longitude != null && !isNaN(Number(longitude)) ? parseFloat(longitude) : -8.0029,
      photo || null,
      user.id,
      targetDpId,
      targetSectorId
    );

    const newReqId = result.lastInsertRowid as number;

    logActivity(user, 'INITIATE_PDV_REQUEST', requestNumber, `Demande de création PDV '${name}' (${requestNumber}) par ${user.firstName} ${user.lastName}`, req);

    // Notify SAN
    createNotification(
      null,
      'SALES_ADMIN_NATIONAL',
      null,
      'Nouveau PDV',
      `Le VRS ${user.firstName} ${user.lastName} demande la création du PDV '${name}' (${ownerName}).`,
      'PDV',
      'pos-requests'
    );

    // Notify SA of Drop Point
    createNotification(
      null,
      'SALES_ADMIN',
      targetDpId,
      'Nouveau PDV',
      `Le VRS ${user.firstName} ${user.lastName} a soumis la demande '${name}'.`,
      'PDV',
      'pos-requests'
    );

    const createdReq = db.prepare('SELECT * FROM pos_creation_requests WHERE id = ?').get(newReqId);

    res.status(201).json({
      message: 'Demande de création de PDV enregistrée avec succès. En attente de validation du SAN.',
      request: createdReq,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la création de la demande de PDV.' });
  }
});

// 3. PATCH review POS request (SAN: Valider ou Refuser)
router.patch('/:id/review', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Seul le SAN est habilité à valider ou refuser les créations de PDV.' });
  }

  const reqId = parseInt(req.params.id, 10);
  const { decision, rejectionReason } = req.body;

  if (decision !== 'VALIDEE' && decision !== 'REFUSEE') {
    return res.status(400).json({ error: 'Décision invalide (VALIDEE ou REFUSEE attendu).' });
  }

  const posReq = db.prepare('SELECT * FROM pos_creation_requests WHERE id = ?').get(reqId) as any;
  if (!posReq) {
    return res.status(404).json({ error: 'Demande introuvable.' });
  }

  if (posReq.status !== 'EN_ATTENTE') {
    return res.status(400).json({ error: `Cette demande a déjà été traitée (Statut : ${posReq.status}).` });
  }

  if (decision === 'REFUSEE') {
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'Le motif de refus est obligatoire pour rejeter une demande de PDV.' });
    }

    db.prepare(`
      UPDATE pos_creation_requests
      SET status = 'REFUSEE',
          rejection_reason = ?,
          reviewed_by_user_id = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rejectionReason.trim(), user.id, reqId);

    logActivity(user, 'REJECT_PDV_REQUEST', posReq.request_number, `Refus demande PDV '${posReq.name}' : ${rejectionReason}`, req);

    createNotification(
      posReq.vrs_id,
      'VRS',
      posReq.drop_point_id,
      'Demande de PDV refusée',
      `Votre demande de création pour '${posReq.name}' a été refusée par le SAN. Motif : ${rejectionReason.trim()}`,
      'PDV',
      'pos'
    );

    return res.json({ message: 'Demande refusée avec succès.' });
  }

  // VALIDEE -> Créer le PDV Actif rattaché au VRS et au Drop Point
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const publicId = `PDV-${randomSuffix}`;
  const code = `POS-${Date.now().toString().slice(-5)}`;

  try {
    const insertPos = db.prepare(`
      INSERT INTO points_of_sale (
        public_id, name, code, owner_name, phone, photo, address, neighborhood,
        sector_id, drop_point_id, assigned_vrs_id, created_by_user_id,
        latitude, longitude, status, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF', 0)
    `).run(
      publicId,
      posReq.name,
      code,
      posReq.owner_name,
      posReq.phone,
      posReq.photo || null,
      posReq.address || '',
      posReq.neighborhood || '',
      posReq.sector_id || null,
      posReq.drop_point_id,
      posReq.vrs_id,
      posReq.vrs_id,
      posReq.latitude,
      posReq.longitude
    );

    const newPosId = insertPos.lastInsertRowid as number;

    // Update the request
    db.prepare(`
      UPDATE pos_creation_requests
      SET status = 'VALIDEE',
          created_pos_id = ?,
          reviewed_by_user_id = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPosId, user.id, reqId);

    // Persist backup
    backupPointsOfSale();

    logActivity(user, 'APPROVE_PDV_REQUEST', posReq.request_number, `Validation demande PDV '${posReq.name}'. PDV ${publicId} (${code}) créé et actif.`, req);

    createNotification(
      posReq.vrs_id,
      'VRS',
      posReq.drop_point_id,
      'Point de Vente validé et actif !',
      `Félicitations ! Votre demande pour '${posReq.name}' (${publicId}) a été validée par le SAN. Le PDV est maintenant actif.`,
      'PDV',
      'pos'
    );

    const createdPos = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(newPosId);

    res.json({
      message: 'Demande validée avec succès. Le point de vente est créé et actif.',
      pos: createdPos,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la validation du point de vente.' });
  }
});

// 4. PATCH FSS adds opinion/note on a POS request
router.patch('/:id/fss-note', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'FSS' && user.role !== 'SALES_ADMIN' && user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès non autorisé.' });
  }

  const reqId = parseInt(req.params.id, 10);
  const { fssNote } = req.body;

  if (!fssNote || !fssNote.trim()) {
    return res.status(400).json({ error: "L'avis ne peut pas être vide." });
  }

  const posReq = db.prepare('SELECT * FROM pos_creation_requests WHERE id = ?').get(reqId) as any;
  if (!posReq) {
    return res.status(404).json({ error: 'Demande introuvable.' });
  }

  if (user.role === 'FSS' && user.dropPointId !== posReq.drop_point_id) {
    return res.status(403).json({ error: 'Cette demande ne concerne pas votre périmètre.' });
  }

  db.prepare(`
    UPDATE pos_creation_requests
    SET fss_note = ?,
        fss_reviewed_by = ?,
        fss_reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(fssNote.trim(), user.id, reqId);

  logActivity(user, 'ADD_FSS_NOTE_PDV_REQUEST', posReq.request_number, `Avis FSS ajouté sur la demande PDV '${posReq.name}' : ${fssNote}`, req);

  res.json({ message: 'Avis FSS enregistré avec succès.' });
});

export default router;
