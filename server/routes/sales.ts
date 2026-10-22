import { Router, type Response } from 'express';
import { db, backupVrsStocksAndSales, triggerMasterBackup } from '../db.ts';
import { requireAuth, type AuthRequest, logActivity, createNotification } from '../auth.ts';
import { getBamakoDateInfo } from '../salesAggregation.ts';

const router = Router();

// GET sales with scope isolation
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { pointOfSaleId, vrsId, dropPointId, dateFrom, dateTo, status } = req.query;

  let query = `
    SELECT s.id,
           s.sale_number as saleNumber,
           s.sale_number,
           s.vrs_id as vrsId,
           s.vrs_id,
           s.drop_point_id as dropPointId,
           s.drop_point_id,
           s.point_of_sale_id as pointOfSaleId,
           s.point_of_sale_id,
           s.total_amount as totalAmount,
           s.total_amount,
           s.discount,
           s.notes,
           s.status,
           s.created_at as createdAt,
           s.created_at,
           vrs.first_name || ' ' || vrs.last_name as vrsName,
           vrs.public_id as vrsPublicId,
           vrs.phone as vrsPhone,
           COALESCE(pos.name, 'Point de Vente Client') as posName,
           COALESCE(pos.code, 'POS-DIR') as posCode,
           COALESCE(pos.owner_name, 'Client Comptant') as posOwner,
           COALESCE(pos.phone, '-') as posPhone,
           COALESCE(pos.address, '-') as posAddress,
           COALESCE(pos.neighborhood, '-') as posNeighborhood,
           COALESCE(dp.name, 'Drop Point DAKAN') as dropPointName,
           COALESCE(dp.code, 'DKN') as dropPointCode,
           COALESCE(dp.city, 'Dakan') as dropPointCity,
           COALESCE(dp.address, '-') as dropPointAddress,
           COALESCE(dp.phone, '-') as dropPointPhone,
           (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as itemCount,
           (SELECT SUM(quantity_cartons) FROM sale_items WHERE sale_id = s.id) as totalCartons
    FROM sales s
    JOIN users vrs ON s.vrs_id = vrs.id
    LEFT JOIN points_of_sale pos ON s.point_of_sale_id = pos.id
    LEFT JOIN drop_points dp ON s.drop_point_id = dp.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (user.role === 'VRS') {
    query += ' AND s.vrs_id = ?';
    params.push(user.id);
  } else if (user.role === 'FSS') {
    query += ' AND (vrs.fss_id = ? OR s.vrs_id = ?)';
    params.push(user.id, user.id);
  } else if (user.role === 'SALES_ADMIN') {
    query += ' AND s.drop_point_id = ?';
    params.push(user.dropPointId);
    if (vrsId) {
      query += ' AND s.vrs_id = ?';
      params.push(vrsId);
    }
  } else {
    // SALES_ADMIN_NATIONAL
    if (dropPointId) {
      query += ' AND s.drop_point_id = ?';
      params.push(dropPointId);
    }
    if (vrsId) {
      query += ' AND s.vrs_id = ?';
      params.push(vrsId);
    }
  }

  if (pointOfSaleId) {
    query += ' AND s.point_of_sale_id = ?';
    params.push(pointOfSaleId);
  }

  if (status) {
    query += ' AND s.status = ?';
    params.push(status);
  }

  if (dateFrom) {
    query += ' AND date(s.created_at) >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    query += ' AND date(s.created_at) <= ?';
    params.push(dateTo);
  }

  query += ' ORDER BY s.created_at DESC';

  const sales = db.prepare(query).all(...params) as any[];

  for (const s of sales) {
    s.items = db.prepare(`
      SELECT si.id,
             si.sale_id as saleId,
             si.product_id as productId,
             si.quantity_cartons as quantityCartons,
             si.unit_price as unitPrice,
             si.total_price as totalPrice,
             COALESCE(si.stock_before, sm.stock_before, 0) as stockBefore,
             COALESCE(si.stock_after, sm.stock_after, 0) as stockAfter,
             p.name as productName, p.reference as productRef, c.name as categoryName
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock_movements sm ON sm.related_entity_id = si.sale_id
                                  AND sm.related_entity_type = 'SALE'
                                  AND sm.product_id = si.product_id
      WHERE si.sale_id = ?
    `).all(s.id);
  }

  res.json({ sales });
});

// GET single sale with complete details (useful for thermal receipt 80x55mm)
router.get('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const saleId = parseInt(req.params.id, 10);
  if (isNaN(saleId)) {
    return res.status(400).json({ error: 'Identifiant de vente invalide' });
  }

  const sale = db.prepare(`
    SELECT s.id,
           s.sale_number as saleNumber,
           s.sale_number,
           s.vrs_id as vrsId,
           s.vrs_id,
           s.drop_point_id as dropPointId,
           s.drop_point_id,
           s.point_of_sale_id as pointOfSaleId,
           s.point_of_sale_id,
           s.total_amount as totalAmount,
           s.total_amount,
           s.discount,
           s.notes,
           s.status,
           s.created_at as createdAt,
           s.created_at,
           vrs.first_name || ' ' || vrs.last_name as vrsName,
           vrs.public_id as vrsPublicId,
           vrs.phone as vrsPhone,
           COALESCE(pos.name, 'Point de Vente Client') as posName,
           COALESCE(pos.code, 'POS-DIR') as posCode,
           COALESCE(pos.owner_name, 'Client Comptant') as posOwner,
           COALESCE(pos.phone, '-') as posPhone,
           COALESCE(pos.address, '-') as posAddress,
           COALESCE(pos.neighborhood, '-') as posNeighborhood,
           COALESCE(dp.name, 'Drop Point DAKAN') as dropPointName,
           COALESCE(dp.code, 'DKN') as dropPointCode,
           COALESCE(dp.city, 'Dakan') as dropPointCity,
           COALESCE(dp.address, '-') as dropPointAddress,
           COALESCE(dp.phone, '-') as dropPointPhone,
           (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as itemCount,
           (SELECT SUM(quantity_cartons) FROM sale_items WHERE sale_id = s.id) as totalCartons
    FROM sales s
    JOIN users vrs ON s.vrs_id = vrs.id
    LEFT JOIN points_of_sale pos ON s.point_of_sale_id = pos.id
    LEFT JOIN drop_points dp ON s.drop_point_id = dp.id
    WHERE s.id = ?
  `).get(saleId) as any;

  if (!sale) {
    return res.status(404).json({ error: 'Vente introuvable' });
  }

  // A seller can only see their own sales
  if (user.role === 'VRS' && sale.vrs_id !== user.id) {
    return res.status(403).json({ error: 'Accès refusé. Vous ne pouvez consulter que vos propres ventes.' });
  }

  sale.items = db.prepare(`
    SELECT si.id,
           si.sale_id as saleId,
           si.product_id as productId,
           si.quantity_cartons as quantityCartons,
           si.unit_price as unitPrice,
           si.total_price as totalPrice,
           COALESCE(si.stock_before, 0) as stockBefore,
           COALESCE(si.stock_after, 0) as stockAfter,
           p.name as productName, p.reference as productRef, c.name as categoryName
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE si.sale_id = ?
  `).all(saleId);

  res.json({ sale });
});

// POST create new sale (Atomic stock deduction)
router.post('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { pointOfSaleId, items, discount, notes } = req.body;

  if (!pointOfSaleId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Point de vente et produits requis pour valider la vente.' });
  }

  // Only VRS (or admin on behalf of VRS) can sell
  const sellerId = user.role === 'VRS' ? user.id : (req.body.vrsId ? parseInt(req.body.vrsId, 10) : user.id);
  const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(sellerId) as any;
  if (!seller) {
    return res.status(400).json({ error: 'Vendeur introuvable.' });
  }

  const posId = parseInt(pointOfSaleId, 10);
  const pos = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(posId) as any;
  if (!pos) {
    return res.status(400).json({ error: 'Point de vente introuvable.' });
  }

  // 1. SOURCE UNIQUE: drop_point_id is deduced strictly from the VRS seller (never manually entered or deduced from PDV)
  const dpId = seller.drop_point_id ? Number(seller.drop_point_id) : 1;

  const saleNumber = `VNT-${Date.now().toString().slice(-6)}`;
  const discountAmount = parseFloat(discount || 0);

  // Mandatory GPS verification for VRS sellers to prevent fraudulent declarations
  let saleLat: number | null = null;
  let saleLng: number | null = null;
  let saleAcc: number | null = null;

  if (seller.role === 'VRS') {
    const rawLat = req.body.latitude;
    const rawLng = req.body.longitude;
    const rawAcc = req.body.accuracy;

    if (rawLat !== undefined && rawLng !== undefined && rawLat !== null && rawLng !== null) {
      const parsedLat = typeof rawLat === 'number' ? rawLat : parseFloat(rawLat);
      const parsedLng = typeof rawLng === 'number' ? rawLng : parseFloat(rawLng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng) && (Math.abs(parsedLat) > 0.001 || Math.abs(parsedLng) > 0.001)) {
        saleLat = parsedLat;
        saleLng = parsedLng;
        saleAcc = rawAcc ? (typeof rawAcc === 'number' ? rawAcc : parseFloat(rawAcc)) : null;
      }
    }

    // If coordinates were not sent directly, verify that the seller has an active recent GPS location (< 30 min)
    if (saleLat === null || saleLng === null) {
      if (seller.last_latitude && seller.last_longitude && seller.last_location_updated_at) {
        const diffMinutes = (Date.now() - new Date(seller.last_location_updated_at).getTime()) / (1000 * 60);
        if (diffMinutes <= 30) {
          saleLat = seller.last_latitude;
          saleLng = seller.last_longitude;
          saleAcc = seller.last_location_accuracy;
        }
      }
    }

    // If still no valid GPS, strictly block the sale!
    if (saleLat === null || saleLng === null) {
      return res.status(403).json({
        error: "Géolocalisation GPS obligatoire : impossible d'enregistrer une vente terrain sans signal GPS actif. Veuillez activer votre GPS sur cet appareil.",
        code: 'GPS_REQUIRED'
      });
    }

    // Update user's last known location and log in location history
    try {
      db.prepare(`
        UPDATE users
        SET last_latitude = ?, last_longitude = ?, last_location_accuracy = ?, last_location_updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(saleLat, saleLng, saleAcc, seller.id);

      db.prepare(`
        INSERT INTO vrs_location_history (vrs_id, latitude, longitude, accuracy, action_context)
        VALUES (?, ?, ?, ?, 'SALE')
      `).run(seller.id, saleLat, saleLng, saleAcc);
    } catch (gpsErr) {
      console.warn('GPS trace update notice:', gpsErr);
    }
  }

  // ATOMIC TRANSACTION: Check stock, deduct, insert sale and items, insert movements, update POS
  const processSale = db.transaction(() => {
    let calculatedTotal = 0;
    const validatedItems: { prodId: number; name: string; qty: number; unitPrice: number; total: number; currentQty: number }[] = [];

    // Phase 1: Verify all products and available stock
    for (const item of items) {
      const rawProdId = item.productId ?? item.product_id ?? item.id;
      const prodId = parseInt(rawProdId, 10);

      if (isNaN(prodId) || prodId <= 0) {
        throw new Error('Identifiant de produit invalide ou manquant.');
      }

      const qty = parseInt(item.quantityCartons ?? item.quantity_cartons ?? item.quantity, 10);

      if (isNaN(qty) || qty <= 0) {
        throw new Error('La quantité vendue doit être un nombre positif de cartons.');
      }

      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId) as any;
      if (!prod) {
        throw new Error(`Produit #${prodId} introuvable.`);
      }

      // Verify actual available stock (strictly manual: NO automatic allocation)
      let available = 0;
      if (seller.role === 'VRS') {
        const stockRow = db.prepare(`
          SELECT available_quantity FROM vrs_stocks WHERE vrs_id = ? AND product_id = ?
        `).get(sellerId, prodId) as { available_quantity: number } | undefined;

        available = stockRow ? stockRow.available_quantity : 0;
        if (available < qty) {
          throw new Error(
            `Stock insuffisant pour le produit '${prod.name}'. Stock disponible du vendeur : ${available} carton(s), demandé : ${qty} carton(s). ` +
            `L'allocation de stock automatique est désactivée. Un réapprovisionnement manuel (demande d'approvisionnement ou allocation manuelle par le Sales Admin) est requis.`
          );
        }
      } else {
        const dpStockRow = db.prepare(`
          SELECT available_quantity FROM drop_point_stocks WHERE drop_point_id = ? AND product_id = ?
        `).get(dpId, prodId) as { available_quantity: number } | undefined;

        available = dpStockRow ? dpStockRow.available_quantity : 0;
        if (available < qty) {
          throw new Error(
            `Stock insuffisant pour le produit '${prod.name}' dans le Dépôt. Stock disponible : ${available} carton(s), demandé : ${qty} carton(s). ` +
            `L'allocation de stock automatique est désactivée. Une demande d'approvisionnement transmise au SAN ou une réception BL manuelle est requise.`
          );
        }
      }

      const unitPrice = parseFloat(item.unitPrice || prod.unit_price);
      const itemTotal = qty * unitPrice;
      calculatedTotal += itemTotal;

      validatedItems.push({
        prodId,
        name: prod.name,
        qty,
        unitPrice,
        total: itemTotal,
        currentQty: available
      });
    }

    const finalAmount = Math.max(0, calculatedTotal - discountAmount);

    // Africa/Bamako local date and time: ensures immediate consistency with today's KPI and monthly bounds
    const bamakoInfo = getBamakoDateInfo();
    const saleCreatedAt = req.body.createdAt || bamakoInfo.nowTimestamp;

    // Phase 2: Insert Sale with certified GPS coordinates and Africa/Bamako timestamp
    const saleResult = db.prepare(`
      INSERT INTO sales (sale_number, vrs_id, drop_point_id, point_of_sale_id, total_amount, discount, notes, status, latitude, longitude, location_accuracy, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?)
    `).run(saleNumber, sellerId, dpId, posId, finalAmount, discountAmount, notes || '', saleLat, saleLng, saleAcc, saleCreatedAt, saleCreatedAt);
    const saleId = saleResult.lastInsertRowid as number;

    const itemStmt = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, quantity_cartons, unit_price, total_price, stock_before, stock_after)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Phase 3: Deduct stock and record movements
    for (const vi of validatedItems) {
      const before = vi.currentQty;
      const after = before - vi.qty;
      itemStmt.run(saleId, vi.prodId, vi.qty, vi.unitPrice, vi.total, before, after);

      // Update stock atomically (VRS or Drop Point)
      if (seller.role === 'VRS') {
        db.prepare(`
          UPDATE vrs_stocks
          SET available_quantity = ?, updated_at = ?
          WHERE vrs_id = ? AND product_id = ?
        `).run(after, saleCreatedAt, sellerId, vi.prodId);
      } else {
        db.prepare(`
          UPDATE drop_point_stocks
          SET available_quantity = ?, updated_at = ?
          WHERE drop_point_id = ? AND product_id = ?
        `).run(after, saleCreatedAt, dpId, vi.prodId);
      }

      // Record negative stock movement
      const sourceRole = seller.role === 'VRS' ? 'VRS' : 'DROP_POINT';
      db.prepare(`
        INSERT INTO stock_movements (
          reference, movement_type, source_role, source_id, target_role, target_id,
          drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type, related_entity_id, notes, created_by_user_id, created_at
        ) VALUES (?, 'SALE', ?, ?, 'PDV', ?, ?, ?, ?, ?, ?, 'SALE', ?, ?, ?, ?)
      `).run(
        `MVT-VNT-${saleId}-${vi.prodId}`,
        sourceRole,
        sellerId,
        posId,
        dpId,
        vi.prodId,
        -vi.qty,
        before,
        after,
        saleId,
        `Vente #${saleNumber} au PDV ${pos.name} (-${vi.qty} cartons)`,
        user.id,
        saleCreatedAt
      );
    }

    // Phase 4: Atomic update of POS activity timestamp
    db.prepare(`
      UPDATE points_of_sale
      SET updated_at = ?
      WHERE id = ?
    `).run(saleCreatedAt, posId);

    return { saleId, finalAmount };
  });

  try {
    const { saleId, finalAmount } = processSale();

    logActivity(user, 'CREATE_SALE', saleNumber, `Vente #${saleNumber} au PDV ${pos.name} (${finalAmount.toLocaleString('fr-FR')} FCFA)`, req);
    createNotification(null, 'SALES_ADMIN', dpId, 'Nouvelle vente enregistrée', `Vente #${saleNumber} réalisée par ${seller.first_name} ${seller.last_name} (${finalAmount.toLocaleString('fr-FR')} FCFA).`, 'SALE', '/sales');

    backupVrsStocksAndSales();
    triggerMasterBackup(true);
    try {
      db.pragma('wal_checkpoint(PASSIVE)');
    } catch {}

    res.status(201).json({
      saleId,
      saleNumber,
      message: 'Vente enregistrée avec succès. Stock mis à jour.'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la validation de la vente.' });
  }
});

// CANCEL a sale (Restore stock, inverse movement) (Section 38)
router.patch('/:id/cancel', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const saleId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as any;
  if (!sale) {
    return res.status(404).json({ error: 'Vente introuvable.' });
  }

  if (sale.status === 'CANCELLED') {
    return res.status(400).json({ error: 'Cette vente a déjà été annulée.' });
  }

  // Permission check: VRS can only cancel their own sale within 24h, SA / SAN can cancel any sale in their scope
  if (user.role === 'VRS' && sale.vrs_id !== user.id) {
    return res.status(403).json({ error: 'Vous ne pouvez pas annuler une vente qui n\'est pas la vôtre.' });
  }
  if (user.role === 'SALES_ADMIN' && user.dropPointId !== sale.drop_point_id) {
    return res.status(403).json({ error: 'Cette vente n\'appartient pas à votre Drop Point.' });
  }

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId) as any[];

  // Atomic cancellation transaction
  const executeCancellation = db.transaction(() => {
    // 1. Mark sale as CANCELLED
    db.prepare(`
      UPDATE sales SET status = 'CANCELLED', notes = notes || ' [ANNULÉE: ' || ? || ']' WHERE id = ?
    `).run(reason || 'Annulation manuelle', saleId);

    // 2. Restore VRS stock for each item and record inverse movement
    for (const it of items) {
      const vrsStock = db.prepare(`
        SELECT available_quantity FROM vrs_stocks WHERE vrs_id = ? AND product_id = ?
      `).get(sale.vrs_id, it.product_id) as { available_quantity: number } | undefined;

      const before = vrsStock ? vrsStock.available_quantity : 0;
      const after = before + it.quantity_cartons;

      db.prepare(`
        INSERT INTO vrs_stocks (vrs_id, drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
        VALUES (?, ?, ?, ?, 0, 3)
        ON CONFLICT(vrs_id, product_id)
        DO UPDATE SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP
      `).run(sale.vrs_id, sale.drop_point_id, after, it.quantity_cartons);

      // Inverse movement
      db.prepare(`
        INSERT INTO stock_movements (
          reference, movement_type, source_role, source_id, target_role, target_id,
          drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type, related_entity_id, notes, created_by_user_id
        ) VALUES (?, 'CANCELLATION', 'PDV', ?, 'VRS', ?, ?, ?, ?, ?, ?, 'SALE_CANCELLATION', ?, ?, ?)
      `).run(
        `MVT-CANC-${saleId}-${it.product_id}`,
        sale.point_of_sale_id,
        sale.vrs_id,
        sale.drop_point_id,
        it.product_id,
        it.quantity_cartons,
        before,
        after,
        saleId,
        `Annulation vente #${sale.sale_number} (+${it.quantity_cartons} cartons restitués)`,
        user.id
      );
    }
  });

  try {
    executeCancellation();

    backupVrsStocksAndSales();
    triggerMasterBackup(true);
    try {
      db.pragma('wal_checkpoint(PASSIVE)');
    } catch {}

    logActivity(user, 'CANCEL_SALE', sale.sale_number, `Annulation de la vente #${sale.sale_number} (Restitution du stock)`, req);

    res.json({ message: `Vente #${sale.sale_number} annulée avec succès. Le stock a été restitué au vendeur.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de l\'annulation de la vente.' });
  }
});

// POST sync offline sales recorded in the field without internet
router.post('/sync-offline', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { sales: incomingSales } = req.body;

  if (!Array.isArray(incomingSales) || incomingSales.length === 0) {
    return res.json({ success: true, count: 0, sales: [], message: 'Aucune vente hors-ligne à synchroniser.' });
  }

  const sellerId = user.id;
  const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(sellerId) as any;
  if (!seller) {
    return res.status(400).json({ error: 'Vendeur introuvable pour la synchronisation.' });
  }

  const syncedSales: any[] = [];
  const errors: string[] = [];

  const syncTx = db.transaction(() => {
    for (let index = 0; index < incomingSales.length; index++) {
      const offlineSale = incomingSales[index];
      const clientGeneratedId = offlineSale.clientGeneratedId || offlineSale.id;

      // Idempotency check: if already synchronized, skip
      const existing = db.prepare(`
        SELECT id, sale_number as saleNumber FROM sales 
        WHERE sale_number = ? OR notes LIKE ?
      `).get(offlineSale.saleNumber || '', `%${clientGeneratedId}%`) as any;

      if (existing) {
        syncedSales.push(existing);
        continue;
      }

      const posId = parseInt(offlineSale.pointOfSaleId, 10);
      const pos = db.prepare('SELECT * FROM points_of_sale WHERE id = ?').get(posId) as any;
      if (!pos) {
        errors.push(`Point de vente #${posId} introuvable pour la vente hors-ligne.`);
        continue;
      }

      const dpId = seller.drop_point_id ? Number(seller.drop_point_id) : 1;
      const saleNumber = offlineSale.saleNumber && !offlineSale.saleNumber.startsWith('VNT-OFF-')
        ? offlineSale.saleNumber
        : `VNT-${Date.now().toString().slice(-6)}-${index + 1}`;
      const discountAmount = parseFloat(offlineSale.discount || 0);
      const saleDate = offlineSale.createdAt || getBamakoDateInfo().nowTimestamp;
      const rawLat = offlineSale.latitude;
      const rawLng = offlineSale.longitude;
      const rawAcc = offlineSale.accuracy;

      let saleLat = typeof rawLat === 'number' && !isNaN(rawLat) ? rawLat : (seller.last_latitude || 12.6392);
      let saleLng = typeof rawLng === 'number' && !isNaN(rawLng) ? rawLng : (seller.last_longitude || -8.0029);
      let saleAcc = rawAcc || seller.last_location_accuracy || 15;

      const items = offlineSale.items || [];
      if (!Array.isArray(items) || items.length === 0) {
        continue;
      }

      let calculatedTotal = 0;
      const validatedItems: any[] = [];

      for (const item of items) {
        const prodId = parseInt(item.productId ?? item.product_id, 10);
        const qty = parseInt(item.quantityCartons ?? item.quantity_cartons, 10);
        if (isNaN(prodId) || isNaN(qty) || qty <= 0) continue;

        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId) as any;
        if (!prod) continue;

        // Check available stock in database
        const stockRow = db.prepare(`
          SELECT available_quantity FROM vrs_stocks WHERE vrs_id = ? AND product_id = ?
        `).get(sellerId, prodId) as { available_quantity: number } | undefined;

        const available = stockRow ? stockRow.available_quantity : 0;
        const unitPrice = parseFloat(item.unitPrice || prod.unit_price);
        const itemTotal = qty * unitPrice;
        calculatedTotal += itemTotal;

        validatedItems.push({
          prodId,
          name: prod.name,
          qty,
          unitPrice,
          total: itemTotal,
          currentQty: available,
        });
      }

      if (validatedItems.length === 0) continue;

      const finalAmount = Math.max(0, calculatedTotal - discountAmount);
      const notes = `${offlineSale.notes || ''} [ClientRef:${clientGeneratedId}] [Sync:${new Date().toISOString()}]`.trim();

      // Insert into sales table preserving original created_at
      const saleResult = db.prepare(`
        INSERT INTO sales (sale_number, vrs_id, drop_point_id, point_of_sale_id, total_amount, discount, notes, status, latitude, longitude, location_accuracy, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(saleNumber, sellerId, dpId, posId, finalAmount, discountAmount, notes, saleLat, saleLng, saleAcc, saleDate);

      const saleId = saleResult.lastInsertRowid as number;

      // Deduct stock and insert sale items & movements
      for (const item of validatedItems) {
        const newStock = Math.max(0, item.currentQty - item.qty);

        db.prepare(`
          UPDATE vrs_stocks 
          SET available_quantity = ?, updated_at = CURRENT_TIMESTAMP
          WHERE vrs_id = ? AND product_id = ?
        `).run(newStock, sellerId, item.prodId);

        db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, quantity_cartons, unit_price, total_price, stock_before, stock_after)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(saleId, item.prodId, item.qty, item.unitPrice, item.total, item.currentQty, newStock);

        db.prepare(`
          INSERT INTO stock_movements (
            reference, movement_type, source_role, source_id, target_role, target_id,
            drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type, related_entity_id, notes, created_by_user_id, created_at
          ) VALUES (?, 'SALE', 'VRS', ?, 'PDV', ?, ?, ?, ?, ?, ?, 'SALE', ?, ?, ?, ?)
        `).run(
          `MVT-VNT-${saleId}-${item.prodId}`,
          sellerId,
          posId,
          dpId,
          item.prodId,
          -item.qty,
          item.currentQty,
          newStock,
          saleId,
          `Synchronisation vente hors-ligne #${saleNumber} (-${item.qty} cartons)`,
          user.id,
          saleDate
        );
      }

      // Record GPS point in vrs_location_history with original timestamp
      try {
        db.prepare(`
          INSERT INTO vrs_location_history (vrs_id, latitude, longitude, accuracy, action_context, recorded_at)
          VALUES (?, ?, ?, ?, 'SALE (HORS-LIGNE SYNCHRONISÉE)', ?)
        `).run(sellerId, saleLat, saleLng, saleAcc, saleDate);
      } catch {}

      syncedSales.push({
        id: saleId,
        saleNumber,
        clientGeneratedId,
        totalAmount: finalAmount,
        createdAt: saleDate,
      });
    }
  });

  try {
    syncTx();
    backupVrsStocksAndSales();
    triggerMasterBackup(true);

    if (syncedSales.length > 0) {
      logActivity(user, 'SYNC_OFFLINE_SALES', `${syncedSales.length} ventes`, `Synchronisation de ${syncedSales.length} vente(s) enregistrée(s) hors-ligne`, req);

      // Send notification to Drop Point Sales Admin
      createNotification(
        null,
        'SALES_ADMIN',
        seller.drop_point_id,
        'Synchronisation Ventes Hors-Ligne',
        `${seller.first_name} ${seller.last_name} a synchronisé ${syncedSales.length} vente(s) effectuée(s) hors-ligne.`,
        'SALE',
        'sales'
      );
    }

    res.json({
      success: true,
      count: syncedSales.length,
      sales: syncedSales,
      message: `${syncedSales.length} vente(s) hors-ligne synchronisée(s) avec succès dans la base de données.`,
    });
  } catch (err: any) {
    console.error('Error syncing offline sales:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la synchronisation des ventes hors-ligne.' });
  }
});

export default router;
