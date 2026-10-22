import express, { type Response } from 'express';
import { db } from '../db.ts';
import { requireAuth, type AuthRequest } from '../auth.ts';
import { logActivity } from './notificationsAndLogs.ts';
import { createNotification } from './notificationsAndLogs.ts';

export const vrsInvoicesRouter = express.Router();

// 1. GET VRS Invoices list & summary
vrsInvoicesRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { paymentStatus, vrsId, dropPointId } = req.query;

  let query = `
    SELECT inv.*,
           vrs.first_name || ' ' || vrs.last_name as vrsName,
           vrs.public_id as vrsPublicId,
           vrs.phone as vrsPhone,
           dp.name as dropPointName,
           dp.code as dropPointCode,
           dp.city as dropPointCity,
           sr.request_number as requestNumber,
           sr.total_cartons as totalCartons
    FROM vrs_invoices inv
    JOIN users vrs ON inv.vrs_id = vrs.id
    JOIN drop_points dp ON inv.drop_point_id = dp.id
    LEFT JOIN supply_requests sr ON inv.request_id = sr.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'VRS') {
    query += ' AND inv.vrs_id = ?';
    params.push(user.id);
  } else if (user.role === 'SALES_ADMIN') {
    query += ' AND inv.drop_point_id = ?';
    params.push(user.dropPointId);
    if (vrsId) {
      query += ' AND inv.vrs_id = ?';
      params.push(vrsId);
    }
  } else if (user.role === 'FSS') {
    query += ' AND (vrs.fss_id = ? OR inv.drop_point_id = ?)';
    params.push(user.id, user.dropPointId);
    if (vrsId) {
      query += ' AND inv.vrs_id = ?';
      params.push(vrsId);
    }
  } else {
    // SAN or ADMIN
    if (dropPointId) {
      query += ' AND inv.drop_point_id = ?';
      params.push(dropPointId);
    }
    if (vrsId) {
      query += ' AND inv.vrs_id = ?';
      params.push(vrsId);
    }
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
    FROM vrs_invoice_payments p
    LEFT JOIN users u ON p.vrs_id = u.id
    WHERE p.invoice_id = ?
    ORDER BY p.payment_date DESC
  `);

  const getItemStmt = db.prepare(`
    SELECT sri.*, p.name as productName, p.reference as productReference,
           COALESCE(p.vrs_cession_price, p.unit_price) as unitCessionPrice,
           p.units_per_carton as unitsPerCarton
    FROM supply_request_items sri
    JOIN products p ON sri.product_id = p.id
    WHERE sri.request_id = ?
  `);

  for (const inv of invoices) {
    inv.payments = getPayStmt.all(inv.id);
    inv.items = inv.request_id ? getItemStmt.all(inv.request_id) : [];
  }

  // Calculate summary KPI
  let totalUnpaid = 0;
  let totalPaid = 0;
  let totalBilled = 0;
  for (const inv of invoices) {
    totalUnpaid += inv.remaining_amount || 0;
    totalPaid += inv.paid_amount || 0;
    totalBilled += inv.total_amount || 0;
  }

  res.json({
    invoices,
    summary: {
      totalUnpaid,
      totalPaid,
      totalBilled,
      count: invoices.length,
    },
  });
});

// 2. GET single VRS invoice
vrsInvoicesRouter.get('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const invoiceId = parseInt(req.params.id, 10);

  const inv = db.prepare(`
    SELECT inv.*,
           vrs.first_name || ' ' || vrs.last_name as vrsName,
           vrs.public_id as vrsPublicId,
           vrs.phone as vrsPhone,
           dp.name as dropPointName,
           dp.code as dropPointCode,
           dp.city as dropPointCity,
           sr.request_number as requestNumber,
           sr.total_cartons as totalCartons
    FROM vrs_invoices inv
    JOIN users vrs ON inv.vrs_id = vrs.id
    JOIN drop_points dp ON inv.drop_point_id = dp.id
    LEFT JOIN supply_requests sr ON inv.request_id = sr.id
    WHERE inv.id = ?
  `).get(invoiceId) as any;

  if (!inv) {
    return res.status(404).json({ error: 'Facture VRS introuvable.' });
  }

  if (user.role === 'VRS' && inv.vrs_id !== user.id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }
  if (user.role === 'SALES_ADMIN' && inv.drop_point_id !== user.dropPointId) {
    return res.status(403).json({ error: 'Action non autorisée sur un autre Drop Point.' });
  }

  inv.payments = db.prepare(`
    SELECT p.*, u.first_name || ' ' || u.last_name as recordedByName
    FROM vrs_invoice_payments p
    LEFT JOIN users u ON p.vrs_id = u.id
    WHERE p.invoice_id = ?
    ORDER BY p.payment_date DESC
  `).all(inv.id);

  inv.items = inv.request_id ? db.prepare(`
    SELECT sri.*, p.name as productName, p.reference as productReference,
           COALESCE(p.vrs_cession_price, p.unit_price) as unitCessionPrice,
           p.units_per_carton as unitsPerCarton
    FROM supply_request_items sri
    JOIN products p ON sri.product_id = p.id
    WHERE sri.request_id = ?
  `).all(inv.request_id) : [];

  res.json({ invoice: inv });
});

// 3. POST record payment on VRS invoice
vrsInvoicesRouter.post('/:id/payments', requireAuth, (req: AuthRequest, res: Response) => {
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

  const invoice = db.prepare('SELECT * FROM vrs_invoices WHERE id = ?').get(invoiceId) as any;
  if (!invoice) {
    return res.status(404).json({ error: 'Facture VRS introuvable.' });
  }

  if (user.role === 'VRS' && user.id !== invoice.vrs_id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }
  if (user.role === 'SALES_ADMIN' && user.dropPointId !== invoice.drop_point_id) {
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

  db.transaction(() => {
    db.prepare(`
      INSERT INTO vrs_invoice_payments (
        invoice_id, vrs_id, drop_point_id, amount, payment_date, payment_method, reference, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRME')
    `).run(
      invoiceId,
      invoice.vrs_id,
      invoice.drop_point_id,
      numAmount,
      paymentDate || new Date().toISOString().replace('T', ' ').substring(0, 19),
      paymentMethod,
      reference || null,
      notes || null
    );

    db.prepare(`
      UPDATE vrs_invoices
      SET paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPaid, newRemaining, newStatus, invoiceId);
  })();

  logActivity(
    user,
    'RECORD_VRS_PAYMENT',
    invoice.invoice_number,
    `Règlement de ${numAmount.toLocaleString('fr-FR')} FCFA (${paymentMethod}) sur facture VRS ${invoice.invoice_number}`,
    req
  );

  // Notify recipient
  if (user.role === 'VRS') {
    createNotification(
      null,
      'SALES_ADMIN',
      invoice.drop_point_id,
      'Paiement facture VRS reçu',
      `Le vendeur ${user.firstName} ${user.lastName} a versé ${numAmount.toLocaleString('fr-FR')} FCFA sur la facture ${invoice.invoice_number} (${paymentMethod}).`,
      'INVOICE',
      'dp-invoices'
    );
  } else {
    createNotification(
      invoice.vrs_id,
      null,
      invoice.drop_point_id,
      'Règlement enregistré sur votre facture',
      `Un paiement de ${numAmount.toLocaleString('fr-FR')} FCFA a été enregistré sur votre facture ${invoice.invoice_number}. Solde restant: ${newRemaining.toLocaleString('fr-FR')} FCFA.`,
      'INVOICE',
      'dp-invoices'
    );
  }

  res.json({
    message: 'Paiement enregistré avec succès.',
    paidAmount: newPaid,
    remainingAmount: newRemaining,
    paymentStatus: newStatus,
  });
});

// 4. POST Generate definitive invoice for VRS (Sales Admin only, solde = 0)
vrsInvoicesRouter.post('/:id/generate', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN' && user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Seul le Sales Admin peut générer la facture définitive pour le VRS.' });
  }

  const invoiceId = parseInt(req.params.id, 10);
  const invoice = db.prepare('SELECT * FROM vrs_invoices WHERE id = ?').get(invoiceId) as any;
  if (!invoice) {
    return res.status(404).json({ error: 'Facture VRS introuvable.' });
  }

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== invoice.drop_point_id) {
    return res.status(403).json({ error: 'Action non autorisée sur un autre Drop Point.' });
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
    UPDATE vrs_invoices
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

  logActivity(
    user,
    'GENERATE_VRS_INVOICE',
    invoice.invoice_number,
    `Génération de la facture définitive acquittée ${invoice.invoice_number} (${totalTtc.toLocaleString('fr-FR')} FCFA TTC, TVA: ${apply ? '18%' : 'Exonérée'}) pour le vendeur #${invoice.vrs_id}.`,
    req
  );

  // Notification to VRS
  createNotification(
    invoice.vrs_id,
    null,
    invoice.drop_point_id,
    'Facture définitive acquittée disponible',
    `Votre facture ${invoice.invoice_number} est désormais acquittée et téléchargeable en PDF (A4).`,
    'INVOICE',
    'dp-invoices'
  );

  const updated = db.prepare('SELECT * FROM vrs_invoices WHERE id = ?').get(invoiceId);
  res.json({ message: 'Facture définitive générée avec succès pour le VRS.', invoice: updated });
});

// 5. POST Cancel generated invoice by Credit Note / Avoir (Sales Admin)
vrsInvoicesRouter.post('/:id/cancel-avoir', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN' && user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Seul le Sales Admin peut annuler une facture définitive par un avoir.' });
  }

  const invoiceId = parseInt(req.params.id, 10);
  const invoice = db.prepare('SELECT * FROM vrs_invoices WHERE id = ?').get(invoiceId) as any;
  if (!invoice) return res.status(404).json({ error: 'Facture VRS introuvable.' });

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== invoice.drop_point_id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  if (!invoice.is_generated) {
    return res.status(400).json({ error: "Cette facture n'est pas encore générée." });
  }

  if (invoice.status === 'ANNULEE_AVOIR') {
    return res.status(400).json({ error: 'Cette facture a déjà été annulée par un avoir.' });
  }

  const { reason } = req.body;
  const creditNoteNum = `AVR-VRS-2026-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;

  db.prepare(`
    UPDATE vrs_invoices
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
    `Annulation par avoir ${creditNoteNum} de la facture VRS ${invoice.invoice_number}. Motif : ${reason || 'Avoir'}`,
    req
  );

  createNotification(
    invoice.vrs_id,
    null,
    invoice.drop_point_id,
    'Facture annulée par avoir',
    `Votre facture ${invoice.invoice_number} a fait l'objet d'un avoir d'annulation ${creditNoteNum}.${reason ? ` Motif: ${reason}` : ''}`,
    'INVOICE',
    'dp-invoices'
  );

  res.json({ message: 'Facture annulée par avoir avec succès.', creditNoteNumber: creditNoteNum });
});

// 6. PATCH update a payment in case of error (VRS or SA)
vrsInvoicesRouter.patch('/payments/:paymentId', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const paymentId = parseInt(req.params.paymentId, 10);
  const { amount, paymentMethod, reference, notes, paymentDate } = req.body;

  const payment = db.prepare('SELECT * FROM vrs_invoice_payments WHERE id = ?').get(paymentId) as any;
  if (!payment) return res.status(404).json({ error: 'Paiement introuvable.' });

  const invoice = db.prepare('SELECT * FROM vrs_invoices WHERE id = ?').get(payment.invoice_id) as any;
  if (!invoice) return res.status(404).json({ error: 'Facture liée introuvable.' });

  if (user.role === 'VRS' && user.id !== payment.vrs_id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }
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
      UPDATE vrs_invoice_payments
      SET amount = ?,
          payment_method = COALESCE(?, payment_method),
          reference = COALESCE(?, reference),
          notes = COALESCE(?, notes),
          payment_date = COALESCE(?, payment_date)
      WHERE id = ?
    `).run(newAmount, paymentMethod || null, reference !== undefined ? reference : null, notes !== undefined ? notes : null, paymentDate || null, paymentId);

    db.prepare(`
      UPDATE vrs_invoices
      SET paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPaid, newRemaining, newStatus, invoice.id);
  })();

  logActivity(
    user,
    'UPDATE_VRS_PAYMENT',
    invoice.invoice_number,
    `Modification du paiement #${paymentId} sur facture VRS ${invoice.invoice_number} (Nouveau montant: ${newAmount.toLocaleString('fr-FR')} FCFA)`,
    req
  );

  res.json({ message: 'Paiement modifié avec succès.' });
});

// 7. POST cancel a payment in case of error (VRS or SA)
vrsInvoicesRouter.post('/payments/:paymentId/cancel', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const paymentId = parseInt(req.params.paymentId, 10);
  const { reason } = req.body;

  const payment = db.prepare('SELECT * FROM vrs_invoice_payments WHERE id = ?').get(paymentId) as any;
  if (!payment) return res.status(404).json({ error: 'Paiement introuvable.' });

  if (payment.status === 'ANNULE') {
    return res.status(400).json({ error: 'Ce paiement est déjà annulé.' });
  }

  const invoice = db.prepare('SELECT * FROM vrs_invoices WHERE id = ?').get(payment.invoice_id) as any;
  if (!invoice) return res.status(404).json({ error: 'Facture liée introuvable.' });

  if (user.role === 'VRS' && user.id !== payment.vrs_id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }
  if (user.role === 'SALES_ADMIN' && user.dropPointId !== payment.drop_point_id) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  if (invoice.is_generated && user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(400).json({ error: 'Cette facture est déjà définitive. Annulation verrouillée pour le vendeur.' });
  }

  const newPaid = Math.max(0, invoice.paid_amount - payment.amount);
  const newRemaining = Math.min(invoice.total_amount, invoice.remaining_amount + payment.amount);
  const newStatus = newPaid === 0 ? 'A_PAYER' : 'PARTIELLEMENT_PAYE';

  db.transaction(() => {
    db.prepare(`
      UPDATE vrs_invoice_payments
      SET status = 'ANNULE',
          cancelled_at = CURRENT_TIMESTAMP,
          cancelled_by_user_id = ?,
          cancellation_reason = ?
      WHERE id = ?
    `).run(user.id, reason || 'Annulation erreur de saisie', paymentId);

    db.prepare(`
      UPDATE vrs_invoices
      SET paid_amount = ?, remaining_amount = ?, payment_status = ?, is_generated = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPaid, newRemaining, newStatus, invoice.id);
  })();

  logActivity(
    user,
    'CANCEL_VRS_PAYMENT',
    invoice.invoice_number,
    `Annulation du paiement de ${payment.amount.toLocaleString('fr-FR')} FCFA sur facture VRS ${invoice.invoice_number}${reason ? ` (Motif: ${reason})` : ''}`,
    req
  );

  res.json({ message: 'Paiement annulé avec succès. Solde réajusté.' });
});
