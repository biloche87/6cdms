import { Router, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db.ts';
import { requireAuth, type AuthRequest } from '../auth.ts';

const router = Router();

export const giftsUploadDir = path.resolve(process.cwd(), 'data', 'uploads', 'gifts');
if (!fs.existsSync(giftsUploadDir)) {
  fs.mkdirSync(giftsUploadDir, { recursive: true });
}

// Detect actual image format from buffer magic bytes (strict check: JPEG, PNG, WebP)
export function detectImageType(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

export interface ScoringSettings {
  id: number;
  weight_turnover: number;
  weight_regularity: number;
  weight_payments: number;
  weight_new_pos: number;
  weight_rigor: number;
  updated_at?: string;
  updated_by_user_id?: number | null;
}

export function seedScoringDefaultData(): void {
  try {
    // 1. Scoring weights
    const existingSettings = db.prepare('SELECT id FROM vrs_scoring_settings LIMIT 1').get();
    if (!existingSettings) {
      db.prepare(`
        INSERT INTO vrs_scoring_settings (weight_turnover, weight_regularity, weight_payments, weight_new_pos, weight_rigor)
        VALUES (8.0, 4.0, 4.0, 2.0, 2.0)
      `).run();
    }

    // 2. Gift Catalog
    const existingGifts = (db.prepare('SELECT COUNT(*) as count FROM gift_catalog').get() as any)?.count || 0;
    if (existingGifts === 0) {
      const defaultGifts = [
        // Bronze gifts
        { name: 'TV Smart', tier: 'BRONZE', svg_key: 'tv', description: 'Téléviseur Smart Full HD connectivité Wi-Fi', estimated_value_fcfa: 175000, quantity: 6 },
        { name: 'Mini frigo', tier: 'BRONZE', svg_key: 'fridge', description: 'Mini réfrigérateur compact basse consommation', estimated_value_fcfa: 135000, quantity: 5 },
        { name: 'Mixeur', tier: 'BRONZE', svg_key: 'blender', description: 'Mixeur multifonction haute performance inox', estimated_value_fcfa: 35000, quantity: 12 },
        { name: 'Machine à café', tier: 'BRONZE', svg_key: 'coffeemaker', description: 'Machine à café expresso automatique', estimated_value_fcfa: 55000, quantity: 8 },
        // Or gifts
        { name: 'Smartphone', tier: 'OR', svg_key: 'smartphone', description: 'Smartphone 4G/5G haute autonomie et double SIM', estimated_value_fcfa: 250000, quantity: 5 },
        { name: 'Moto Jakarta', tier: 'OR', svg_key: 'motorbike', description: 'Moto Jakarta tout-terrain économique pour prospection', estimated_value_fcfa: 650000, quantity: 3 },
        { name: 'Ordinateur', tier: 'OR', svg_key: 'computer', description: 'Ordinateur portable professionnel écran 15.6"', estimated_value_fcfa: 420000, quantity: 4 },
      ];

      const insertGift = db.prepare(`
        INSERT INTO gift_catalog (name, tier, svg_key, description, estimated_value_fcfa, quantity, status)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIF')
      `);

      for (const gift of defaultGifts) {
        insertGift.run(gift.name, gift.tier, gift.svg_key, gift.description, gift.estimated_value_fcfa, gift.quantity);
      }
    } else {
      // Backfill estimated_value_fcfa and quantity if 0 or null
      try {
        db.prepare(`
          UPDATE gift_catalog
          SET estimated_value_fcfa = CASE
            WHEN name LIKE '%TV%' THEN 175000
            WHEN name LIKE '%frigo%' THEN 135000
            WHEN name LIKE '%Mixeur%' THEN 35000
            WHEN name LIKE '%café%' THEN 55000
            WHEN name LIKE '%Smartphone%' THEN 250000
            WHEN name LIKE '%Moto%' THEN 650000
            WHEN name LIKE '%Ordinateur%' THEN 420000
            ELSE 100000
          END,
          quantity = CASE
            WHEN name LIKE '%TV%' THEN 6
            WHEN name LIKE '%frigo%' THEN 5
            WHEN name LIKE '%Mixeur%' THEN 12
            WHEN name LIKE '%café%' THEN 8
            WHEN name LIKE '%Smartphone%' THEN 5
            WHEN name LIKE '%Moto%' THEN 3
            WHEN name LIKE '%Ordinateur%' THEN 4
            ELSE 5
          END
          WHERE estimated_value_fcfa IS NULL OR estimated_value_fcfa = 0
        `).run();

        // Backfill real gift photos if not set
        db.prepare(`
          UPDATE gift_catalog
          SET photo_url = CASE
            WHEN name LIKE '%TV%' THEN 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%frigo%' THEN 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%Mixeur%' THEN 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%café%' THEN 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%Smartphone%' THEN 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%Moto%' THEN 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%Ordinateur%' THEN 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80'
            ELSE photo_url
          END,
          custom_photo = CASE
            WHEN name LIKE '%TV%' THEN 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%frigo%' THEN 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%Mixeur%' THEN 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%café%' THEN 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%Smartphone%' THEN 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%Moto%' THEN 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80'
            WHEN name LIKE '%Ordinateur%' THEN 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80'
            ELSE custom_photo
          END
          WHERE (photo_url IS NULL OR photo_url = '') AND (custom_photo IS NULL OR custom_photo = '')
        `).run();
      } catch (bfErr) {
        console.warn('[SCORING-SEED] Notice backfill gift_catalog:', bfErr);
      }
    }

    // 3. Semesters
    const existingSemesters = (db.prepare('SELECT COUNT(*) as count FROM semesters').get() as any)?.count || 0;
    if (existingSemesters === 0) {
      // S1-2026 (Semestre de démo pour tester la clôture, 16/20, 12/20, 8/20)
      db.prepare(`
        INSERT INTO semesters (code, name, start_date, end_date, closing_date, status)
        VALUES ('S1-2026', '1er Semestre 2026', '2026-01-01', '2026-06-30', '2026-07-01', 'EN_COURS')
      `).run();

      // S2-2026 (Semestre courant)
      db.prepare(`
        INSERT INTO semesters (code, name, start_date, end_date, closing_date, status)
        VALUES ('S2-2026', '2ème Semestre 2026', '2026-07-01', '2026-12-31', '2027-01-01', 'EN_COURS')
      `).run();
    }

    // 4. Ensure demo VRS scores exist for S1-2026
    seedDemoScoresIfEmpty();
  } catch (err) {
    console.error('[SCORING-SEED] Erreur initialisation module notation/cadeaux:', err);
  }
}

export function seedDemoScoresIfEmpty(): void {
  try {
    const s1 = db.prepare("SELECT id FROM semesters WHERE code = 'S1-2026'").get() as any;
    if (!s1) return;

    const countScores = (db.prepare('SELECT COUNT(*) as count FROM vrs_semester_scores WHERE semester_id = ?').get(s1.id) as any)?.count || 0;
    if (countScores > 0) return;

    // Get 3 VRS
    const vrsList = db.prepare("SELECT id, public_id, first_name, last_name FROM users WHERE role = 'VRS' ORDER BY id ASC").all() as any[];
    if (vrsList.length === 0) return;

    // Target demo performance profiles:
    // VRS 0 (Ibrahim Sangaré): 16.0 / 20 -> OR
    // VRS 1 (Bakary Coulibaly): 12.0 / 20 -> BRONZE
    // VRS 2 (Oumar Kone or next): 8.0 / 20 -> AUCUN (< 10)
    const profiles = [
      {
        turnover_score: 6.5,
        regularity_score: 3.5,
        payments_score: 4.0,
        new_pos_score: 1.0,
        rigor_score: 1.0,
        total_score: 16.0,
        actual_turnover: 12500000,
        target_turnover: 15000000,
        working_days: 130,
        active_sales_days: 115,
        overdue_payments_count: 0,
        unpaid_balance: 150000,
        new_pos_validated_count: 3,
        target_new_pos: 5,
        stock_discrepancies_count: 0,
        rejected_requests_count: 0,
        tier: 'OR',
      },
      {
        turnover_score: 5.0,
        regularity_score: 2.5,
        payments_score: 2.5,
        new_pos_score: 1.0,
        rigor_score: 1.0,
        total_score: 12.0,
        actual_turnover: 9500000,
        target_turnover: 15000000,
        working_days: 130,
        active_sales_days: 82,
        overdue_payments_count: 1,
        unpaid_balance: 380000,
        new_pos_validated_count: 2,
        target_new_pos: 5,
        stock_discrepancies_count: 0,
        rejected_requests_count: 1,
        tier: 'BRONZE',
      },
      {
        turnover_score: 3.0,
        regularity_score: 1.5,
        payments_score: 2.0,
        new_pos_score: 0.5,
        rigor_score: 1.0,
        total_score: 8.0,
        actual_turnover: 5500000,
        target_turnover: 15000000,
        working_days: 130,
        active_sales_days: 48,
        overdue_payments_count: 3,
        unpaid_balance: 620000,
        new_pos_validated_count: 1,
        target_new_pos: 5,
        stock_discrepancies_count: 1,
        rejected_requests_count: 2,
        tier: 'AUCUN',
      },
    ];

    const insertScoreStmt = db.prepare(`
      INSERT OR REPLACE INTO vrs_semester_scores (
        vrs_id, semester_id, turnover_score, regularity_score, payments_score,
        new_pos_score, rigor_score, total_score, target_turnover, actual_turnover,
        working_days, active_sales_days, overdue_payments_count, unpaid_balance,
        new_pos_validated_count, target_new_pos, stock_discrepancies_count,
        rejected_requests_count, tier, is_frozen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    vrsList.forEach((vrs, idx) => {
      const p = profiles[idx % profiles.length];
      insertScoreStmt.run(
        vrs.id,
        s1.id,
        p.turnover_score,
        p.regularity_score,
        p.payments_score,
        p.new_pos_score,
        p.rigor_score,
        p.total_score,
        p.target_turnover,
        p.actual_turnover,
        p.working_days,
        p.active_sales_days,
        p.overdue_payments_count,
        p.unpaid_balance,
        p.new_pos_validated_count,
        p.target_new_pos,
        p.stock_discrepancies_count,
        p.rejected_requests_count,
        p.tier
      );
    });
  } catch (err) {
    console.error('[SCORING-SEED] Erreur initialisation notes de démo:', err);
  }
}

// Log audit helper
function logAudit(userId: number | null, userPublicId: string, action: string, details: string, req?: any) {
  try {
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || '127.0.0.1';
    db.prepare(`
      INSERT INTO activity_logs (user_id, user_public_id, action, resource, details, ip_address)
      VALUES (?, ?, ?, 'SCORING_GIFTS', ?, ?)
    `).run(userId, userPublicId, action, details, String(ip));
  } catch (e) {
    console.error('[AUDIT] Failed to log activity:', e);
  }
}

// Round to 0.5 helper
export function roundToHalf(num: number): number {
  return Math.round(num * 2) / 2;
}

// Determine tier
export function determineTier(score: number): 'AUCUN' | 'BRONZE' | 'OR' {
  if (score >= 15.0) return 'OR';
  if (score >= 10.0) return 'BRONZE';
  return 'AUCUN';
}

// Compute live VRS score on the server for the ongoing semester
export function computeLiveVrsSemesterScore(vrsId: number, semesterId: number): any {
  const semester = db.prepare('SELECT * FROM semesters WHERE id = ?').get(semesterId) as any;
  if (!semester) return null;

  // If frozen, return existing score record
  const existing = db.prepare('SELECT * FROM vrs_semester_scores WHERE vrs_id = ? AND semester_id = ?').get(vrsId, semesterId) as any;
  if (existing && existing.is_frozen === 1) {
    return existing;
  }

  // Get current weights (default: 8, 4, 4, 2, 2)
  let settings = db.prepare('SELECT * FROM vrs_scoring_settings ORDER BY id ASC LIMIT 1').get() as ScoringSettings | undefined;
  if (!settings) {
    seedScoringDefaultData();
    settings = db.prepare('SELECT * FROM vrs_scoring_settings ORDER BY id ASC LIMIT 1').get() as ScoringSettings;
  }

  const startDate = semester.start_date;
  const endDate = semester.end_date;

  // 1. Chiffre d'affaires vs objectif : 8 points
  const targetTurnover = existing?.target_turnover || 15000000;
  const salesRow = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as turnover,
           COUNT(DISTINCT date(created_at)) as active_days
    FROM sales
    WHERE vrs_id = ? AND date(created_at) >= ? AND date(created_at) <= ?
  `).get(vrsId, startDate, endDate) as any;

  const actualTurnover = Number(salesRow?.turnover) > 0 ? Number(salesRow.turnover) : (existing?.actual_turnover ?? 0);
  const turnoverRatio = targetTurnover > 0 ? Math.min(1.0, actualTurnover / targetTurnover) : 0;
  const turnoverScore = roundToHalf(turnoverRatio * settings.weight_turnover);

  // 2. Régularité (jours avec au moins une vente / jours ouvrés) : 4 points
  const workingDays = existing?.working_days || 130;
  const activeSalesDays = Number(salesRow?.active_days) > 0 ? Number(salesRow.active_days) : (existing?.active_sales_days ?? 0);
  const regularityRatio = workingDays > 0 ? Math.min(1.0, activeSalesDays / workingDays) : 0;
  const regularityScore = roundToHalf(regularityRatio * settings.weight_regularity);

  // 3. Paiements dans les délais (solde dû sous le plafond, aucun retard) : 4 points
  const unpaidRow = db.prepare(`
    SELECT COALESCE(SUM(remaining_amount), 0) as balance,
           COUNT(CASE WHEN remaining_amount > 0 AND (julianday('now') - julianday(created_at)) > 15 THEN 1 END) as overdue_count
    FROM vrs_invoices
    WHERE vrs_id = ? AND status = 'ACTIVE'
  `).get(vrsId) as any;

  const unpaidBalance = unpaidRow?.balance != null ? Number(unpaidRow.balance) : (existing?.unpaid_balance ?? 0);
  const overdueCount = unpaidRow?.overdue_count != null ? Number(unpaidRow.overdue_count) : (existing?.overdue_payments_count ?? 0);

  let paymentsScore = 0;
  if (overdueCount === 0 && unpaidBalance <= 500000) {
    paymentsScore = settings.weight_payments;
  } else if (overdueCount === 0 && unpaidBalance <= 1000000) {
    paymentsScore = roundToHalf(settings.weight_payments * 0.75);
  } else if (overdueCount <= 1 && unpaidBalance <= 1000000) {
    paymentsScore = roundToHalf(settings.weight_payments * 0.5);
  } else if (overdueCount <= 2 && unpaidBalance <= 1500000) {
    paymentsScore = roundToHalf(settings.weight_payments * 0.25);
  } else {
    paymentsScore = 0;
  }

  // 4. Nouveaux PDV validés par le SAN : 2 points
  const targetNewPos = existing?.target_new_pos || 5;
  const posRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM points_of_sale
    WHERE (created_by_user_id = ? OR assigned_vrs_id = ?) AND status = 'ACTIF' AND date(created_at) >= ? AND date(created_at) <= ?
  `).get(vrsId, vrsId, startDate, endDate) as any;

  const newPosValidated = Number(posRow?.cnt) > 0 ? Number(posRow.cnt) : (existing?.new_pos_validated_count ?? 0);
  const newPosRatio = targetNewPos > 0 ? Math.min(1.0, newPosValidated / targetNewPos) : 0;
  const newPosScore = roundToHalf(newPosRatio * settings.weight_new_pos);

  // 5. Rigueur (aucun écart de stock "à régulariser", aucune demande rejetée pour erreur) : 2 points
  const stockDiscrepancies = (db.prepare(`
    SELECT COUNT(*) as cnt FROM stock_movements
    WHERE (created_by_user_id = ? OR (source_id = ? AND source_role = 'VRS') OR (target_id = ? AND target_role = 'VRS'))
      AND (movement_type = 'REGULARIZATION' OR notes LIKE '%écart%' OR notes LIKE '%régulariser%')
      AND date(created_at) >= ? AND date(created_at) <= ?
  `).get(vrsId, vrsId, vrsId, startDate, endDate) as any)?.cnt ?? (existing?.stock_discrepancies_count ?? 0);

  const rejectedRequests = (db.prepare(`
    SELECT COUNT(*) as cnt FROM supply_requests
    WHERE vrs_id = ? AND (status LIKE 'REJETE%' OR status = 'REJETEE')
      AND date(created_at) >= ? AND date(created_at) <= ?
  `).get(vrsId, startDate, endDate) as any)?.cnt ?? (existing?.rejected_requests_count ?? 0);

  const totalErrors = stockDiscrepancies + rejectedRequests;
  let rigorScore = 0;
  if (totalErrors === 0) {
    rigorScore = settings.weight_rigor;
  } else if (totalErrors === 1) {
    rigorScore = roundToHalf(settings.weight_rigor * 0.5);
  } else {
    rigorScore = 0;
  }

  // Total calculation
  const rawTotal = turnoverScore + regularityScore + paymentsScore + newPosScore + rigorScore;
  const totalScore = roundToHalf(Math.min(20, Math.max(0, rawTotal)));
  const tier = determineTier(totalScore);

  db.prepare(`
    INSERT OR REPLACE INTO vrs_semester_scores (
      vrs_id, semester_id, turnover_score, regularity_score, payments_score,
      new_pos_score, rigor_score, total_score, target_turnover, actual_turnover,
      working_days, active_sales_days, overdue_payments_count, unpaid_balance,
      new_pos_validated_count, target_new_pos, stock_discrepancies_count,
      rejected_requests_count, tier, is_frozen, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `).run(
    vrsId,
    semesterId,
    turnoverScore,
    regularityScore,
    paymentsScore,
    newPosScore,
    rigorScore,
    totalScore,
    targetTurnover,
    actualTurnover,
    workingDays,
    activeSalesDays,
    overdueCount,
    unpaidBalance,
    newPosValidated,
    targetNewPos,
    stockDiscrepancies,
    rejectedRequests,
    tier
  );

  return db.prepare('SELECT * FROM vrs_semester_scores WHERE vrs_id = ? AND semester_id = ?').get(vrsId, semesterId);
}

// Clôture interne de semestre (déclenchée par le SAN ou automatiquement le 1er janvier et 1er juillet heure Bamako)
export function closeSemesterInternal(semesterId: number, closedByUserId: number | null, userPublicId: string, req?: any, force = false): any[] {
  const semester = db.prepare('SELECT * FROM semesters WHERE id = ?').get(semesterId) as any;
  if (!semester) throw new Error('Semestre introuvable.');
  if (semester.status === 'CLOTURE' && !force) return [];

  // Active gifts by tier
  const bronzeGifts = db.prepare("SELECT * FROM gift_catalog WHERE tier = 'BRONZE' AND status = 'ACTIF'").all() as any[];
  const orGifts = db.prepare("SELECT * FROM gift_catalog WHERE tier = 'OR' AND status = 'ACTIF'").all() as any[];

  if (bronzeGifts.length === 0 || orGifts.length === 0) {
    throw new Error('Le catalogue doit contenir au moins un cadeau actif pour chaque palier (Bronze et Or).');
  }

  // Ensure all VRS have calculated scores for this semester (compute if not already present)
  const allVrs = db.prepare("SELECT id FROM users WHERE role = 'VRS'").all() as any[];
  for (const v of allVrs) {
    const existing = db.prepare('SELECT id FROM vrs_semester_scores WHERE vrs_id = ? AND semester_id = ?').get(v.id, semesterId);
    if (!existing) {
      computeLiveVrsSemesterScore(v.id, semesterId);
    }
  }

  const vrsScores = db.prepare('SELECT * FROM vrs_semester_scores WHERE semester_id = ?').all(semesterId) as any[];

  const runCloseTx = db.transaction(() => {
    // 1. Mark semester closed
    db.prepare(`
      UPDATE semesters
      SET status = 'CLOTURE', closed_at = CURRENT_TIMESTAMP, closed_by_user_id = ?
      WHERE id = ?
    `).run(closedByUserId, semesterId);

    // 2. Freeze each VRS score and generate scratch card if score >= 10
    const cardsGenerated: any[] = [];

    for (const scoreRow of vrsScores) {
      // Freeze score
      const finalScore = roundToHalf(Number(scoreRow.total_score));
      const tier = determineTier(finalScore);

      db.prepare(`
        UPDATE vrs_semester_scores
        SET is_frozen = 1, total_score = ?, tier = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(finalScore, tier, scoreRow.id);

      // Check if eligible (>= 10)
      if (finalScore >= 10.0) {
        // Draw random gift from tier on server
        const pool = tier === 'OR' ? orGifts : bronzeGifts;
        const randomIndex = Math.floor(Math.random() * pool.length);
        const selectedGift = pool[randomIndex];

        const cardCode = `CARD-${semester.code}-VRS${scoreRow.vrs_id}`;

        // Check if a card already exists
        const existingCard = db.prepare(
          'SELECT id, is_revealed, gift_id FROM scratch_cards WHERE semester_id = ? AND vrs_id = ?'
        ).get(semesterId, scoreRow.vrs_id) as any;

        if (existingCard) {
          // If already revealed, do NOT overwrite the gift (immutable rule)
          if (!existingCard.is_revealed) {
            db.prepare(`
              UPDATE scratch_cards
              SET gift_id = ?, tier = ?, final_score = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(selectedGift.id, tier, finalScore, existingCard.id);
          }
        } else {
          // Insert scratch card (one per VRS per semester)
          db.prepare(`
            INSERT INTO scratch_cards (
              code, semester_id, vrs_id, gift_id, tier, final_score, is_revealed, delivery_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, 'A_PROGRAMMER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(cardCode, semesterId, scoreRow.vrs_id, selectedGift.id, tier, finalScore);
        }

        // Notify VRS
        db.prepare(`
          INSERT INTO notifications (user_id, role, title, message, type, is_read, link)
          VALUES (?, 'VRS', ?, ?, 'SYSTEM', 0, 'gifts')
        `).run(
          scoreRow.vrs_id,
          'Félicitations ! Votre carte cadeau est prête 🎁',
          `Clôture du semestre ${semester.name} : avec une note de ${finalScore.toFixed(1)}/20 (${tier}), une carte cadeau à gratter vous attend dans "Mes cadeaux" !`
        );

        cardsGenerated.push({ vrs_id: scoreRow.vrs_id, tier, gift_name: selectedGift.name, cardCode });

        logAudit(
          closedByUserId,
          userPublicId,
          'TIRAGE_CARTE_SERVEUR',
          `Carte générée pour VRS ID ${scoreRow.vrs_id} : Note=${finalScore.toFixed(1)}/20, Palier=${tier}, Cadeau tiré="${selectedGift.name}" (ID ${selectedGift.id})`,
          req
        );
      } else {
        // Under 10: notify missing points
        const missing = (10.0 - finalScore).toFixed(1);
        db.prepare(`
          INSERT INTO notifications (user_id, role, title, message, type, is_read, link)
          VALUES (?, 'VRS', ?, ?, 'SYSTEM', 0, 'gifts')
        `).run(
          scoreRow.vrs_id,
          'Bilan du semestre clôturé',
          `Votre note pour le semestre ${semester.name} est de ${finalScore.toFixed(1)}/20. Pas de carte ce semestre, objectif : 10/20 (il vous manquait ${missing} pt${Number(missing) > 1 ? 's' : ''}). Rendez-vous dans "Mes cadeaux" pour le détail.`
        );
      }
    }

    logAudit(
      closedByUserId,
      userPublicId,
      'CLOTURE_SEMESTRE',
      `Clôture du semestre "${semester.name}" (${semester.code}). ${cardsGenerated.length} carte(s) à gratter générée(s).`,
      req
    );

    return cardsGenerated;
  });

  return runCloseTx();
}

// Vérification de la clôture automatique selon fuseau Africa/Bamako (1er janvier et 1er juillet)
export function checkAndAutoCloseSemestersInBamako(): void {
  try {
    const bamakoDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Bamako',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const expiredSemesters = db.prepare(`
      SELECT * FROM semesters
      WHERE status = 'EN_COURS' AND closing_date <= ?
    `).all(bamakoDate) as any[];

    for (const sem of expiredSemesters) {
      console.log(`[SCORING] Clôture automatique du semestre ${sem.code} (Date Bamako: ${bamakoDate} >= ${sem.closing_date})`);
      closeSemesterInternal(sem.id, null, 'SYSTEM_BAMAKO');
    }
  } catch (err) {
    console.error('[SCORING] Erreur vérification clôture automatique Bamako:', err);
  }
}

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// 1. GET /api/scoring/settings
router.get('/settings', requireAuth, (_req: AuthRequest, res: Response) => {
  let settings = db.prepare('SELECT * FROM vrs_scoring_settings ORDER BY id ASC LIMIT 1').get() as ScoringSettings | undefined;
  if (!settings) {
    seedScoringDefaultData();
    settings = db.prepare('SELECT * FROM vrs_scoring_settings ORDER BY id ASC LIMIT 1').get() as ScoringSettings;
  }
  res.json({ settings });
});

// 2. PUT /api/scoring/settings (SAN only)
router.put('/settings', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  const { weight_turnover, weight_regularity, weight_payments, weight_new_pos, weight_rigor } = req.body;
  const w1 = Number(weight_turnover);
  const w2 = Number(weight_regularity);
  const w3 = Number(weight_payments);
  const w4 = Number(weight_new_pos);
  const w5 = Number(weight_rigor);

  if (isNaN(w1) || isNaN(w2) || isNaN(w3) || isNaN(w4) || isNaN(w5)) {
    return res.status(400).json({ error: 'Toutes les pondérations doivent être des nombres valides.' });
  }

  if (w1 < 0 || w2 < 0 || w3 < 0 || w4 < 0 || w5 < 0) {
    return res.status(400).json({ error: 'Les pondérations ne peuvent pas être négatives.' });
  }

  const total = w1 + w2 + w3 + w4 + w5;
  if (Math.abs(total - 20) > 0.01) {
    return res.status(400).json({
      error: `La somme des pondérations doit être exactement égale à 20 points (total actuel: ${total.toFixed(1)} pts).`,
    });
  }

  const existing = db.prepare('SELECT id FROM vrs_scoring_settings LIMIT 1').get() as any;
  if (existing) {
    db.prepare(`
      UPDATE vrs_scoring_settings
      SET weight_turnover = ?, weight_regularity = ?, weight_payments = ?, weight_new_pos = ?, weight_rigor = ?,
          updated_at = CURRENT_TIMESTAMP, updated_by_user_id = ?
      WHERE id = ?
    `).run(w1, w2, w3, w4, w5, user.id, existing.id);
  } else {
    db.prepare(`
      INSERT INTO vrs_scoring_settings (weight_turnover, weight_regularity, weight_payments, weight_new_pos, weight_rigor, updated_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(w1, w2, w3, w4, w5, user.id);
  }

  logAudit(
    user.id,
    user.publicId,
    'MODIFICATION_REGLAGES_NOTATION',
    `Pondérations modifiées : CA=${w1}, Rég=${w2}, Paiements=${w3}, PDV=${w4}, Rigueur=${w5} (Total 20)`,
    req
  );

  const updated = db.prepare('SELECT * FROM vrs_scoring_settings LIMIT 1').get();
  res.json({ success: true, settings: updated });
});

// 3. GET /api/scoring/semesters
router.get('/semesters', requireAuth, (_req: AuthRequest, res: Response) => {
  const semesters = db.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM vrs_semester_scores WHERE semester_id = s.id) as total_vrs_scored,
           (SELECT COUNT(*) FROM scratch_cards WHERE semester_id = s.id) as cards_generated_count,
           (SELECT COUNT(*) FROM scratch_cards WHERE semester_id = s.id AND is_revealed = 1) as cards_revealed_count,
           (SELECT COUNT(*) FROM scratch_cards WHERE semester_id = s.id AND delivery_status IN ('REMISE_EFFECTUEE', 'RECU')) as gifts_delivered_count
    FROM semesters s
    ORDER BY s.start_date DESC
  `).all();
  res.json({ semesters });
});

// 4. POST /api/scoring/semesters/close (SAN only)
const handleCloseSemesterAction = (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  const semesterId = Number(req.params.id || req.body.semester_id);
  const force = Boolean(req.body.force);

  if (!semesterId) {
    return res.status(400).json({ error: 'Identifiant du semestre requis.' });
  }

  try {
    const semester = db.prepare('SELECT * FROM semesters WHERE id = ?').get(semesterId) as any;
    if (!semester) {
      return res.status(404).json({ error: 'Semestre introuvable.' });
    }

    if (semester.status === 'CLOTURE' && !force) {
      // Return helpful message with flag to allow re-generation
      return res.status(400).json({
        error: 'Ce semestre est déjà clôturé. Utilisez l\'option de régénération pour actualiser les cartes.',
        alreadyClosed: true,
      });
    }

    const cardsResult = closeSemesterInternal(semesterId, user.id, user.publicId, req, force);

    res.json({
      success: true,
      message: `Semestre "${semester.name}" clôturé avec succès. ${cardsResult.length} carte(s) cadeau générée(s).`,
      cardsGenerated: cardsResult,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la clôture du semestre.' });
  }
};

router.post('/semesters/close', requireAuth, handleCloseSemesterAction);
router.post('/semesters/:id/close', requireAuth, handleCloseSemesterAction);

// 4b. POST /api/scoring/semesters/reopen (SAN only)
const handleReopenSemesterAction = (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  const semesterId = Number(req.params.id || req.body.semester_id);
  if (!semesterId) {
    return res.status(400).json({ error: 'Identifiant du semestre requis.' });
  }

  try {
    const semester = db.prepare('SELECT * FROM semesters WHERE id = ?').get(semesterId) as any;
    if (!semester) return res.status(404).json({ error: 'Semestre introuvable.' });

    db.prepare(`
      UPDATE semesters
      SET status = 'EN_COURS', closed_at = NULL, closed_by_user_id = NULL
      WHERE id = ?
    `).run(semesterId);

    db.prepare(`
      UPDATE vrs_semester_scores
      SET is_frozen = 0
      WHERE semester_id = ?
    `).run(semesterId);

    logAudit(
      user.id,
      user.publicId,
      'REOUVERTURE_SEMESTRE',
      `Réouverture du semestre "${semester.name}" (ID ${semesterId}) par le SAN`,
      req
    );

    res.json({ success: true, message: `Semestre "${semester.name}" rouvert avec succès.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la réouverture.' });
  }
};

router.post('/semesters/reopen', requireAuth, handleReopenSemesterAction);
router.post('/semesters/:id/reopen', requireAuth, handleReopenSemesterAction);

// 5. POST /api/scoring/semesters/reset-demo (SAN only: test shortcut for demo)
router.post('/semesters/reset-demo', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  // Ensure default catalog and settings
  seedScoringDefaultData();

  // Reset S1-2026 to EN_COURS, clear cards for S1-2026, re-seed 16/20, 12/20, 8/20
  const s1 = db.prepare("SELECT id FROM semesters WHERE code = 'S1-2026'").get() as any;
  if (!s1) {
    db.prepare(`
      INSERT INTO semesters (code, name, start_date, end_date, closing_date, status)
      VALUES ('S1-2026', '1er Semestre 2026', '2026-01-01', '2026-06-30', '2026-07-01', 'EN_COURS')
    `).run();
  } else {
    db.prepare("UPDATE semesters SET status = 'EN_COURS', closed_at = NULL, closed_by_user_id = NULL WHERE id = ?").run(s1.id);
  }

  const s1Id = (db.prepare("SELECT id FROM semesters WHERE code = 'S1-2026'").get() as any).id;

  // Clear existing cards for S1
  db.prepare('DELETE FROM scratch_cards WHERE semester_id = ?').run(s1Id);
  db.prepare('DELETE FROM vrs_semester_scores WHERE semester_id = ?').run(s1Id);

  // Re-seed demo scores (16, 12, 8)
  seedDemoScoresIfEmpty();

  logAudit(
    user.id,
    user.publicId,
    'REINITIALISATION_SEMESTRE_DEMO',
    'Semestre de démo S1-2026 réinitialisé pour test (VRS 16/20, 12/20, 8/20 prêts pour clôture).',
    req
  );

  res.json({
    success: true,
    message: 'Semestre de démo S1-2026 réinitialisé avec succès (profils 16/20 Or, 12/20 Bronze, 8/20 Sans carte).',
  });
});

// 6. GET /api/scoring/scores
router.get('/scores', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const semesterIdParam = req.query.semester_id ? Number(req.query.semester_id) : null;

  let semesterId = semesterIdParam;
  if (!semesterId) {
    const latestSem = db.prepare('SELECT id FROM semesters ORDER BY start_date DESC LIMIT 1').get() as any;
    semesterId = latestSem?.id || 1;
  }

  // If semester is ongoing, dynamically calculate and refresh live score on the server
  const semRow = db.prepare('SELECT * FROM semesters WHERE id = ?').get(semesterId) as any;
  if (semRow && semRow.status === 'EN_COURS') {
    const allVrs = db.prepare("SELECT id FROM users WHERE role = 'VRS'").all() as any[];
    for (const v of allVrs) {
      const existing = db.prepare('SELECT id FROM vrs_semester_scores WHERE vrs_id = ? AND semester_id = ?').get(v.id, semesterId);
      if (!existing || semRow.code !== 'S1-2026') {
        computeLiveVrsSemesterScore(v.id, semesterId);
      }
    }
  }

  let query = `
    SELECT sc.*,
           u.public_id as vrs_public_id,
           u.first_name as vrs_first_name,
           u.last_name as vrs_last_name,
           u.phone as vrs_phone,
           u.drop_point_id,
           dp.name as drop_point_name,
           dp.code as drop_point_code,
           card.id as card_id,
           card.code as card_code,
           card.is_revealed as card_is_revealed,
           card.revealed_at as card_revealed_at,
           card.delivery_status,
           card.delivery_date,
           card.delivery_location,
           card.delivered_by,
           g.name as gift_name,
           g.svg_key as gift_svg_key,
           g.custom_photo as gift_custom_photo,
           g.photo_url as gift_photo_url,
           g.estimated_value_fcfa as gift_estimated_value
    FROM vrs_semester_scores sc
    JOIN users u ON sc.vrs_id = u.id
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    LEFT JOIN scratch_cards card ON card.semester_id = sc.semester_id AND card.vrs_id = sc.vrs_id
    LEFT JOIN gift_catalog g ON card.gift_id = g.id
    WHERE sc.semester_id = ?
  `;

  const params: any[] = [semesterId];

  if (user.role === 'SALES_ADMIN_NATIONAL') {
    // SAN sees all
  } else if (user.role === 'SALES_ADMIN') {
    // SA sees VRS belonging to their Drop Point
    query += ' AND u.drop_point_id = ?';
    params.push(user.dropPointId || -1);
  } else if (user.role === 'FSS') {
    // FSS sees VRS under their supervision or drop point
    query += ' AND (u.fss_id = ? OR u.drop_point_id = ?)';
    params.push(user.id, user.dropPointId || -1);
  } else {
    // VRS sees only their own score
    query += ' AND u.id = ?';
    params.push(user.id);
  }

  query += ' ORDER BY sc.total_score DESC, u.last_name ASC';

  const scores = db.prepare(query).all(...params);

  // Also include previous semester score for progression calculation
  const prevSemester = db.prepare(`
    SELECT id, code, name FROM semesters
    WHERE start_date < (SELECT start_date FROM semesters WHERE id = ?)
    ORDER BY start_date DESC LIMIT 1
  `).get(semesterId) as any;

  let prevScoresMap: Record<number, number> = {};
  if (prevSemester) {
    const prevList = db.prepare('SELECT vrs_id, total_score FROM vrs_semester_scores WHERE semester_id = ?').all(prevSemester.id) as any[];
    for (const r of prevList) {
      prevScoresMap[r.vrs_id] = r.total_score;
    }
  }

  const enriched = scores.map((s: any) => ({
    ...s,
    previous_total_score: prevScoresMap[s.vrs_id] ?? null,
    progression: prevScoresMap[s.vrs_id] != null ? roundToHalf(s.total_score - prevScoresMap[s.vrs_id]) : null,
  }));

  res.json({
    semester_id: semesterId,
    scores: enriched,
    previous_semester: prevSemester || null,
  });
});

// 7. PUT /api/scoring/scores/:id/correct (SAN only: exception tracking)
router.put('/scores/:id/correct', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  const scoreId = Number(req.params.id);
  const { new_total_score, reason } = req.body;

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return res.status(400).json({
      error: 'Un motif d\'audit circonstancié (au moins 5 caractères) est strictement obligatoire pour toute correction exceptionnelle de note.',
    });
  }

  const scoreRow = db.prepare(`
    SELECT sc.*, s.status as semester_status, s.code as semester_code, u.public_id as vrs_public_id, u.first_name, u.last_name
    FROM vrs_semester_scores sc
    JOIN semesters s ON sc.semester_id = s.id
    JOIN users u ON sc.vrs_id = u.id
    WHERE sc.id = ?
  `).get(scoreId) as any;

  if (!scoreRow) {
    return res.status(404).json({ error: 'Note introuvable.' });
  }

  const scoreVal = Number(new_total_score);
  if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 20) {
    return res.status(400).json({ error: 'La nouvelle note doit être comprise entre 0 et 20.' });
  }

  const roundedScore = roundToHalf(scoreVal);
  const oldScore = scoreRow.total_score;
  const newTier = determineTier(roundedScore);

  const runCorrectionTx = db.transaction(() => {
    db.prepare(`
      UPDATE vrs_semester_scores
      SET total_score = ?, tier = ?, correction_reason = ?, corrected_by_user_id = ?, corrected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(roundedScore, newTier, reason.trim(), user.id, scoreId);

    // If semester was closed and score newly reached >= 10, generate card if missing
    if (scoreRow.is_frozen === 1 && roundedScore >= 10.0) {
      const existingCard = db.prepare('SELECT id FROM scratch_cards WHERE semester_id = ? AND vrs_id = ?').get(scoreRow.semester_id, scoreRow.vrs_id);
      if (!existingCard) {
        const pool = newTier === 'OR'
          ? db.prepare("SELECT * FROM gift_catalog WHERE tier = 'OR' AND status = 'ACTIF'").all() as any[]
          : db.prepare("SELECT * FROM gift_catalog WHERE tier = 'BRONZE' AND status = 'ACTIF'").all() as any[];

        if (pool.length > 0) {
          const selectedGift = pool[Math.floor(Math.random() * pool.length)];
          const cardCode = `CARD-${scoreRow.semester_code}-VRS${scoreRow.vrs_id}`;

          db.prepare(`
            INSERT INTO scratch_cards (code, semester_id, vrs_id, gift_id, tier, final_score, is_revealed, delivery_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'A_PROGRAMMER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(cardCode, scoreRow.semester_id, scoreRow.vrs_id, selectedGift.id, newTier, roundedScore);
        }
      } else {
        db.prepare('UPDATE scratch_cards SET tier = ?, final_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
          newTier,
          roundedScore,
          (existingCard as any).id
        );
      }
    }

    logAudit(
      user.id,
      user.publicId,
      'CORRECTION_NOTE_POST_CLOTURE',
      `Correction de note pour ${scoreRow.first_name} ${scoreRow.last_name} (${scoreRow.vrs_public_id}) : ${oldScore}/20 -> ${roundedScore}/20 (${newTier}). Motif : "${reason.trim()}"`,
      req
    );
  });

  runCorrectionTx();

  const updatedScore = db.prepare('SELECT * FROM vrs_semester_scores WHERE id = ?').get(scoreId);
  res.json({ success: true, score: updatedScore });
});

// 8. GET /api/scoring/gifts/catalog
router.get('/gifts/catalog', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const showAll = user.role === 'SALES_ADMIN_NATIONAL';

  const query = showAll
    ? 'SELECT * FROM gift_catalog ORDER BY tier DESC, name ASC'
    : "SELECT * FROM gift_catalog WHERE status = 'ACTIF' ORDER BY tier DESC, name ASC";

  const catalog = db.prepare(query).all();
  res.json({ catalog });
});

// 9. POST /api/scoring/gifts/catalog (SAN only)
router.post('/gifts/catalog', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  const { name, tier, description, estimated_value_fcfa, quantity, photo_url, svg_key, custom_photo } = req.body;
  if (!name || !tier || !['BRONZE', 'OR'].includes(tier)) {
    return res.status(400).json({ error: 'Nom et palier valide (BRONZE ou OR) obligatoires.' });
  }

  const finalSvgKey = svg_key || (tier === 'OR' ? 'smartphone' : 'tv');
  const finalPhotoUrl = photo_url || custom_photo || null;
  const estimatedVal = Math.max(0, Number(estimated_value_fcfa) || 0);
  const qty = Math.max(0, parseInt(quantity, 10) || 0);

  const resInsert = db.prepare(`
    INSERT INTO gift_catalog (name, tier, description, estimated_value_fcfa, quantity, photo_url, svg_key, custom_photo, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF')
  `).run(name.trim(), tier, description || '', estimatedVal, qty, finalPhotoUrl, finalSvgKey, finalPhotoUrl);

  logAudit(
    user.id,
    user.publicId,
    'AJOUT_CADEAU_CATALOGUE',
    `Ajout du cadeau "${name.trim()}" au palier ${tier} (Valeur: ${estimatedVal.toLocaleString('fr-FR')} FCFA, Qté: ${qty})`,
    req
  );

  const created = db.prepare('SELECT * FROM gift_catalog WHERE id = ?').get(resInsert.lastInsertRowid);
  res.json({ success: true, gift: created });
});

// 10. PUT /api/scoring/gifts/catalog/:id (SAN only)
router.put('/gifts/catalog/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  const giftId = Number(req.params.id);
  const { name, tier, description, estimated_value_fcfa, quantity, photo_url, svg_key, custom_photo, status } = req.body;

  const current = db.prepare('SELECT * FROM gift_catalog WHERE id = ?').get(giftId) as any;
  if (!current) {
    return res.status(404).json({ error: 'Cadeau introuvable.' });
  }

  const finalPhotoUrl = photo_url !== undefined ? photo_url : (custom_photo !== undefined ? custom_photo : current.photo_url);
  const estimatedVal = estimated_value_fcfa !== undefined ? Math.max(0, Number(estimated_value_fcfa) || 0) : current.estimated_value_fcfa;
  const qty = quantity !== undefined ? Math.max(0, parseInt(quantity, 10) || 0) : current.quantity;

  db.prepare(`
    UPDATE gift_catalog
    SET name = ?, tier = ?, description = ?, estimated_value_fcfa = ?, quantity = ?, photo_url = ?, svg_key = ?, custom_photo = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name ? name.trim() : current.name,
    tier || current.tier,
    description !== undefined ? description : current.description,
    estimatedVal,
    qty,
    finalPhotoUrl,
    svg_key || current.svg_key,
    finalPhotoUrl,
    status || current.status,
    giftId
  );

  logAudit(
    user.id,
    user.publicId,
    'MODIFICATION_CADEAU_CATALOGUE',
    `Modification du cadeau ID ${giftId} (${name || current.name}) - Palier: ${tier || current.tier}, Statut: ${status || current.status}`,
    req
  );

  const updated = db.prepare('SELECT * FROM gift_catalog WHERE id = ?').get(giftId);
  res.json({ success: true, gift: updated });
});

// 10b. PATCH /api/scoring/gifts/catalog/:id/toggle-status (SAN only)
router.patch('/gifts/catalog/:id/toggle-status', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  const giftId = Number(req.params.id);
  const current = db.prepare('SELECT * FROM gift_catalog WHERE id = ?').get(giftId) as any;
  if (!current) return res.status(404).json({ error: 'Cadeau introuvable.' });

  const newStatus = current.status === 'ACTIF' ? 'INACTIF' : 'ACTIF';
  db.prepare('UPDATE gift_catalog SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, giftId);

  logAudit(
    user.id,
    user.publicId,
    newStatus === 'ACTIF' ? 'ACTIVATION_CADEAU' : 'DESACTIVATION_CADEAU',
    `${newStatus === 'ACTIF' ? 'Activation' : 'Désactivation'} du cadeau "${current.name}" (ID ${giftId}) par le SAN`,
    req
  );

  const updated = db.prepare('SELECT * FROM gift_catalog WHERE id = ?').get(giftId);
  res.json({ success: true, gift: updated });
});

// 10c. POST /api/scoring/gifts/upload-photo (SAN only, verifies magic bytes, 5 Mo max)
router.post('/gifts/upload-photo', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  const { image_data, gift_id } = req.body;
  if (!image_data || typeof image_data !== 'string') {
    return res.status(400).json({ error: 'Données image manquantes ou invalides.' });
  }

  let base64Clean = image_data;
  if (image_data.includes(';base64,')) {
    base64Clean = image_data.split(';base64,')[1];
  }

  const buffer = Buffer.from(base64Clean, 'base64');

  // Strict 5 Mo limit
  const MAX_SIZE = 5 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    return res.status(400).json({ error: 'La taille de la photo dépasse la limite autorisée de 5 Mo.' });
  }

  // Real type verification from magic bytes (JPEG, PNG, WebP)
  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    return res.status(400).json({
      error: 'Format d\'image non valide. Seuls les formats réels JPEG, PNG et WebP sont autorisés.',
    });
  }

  const ext = detectedType === 'jpeg' ? 'jpg' : detectedType;
  const filename = `gift-${gift_id || 'item'}-${Date.now()}.${ext}`;
  const filePath = path.join(giftsUploadDir, filename);

  fs.writeFileSync(filePath, buffer);

  const photoUrl = `/api/scoring/gifts/photo/${filename}`;

  // If gift_id provided, update gift record and remove previous uploaded file if on disk
  if (gift_id) {
    const existingGift = db.prepare('SELECT * FROM gift_catalog WHERE id = ?').get(gift_id) as any;
    if (existingGift) {
      if (existingGift.photo_url && existingGift.photo_url.includes('/api/scoring/gifts/photo/')) {
        const oldFile = path.basename(existingGift.photo_url);
        const oldPath = path.join(giftsUploadDir, oldFile);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
      }
      db.prepare(`
        UPDATE gift_catalog
        SET photo_url = ?, custom_photo = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(photoUrl, photoUrl, gift_id);

      logAudit(
        user.id,
        user.publicId,
        'UPLOAD_PHOTO_CADEAU',
        `Photo enregistrée pour le cadeau "${existingGift.name}" (ID ${gift_id}) - ${buffer.length} octets (${detectedType.toUpperCase()})`,
        req
      );
    }
  }

  res.json({
    success: true,
    photo_url: photoUrl,
    filename,
    sizeBytes: buffer.length,
    format: detectedType,
  });
});

// 10d. GET /api/scoring/gifts/photo/:filename (Serve photo from disk)
router.get('/gifts/photo/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(giftsUploadDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Photo introuvable.' });
  }
  let contentType = 'image/jpeg';
  if (filename.endsWith('.png')) contentType = 'image/png';
  else if (filename.endsWith('.webp')) contentType = 'image/webp';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(filePath).pipe(res);
});

// 10e. DELETE /api/scoring/gifts/:id/photo (SAN only, delete photo file and clear record)
router.delete('/gifts/:id/photo', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  const giftId = Number(req.params.id);
  const gift = db.prepare('SELECT * FROM gift_catalog WHERE id = ?').get(giftId) as any;
  if (!gift) return res.status(404).json({ error: 'Cadeau introuvable.' });

  if (gift.photo_url && gift.photo_url.includes('/api/scoring/gifts/photo/')) {
    const filename = path.basename(gift.photo_url);
    const filePath = path.join(giftsUploadDir, filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }

  db.prepare(`
    UPDATE gift_catalog
    SET photo_url = NULL, custom_photo = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(giftId);

  logAudit(
    user.id,
    user.publicId,
    'SUPPRESSION_PHOTO_CADEAU',
    `Suppression de la photo du cadeau "${gift.name}" (ID ${giftId}) par le SAN`,
    req
  );

  const updated = db.prepare('SELECT * FROM gift_catalog WHERE id = ?').get(giftId);
  res.json({ success: true, message: 'Photo supprimée avec succès.', gift: updated });
});

// 11. GET /api/scoring/scratch-cards/my-card (for logged-in VRS)
router.get('/scratch-cards/my-card', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const semesterIdParam = req.query.semester_id ? Number(req.query.semester_id) : null;

  let semesterQuery = 'SELECT * FROM semesters ORDER BY start_date DESC LIMIT 1';
  let semester = (semesterIdParam
    ? db.prepare('SELECT * FROM semesters WHERE id = ?').get(semesterIdParam)
    : db.prepare(semesterQuery).get()) as any;

  if (!semester) {
    seedScoringDefaultData();
    semester = db.prepare(semesterQuery).get() as any;
  }

  // If semester is ongoing and user is VRS, calculate/update live score on server
  if (user.role === 'VRS' && semester && semester.status === 'EN_COURS') {
    const existing = db.prepare('SELECT id FROM vrs_semester_scores WHERE vrs_id = ? AND semester_id = ?').get(user.id, semester.id);
    if (!existing || semester.code !== 'S1-2026') {
      computeLiveVrsSemesterScore(user.id, semester.id);
    }
  }

  // Get VRS score for this semester
  const score = db.prepare(`
    SELECT * FROM vrs_semester_scores
    WHERE vrs_id = ? AND semester_id = ?
  `).get(user.id, semester.id) as any;

  // Card only appears if semester is closed and score is >= 10
  const isEligible = score ? score.total_score >= 10.0 : false;
  const isClosed = semester && semester.status === 'CLOTURE';

  let card: any = null;
  if (isClosed && isEligible) {
    card = db.prepare(`
      SELECT c.*,
             g.name as gift_name,
             g.tier as gift_tier,
             g.description as gift_description,
             g.svg_key as gift_svg_key,
             g.custom_photo as gift_custom_photo,
             g.photo_url as gift_photo_url,
             g.estimated_value_fcfa as gift_estimated_value,
             s.name as semester_name,
             s.code as semester_code,
             s.status as semester_status,
             u.first_name || ' ' || u.last_name as vrs_name,
             u.first_name as vrs_first_name,
             u.last_name as vrs_last_name
      FROM scratch_cards c
      JOIN gift_catalog g ON c.gift_id = g.id
      JOIN semesters s ON c.semester_id = s.id
      JOIN users u ON c.vrs_id = u.id
      WHERE c.vrs_id = ? AND c.semester_id = ?
    `).get(user.id, semester.id) as any;

    // Strict requirement: Le cadeau est totalement MASQUÉ : ni nom ni photo présents dans la page ni dans les réponses réseau avant révélation
    if (card && card.is_revealed === 0) {
      card.gift_name = null;
      card.gift_description = null;
      card.gift_svg_key = null;
      card.gift_custom_photo = null;
      card.gift_photo_url = null;
      card.photo_url = null;
      card.gift_estimated_value = null;
      card.gift_id = 0;
    }
  }

  res.json({
    semester,
    score: score || null,
    card: card || null,
    eligible: isEligible,
    missing_points: score && score.total_score < 10.0 ? roundToHalf(10.0 - score.total_score) : 0,
  });
});

// 12. Reveal scratch card handler (POST /cartes/:id/reveler and POST /api/scoring/scratch-cards/:id/reveal)
const handleRevealCard = (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const cardId = Number(req.params.id);
  const { method } = req.body || {}; // 'SCRATCH' or 'BUTTON'

  const card = db.prepare(`
    SELECT c.*, g.name as gift_name, g.tier as gift_tier, g.svg_key as gift_svg_key,
           g.description as gift_description, g.custom_photo as gift_custom_photo,
           g.photo_url as gift_photo_url, g.estimated_value_fcfa as gift_estimated_value
    FROM scratch_cards c
    JOIN gift_catalog g ON c.gift_id = g.id
    WHERE c.id = ?
  `).get(cardId) as any;

  if (!card) {
    return res.status(404).json({ error: 'Carte à gratter introuvable.' });
  }

  // Check ownership (only owner VRS or SAN)
  if (user.role === 'VRS' && card.vrs_id !== user.id) {
    return res.status(403).json({ error: 'Vous ne pouvez gratter que votre propre carte.' });
  }

  // Marque la carte "Révélée" (date, heure)
  if (card.is_revealed === 0) {
    db.prepare(`
      UPDATE scratch_cards
      SET is_revealed = 1, revealed_at = CURRENT_TIMESTAMP, revealed_method = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(method === 'BUTTON' ? 'BUTTON' : 'SCRATCH', cardId);

    logAudit(
      user.id,
      user.publicId,
      'GRATTAGE_CARTE_REVELEE',
      `Carte ID ${cardId} (${card.code}) révélée par ${user.publicId} via ${method || 'SCRATCH'}. Cadeau révélé : "${card.gift_name}" (${card.gift_tier})`,
      req
    );
  }

  const updatedCard = db.prepare(`
    SELECT c.*, g.name as gift_name, g.tier as gift_tier, g.svg_key as gift_svg_key,
           g.description as gift_description, g.custom_photo as gift_custom_photo,
           g.photo_url as gift_photo_url, g.estimated_value_fcfa as gift_estimated_value,
           s.name as semester_name, s.code as semester_code, s.status as semester_status,
           u.first_name || ' ' || u.last_name as vrs_name,
           u.first_name as vrs_first_name,
           u.last_name as vrs_last_name
    FROM scratch_cards c
    JOIN gift_catalog g ON c.gift_id = g.id
    JOIN semesters s ON c.semester_id = s.id
    JOIN users u ON c.vrs_id = u.id
    WHERE c.id = ?
  `).get(cardId) as any;

  const photo = updatedCard.gift_custom_photo || updatedCard.gift_photo_url || null;

  // Renvoie seulement alors le cadeau (nom, photo, palier, valeur)
  res.json({
    success: true,
    card: updatedCard,
    cadeau: {
      nom: updatedCard.gift_name,
      photo: photo,
      palier: updatedCard.gift_tier,
      valeur: updatedCard.gift_estimated_value || 0,
      description: updatedCard.gift_description || '',
      svg_key: updatedCard.gift_svg_key,
    },
    gift: {
      name: updatedCard.gift_name,
      photo: photo,
      tier: updatedCard.gift_tier,
      estimated_value_fcfa: updatedCard.gift_estimated_value || 0,
      description: updatedCard.gift_description || '',
    },
  });
};

router.post('/scratch-cards/:id/reveal', requireAuth, handleRevealCard);
router.post('/cartes/:id/reveler', requireAuth, handleRevealCard);

// 13. GET /api/scoring/gifts/deliveries (List of revealed gifts for SAN, SA, FSS)
router.get('/gifts/deliveries', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { semester_id, tier, delivery_status } = req.query;

  let query = `
    SELECT c.*,
           g.name as gift_name,
           g.tier as gift_tier,
           g.svg_key as gift_svg_key,
           g.custom_photo as gift_custom_photo,
           s.name as semester_name,
           s.code as semester_code,
           u.public_id as vrs_public_id,
           u.first_name as vrs_first_name,
           u.last_name as vrs_last_name,
           u.phone as vrs_phone,
           u.photo as vrs_photo,
           dp.name as drop_point_name,
           dp.code as drop_point_code,
           dp.id as drop_point_id
    FROM scratch_cards c
    JOIN gift_catalog g ON c.gift_id = g.id
    JOIN semesters s ON c.semester_id = s.id
    JOIN users u ON c.vrs_id = u.id
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    WHERE c.is_revealed = 1
  `;

  const params: any[] = [];

  // Scoping
  if (user.role === 'SALES_ADMIN_NATIONAL') {
    // SAN sees everything
  } else if (user.role === 'SALES_ADMIN') {
    // SA sees only their Drop Point
    query += ' AND u.drop_point_id = ?';
    params.push(user.dropPointId || -1);
  } else if (user.role === 'FSS') {
    // FSS sees only their VRS
    query += ' AND (u.fss_id = ? OR u.drop_point_id = ?)';
    params.push(user.id, user.dropPointId || -1);
  } else {
    // VRS sees only their own
    query += ' AND c.vrs_id = ?';
    params.push(user.id);
  }

  if (semester_id) {
    query += ' AND c.semester_id = ?';
    params.push(Number(semester_id));
  }

  if (tier) {
    query += ' AND c.tier = ?';
    params.push(String(tier));
  }

  if (delivery_status) {
    query += ' AND c.delivery_status = ?';
    params.push(String(delivery_status));
  }

  query += ' ORDER BY c.revealed_at DESC, c.id DESC';

  const deliveries = db.prepare(query).all(...params);
  res.json({ deliveries });
});

// 14. POST /api/scoring/scratch-cards/:id/schedule-delivery (SAN or SA)
router.post('/scratch-cards/:id/schedule-delivery', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL' && user.role !== 'SALES_ADMIN') {
    return res.status(403).json({ error: 'Seul le SAN ou le SA du Drop Point peut programmer une remise de cadeau.' });
  }

  const cardId = Number(req.params.id);
  const { delivery_date, delivery_location, delivered_by, delivery_comment } = req.body;

  if (!delivery_date || !delivery_location || !delivered_by) {
    return res.status(400).json({ error: 'Date de remise, lieu et responsable de remise sont obligatoires.' });
  }

  const card = db.prepare(`
    SELECT c.*, u.id as vrs_user_id, u.drop_point_id, g.name as gift_name, s.name as semester_name
    FROM scratch_cards c
    JOIN users u ON c.vrs_id = u.id
    JOIN gift_catalog g ON c.gift_id = g.id
    JOIN semesters s ON c.semester_id = s.id
    WHERE c.id = ?
  `).get(cardId) as any;

  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable.' });
  }

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== card.drop_point_id) {
    return res.status(403).json({ error: 'Vous ne pouvez programmer que les remises pour les VRS de votre Drop Point.' });
  }

  const isReschedule = card.delivery_status === 'PROGRAMMEE';

  db.prepare(`
    UPDATE scratch_cards
    SET delivery_status = 'PROGRAMMEE',
        delivery_date = ?,
        delivery_location = ?,
        delivered_by = ?,
        delivery_comment = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(delivery_date, delivery_location.trim(), delivered_by.trim(), delivery_comment || '', cardId);

  // Send notification to VRS
  const notifMsg = isReschedule
    ? `La remise de votre cadeau (${card.gift_name}) a été reprogrammée au ${delivery_date} à ${delivery_location.trim()} par ${delivered_by.trim()}.`
    : `La remise officielle de votre cadeau (${card.gift_name}) est programmée le ${delivery_date} à ${delivery_location.trim()} par ${delivered_by.trim()}.`;

  db.prepare(`
    INSERT INTO notifications (user_id, role, title, message, type, is_read, link)
    VALUES (?, 'VRS', ?, ?, 'SYSTEM', 0, 'gifts')
  `).run(card.vrs_user_id, isReschedule ? 'Reprogrammation remise de cadeau' : 'Remise de votre cadeau programmée 🎁', notifMsg);

  // Automatically insert a reminder notification in advance (or scheduled 3 days before)
  db.prepare(`
    INSERT INTO notifications (user_id, role, title, message, type, is_read, link)
    VALUES (?, 'VRS', ?, ?, 'SYSTEM', 0, 'gifts')
  `).run(
    card.vrs_user_id,
    'Rappel : Remise de votre cadeau dans 3 jours',
    `Rappel : votre cadeau "${card.gift_name}" vous sera remis le ${delivery_date} à ${delivery_location.trim()}. Contact : ${delivered_by.trim()}.`
  );

  logAudit(
    user.id,
    user.publicId,
    isReschedule ? 'REPROGRAMMATION_REMISE_CADEAU' : 'PROGRAMMATION_REMISE_CADEAU',
    `Remise de "${card.gift_name}" pour VRS ID ${card.vrs_user_id} programmée le ${delivery_date} à "${delivery_location}" par "${delivered_by}"`,
    req
  );

  res.json({ success: true, message: 'Remise programmée avec succès.' });
});

// 15. POST /api/scoring/scratch-cards/:id/confirm-delivery (SAN or SA confirms delivery done)
router.post('/scratch-cards/:id/confirm-delivery', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL' && user.role !== 'SALES_ADMIN') {
    return res.status(403).json({ error: 'Seul le SAN ou le SA peut confirmer la réalisation de la remise.' });
  }

  const cardId = Number(req.params.id);
  const card = db.prepare(`
    SELECT c.*, u.id as vrs_user_id, u.drop_point_id, g.name as gift_name
    FROM scratch_cards c
    JOIN users u ON c.vrs_id = u.id
    JOIN gift_catalog g ON c.gift_id = g.id
    WHERE c.id = ?
  `).get(cardId) as any;

  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable.' });
  }

  if (user.role === 'SALES_ADMIN' && user.dropPointId !== card.drop_point_id) {
    return res.status(403).json({ error: 'Non autorisé sur ce Drop Point.' });
  }

  db.prepare(`
    UPDATE scratch_cards
    SET delivery_status = 'REMISE_EFFECTUEE', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(cardId);

  // Notify VRS to confirm receipt
  db.prepare(`
    INSERT INTO notifications (user_id, role, title, message, type, is_read, link)
    VALUES (?, 'VRS', ?, ?, 'SYSTEM', 0, 'gifts')
  `).run(
    card.vrs_user_id,
    'Confirmez la réception de votre cadeau 🎁',
    `La remise de votre cadeau "${card.gift_name}" a été effectuée. Merci de valider la réception dans "Mes cadeaux" pour finaliser le dossier.`
  );

  logAudit(
    user.id,
    user.publicId,
    'REMISE_CADEAU_EFFECTUEE',
    `Remise du cadeau "${card.gift_name}" effectuée pour VRS ID ${card.vrs_user_id}. En attente de confirmation VRS.`,
    req
  );

  res.json({ success: true, message: 'Remise marquée comme effectuée.' });
});

// 16. POST /api/scoring/scratch-cards/:id/confirm-receipt (VRS confirms receiving)
router.post('/scratch-cards/:id/confirm-receipt', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const cardId = Number(req.params.id);

  const card = db.prepare(`
    SELECT c.*, g.name as gift_name
    FROM scratch_cards c
    JOIN gift_catalog g ON c.gift_id = g.id
    WHERE c.id = ?
  `).get(cardId) as any;

  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable.' });
  }

  if (card.vrs_id !== user.id && user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Seul le VRS bénéficiaire peut confirmer la réception de son cadeau.' });
  }

  db.prepare(`
    UPDATE scratch_cards
    SET delivery_status = 'RECU', vrs_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(cardId);

  logAudit(
    user.id,
    user.publicId,
    'RECEPTION_CADEAU_CONFIRMEE',
    `Le VRS ${user.publicId} a confirmé la réception en main propre de son cadeau "${card.gift_name}" (Statut: RECU).`,
    req
  );

  res.json({ success: true, message: 'Réception confirmée avec succès. Félicitations !' });
});

// 17. GET /api/scoring/export-csv (SAN only)
router.get('/export-csv', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès réservé au Sales Admin National (SAN).' });
  }

  const semesterIdParam = req.query.semester_id ? Number(req.query.semester_id) : null;
  let semesterId = semesterIdParam;
  if (!semesterId) {
    const latest = db.prepare('SELECT id FROM semesters ORDER BY start_date DESC LIMIT 1').get() as any;
    semesterId = latest?.id || 1;
  }

  const rows = db.prepare(`
    SELECT s.name as semester_name,
           s.code as semester_code,
           u.public_id,
           u.last_name,
           u.first_name,
           dp.name as drop_point_name,
           sc.turnover_score,
           sc.regularity_score,
           sc.payments_score,
           sc.new_pos_score,
           sc.rigor_score,
           sc.total_score,
           sc.tier,
           CASE WHEN card.id IS NOT NULL THEN 'OUI' ELSE 'NON' END as card_generated,
           card.revealed_at,
           g.name as gift_name,
           card.delivery_status,
           card.delivery_date,
           card.delivery_location,
           card.delivered_by
    FROM vrs_semester_scores sc
    JOIN semesters s ON sc.semester_id = s.id
    JOIN users u ON sc.vrs_id = u.id
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    LEFT JOIN scratch_cards card ON card.semester_id = sc.semester_id AND card.vrs_id = sc.vrs_id
    LEFT JOIN gift_catalog g ON card.gift_id = g.id
    WHERE sc.semester_id = ?
    ORDER BY sc.total_score DESC, u.last_name ASC
  `).all(semesterId) as any[];

  // Build CSV
  const headers = [
    'Semestre',
    'Code Semestre',
    'ID VRS',
    'Nom',
    'Prénom',
    'Drop Point',
    'Note CA (/8)',
    'Note Régularité (/4)',
    'Note Paiements (/4)',
    'Note Nouveaux PDV (/2)',
    'Note Rigueur (/2)',
    'Note Globale (/20)',
    'Palier',
    'Carte Générée',
    'Date Grattage',
    'Cadeau Tiré',
    'Statut Remise',
    'Date Remise',
    'Lieu Remise',
    'Remis Par',
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvContent = [
    headers.join(';'),
    ...rows.map((r) =>
      [
        escapeCsv(r.semester_name),
        escapeCsv(r.semester_code),
        escapeCsv(r.public_id),
        escapeCsv(r.last_name),
        escapeCsv(r.first_name),
        escapeCsv(r.drop_point_name || 'Non rattaché'),
        escapeCsv(r.turnover_score),
        escapeCsv(r.regularity_score),
        escapeCsv(r.payments_score),
        escapeCsv(r.new_pos_score),
        escapeCsv(r.rigor_score),
        escapeCsv(r.total_score),
        escapeCsv(r.tier),
        escapeCsv(r.card_generated),
        escapeCsv(r.revealed_at || 'Non révélée'),
        escapeCsv(r.gift_name || 'Aucun'),
        escapeCsv(r.delivery_status || 'N/A'),
        escapeCsv(r.delivery_date || ''),
        escapeCsv(r.delivery_location || ''),
        escapeCsv(r.delivered_by || ''),
      ].join(';')
    ),
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="notation-vrs-semestre-${semesterId}.csv"`);
  res.send('\uFEFF' + csvContent);
});

// 18. GET /api/scoring/badge-count (For navigation red notification bubble)
router.get('/badge-count', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  let count = 0;

  if (user.role === 'VRS') {
    // Unrevealed card count OR card with REMISE_EFFECTUEE awaiting VRS confirmation
    const unrevealed = (db.prepare(`
      SELECT COUNT(*) as c FROM scratch_cards
      WHERE vrs_id = ? AND (is_revealed = 0 OR delivery_status = 'REMISE_EFFECTUEE')
    `).get(user.id) as any)?.c || 0;
    count = unrevealed;
  } else if (user.role === 'SALES_ADMIN_NATIONAL') {
    // Gifts revealed awaiting delivery programming or delivery completion
    const pendingDeliveries = (db.prepare(`
      SELECT COUNT(*) as c FROM scratch_cards
      WHERE is_revealed = 1 AND delivery_status IN ('A_PROGRAMMER', 'PROGRAMMEE')
    `).get() as any)?.c || 0;
    count = pendingDeliveries;
  } else if (user.role === 'SALES_ADMIN') {
    const pendingDeliveries = (db.prepare(`
      SELECT COUNT(*) as c FROM scratch_cards c
      JOIN users u ON c.vrs_id = u.id
      WHERE c.is_revealed = 1
        AND u.drop_point_id = ?
        AND c.delivery_status IN ('A_PROGRAMMER', 'PROGRAMMEE')
    `).get(user.dropPointId || -1) as any)?.c || 0;
    count = pendingDeliveries;
  }

  res.json({ badgeCount: count });
});

export default router;
