import { Router, type Response } from 'express';
import { db } from '../db.ts';
import { requireAuth, type AuthRequest, logActivity, createNotification } from '../auth.ts';

const router = Router();

// Helper to get cession price (85% of unit_price or unit_price)
const getCessionPrice = (prodUnitPrice: number) => {
  return Math.round(prodUnitPrice * 0.85);
};

// 1. GET Supply Requests
router.get('/requests', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { status, dropPointId } = req.query;

  let query = `
    SELECT r.*,
           dp.name as dropPointName, dp.code as dropPointCode, dp.city as dropPointCity,
           u.first_name || ' ' || u.last_name as requesterName, u.public_id as requesterPublicId,
           rev.first_name || ' ' || rev.last_name as reviewerName,
           inv.id as invoiceId, inv.invoice_number as invoiceNumber, inv.payment_status as invoicePaymentStatus,
           inv.total_amount as invoiceTotalAmount, inv.paid_amount as invoicePaidAmount, inv.remaining_amount as invoiceRemainingAmount,
           trf.id as transferId, trf.transfer_number as transferNumber, trf.status as transferStatus
    FROM dp_supply_requests r
    JOIN drop_points dp ON r.drop_point_id = dp.id
    JOIN users u ON r.created_by_user_id = u.id
    LEFT JOIN users rev ON r.reviewed_by_user_id = rev.id
    LEFT JOIN dp_invoices inv ON inv.request_id = r.id
    LEFT JOIN dp_transfers trf ON trf.request_id = r.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'SALES_ADMIN') {
    query += ' AND r.drop_point_id = ?';
    params.push(user.dropPointId);
  } else if (dropPointId) {
    query += ' AND r.drop_point_id = ?';
    params.push(dropPointId);
  }

  if (status) {
    query += ' AND r.status = ?';
    params.push(status);
  }

  query += ' ORDER BY r.created_at DESC';

  const requests = db.prepare(query).all(...params) as any[];

  // Attach items
  const getItemStmt = db.prepare(`
    SELECT i.*, p.name as productName, p.reference as productReference, p.unit_price as unitPrice
    FROM dp_supply_request_items i
    JOIN products p ON i.product_id = p.id
    WHERE i.request_id = ?
  `);

  for (const r of requests) {
    r.items = getItemStmt.all(r.id);
  }

  // Pending count for SAN
  const pendingCount = (db.prepare("SELECT COUNT(*) as c FROM dp_supply_requests WHERE status = 'DEMANDEE'").get() as any)?.c || 0;

  res.json({ requests, pendingCount });
});

// 2. POST create Supply Request (Sales Admin)
router.post('/requests', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { dropPointId, desiredDate, comments, items } = req.body;

  const targetDpId = user.role === 'SALES_ADMIN' ? user.dropPointId : parseInt(dropPointId, 10);
  if (!targetDpId) {
    return res.status(400).json({ error: 'Drop Point requis.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Au moins un produit doit être demandé.' });
  }

  const validItems = items.filter((it: any) => it.productId && Number(it.quantityRequested) > 0);
  if (validItems.length === 0) {
    return res.status(400).json({ error: 'Les quantités demandées doivent être supérieures à zéro.' });
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const requestNumber = `CMD-DP-${Date.now().toString().slice(-4)}-${randomNum}`;

  let totalCartons = 0;
  let estimatedAmount = 0;

  const prodsMap = new Map();
  const allProds = db.prepare('SELECT id, name, unit_price, dp_cession_price FROM products').all() as any[];
  allProds.forEach((p) => prodsMap.set(p.id, p));

  const itemsToInsert: any[] = [];
  for (const it of validItems) {
    const p = prodsMap.get(it.productId);
    if (!p) continue;
    const qty = parseInt(it.quantityRequested, 10);
    const cessionPrice = (p.dp_cession_price && p.dp_cession_price > 0) ? p.dp_cession_price : getCessionPrice(p.unit_price);
    totalCartons += qty;
    estimatedAmount += qty * cessionPrice;
    itemsToInsert.push({
      productId: p.id,
      quantityRequested: qty,
      unitCessionPrice: cessionPrice,
    });
  }

  try {
    const insertReq = db.prepare(`
      INSERT INTO dp_supply_requests (
        request_number, drop_point_id, created_by_user_id, status, desired_date,
        comments, total_cartons_requested, total_cartons_approved, total_amount
      ) VALUES (?, ?, ?, 'DEMANDEE', ?, ?, ?, 0, ?)
    `).run(requestNumber, targetDpId, user.id, desiredDate || null, comments || null, totalCartons, estimatedAmount);

    const reqId = insertReq.lastInsertRowid as number;

    const insertItem = db.prepare(`
      INSERT INTO dp_supply_request_items (
        request_id, product_id, quantity_requested, quantity_approved, unit_cession_price
      ) VALUES (?, ?, ?, ?, ?)
    `);

    for (const it of itemsToInsert) {
      insertItem.run(reqId, it.productId, it.quantityRequested, it.quantityRequested, it.unitCessionPrice);
    }

    logActivity(user, 'CREATE_DP_SUPPLY_REQUEST', requestNumber, `Création demande approvisionnement ${requestNumber} (${totalCartons} cartons)`, req);

    // Notify SAN
    createNotification(
      null,
      'SALES_ADMIN_NATIONAL',
      null,
      'Nouvelle commande de stock Drop Point',
      `Le Drop Point #${targetDpId} a soumis la commande ${requestNumber} pour ${totalCartons} cartons.`,
      'SUPPLY',
      'dp-supply-requests'
    );

    res.status(201).json({
      message: 'Commande créée avec succès.',
      requestId: reqId,
      requestNumber,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la création de la demande.' });
  }
});

// 2b. PATCH modify Supply Request (Sales Admin - before validation)
router.patch('/requests/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const reqId = parseInt(req.params.id, 10);
  const { desiredDate, comments, items } = req.body;

  const currentReq = db.prepare('SELECT * FROM dp_supply_requests WHERE id = ?').get(reqId) as any;
  if (!currentReq) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== currentReq.drop_point_id) {
    return res.status(403).json({ error: 'Action non autorisée sur un autre Drop Point.' });
  }

  if (currentReq.status !== 'DEMANDEE') {
    return res.status(400).json({ error: `Impossible de modifier une commande au statut "${currentReq.status}". Seules les commandes "Demandée" peuvent être modifiées.` });
  }

  if (Array.isArray(items) && items.length > 0) {
    const validItems = items.filter((it: any) => it.productId && Number(it.quantityRequested) > 0);
    if (validItems.length === 0) {
      return res.status(400).json({ error: 'Au moins un produit doit avoir une quantité supérieure à zéro.' });
    }

    const prodsMap = new Map();
    const allProds = db.prepare('SELECT id, name, unit_price, dp_cession_price FROM products').all() as any[];
    allProds.forEach((p) => prodsMap.set(p.id, p));

    let totalCartons = 0;
    let estimatedAmount = 0;

    const itemsToInsert: any[] = [];
    for (const it of validItems) {
      const p = prodsMap.get(it.productId);
      if (!p) continue;
      const qty = parseInt(it.quantityRequested, 10);
      const cessionPrice = (p.dp_cession_price && p.dp_cession_price > 0) ? p.dp_cession_price : getCessionPrice(p.unit_price);
      totalCartons += qty;
      estimatedAmount += qty * cessionPrice;
      itemsToInsert.push({
        productId: p.id,
        quantityRequested: qty,
        unitCessionPrice: cessionPrice,
      });
    }

    db.transaction(() => {
      db.prepare('DELETE FROM dp_supply_request_items WHERE request_id = ?').run(reqId);
      const insertItem = db.prepare(`
        INSERT INTO dp_supply_request_items (
          request_id, product_id, quantity_requested, quantity_approved, unit_cession_price
        ) VALUES (?, ?, ?, ?, ?)
      `);
      for (const it of itemsToInsert) {
        insertItem.run(reqId, it.productId, it.quantityRequested, it.quantityRequested, it.unitCessionPrice);
      }
      db.prepare(`
        UPDATE dp_supply_requests
        SET desired_date = COALESCE(?, desired_date),
            comments = COALESCE(?, comments),
            total_cartons_requested = ?,
            total_cartons_approved = ?,
            total_amount = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(desiredDate || null, comments || null, totalCartons, totalCartons, estimatedAmount, reqId);
    })();
  } else {
    db.prepare(`
      UPDATE dp_supply_requests
      SET desired_date = COALESCE(?, desired_date),
          comments = COALESCE(?, comments),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(desiredDate || null, comments || null, reqId);
  }

  logActivity(user, 'UPDATE_DP_SUPPLY_REQUEST', currentReq.request_number, `Modification de la commande #${currentReq.request_number}`, req);

  res.json({ message: 'Commande modifiée avec succès.' });
});

// 2c. POST cancel Supply Request (Sales Admin - before validation)
router.post('/requests/:id/cancel', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const reqId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  const currentReq = db.prepare('SELECT * FROM dp_supply_requests WHERE id = ?').get(reqId) as any;
  if (!currentReq) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== currentReq.drop_point_id) {
    return res.status(403).json({ error: 'Action non autorisée sur un autre Drop Point.' });
  }

  if (currentReq.status !== 'DEMANDEE') {
    return res.status(400).json({ error: `Impossible d'annuler une commande déjà validée ou traitée (statut: ${currentReq.status}).` });
  }

  db.prepare(`
    UPDATE dp_supply_requests
    SET status = 'ANNULEE',
        rejection_reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reason || 'Annulée par le demandeur', reqId);

  logActivity(user, 'CANCEL_DP_SUPPLY_REQUEST', currentReq.request_number, `Annulation de la commande #${currentReq.request_number}${reason ? ` (Motif: ${reason})` : ''}`, req);

  createNotification(
    null,
    'SALES_ADMIN_NATIONAL',
    null,
    'Commande Drop Point annulée',
    `La commande ${currentReq.request_number} a été annulée par ${user.firstName} ${user.lastName}.${reason ? ` Motif: ${reason}` : ''}`,
    'SUPPLY',
    'dp-supply-requests'
  );

  res.json({ message: 'Commande annulée avec succès.' });
});

// 3. PATCH review Supply Request (SAN: Valider totalement/ajusté ou Refuser)
router.patch('/requests/:id/review', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Seul le SAN peut valider ou refuser les demandes des Drop Points.' });
  }

  const reqId = parseInt(req.params.id, 10);
  const { decision, rejectionReason, validationNotes, items } = req.body;

  if (decision !== 'VALIDEE' && decision !== 'REFUSEE') {
    return res.status(400).json({ error: 'Décision invalide (VALIDEE ou REFUSEE attendu).' });
  }

  const supplyReq = db.prepare('SELECT * FROM dp_supply_requests WHERE id = ?').get(reqId) as any;
  if (!supplyReq) {
    return res.status(404).json({ error: 'Demande introuvable.' });
  }

  if (supplyReq.status !== 'DEMANDEE') {
    return res.status(400).json({ error: `Cette demande a déjà été traitée (Statut : ${supplyReq.status}).` });
  }

  if (decision === 'REFUSEE') {
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'Le motif de refus est obligatoire.' });
    }

    db.prepare(`
      UPDATE dp_supply_requests
      SET status = 'REFUSEE',
          rejection_reason = ?,
          reviewed_by_user_id = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rejectionReason.trim(), user.id, reqId);

    logActivity(user, 'REJECT_DP_SUPPLY_REQUEST', supplyReq.request_number, `Refus de la demande ${supplyReq.request_number} : ${rejectionReason}`, req);

    createNotification(
      supplyReq.created_by_user_id,
      'SALES_ADMIN',
      supplyReq.drop_point_id,
      'Commande de stock refusée',
      `Votre commande ${supplyReq.request_number} a été refusée par le SAN. Motif : ${rejectionReason}`,
      'SUPPLY',
      'dp-supply-requests'
    );

    return res.json({ message: 'Commande refusée avec succès.' });
  }

  // VALIDEE
  // Update item approved quantities if provided
  let totalApprovedCartons = 0;
  let totalInvoiceAmount = 0;

  const currentItems = db.prepare(`
    SELECT i.*, p.unit_price as prodPrice
    FROM dp_supply_request_items i
    JOIN products p ON i.product_id = p.id
    WHERE i.request_id = ?
  `).all(reqId) as any[];

  const updateItemStmt = db.prepare(`
    UPDATE dp_supply_request_items
    SET quantity_approved = ?
    WHERE id = ?
  `);

  for (const item of currentItems) {
    let approvedQty = item.quantity_requested;
    if (Array.isArray(items)) {
      const matched = items.find((it: any) => it.productId === item.product_id || it.id === item.id);
      if (matched && matched.quantityApproved != null) {
        approvedQty = Math.max(0, parseInt(matched.quantityApproved, 10));
      }
    }
    updateItemStmt.run(approvedQty, item.id);
    totalApprovedCartons += approvedQty;
    totalInvoiceAmount += approvedQty * item.unit_cession_price;
  }

  if (totalApprovedCartons === 0) {
    return res.status(400).json({ error: 'La quantité totale validée ne peut pas être nulle.' });
  }

  // 1. Update request status
  db.prepare(`
    UPDATE dp_supply_requests
    SET status = 'VALIDEE',
        total_cartons_approved = ?,
        total_amount = ?,
        validation_notes = ?,
        reviewed_by_user_id = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(totalApprovedCartons, totalInvoiceAmount, validationNotes || null, user.id, reqId);

  // 2. Generate Facture (dp_invoices)
  const invoiceNumber = `FAC-2026-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
  const insertInvoice = db.prepare(`
    INSERT INTO dp_invoices (
      invoice_number, request_id, drop_point_id, total_amount, paid_amount, remaining_amount, payment_status
    ) VALUES (?, ?, ?, ?, 0, ?, 'A_PAYER')
  `).run(invoiceNumber, reqId, supplyReq.drop_point_id, totalInvoiceAmount, totalInvoiceAmount);

  const invoiceId = insertInvoice.lastInsertRowid as number;

  // 3. Generate Transfert physique (dp_transfers)
  const transferNumber = `TRF-2026-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
  db.prepare(`
    INSERT INTO dp_transfers (
      transfer_number, request_id, invoice_id, drop_point_id, status, notes
    ) VALUES (?, ?, ?, ?, 'PREPARE', ?)
  `).run(transferNumber, reqId, invoiceId, supplyReq.drop_point_id, `Issu de la demande ${supplyReq.request_number}`);

  logActivity(user, 'APPROVE_DP_SUPPLY_REQUEST', supplyReq.request_number, `Validation demande ${supplyReq.request_number} (${totalApprovedCartons}c, ${totalInvoiceAmount} FCFA). Facture ${invoiceNumber} et Transfert ${transferNumber} créés.`, req);

  // Notify Sales Admin
  createNotification(
    supplyReq.created_by_user_id,
    'SALES_ADMIN',
    supplyReq.drop_point_id,
    'Commande de stock validée',
    `Votre commande ${supplyReq.request_number} a été validée (${totalApprovedCartons} cartons). Facture ${invoiceNumber} émise (${totalInvoiceAmount.toLocaleString('fr-FR')} FCFA).`,
    'SUPPLY',
    'dp-supply-requests'
  );

  res.json({
    message: 'Demande validée avec succès. Facture et transfert physique générés.',
    invoiceNumber,
    transferNumber,
    totalApprovedCartons,
    totalInvoiceAmount,
  });
});

// 4. GET Invoices & Summary
router.get('/invoices', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { paymentStatus, dropPointId } = req.query;

  let query = `
    SELECT inv.*,
           dp.name as dropPointName, dp.code as dropPointCode, dp.city as dropPointCity,
           sr.request_number as requestNumber, sr.total_cartons_approved as totalCartons,
           trf.transfer_number as transferNumber, trf.status as transferStatus
    FROM dp_invoices inv
    JOIN drop_points dp ON inv.drop_point_id = dp.id
    JOIN dp_supply_requests sr ON inv.request_id = sr.id
    LEFT JOIN dp_transfers trf ON trf.invoice_id = inv.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'SALES_ADMIN' || user.role === 'VRS') {
    query += ' AND inv.drop_point_id = ?';
    params.push(user.dropPointId);
  } else if (dropPointId) {
    query += ' AND inv.drop_point_id = ?';
    params.push(dropPointId);
  }

  if (paymentStatus) {
    query += ' AND inv.payment_status = ?';
    params.push(paymentStatus);
  }

  query += ' ORDER BY inv.created_at DESC';

  const invoices = db.prepare(query).all(...params) as any[];

  // Attach payments and items
  const getPayStmt = db.prepare(`
    SELECT p.*, u.first_name || ' ' || u.last_name as recordedByName
    FROM dp_invoice_payments p
    JOIN users u ON p.recorded_by_user_id = u.id
    WHERE p.invoice_id = ?
    ORDER BY p.payment_date DESC
  `);

  const getItemStmt = db.prepare(`
    SELECT it.*, p.name as productName, p.reference as productReference, p.units_per_carton as unitsPerCarton
    FROM dp_supply_request_items it
    JOIN products p ON it.product_id = p.id
    WHERE it.request_id = ?
  `);

  for (const inv of invoices) {
    inv.payments = getPayStmt.all(inv.id);
    inv.items = getItemStmt.all(inv.request_id);
  }

  res.json({ invoices });
});

// 5. GET Invoices Summary (KPI Créances Drop Points)
router.get('/invoices/summary', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;

  let filterClause = '';
  const params: any[] = [];
  if (user.role === 'SALES_ADMIN' || user.role === 'VRS') {
    filterClause = 'WHERE inv.drop_point_id = ?';
    params.push(user.dropPointId);
  }

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(remaining_amount), 0) as totalUnpaid,
      COALESCE(SUM(paid_amount), 0) as totalPaid,
      COALESCE(SUM(total_amount), 0) as totalBilled,
      COUNT(*) as count
    FROM dp_invoices inv
    ${filterClause}
  `).get(...params) as any;

  // Breakdown by Drop Point
  const byDropPoint = db.prepare(`
    SELECT
      dp.id as dropPointId,
      dp.name as dropPointName,
      dp.code as dropPointCode,
      dp.city as dropPointCity,
      COALESCE(SUM(inv.remaining_amount), 0) as unpaidAmount,
      COALESCE(SUM(inv.paid_amount), 0) as paidAmount,
      COALESCE(SUM(inv.total_amount), 0) as totalAmount,
      COUNT(inv.id) as invoiceCount
    FROM drop_points dp
    LEFT JOIN dp_invoices inv ON inv.drop_point_id = dp.id
    WHERE dp.status = 'ACTIF'
    GROUP BY dp.id
    ORDER BY unpaidAmount DESC
  `).all();

  res.json({
    totalUnpaid: totals?.totalUnpaid || 0,
    totalPaid: totals?.totalPaid || 0,
    totalBilled: totals?.totalBilled || 0,
    count: totals?.count || 0,
    byDropPoint,
  });
});

// 6. POST record a payment on an Invoice
router.post('/invoices/:id/payments', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const invoiceId = parseInt(req.params.id, 10);
  const { amount, paymentMethod, reference, notes, paymentDate } = req.body;

  const numAmount = parseFloat(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Le montant du paiement doit être supérieur à zéro.' });
  }

  const validMethods = ['ESPECES', 'VIREMENT', 'MOBILE_MONEY'];
  if (!validMethods.includes(paymentMethod)) {
    return res.status(400).json({ error: 'Mode de paiement invalide (ESPECES, VIREMENT, MOBILE_MONEY).' });
  }

  const invoice = db.prepare('SELECT * FROM dp_invoices WHERE id = ?').get(invoiceId) as any;
  if (!invoice) {
    return res.status(404).json({ error: 'Facture introuvable.' });
  }

  if ((user.role === 'SALES_ADMIN' || user.role === 'VRS') && user.dropPointId !== invoice.drop_point_id) {
    return res.status(403).json({ error: 'Action non autorisée sur un autre Drop Point.' });
  }

  if (invoice.payment_status === 'PAYE' || invoice.remaining_amount <= 0) {
    return res.status(400).json({ error: 'Cette facture est déjà intégralement réglée.' });
  }

  if (numAmount > invoice.remaining_amount) {
    return res.status(400).json({
      error: `Le montant (${numAmount.toLocaleString('fr-FR')} FCFA) dépasse le solde restant (${invoice.remaining_amount.toLocaleString('fr-FR')} FCFA).`,
    });
  }

  const newPaid = Math.min(invoice.total_amount, invoice.paid_amount + numAmount);
  const newRemaining = Math.max(0, invoice.total_amount - newPaid);
  const newStatus = newRemaining === 0 ? 'PAYE' : 'PARTIELLEMENT_PAYE';

  // 1. Insert payment
  db.prepare(`
    INSERT INTO dp_invoice_payments (
      invoice_id, drop_point_id, recorded_by_user_id, amount, payment_date, payment_method, reference, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoiceId,
    invoice.drop_point_id,
    user.id,
    numAmount,
    paymentDate || new Date().toISOString().replace('T', ' ').substring(0, 19),
    paymentMethod,
    reference || null,
    notes || null
  );

  // 2. Update invoice
  db.prepare(`
    UPDATE dp_invoices
    SET paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newPaid, newRemaining, newStatus, invoiceId);

  logActivity(user, 'RECORD_DP_PAYMENT', invoice.invoice_number, `Paiement de ${numAmount.toLocaleString('fr-FR')} FCFA (${paymentMethod}) sur facture ${invoice.invoice_number}`, req);

  // If fully paid, unblock shipping if it was blocked
  if (newStatus === 'PAYE') {
    db.prepare('UPDATE dp_transfers SET shipping_blocked_unpaid = 0 WHERE invoice_id = ?').run(invoiceId);
  }

  res.json({
    message: 'Paiement enregistré avec succès.',
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      paymentStatus: newStatus,
    },
  });
});

// 6b. POST Generate definitive invoice (SAN only, solde = 0)
router.post('/invoices/:id/generate', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Seul le SAN peut générer la facture définitive pour le Drop Point.' });
  }

  const invoiceId = parseInt(req.params.id, 10);
  const invoice = db.prepare('SELECT * FROM dp_invoices WHERE id = ?').get(invoiceId) as any;
  if (!invoice) {
    return res.status(404).json({ error: 'Facture introuvable.' });
  }

  if (invoice.payment_status !== 'PAYE' || invoice.remaining_amount > 0) {
    return res.status(400).json({
      error: `La facture ne peut être générée que si le solde est à 0 (Solde restant : ${invoice.remaining_amount.toLocaleString('fr-FR')} FCFA).`,
    });
  }

  if (invoice.is_generated) {
    return res.status(400).json({ error: 'Cette facture définitive a déjà été générée et ne peut plus être modifiée.' });
  }

  const { applyTva } = req.body;
  const apply = applyTva !== false; // default true
  const totalTtc = invoice.total_amount;
  const totalHt = apply ? Math.round(totalTtc / 1.18) : totalTtc;
  const tvaAmount = apply ? (totalTtc - totalHt) : 0;
  const tvaApplicable = apply ? 1 : 0;

  db.prepare(`
    UPDATE dp_invoices
    SET is_generated = 1,
        generated_at = CURRENT_TIMESTAMP,
        generated_by_user_id = ?,
        tva_applicable = ?,
        tva_rate = 18.0,
        tva_amount = ?,
        total_ht = ?,
        total_ttc = ?,
        status = 'ACTIVE',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id, tvaApplicable, tvaAmount, totalHt, totalTtc, invoiceId);

  // Audit log
  logActivity(
    user,
    'GENERATE_DP_INVOICE',
    invoice.invoice_number,
    `Génération de la facture définitive acquittée ${invoice.invoice_number} (${totalTtc.toLocaleString('fr-FR')} FCFA TTC, TVA: ${apply ? '18%' : 'Exonérée'}) pour le Drop Point #${invoice.drop_point_id}.`,
    req
  );

  // Notification to SA
  const saUser = db.prepare("SELECT id FROM users WHERE role = 'SALES_ADMIN' AND drop_point_id = ? LIMIT 1").get(invoice.drop_point_id) as any;
  if (saUser) {
    createNotification(
      saUser.id,
      'SALES_ADMIN',
      invoice.drop_point_id,
      'Facture définitive acquittée disponible',
      `La facture définitive ${invoice.invoice_number} est désormais acquittée et consultable/imprimable en PDF (A4).`,
      'INVOICE',
      'dp-invoices'
    );
  }

  const updated = db.prepare('SELECT * FROM dp_invoices WHERE id = ?').get(invoiceId);
  res.json({ message: 'Facture définitive générée avec succès.', invoice: updated });
});

// 6c. POST Cancel generated invoice by Credit Note / Avoir (SAN only)
router.post('/invoices/:id/cancel-avoir', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Seul le SAN peut annuler une facture définitive par un avoir.' });
  }

  const invoiceId = parseInt(req.params.id, 10);
  const invoice = db.prepare('SELECT * FROM dp_invoices WHERE id = ?').get(invoiceId) as any;
  if (!invoice) return res.status(404).json({ error: 'Facture introuvable.' });

  if (!invoice.is_generated) {
    return res.status(400).json({ error: "Cette facture n'est pas encore générée." });
  }

  if (invoice.status === 'ANNULEE_AVOIR') {
    return res.status(400).json({ error: 'Cette facture a déjà été annulée par un avoir.' });
  }

  const { reason } = req.body;
  const creditNoteNum = `AVR-DP-2026-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;

  db.prepare(`
    UPDATE dp_invoices
    SET status = 'ANNULEE_AVOIR',
        credit_note_number = ?,
        credit_note_date = CURRENT_TIMESTAMP,
        credit_note_reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(creditNoteNum, reason || 'Annulation par avoir régularisateur', invoiceId);

  logActivity(
    user,
    'CANCEL_INVOICE_CREDIT_NOTE',
    invoice.invoice_number,
    `Annulation par avoir ${creditNoteNum} de la facture ${invoice.invoice_number}. Motif : ${reason || 'Avoir'}`,
    req
  );

  const saUser = db.prepare("SELECT id FROM users WHERE role = 'SALES_ADMIN' AND drop_point_id = ? LIMIT 1").get(invoice.drop_point_id) as any;
  if (saUser) {
    createNotification(
      saUser.id,
      'SALES_ADMIN',
      invoice.drop_point_id,
      'Facture annulée par avoir',
      `La facture ${invoice.invoice_number} a fait l'objet d'un avoir d'annulation ${creditNoteNum}.${reason ? ` Motif: ${reason}` : ''}`,
      'INVOICE',
      'dp-invoices'
    );
  }

  res.json({ message: 'Facture annulée par avoir avec succès.', creditNoteNumber: creditNoteNum });
});

// 6d. PATCH update a payment in case of error (SA or SAN)
router.patch('/invoices/payments/:paymentId', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const paymentId = parseInt(req.params.paymentId, 10);
  const { amount, paymentMethod, reference, notes, paymentDate } = req.body;

  const payment = db.prepare('SELECT * FROM dp_invoice_payments WHERE id = ?').get(paymentId) as any;
  if (!payment) return res.status(404).json({ error: 'Paiement introuvable.' });

  const invoice = db.prepare('SELECT * FROM dp_invoices WHERE id = ?').get(payment.invoice_id) as any;
  if (!invoice) return res.status(404).json({ error: 'Facture liée introuvable.' });

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== payment.drop_point_id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  if (invoice.is_generated && user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(400).json({ error: 'Cette facture est déjà définitive et acquittée. Modifications verrouillées.' });
  }

  const newAmount = amount !== undefined ? parseFloat(amount) : payment.amount;
  if (isNaN(newAmount) || newAmount <= 0) {
    return res.status(400).json({ error: 'Le montant doit être supérieur à zéro.' });
  }

  const diff = newAmount - payment.amount;
  const newPaid = invoice.paid_amount + diff;
  const newRemaining = invoice.total_amount - newPaid;

  if (newRemaining < 0) {
    return res.status(400).json({ error: `Le montant dépasse le total de la facture (${invoice.total_amount.toLocaleString('fr-FR')} FCFA).` });
  }

  const newStatus = newRemaining === 0 ? 'PAYE' : newPaid > 0 ? 'PARTIELLEMENT_PAYE' : 'A_PAYER';

  db.transaction(() => {
    db.prepare(`
      UPDATE dp_invoice_payments
      SET amount = ?,
          payment_method = COALESCE(?, payment_method),
          reference = COALESCE(?, reference),
          notes = COALESCE(?, notes),
          payment_date = COALESCE(?, payment_date)
      WHERE id = ?
    `).run(newAmount, paymentMethod || null, reference !== undefined ? reference : null, notes !== undefined ? notes : null, paymentDate || null, paymentId);

    db.prepare(`
      UPDATE dp_invoices
      SET paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPaid, newRemaining, newStatus, invoice.id);
  })();

  logActivity(
    user,
    'UPDATE_DP_PAYMENT',
    invoice.invoice_number,
    `Modification du paiement #${paymentId} sur facture ${invoice.invoice_number} (Nouveau montant: ${newAmount.toLocaleString('fr-FR')} FCFA)`,
    req
  );

  res.json({ message: 'Paiement modifié avec succès.' });
});

// 6e. POST cancel a payment in case of error (SA or SAN)
router.post('/invoices/payments/:paymentId/cancel', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const paymentId = parseInt(req.params.paymentId, 10);
  const { reason } = req.body;

  const payment = db.prepare('SELECT * FROM dp_invoice_payments WHERE id = ?').get(paymentId) as any;
  if (!payment) return res.status(404).json({ error: 'Paiement introuvable.' });

  if (payment.status === 'ANNULE') {
    return res.status(400).json({ error: 'Ce paiement est déjà annulé.' });
  }

  const invoice = db.prepare('SELECT * FROM dp_invoices WHERE id = ?').get(payment.invoice_id) as any;
  if (!invoice) return res.status(404).json({ error: 'Facture liée introuvable.' });

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== payment.drop_point_id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  if (invoice.is_generated && user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(400).json({ error: 'Cette facture est déjà définitive. Annulation verrouillée pour le SA.' });
  }

  const newPaid = Math.max(0, invoice.paid_amount - payment.amount);
  const newRemaining = Math.min(invoice.total_amount, invoice.remaining_amount + payment.amount);
  const newStatus = newPaid === 0 ? 'A_PAYER' : 'PARTIELLEMENT_PAYE';

  db.transaction(() => {
    db.prepare(`
      UPDATE dp_invoice_payments
      SET status = 'ANNULE',
          cancelled_at = CURRENT_TIMESTAMP,
          cancelled_by_user_id = ?,
          cancellation_reason = ?
      WHERE id = ?
    `).run(user.id, reason || 'Annulation erreur de saisie', paymentId);

    db.prepare(`
      UPDATE dp_invoices
      SET paid_amount = ?, remaining_amount = ?, payment_status = ?, is_generated = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPaid, newRemaining, newStatus, invoice.id);
  })();

  logActivity(
    user,
    'CANCEL_DP_PAYMENT',
    invoice.invoice_number,
    `Annulation du paiement de ${payment.amount.toLocaleString('fr-FR')} FCFA sur facture ${invoice.invoice_number}${reason ? ` (Motif: ${reason})` : ''}`,
    req
  );

  res.json({ message: 'Paiement annulé avec succès. Solde réajusté.' });
});

// 7. GET Transfers (Physical logistical tracking)
router.get('/transfers', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { status, dropPointId } = req.query;

  let query = `
    SELECT t.*,
           dp.name as dropPointName, dp.code as dropPointCode, dp.city as dropPointCity,
           sr.request_number as requestNumber, sr.total_cartons_approved as totalCartons,
           inv.invoice_number as invoiceNumber, inv.payment_status as invoicePaymentStatus,
           inv.total_amount as invoiceTotalAmount, inv.paid_amount as invoicePaidAmount, inv.remaining_amount as invoiceRemainingAmount,
           rec.first_name || ' ' || rec.last_name as receiverName
    FROM dp_transfers t
    JOIN drop_points dp ON t.drop_point_id = dp.id
    JOIN dp_supply_requests sr ON t.request_id = sr.id
    JOIN dp_invoices inv ON t.invoice_id = inv.id
    LEFT JOIN users rec ON t.received_by_user_id = rec.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'SALES_ADMIN') {
    query += ' AND t.drop_point_id = ?';
    params.push(user.dropPointId);
  } else if (dropPointId) {
    query += ' AND t.drop_point_id = ?';
    params.push(dropPointId);
  }

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }

  query += ' ORDER BY t.created_at DESC';

  const transfers = db.prepare(query).all(...params) as any[];

  // Attach items
  const getItemStmt = db.prepare(`
    SELECT i.*, p.name as productName, p.reference as productReference
    FROM dp_supply_request_items i
    JOIN products p ON i.product_id = p.id
    WHERE i.request_id = ?
  `);

  for (const t of transfers) {
    t.items = getItemStmt.all(t.request_id);
  }

  res.json({ transfers });
});

// 8. PATCH update Transfer status (Préparé -> En transit -> Reçu)
router.patch('/transfers/:id/status', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const transferId = parseInt(req.params.id, 10);
  const { newStatus } = req.body;

  if (newStatus !== 'EN_TRANSIT' && newStatus !== 'RECU') {
    return res.status(400).json({ error: 'Nouveau statut invalide (EN_TRANSIT ou RECU).' });
  }

  const transfer = db.prepare(`
    SELECT t.*, inv.payment_status as invoicePaymentStatus, inv.remaining_amount as invoiceRemainingAmount,
           sr.drop_point_id, dp.name as dropPointName, dp.code as dropPointCode
    FROM dp_transfers t
    JOIN dp_invoices inv ON t.invoice_id = inv.id
    JOIN dp_supply_requests sr ON t.request_id = sr.id
    JOIN drop_points dp ON t.drop_point_id = dp.id
    WHERE t.id = ?
  `).get(transferId) as any;

  if (!transfer) {
    return res.status(404).json({ error: 'Transfert introuvable.' });
  }

  const items = db.prepare(`
    SELECT product_id, COALESCE(quantity_approved, quantity_requested) as quantity
    FROM dp_supply_request_items
    WHERE request_id = ?
  `).all(transfer.request_id) as any[];

  if (newStatus === 'EN_TRANSIT') {
    if (user.role !== 'SALES_ADMIN_NATIONAL') {
      return res.status(403).json({ error: "Seul le SAN peut expédier les transferts depuis 6C Distribution." });
    }
    if (transfer.status !== 'PREPARE') {
      return res.status(400).json({ error: `Impossible d'expédier un transfert déjà ${transfer.status}.` });
    }

    // Check condition "Expédition conditionnée au paiement"
    const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'shipping_conditioned_on_payment'").get() as any;
    const isConditionActive = setting && (setting.value === '1' || setting.value === 'true');

    if (isConditionActive && transfer.invoicePaymentStatus !== 'PAYE') {
      db.prepare('UPDATE dp_transfers SET shipping_blocked_unpaid = 1 WHERE id = ?').run(transferId);
      return res.status(400).json({
        error: `Expédition bloquée : La facture associée n'est pas encore totalement payée (solde dû : ${transfer.invoiceRemainingAmount.toLocaleString('fr-FR')} FCFA).`,
        blocked: true,
      });
    }

    // Debit Central Depot Stock
    const getCentralStock = db.prepare('SELECT available_quantity FROM central_depot_stocks WHERE product_id = ?');
    const debitCentralStmt = db.prepare(`
      INSERT INTO central_depot_stocks (product_id, available_quantity)
      VALUES (?, ?)
      ON CONFLICT(product_id) DO UPDATE SET
        available_quantity = MAX(0, available_quantity - ?),
        updated_at = CURRENT_TIMESTAMP
    `);

    const insertTransferMvtStmt = db.prepare(`
      INSERT INTO stock_movements (
        reference, movement_type, source_role, source_id, target_role, target_id,
        drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type, related_entity_id, notes, created_by_user_id
      ) VALUES (?, 'TRANSFER', '6C_DISTRIBUTION', 0, 'DROP_POINT', ?, ?, ?, ?, ?, ?, 'DP_TRANSFER', ?, ?, ?)
    `);

    db.transaction(() => {
      for (const it of items) {
        const centralRow = getCentralStock.get(it.product_id) as any;
        const currentCentral = centralRow ? Number(centralRow.available_quantity) : 5000;
        const afterCentral = Math.max(0, currentCentral - it.quantity);
        debitCentralStmt.run(it.product_id, afterCentral, it.quantity);

        // Log stock movement with all required non-null fields
        insertTransferMvtStmt.run(
          transfer.transfer_number,
          transfer.drop_point_id,
          transfer.drop_point_id,
          it.product_id,
          it.quantity,
          currentCentral,
          afterCentral,
          transferId,
          `Expédition depuis 6C Distribution vers ${transfer.dropPointCode}`,
          user.id
        );
      }

      db.prepare(`
        UPDATE dp_transfers
        SET status = 'EN_TRANSIT', shipped_at = CURRENT_TIMESTAMP, shipping_blocked_unpaid = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(transferId);
    })();

    logActivity(user, 'SHIP_DP_TRANSFER', transfer.transfer_number, `Expédition transfert ${transfer.transfer_number} vers Drop Point ${transfer.dropPointCode}`, req);

    createNotification(
      null,
      'SALES_ADMIN',
      transfer.drop_point_id,
      'Transfert 6C Distribution en transit',
      `Le transfert ${transfer.transfer_number} est en transit depuis 6C Distribution vers votre dépôt. Préparez la Réception 6C Distribution.`,
      'SUPPLY',
      'dp-transfers'
    );

    return res.json({ message: 'Transfert expédié (En transit) avec succès.' });
  }

  if (newStatus === 'RECU') {
    if (user.role === 'SALES_ADMIN' && user.dropPointId !== transfer.drop_point_id) {
      return res.status(403).json({ error: 'Vous ne pouvez confirmer que les réceptions de votre propre Drop Point.' });
    }
    if (transfer.status !== 'EN_TRANSIT') {
      return res.status(400).json({ error: `Ce transfert doit d'abord être 'En transit' avant d'être réceptionné (actuellement : ${transfer.status}).` });
    }

    // Credit Drop Point Stock
    const getDpStock = db.prepare('SELECT available_quantity FROM drop_point_stocks WHERE drop_point_id = ? AND product_id = ?');
    const creditDpStmt = db.prepare(`
      INSERT INTO drop_point_stocks (drop_point_id, product_id, available_quantity)
      VALUES (?, ?, ?)
      ON CONFLICT(drop_point_id, product_id) DO UPDATE SET
        available_quantity = available_quantity + ?,
        updated_at = CURRENT_TIMESTAMP
    `);

    const insertReceiptMvtStmt = db.prepare(`
      INSERT INTO stock_movements (
        reference, movement_type, source_role, source_id, target_role, target_id,
        drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type, related_entity_id, notes, created_by_user_id
      ) VALUES (?, 'RECEIPT', '6C_DISTRIBUTION', 0, 'DROP_POINT', ?, ?, ?, ?, ?, ?, 'DP_TRANSFER', ?, ?, ?)
    `);

    db.transaction(() => {
      for (const it of items) {
        const dpStockRow = getDpStock.get(transfer.drop_point_id, it.product_id) as any;
        const currentDp = dpStockRow ? Number(dpStockRow.available_quantity) : 0;
        const afterDp = currentDp + it.quantity;
        creditDpStmt.run(transfer.drop_point_id, it.product_id, it.quantity, it.quantity);

        // Log stock movement with all required non-null fields
        insertReceiptMvtStmt.run(
          transfer.transfer_number,
          transfer.drop_point_id,
          transfer.drop_point_id,
          it.product_id,
          it.quantity,
          currentDp,
          afterDp,
          transferId,
          `Réception 6C Distribution confirmée par ${user.firstName} ${user.lastName}`,
          user.id
        );
      }

      db.prepare(`
        UPDATE dp_transfers
        SET status = 'RECU', received_at = CURRENT_TIMESTAMP, received_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(user.id, transferId);
    })();

    logActivity(user, 'RECEIVE_DP_TRANSFER', transfer.transfer_number, `Réception 6C Distribution confirmée pour le transfert ${transfer.transfer_number}`, req);

    createNotification(
      null,
      'SALES_ADMIN_NATIONAL',
      null,
      'Réception 6C Distribution confirmée',
      `Le Drop Point ${transfer.dropPointCode} a confirmé la Réception 6C Distribution du transfert ${transfer.transfer_number}.`,
      'SUPPLY',
      'dp-transfers'
    );

    return res.json({ message: 'Réception 6C Distribution confirmée avec succès. Le stock du Drop Point est mis à jour.' });
  }
});

// 9. GET & PATCH System Settings (Expédition conditionnée au paiement)
router.get('/settings', requireAuth, (_req: AuthRequest, res: Response) => {
  const row = db.prepare("SELECT value FROM system_settings WHERE key = 'shipping_conditioned_on_payment'").get() as any;
  const shippingConditionedOnPayment = row ? (row.value === '1' || row.value === 'true') : false;
  res.json({ shippingConditionedOnPayment });
});

router.patch('/settings', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Seul le SAN peut modifier les paramètres généraux.' });
  }

  const { shippingConditionedOnPayment } = req.body;
  const valStr = shippingConditionedOnPayment ? '1' : '0';

  db.prepare(`
    INSERT INTO system_settings (key, value)
    VALUES ('shipping_conditioned_on_payment', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(valStr);

  logActivity(user, 'UPDATE_SETTING', 'shipping_conditioned_on_payment', `Paramètre 'Expédition conditionnée au paiement' -> ${shippingConditionedOnPayment ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`, req);

  res.json({ shippingConditionedOnPayment: !!shippingConditionedOnPayment });
});

export default router;
