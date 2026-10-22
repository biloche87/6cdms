import type Database from 'better-sqlite3';

export interface UserScope {
  id: number;
  role: string;
  dropPointId?: number | null;
}

export interface BamakoDateInfo {
  today: string;            // 'YYYY-MM-DD'
  todayStart: string;       // 'YYYY-MM-DD 00:00:00'
  todayEnd: string;         // 'YYYY-MM-DD 23:59:59'
  lastWeekDate: string;     // 'YYYY-MM-DD' (7 days ago)
  lastWeekStart: string;    // 'YYYY-MM-DD 00:00:00'
  lastWeekEnd: string;      // 'YYYY-MM-DD 23:59:59'
  currentMonth: string;     // 'YYYY-MM'
  monthStart: string;       // 'YYYY-MM-01 00:00:00'
  monthEnd: string;         // 'YYYY-MM-DD 23:59:59' (last day of month)
  curPeriodStart: string;   // 'YYYY-MM-01 00:00:00'
  curPeriodEnd: string;     // 'YYYY-MM-DD 23:59:59' (day J)
  prevPeriodStart: string;  // 'YYYY-MM-01 00:00:00' (prev month)
  prevPeriodEnd: string;    // 'YYYY-MM-DD 23:59:59' (prev month day J)
  currentDay: number;
  currentYear: number;
  currentMonthNum: number;  // 1-12
  nowTimestamp: string;     // 'YYYY-MM-DD HH:MM:SS'
  thirtyDaysAgoStart: string; // 30 days ago 00:00:00
}

/**
 * Returns date and time boundaries calculated strictly in the Africa/Bamako timezone (UTC+0).
 * Prevents timezone skew between host system / Node.js and local African business hours.
 */
export function getBamakoDateInfo(): BamakoDateInfo {
  const now = new Date();

  // Extract date components strictly in Africa/Bamako
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Bamako',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10);
  const day = parseInt(getPart('day'), 10);
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  const today = `${year}-${mm}-${dd}`;
  const nowTimestamp = `${today} ${hour}:${minute}:${second}`;
  const todayStart = `${today} 00:00:00`;
  const todayEnd = `${today} 23:59:59`;

  // 7 days ago in Bamako
  const dMinus7 = new Date(Date.UTC(year, month - 1, day - 7));
  const lYear = dMinus7.getUTCFullYear();
  const lMonth = String(dMinus7.getUTCMonth() + 1).padStart(2, '0');
  const lDay = String(dMinus7.getUTCDate()).padStart(2, '0');
  const lastWeekDate = `${lYear}-${lMonth}-${lDay}`;
  const lastWeekStart = `${lastWeekDate} 00:00:00`;
  const lastWeekEnd = `${lastWeekDate} 23:59:59`;

  // 30 days ago in Bamako
  const dMinus30 = new Date(Date.UTC(year, month - 1, day - 30));
  const tYear = dMinus30.getUTCFullYear();
  const tMonth = String(dMinus30.getUTCMonth() + 1).padStart(2, '0');
  const tDay = String(dMinus30.getUTCDate()).padStart(2, '0');
  const thirtyDaysAgoStart = `${tYear}-${tMonth}-${tDay} 00:00:00`;

  // Current month bounds
  const currentMonth = `${year}-${mm}`;
  const monthStart = `${currentMonth}-01 00:00:00`;
  const daysInCurrentMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${currentMonth}-${String(daysInCurrentMonth).padStart(2, '0')} 23:59:59`;

  // MTD Trend bounds: Day 1 to Day J of current month
  const curPeriodStart = monthStart;
  const curPeriodEnd = todayEnd;

  // Previous month MTD: Day 1 to Day J of previous month
  const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
  const pYear = prevMonthDate.getUTCFullYear();
  const pMonth = String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0');
  const daysInPrevMonth = new Date(Date.UTC(pYear, prevMonthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const prevPeriodEndDay = Math.min(day, daysInPrevMonth);

  const prevPeriodStart = `${pYear}-${pMonth}-01 00:00:00`;
  const prevPeriodEnd = `${pYear}-${pMonth}-${String(prevPeriodEndDay).padStart(2, '0')} 23:59:59`;

  return {
    today,
    todayStart,
    todayEnd,
    lastWeekDate,
    lastWeekStart,
    lastWeekEnd,
    currentMonth,
    monthStart,
    monthEnd,
    curPeriodStart,
    curPeriodEnd,
    prevPeriodStart,
    prevPeriodEnd,
    currentDay: day,
    currentYear: year,
    currentMonthNum: month,
    nowTimestamp,
    thirtyDaysAgoStart,
  };
}

/**
 * Builds standard perimeter SQL filter for sales based on user role and optional filters.
 * Ensures strictly:
 * - SAN: all sales, or filtered by dropPointId if explicitly provided
 * - SA: sales of their assigned drop point
 * - FSS: sales of their supervised VRS
 * - VRS: only their own sales
 */
export function buildSalesScopeFilter(
  user: UserScope,
  requestedDpId?: number | null,
  requestedVrsId?: number | null
): { sql: string; params: any[] } {
  let sql = '';
  const params: any[] = [];

  if (user.role === 'SALES_ADMIN_NATIONAL') {
    if (requestedDpId) {
      sql += ' AND s.drop_point_id = ?';
      params.push(requestedDpId);
    }
    if (requestedVrsId) {
      sql += ' AND s.vrs_id = ?';
      params.push(requestedVrsId);
    }
  } else if (user.role === 'SALES_ADMIN') {
    sql += ' AND s.drop_point_id = ?';
    params.push(user.dropPointId);
    if (requestedVrsId) {
      sql += ' AND s.vrs_id = ?';
      params.push(requestedVrsId);
    }
  } else if (user.role === 'FSS') {
    sql += ' AND (s.vrs_id IN (SELECT id FROM users WHERE fss_id = ?) OR s.vrs_id = ?)';
    params.push(user.id, user.id);
    if (requestedVrsId) {
      sql += ' AND s.vrs_id = ?';
      params.push(requestedVrsId);
    }
  } else if (user.role === 'VRS') {
    sql += ' AND s.vrs_id = ?';
    params.push(user.id);
  }

  return { sql, params };
}

/**
 * Aggregates sales for today in Africa/Bamako
 */
export function getSalesToday(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null,
  dateInfo = getBamakoDateInfo()
) {
  const scope = buildSalesScopeFilter(user, requestedDpId);
  const row = db.prepare(`
    SELECT COUNT(*) as count,
           COALESCE(SUM(s.total_amount), 0) as amount,
           COALESCE(SUM((SELECT SUM(quantity_cartons) FROM sale_items WHERE sale_id = s.id)), 0) as cartons
    FROM sales s
    WHERE s.status = 'COMPLETED'
      AND s.created_at >= ? AND s.created_at <= ?
      ${scope.sql}
  `).get(dateInfo.todayStart, dateInfo.todayEnd, ...scope.params) as any;

  return {
    count: Number(row?.count) || 0,
    amount: Number(row?.amount) || 0,
    cartons: Number(row?.cartons) || 0,
  };
}

/**
 * Aggregates sales for same day last week (S-1) in Africa/Bamako
 */
export function getSalesSameDayLastWeek(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null,
  dateInfo = getBamakoDateInfo(),
  todayAmount = 0
) {
  const scope = buildSalesScopeFilter(user, requestedDpId);
  const row = db.prepare(`
    SELECT COUNT(*) as count,
           COALESCE(SUM(s.total_amount), 0) as amount,
           COALESCE(SUM((SELECT SUM(quantity_cartons) FROM sale_items WHERE sale_id = s.id)), 0) as cartons
    FROM sales s
    WHERE s.status = 'COMPLETED'
      AND s.created_at >= ? AND s.created_at <= ?
      ${scope.sql}
  `).get(dateInfo.lastWeekStart, dateInfo.lastWeekEnd, ...scope.params) as any;

  const count = Number(row?.count) || 0;
  const amount = Number(row?.amount) || 0;
  const cartons = Number(row?.cartons) || 0;

  let growth: number | null = null;
  if (amount > 0) {
    growth = Math.round(((todayAmount - amount) / amount) * 100);
  }

  return {
    count,
    amount,
    cartons,
    growth,
  };
}

/**
 * Aggregates monthly sales for current month in Africa/Bamako
 */
export function getSalesMonth(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null,
  dateInfo = getBamakoDateInfo()
) {
  const scope = buildSalesScopeFilter(user, requestedDpId);
  const row = db.prepare(`
    SELECT COUNT(*) as count,
           COALESCE(SUM(s.total_amount), 0) as amount,
           COALESCE(SUM((SELECT SUM(quantity_cartons) FROM sale_items WHERE sale_id = s.id)), 0) as cartons
    FROM sales s
    WHERE s.status = 'COMPLETED'
      AND s.created_at >= ? AND s.created_at <= ?
      ${scope.sql}
  `).get(dateInfo.monthStart, dateInfo.monthEnd, ...scope.params) as any;

  return {
    count: Number(row?.count) || 0,
    amount: Number(row?.amount) || 0,
    cartons: Number(row?.cartons) || 0,
  };
}

/**
 * Aggregates all-time sales for given user scope
 */
export function getTotalSalesAllTime(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null
) {
  const scope = buildSalesScopeFilter(user, requestedDpId);
  const row = db.prepare(`
    SELECT COUNT(*) as count,
           COALESCE(SUM(s.total_amount), 0) as amount,
           COALESCE(SUM((SELECT SUM(quantity_cartons) FROM sale_items WHERE sale_id = s.id)), 0) as cartons
    FROM sales s
    WHERE s.status = 'COMPLETED'
      ${scope.sql}
  `).get(...scope.params) as any;

  return {
    count: Number(row?.count) || 0,
    amount: Number(row?.amount) || 0,
    cartons: Number(row?.cartons) || 0,
  };
}

/**
 * Calculates recent trend (MTD comparison vs previous month equivalent period)
 */
export function getRecentTrend(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null,
  dateInfo = getBamakoDateInfo()
) {
  const scope = buildSalesScopeFilter(user, requestedDpId);

  const curPeriodSales = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as amount,
           COALESCE(SUM((SELECT SUM(quantity_cartons) FROM sale_items WHERE sale_id = s.id)), 0) as cartons
    FROM sales s
    WHERE s.status = 'COMPLETED'
      AND s.created_at >= ? AND s.created_at <= ?
      ${scope.sql}
  `).get(dateInfo.curPeriodStart, dateInfo.curPeriodEnd, ...scope.params) as any;

  const prevPeriodSales = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as amount,
           COALESCE(SUM((SELECT SUM(quantity_cartons) FROM sale_items WHERE sale_id = s.id)), 0) as cartons
    FROM sales s
    WHERE s.status = 'COMPLETED'
      AND s.created_at >= ? AND s.created_at <= ?
      ${scope.sql}
  `).get(dateInfo.prevPeriodStart, dateInfo.prevPeriodEnd, ...scope.params) as any;

  const curPeriodAmt = Number(curPeriodSales?.amount) || 0;
  const prevPeriodAmt = Number(prevPeriodSales?.amount) || 0;
  const isInsufficientTrendData = dateInfo.currentDay < 5;

  let recentTrendPercentage: number | null = null;
  if (!isInsufficientTrendData && prevPeriodAmt > 0) {
    recentTrendPercentage = Math.round(((curPeriodAmt - prevPeriodAmt) / prevPeriodAmt) * 100);
  }

  return {
    currentDay: dateInfo.currentDay,
    isInsufficientData: isInsufficientTrendData,
    currentPeriodAmount: curPeriodAmt,
    previousPeriodAmount: prevPeriodAmt,
    percentage: recentTrendPercentage,
    label: `J1-J${dateInfo.currentDay} vs J1-J${dateInfo.currentDay} du mois précédent`,
  };
}

/**
 * Aggregates sales by product category
 */
export function getSalesByCategory(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null
) {
  const scope = buildSalesScopeFilter(user, requestedDpId);
  return db.prepare(`
    SELECT c.name as category,
           COALESCE(SUM(si.total_price), 0) as amount,
           COALESCE(SUM(si.quantity_cartons), 0) as cartons
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE s.status = 'COMPLETED'
      ${scope.sql}
    GROUP BY c.name
    ORDER BY amount DESC
  `).all(...scope.params) as Array<{ category: string; amount: number; cartons: number }>;
}

/**
 * Aggregates top products sold
 */
export function getTopProducts(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null,
  limit = 6
) {
  const scope = buildSalesScopeFilter(user, requestedDpId);
  return db.prepare(`
    SELECT p.name as productName,
           c.name as category,
           COALESCE(SUM(si.quantity_cartons), 0) as cartonsSold,
           COALESCE(SUM(si.total_price), 0) as totalRevenue
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE s.status = 'COMPLETED'
      ${scope.sql}
    GROUP BY p.id
    ORDER BY totalRevenue DESC
    LIMIT ?
  `).all(...scope.params, limit) as Array<{ productName: string; category: string; cartonsSold: number; totalRevenue: number }>;
}

/**
 * Aggregates sales by Drop Point (for SAN & SA)
 * Guarantees: Sum of Drop Points = Total of SAN
 */
export function getSalesByDropPoint(
  db: Database.Database,
  user: UserScope
) {
  if (user.role === 'SALES_ADMIN_NATIONAL') {
    return db.prepare(`
      SELECT dp.name as dropPointName,
             dp.code as dropPointCode,
             COALESCE(SUM(s.total_amount), 0) as totalAmount,
             COUNT(s.id) as salesCount
      FROM drop_points dp
      LEFT JOIN sales s ON s.drop_point_id = dp.id AND s.status = 'COMPLETED'
      WHERE dp.status = 'ACTIF'
      GROUP BY dp.id
      ORDER BY totalAmount DESC
    `).all() as Array<{ dropPointName: string; dropPointCode: string; totalAmount: number; salesCount: number }>;
  } else if (user.dropPointId) {
    return db.prepare(`
      SELECT dp.name as dropPointName,
             dp.code as dropPointCode,
             COALESCE(SUM(s.total_amount), 0) as totalAmount,
             COUNT(s.id) as salesCount
      FROM drop_points dp
      LEFT JOIN sales s ON s.drop_point_id = dp.id AND s.status = 'COMPLETED'
      WHERE dp.id = ?
      GROUP BY dp.id
    `).all(user.dropPointId) as Array<{ dropPointName: string; dropPointCode: string; totalAmount: number; salesCount: number }>;
  }
  return [];
}

/**
 * Aggregates sales by VRS (seller performance)
 * Guarantees: Sum of VRS for a Drop Point = Total of that Drop Point
 * and Sum of all VRS = Total of SAN
 */
export function getSalesByVrs(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null
) {
  let userFilter = "WHERE u.role = 'VRS' AND u.status = 'ACTIF'";
  const params: any[] = [];

  if (user.role === 'VRS') {
    userFilter += ' AND u.id = ?';
    params.push(user.id);
  } else if (user.role === 'FSS') {
    userFilter += ' AND (u.fss_id = ? OR u.id = ?)';
    params.push(user.id, user.id);
  } else if (user.role === 'SALES_ADMIN') {
    userFilter += ' AND u.drop_point_id = ?';
    params.push(user.dropPointId);
  } else if (user.role === 'SALES_ADMIN_NATIONAL' && requestedDpId) {
    userFilter += ' AND u.drop_point_id = ?';
    params.push(requestedDpId);
  }

  return db.prepare(`
    SELECT u.first_name || ' ' || u.last_name as vrsName,
           u.public_id as vrsPublicId,
           COALESCE(SUM(s.total_amount), 0) as totalAmount,
           COUNT(s.id) as salesCount
    FROM users u
    LEFT JOIN sales s ON s.vrs_id = u.id AND s.status = 'COMPLETED'
    ${userFilter}
    GROUP BY u.id
    ORDER BY totalAmount DESC
  `).all(...params) as Array<{ vrsName: string; vrsPublicId: string; totalAmount: number; salesCount: number }>;
}

/**
 * Computes rolling 6-month commercial sales evolution in Africa/Bamako
 */
export function getMonthlySalesEvolution(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null,
  dateInfo = getBamakoDateInfo()
) {
  const scope = buildSalesScopeFilter(user, requestedDpId);

  const monthlySalesRaw = db.prepare(`
    SELECT 
      substr(s.created_at, 1, 7) as month,
      COALESCE(SUM(s.total_amount), 0) as totalAmount,
      COUNT(s.id) as salesCount,
      COALESCE(SUM((SELECT SUM(quantity_cartons) FROM sale_items WHERE sale_id = s.id)), 0) as cartonsSold
    FROM sales s
    WHERE s.status = 'COMPLETED'
      ${scope.sql}
    GROUP BY substr(s.created_at, 1, 7)
    ORDER BY month ASC
  `).all(...scope.params) as Array<{ month: string; totalAmount: number; salesCount: number; cartonsSold: number }>;

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

  const currentYear = dateInfo.currentYear;
  const currentMonthNum = dateInfo.currentMonthNum; // 1-12
  const targetDpId = user.role === 'SALES_ADMIN_NATIONAL' ? requestedDpId : user.dropPointId;

  const monthlySales = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(currentYear, currentMonthNum - 1 - i, 1));
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const key = `${yyyy}-${mm}`;
    const raw = monthlyMap.get(key) || { totalAmount: 0, salesCount: 0, cartonsSold: 0 };

    const baseObjective = 0;

    monthlySales.push({
      month: key,
      monthLabel: `${monthsFrenchFull[mm] || mm} ${yyyy}`,
      shortLabel: monthsFrenchShort[mm] || mm,
      totalAmount: raw.totalAmount,
      salesCount: raw.salesCount,
      cartonsSold: raw.cartonsSold,
      objectiveAmount: baseObjective,
      growthRate: 0,
    });
  }

  for (let i = 0; i < monthlySales.length; i++) {
    if (i > 0 && monthlySales[i - 1].totalAmount > 0) {
      const prev = monthlySales[i - 1].totalAmount;
      const curr = monthlySales[i].totalAmount;
      monthlySales[i].growthRate = Math.round(((curr - prev) / prev) * 100);
    }
  }

  return monthlySales;
}

/**
 * Returns latest recent sales
 */
export function getRecentSales(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null,
  limit = 6
) {
  const scope = buildSalesScopeFilter(user, requestedDpId);
  return db.prepare(`
    SELECT s.id,
           s.sale_number as saleNumber,
           s.total_amount as totalAmount,
           s.created_at as createdAt,
           vrs.first_name || ' ' || vrs.last_name as vrsName,
           pos.name as posName,
           dp.code as dropPointCode
    FROM sales s
    JOIN users vrs ON s.vrs_id = vrs.id
    JOIN points_of_sale pos ON s.point_of_sale_id = pos.id
    JOIN drop_points dp ON s.drop_point_id = dp.id
    WHERE s.status = 'COMPLETED'
      ${scope.sql}
    ORDER BY s.created_at DESC
    LIMIT ?
  `).all(...scope.params, limit);
}

/**
 * Total cartons sold over the last 30 days for stock coverage
 */
export function getSalesLast30DaysCartons(
  db: Database.Database,
  user: UserScope,
  requestedDpId?: number | null,
  dateInfo = getBamakoDateInfo()
) {
  const scope = buildSalesScopeFilter(user, requestedDpId);
  const row = db.prepare(`
    SELECT COALESCE(SUM(si.quantity_cartons), 0) as totalCartons
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'COMPLETED'
      AND s.created_at >= ?
      ${scope.sql}
  `).get(dateInfo.thirtyDaysAgoStart, ...scope.params) as any;

  return Number(row?.totalCartons) || 0;
}
