import { Router, type Response } from 'express';
import { db } from '../db.ts';
import { requireAuth, type AuthRequest } from '../auth.ts';
import {
  getBamakoDateInfo,
  getSalesToday,
  getSalesSameDayLastWeek,
  getSalesMonth,
  getTotalSalesAllTime,
  getRecentTrend,
  getSalesByCategory,
  getTopProducts,
  getSalesByDropPoint,
  getSalesByVrs,
  getMonthlySalesEvolution,
  getRecentSales,
  getSalesLast30DaysCartons,
  buildSalesScopeFilter,
} from '../salesAggregation.ts';

const router = Router();

// GET Dashboard KPIs & charts data
router.get('/dashboard', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { dropPointId, period } = req.query;

  const targetDpId = user.role === 'SALES_ADMIN_NATIONAL'
    ? (dropPointId ? parseInt(String(dropPointId), 10) : null)
    : user.dropPointId;

  // Base scope filters for non-sales entities (stocks, visits, pos)
  let dpFilterStocks = '';
  let dpFilterVisits = '';
  let dpFilterPos = '';
  const paramsStocks: any[] = [];
  const paramsVisits: any[] = [];
  const paramsPos: any[] = [];

  if (targetDpId) {
    dpFilterStocks = ' AND dps.drop_point_id = ?';
    paramsStocks.push(targetDpId);

    dpFilterVisits = ' AND v.drop_point_id = ?';
    paramsVisits.push(targetDpId);

    dpFilterPos = ' AND pos.drop_point_id = ?';
    paramsPos.push(targetDpId);
  }

  // VRS specific filter for non-sales
  if (user.role === 'VRS') {
    dpFilterVisits += ' AND v.vrs_id = ?';
    paramsVisits.push(user.id);
  } else if (user.role === 'FSS') {
    dpFilterVisits += ' AND (SELECT fss_id FROM users WHERE id = v.vrs_id) = ?';
    paramsVisits.push(user.id);
  }

  // 1. Overall counts
  const totalDropPoints = (db.prepare('SELECT COUNT(*) as c FROM drop_points').get() as any).c;
  const totalSalesAdmins = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'SALES_ADMIN'").get() as any).c;
  const totalFSS = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'FSS'").get() as any).c;
  const totalVRS = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'VRS'").get() as any).c;

  // 2. Unified Sales Aggregations (Single Source of Truth, Africa/Bamako local timezone)
  const bamakoDate = getBamakoDateInfo();
  const userScope = { id: user.id, role: user.role, dropPointId: user.dropPointId };

  const salesToday = getSalesToday(db, userScope, targetDpId, bamakoDate);
  const salesSameDayLastWeek = getSalesSameDayLastWeek(db, userScope, targetDpId, bamakoDate, salesToday.amount);
  const salesSameDayLastWeekGrowth = salesSameDayLastWeek.growth;
  const salesMonth = getSalesMonth(db, userScope, targetDpId, bamakoDate);
  const totalSalesAllTime = getTotalSalesAllTime(db, userScope, targetDpId);
  const recentTrend = getRecentTrend(db, userScope, targetDpId, bamakoDate);

  // 3. Points of Sale Stats
  const totalPos = (db.prepare(`SELECT COUNT(*) as c FROM points_of_sale pos WHERE 1=1 ${dpFilterPos}`).get(...paramsPos) as any).c;
  const pendingPos = (db.prepare(`SELECT COUNT(*) as c FROM points_of_sale pos WHERE pos.status = 'EN ATTENTE' ${dpFilterPos}`).get(...paramsPos) as any).c;
  const activePos = (db.prepare(`SELECT COUNT(*) as c FROM points_of_sale pos WHERE pos.status IN ('ACTIF', 'VALIDE') ${dpFilterPos}`).get(...paramsPos) as any).c;

  // 4. Stock Stats
  let totalStockCartons = 0;
  let lowStockAlerts = 0;

  if (user.role === 'VRS') {
    const vrsStockSummary = db.prepare(`
      SELECT COALESCE(SUM(available_quantity), 0) as totalCartons,
             COALESCE(SUM(CASE WHEN available_quantity <= alert_threshold THEN 1 ELSE 0 END), 0) as alertCount
      FROM vrs_stocks WHERE vrs_id = ?
    `).get(user.id) as any;
    totalStockCartons = vrsStockSummary.totalCartons;
    lowStockAlerts = vrsStockSummary.alertCount;
  } else {
    const dpStockSummary = db.prepare(`
      SELECT COALESCE(SUM(available_quantity), 0) as totalCartons,
             COALESCE(SUM(CASE WHEN available_quantity <= alert_threshold THEN 1 ELSE 0 END), 0) as alertCount
      FROM drop_point_stocks dps WHERE 1=1 ${dpFilterStocks}
    `).get(...paramsStocks) as any;
    totalStockCartons = dpStockSummary.totalCartons;
    lowStockAlerts = dpStockSummary.alertCount;
  }

  // 4.1 Stock Coverage: couverture en jours = stock total / moyenne journalière de cartons vendus sur les 30 derniers jours
  const totalCartonsSold30d = getSalesLast30DaysCartons(db, userScope, targetDpId, bamakoDate);
  const dailyAverageCartons30d = totalCartonsSold30d > 0 ? (totalCartonsSold30d / 30) : 0;

  let stockCoverageDays = 0;
  let stockCoverageStatus: 'RUPTURE' | 'BAS' | 'NORMAL' | 'SURSTOCK' = 'NORMAL';
  let stockCoverageLabel = 'Niveau normal';

  if (dailyAverageCartons30d > 0) {
    stockCoverageDays = Math.round(totalStockCartons / dailyAverageCartons30d);
  } else if (totalStockCartons > 0) {
    stockCoverageDays = 999;
  }

  // Règles de couverture :
  // < 7 jours : "Risque de rupture" (rouge)
  // 7 à 15 jours : "Stock bas" (orange)
  // 15 à 60 jours : "Niveau normal" (vert)
  // > 60 jours : "Surstock" (bleu)
  if (stockCoverageDays < 7) {
    stockCoverageStatus = 'RUPTURE';
    stockCoverageLabel = 'Risque de rupture';
  } else if (stockCoverageDays <= 15) {
    stockCoverageStatus = 'BAS';
    stockCoverageLabel = 'Stock bas';
  } else if (stockCoverageDays <= 60) {
    stockCoverageStatus = 'NORMAL';
    stockCoverageLabel = 'Niveau normal';
  } else {
    stockCoverageStatus = 'SURSTOCK';
    stockCoverageLabel = 'Surstock';
  }

  const visitsToday = (db.prepare(`SELECT COUNT(*) as c FROM visits v WHERE date(v.started_at) = ? ${dpFilterVisits}`).get(bamakoDate.today, ...paramsVisits) as any).c;
  const pendingSupplyRequests = (db.prepare(`
    SELECT COUNT(*) as c FROM supply_requests sr
    WHERE sr.status IN ('ENVOYÉE', 'EN ATTENTE', 'APPROUVÉE', 'PRÉPARÉE', 'LIVRÉE')
    ${targetDpId ? ' AND sr.drop_point_id = ' + targetDpId : ''}
    ${user.role === 'VRS' ? ' AND sr.vrs_id = ' + user.id : ''}
  `).get() as any).c;

  // 5b. Drop Point Supply & Invoices KPI (Créances Drop Points)
  let totalCreancesAmount = 0;
  let creancesBreakdown: Array<{ dropPointId: number; dropPointName: string; dropPointCode: string; amount: number }> = [];
  try {
    const creancesRows = db.prepare(`
      SELECT dp.id as dropPointId, dp.name as dropPointName, dp.code as dropPointCode,
             COALESCE(SUM(inv.remaining_amount), 0) as amount
      FROM drop_points dp
      LEFT JOIN dp_invoices inv ON inv.drop_point_id = dp.id AND inv.payment_status IN ('A_PAYER', 'PARTIELLEMENT_PAYE')
      WHERE dp.status = 'ACTIF'
      GROUP BY dp.id
      ORDER BY amount DESC
    `).all() as any[];

    creancesBreakdown = creancesRows;
    totalCreancesAmount = creancesRows.reduce((acc, row) => acc + (row.amount || 0), 0);
  } catch (err) {
    console.error('Error calculating creances:', err);
  }

  // Pending DP Supply requests
  let pendingDpSupplyCount = 0;
  try {
    let dpSupplyQuery = "SELECT COUNT(*) as c FROM dp_supply_requests WHERE status = 'DEMANDEE'";
    const dpSupplyParams: any[] = [];
    if (user.role === 'SALES_ADMIN') {
      dpSupplyQuery += ' AND drop_point_id = ?';
      dpSupplyParams.push(user.dropPointId);
    }
    pendingDpSupplyCount = (db.prepare(dpSupplyQuery).get(...dpSupplyParams) as any)?.c || 0;
  } catch {}

  // Pending POS creation requests
  let pendingPosRequestsCount = 0;
  try {
    let posReqQuery = "SELECT COUNT(*) as c FROM pos_creation_requests WHERE status = 'EN_ATTENTE'";
    const posReqParams: any[] = [];
    if (user.role === 'SALES_ADMIN' || user.role === 'FSS') {
      posReqQuery += ' AND drop_point_id = ?';
      posReqParams.push(user.dropPointId);
    } else if (user.role === 'VRS') {
      posReqQuery += ' AND vrs_id = ?';
      posReqParams.push(user.id);
    }
    pendingPosRequestsCount = (db.prepare(posReqQuery).get(...posReqParams) as any)?.c || 0;
  } catch {}

  // Central depot stocks (for SAN)
  let centralDepotStockCartons = 0;
  try {
    const centralStockRow = db.prepare('SELECT COALESCE(SUM(available_quantity), 0) as total FROM central_depot_stocks').get() as any;
    centralDepotStockCartons = Number(centralStockRow?.total) || 0;
  } catch {}

  // Drop point stocks breakdown (e.g. BKO, DKN)
  let dropPointStockBreakdown: Array<{ dropPointId: number; dropPointCode: string; dropPointName: string; totalCartons: number }> = [];
  let totalDropPointStockCartons = 0;
  try {
    const dpStockRows = db.prepare(`
      SELECT dp.id as dropPointId, dp.code as dropPointCode, dp.name as dropPointName,
             COALESCE(SUM(dps.available_quantity), 0) as totalCartons
      FROM drop_points dp
      JOIN drop_point_stocks dps ON dps.drop_point_id = dp.id
      WHERE dp.status = 'ACTIF'
      GROUP BY dp.id
      ORDER BY dp.code ASC
    `).all() as any[];
    dropPointStockBreakdown = dpStockRows;
    totalDropPointStockCartons = dpStockRows.reduce((acc, r) => acc + (r.totalCartons || 0), 0);
  } catch {}

  // 6. Chart: Sales by Category
  const salesByCategory = getSalesByCategory(db, userScope, targetDpId);

  // 7. Chart: Top 5 Products Sold
  const topProducts = getTopProducts(db, userScope, targetDpId, 6);

  // 8. Chart: Sales by Drop Point (For SAN & SA)
  const salesByDropPoint = getSalesByDropPoint(db, userScope);

  // 9. Chart: Sales by VRS (supervisory view; for VRS, strictly their own entry)
  const salesByVrs = getSalesByVrs(db, userScope, targetDpId);

  // 10. Chart: Monthly Sales Evolution (Last 6 months in Africa/Bamako)
  const monthlySales = getMonthlySalesEvolution(db, userScope, targetDpId, bamakoDate);

  // 11. Recent Sales for Table/Feed
  const recentSales = getRecentSales(db, userScope, targetDpId, 6);

  // 12. Chart: Stock Levels by Category (Recharts Component for National Dashboard)
  const evaluateStockLevel = (available: number, threshold: number): 'critique' | 'faible' | 'optimal' => {
    const alertThresh = threshold > 0 ? threshold : 10;
    const criticalThresh = Math.max(1, Math.floor(alertThresh * 0.4));
    if (available <= 0 || available <= criticalThresh) return 'critique';
    if (available <= alertThresh) return 'faible';
    return 'optimal';
  };

  const categories = db.prepare('SELECT id, name FROM categories ORDER BY id ASC').all() as Array<{ id: number; name: string }>;

  // Drop Point stocks (strictly empty for VRS as VRS only sees their own stock)
  const dpStocksRaw = user.role === 'VRS' ? [] : db.prepare(`
    SELECT 
      c.id as categoryId, c.name as categoryName,
      p.id as productId, p.name as productName, p.reference as productRef,
      p.unit_price as unitPrice,
      dps.available_quantity as availableQuantity,
      dps.alert_threshold as alertThreshold
    FROM categories c
    JOIN products p ON p.category_id = c.id
    JOIN drop_point_stocks dps ON dps.product_id = p.id
    WHERE 1=1 ${dpFilterStocks}
  `).all(...paramsStocks) as any[];

  // VRS stocks
  let vrsStocksRaw: any[] = [];
  if (user.role === 'VRS') {
    vrsStocksRaw = db.prepare(`
      SELECT 
        c.id as categoryId, c.name as categoryName,
        p.id as productId, p.name as productName, p.reference as productRef,
        p.unit_price as unitPrice,
        vs.available_quantity as availableQuantity,
        vs.alert_threshold as alertThreshold
      FROM categories c
      JOIN products p ON p.category_id = c.id
      JOIN vrs_stocks vs ON vs.product_id = p.id
      WHERE vs.vrs_id = ?
    `).all(user.id) as any[];
  } else {
    vrsStocksRaw = db.prepare(`
      SELECT 
        c.id as categoryId, c.name as categoryName,
        p.id as productId, p.name as productName, p.reference as productRef,
        p.unit_price as unitPrice,
        vs.available_quantity as availableQuantity,
        vs.alert_threshold as alertThreshold
      FROM categories c
      JOIN products p ON p.category_id = c.id
      JOIN vrs_stocks vs ON vs.product_id = p.id
      JOIN users u ON vs.vrs_id = u.id
      WHERE 1=1 ${targetDpId ? ' AND u.drop_point_id = ' + targetDpId : ''}
    `).all() as any[];
  }

  const stockLevelsByCategory = categories.map((cat) => {
    const dpItems = dpStocksRaw.filter((s) => s.categoryId === cat.id);
    const vrsItems = vrsStocksRaw.filter((s) => s.categoryId === cat.id);

    const productMap = new Map<number, {
      id: number;
      name: string;
      reference: string;
      unitPrice: number;
      alertThreshold: number;
      dpAvailable: number;
      vrsAvailable: number;
      totalAvailable: number;
    }>();

    dpItems.forEach((s) => {
      const existing = productMap.get(s.productId) || {
        id: s.productId,
        name: s.productName,
        reference: s.productRef,
        unitPrice: s.unitPrice,
        alertThreshold: s.alertThreshold,
        dpAvailable: 0,
        vrsAvailable: 0,
        totalAvailable: 0,
      };
      existing.dpAvailable += s.availableQuantity;
      existing.totalAvailable += s.availableQuantity;
      productMap.set(s.productId, existing);
    });

    vrsItems.forEach((s) => {
      const existing = productMap.get(s.productId) || {
        id: s.productId,
        name: s.productName,
        reference: s.productRef,
        unitPrice: s.unitPrice,
        alertThreshold: s.alertThreshold,
        dpAvailable: 0,
        vrsAvailable: 0,
        totalAvailable: 0,
      };
      existing.vrsAvailable += s.availableQuantity;
      existing.totalAvailable += s.availableQuantity;
      productMap.set(s.productId, existing);
    });

    let optimalCartons = 0;
    let faibleCartons = 0;
    let critiqueCartons = 0;
    let optimalCount = 0;
    let faibleCount = 0;
    let critiqueCount = 0;
    let totalValue = 0;

    let dpOptimalCartons = 0;
    let dpFaibleCartons = 0;
    let dpCritiqueCartons = 0;
    let dpOptimalCount = 0;
    let dpFaibleCount = 0;
    let dpCritiqueCount = 0;

    let vrsOptimalCartons = 0;
    let vrsFaibleCartons = 0;
    let vrsCritiqueCartons = 0;
    let vrsOptimalCount = 0;
    let vrsFaibleCount = 0;
    let vrsCritiqueCount = 0;

    const products = Array.from(productMap.values()).map((p) => {
      const globalLevel = evaluateStockLevel(p.totalAvailable, p.alertThreshold);
      const dpLevel = evaluateStockLevel(p.dpAvailable, p.alertThreshold);
      const vrsLevel = evaluateStockLevel(p.vrsAvailable, p.alertThreshold > 5 ? 5 : p.alertThreshold);

      if (globalLevel === 'critique') {
        critiqueCartons += p.totalAvailable;
        critiqueCount++;
      } else if (globalLevel === 'faible') {
        faibleCartons += p.totalAvailable;
        faibleCount++;
      } else {
        optimalCartons += p.totalAvailable;
        optimalCount++;
      }

      if (dpLevel === 'critique') {
        dpCritiqueCartons += p.dpAvailable;
        dpCritiqueCount++;
      } else if (dpLevel === 'faible') {
        dpFaibleCartons += p.dpAvailable;
        dpFaibleCount++;
      } else {
        dpOptimalCartons += p.dpAvailable;
        dpOptimalCount++;
      }

      if (vrsLevel === 'critique') {
        vrsCritiqueCartons += p.vrsAvailable;
        vrsCritiqueCount++;
      } else if (vrsLevel === 'faible') {
        vrsFaibleCartons += p.vrsAvailable;
        vrsFaibleCount++;
      } else {
        vrsOptimalCartons += p.vrsAvailable;
        vrsOptimalCount++;
      }

      const val = p.totalAvailable * p.unitPrice;
      totalValue += val;

      return {
        id: p.id,
        name: p.name,
        reference: p.reference,
        unitPrice: p.unitPrice,
        availableQuantity: p.totalAvailable,
        dpAvailable: p.dpAvailable,
        vrsAvailable: p.vrsAvailable,
        alertThreshold: p.alertThreshold,
        level: globalLevel,
        totalValue: val,
      };
    });

    const totalCartons = optimalCartons + faibleCartons + critiqueCartons;
    const dpTotalCartons = dpOptimalCartons + dpFaibleCartons + dpCritiqueCartons;
    const vrsTotalCartons = vrsOptimalCartons + vrsFaibleCartons + vrsCritiqueCartons;

    return {
      categoryId: cat.id,
      category: cat.name,
      optimalCartons,
      faibleCartons,
      critiqueCartons,
      totalCartons,
      optimalCount,
      faibleCount,
      critiqueCount,
      totalProductsCount: products.length,
      totalValue,
      dp: {
        optimalCartons: dpOptimalCartons,
        faibleCartons: dpFaibleCartons,
        critiqueCartons: dpCritiqueCartons,
        totalCartons: dpTotalCartons,
        optimalCount: dpOptimalCount,
        faibleCount: dpFaibleCount,
        critiqueCount: dpCritiqueCount,
      },
      vrs: {
        optimalCartons: vrsOptimalCartons,
        faibleCartons: vrsFaibleCartons,
        critiqueCartons: vrsCritiqueCartons,
        totalCartons: vrsTotalCartons,
        optimalCount: vrsOptimalCount,
        faibleCount: vrsFaibleCount,
        critiqueCount: vrsCritiqueCount,
      },
      products,
    };
  });

  res.json({
    kpis: {
      totalDropPoints,
      totalSalesAdmins,
      totalFSS,
      totalVRS,
      totalPos,
      pendingPos,
      activePos,
      salesTodayCount: salesToday.count,
      salesTodayAmount: salesToday.amount,
      salesTodayCartons: salesToday.cartons,
      salesSameDayLastWeekCount: salesSameDayLastWeek.count,
      salesSameDayLastWeekAmount: salesSameDayLastWeek.amount,
      salesSameDayLastWeekGrowth,
      salesMonthCount: salesMonth.count,
      salesMonthAmount: salesMonth.amount,
      salesMonthCartons: salesMonth.cartons,
      totalSalesAllTimeAmount: totalSalesAllTime.amount,
      totalStockCartons,
      centralDepotStockCartons,
      dropPointStockCartons: totalDropPointStockCartons || totalStockCartons,
      dropPointStockBreakdown,
      dailyAverageCartons30d: Math.round(dailyAverageCartons30d * 10) / 10,
      stockCoverageDays,
      stockCoverageStatus,
      stockCoverageLabel,
      recentTrend,
      lowStockAlerts,
      visitsToday,
      pendingSupplyRequests,
      creancesDropPoints: {
        total: totalCreancesAmount,
        breakdown: creancesBreakdown,
      },
      pendingDpSupplyCount,
      pendingPosRequestsCount,
    },
    charts: {
      salesByCategory,
      topProducts,
      salesByDropPoint,
      salesByVrs,
      monthlySales,
      stockLevelsByCategory,
      recentTrend
    },
    recentSales
  });
});

// CSV Export route (Section 34)
router.get('/export/csv', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { type } = req.query; // 'sales', 'stock', 'pos', 'receipts'

  let filename = `export_${type}_${Date.now()}.csv`;
  let csvContent = '';

  if (type === 'sales') {
    const scope = buildSalesScopeFilter(user);
    const query = `
      SELECT s.sale_number, s.created_at, dp.name as drop_point, vrs.public_id as vrs_id,
             vrs.first_name || ' ' || vrs.last_name as vrs_name,
             pos.name as point_of_sale, s.total_amount, s.status
      FROM sales s
      JOIN drop_points dp ON s.drop_point_id = dp.id
      JOIN users vrs ON s.vrs_id = vrs.id
      JOIN points_of_sale pos ON s.point_of_sale_id = pos.id
      WHERE 1=1 ${scope.sql}
      ORDER BY s.created_at DESC
    `;
    const rows = db.prepare(query).all(...scope.params) as any[];
    csvContent = 'Numero Vente,Date,Drop Point,ID VRS,Vendeur,Point de Vente,Montant Total (FCFA),Statut\n';
    for (const r of rows) {
      csvContent += `"${r.sale_number}","${r.created_at}","${r.drop_point}","${r.vrs_id}","${r.vrs_name}","${r.point_of_sale}",${r.total_amount},"${r.status}"\n`;
    }
  } else if (type === 'pos') {
    let query = `
      SELECT pos.public_id, pos.name, pos.code, pos.owner_name, pos.phone, pos.address,
             dp.name as drop_point, pos.latitude, pos.longitude, pos.status, pos.created_at
      FROM points_of_sale pos
      JOIN drop_points dp ON pos.drop_point_id = dp.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (user.role !== 'SALES_ADMIN_NATIONAL') {
      query += ' AND pos.drop_point_id = ?';
      params.push(user.dropPointId);
    }
    const rows = db.prepare(query).all(...params) as any[];
    csvContent = 'ID Public,Nom PDV,Code,Proprietaire,Telephone,Adresse,Drop Point,Latitude,Longitude,Statut,Date Creation\n';
    for (const r of rows) {
      csvContent += `"${r.public_id}","${r.name}","${r.code}","${r.owner_name}","${r.phone}","${r.address}","${r.drop_point}",${r.latitude},${r.longitude},"${r.status}","${r.created_at}"\n`;
    }
  } else {
    // Default stock export
    let query = `
      SELECT dp.name as drop_point, c.name as categorie, p.name as produit, p.reference,
             dps.available_quantity as stock_disponible, dps.alert_threshold as seuil_alerte
      FROM drop_point_stocks dps
      JOIN drop_points dp ON dps.drop_point_id = dp.id
      JOIN products p ON dps.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (user.role !== 'SALES_ADMIN_NATIONAL') {
      query += ' AND dps.drop_point_id = ?';
      params.push(user.dropPointId);
    }
    const rows = db.prepare(query).all(...params) as any[];
    csvContent = 'Drop Point,Categorie,Produit,Reference,Stock Disponible (Cartons),Seuil Alerte\n';
    for (const r of rows) {
      csvContent += `"${r.drop_point}","${r.categorie}","${r.produit}","${r.reference}",${r.stock_disponible},${r.seuil_alerte}\n`;
    }
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

export default router;
