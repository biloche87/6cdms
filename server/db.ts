import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { resetNestleDemoData } from './nestleSeed.ts';

export const resolvedDbPath = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.resolve(process.cwd(), 'data', 'distribution.db');

const dbDir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const dbPath = resolvedDbPath;

function createDbConnection(): Database.Database {
  const setupPragmas = (inst: Database.Database) => {
    inst.pragma('foreign_keys = ON');
    inst.pragma('journal_mode = WAL');
    inst.pragma('synchronous = NORMAL');
    inst.pragma('busy_timeout = 15000');
    inst.pragma('temp_store = MEMORY');
    inst.pragma('cache_size = -64000');
  };

  try {
    const instance = new Database(dbPath);
    setupPragmas(instance);
    const check = instance.pragma('quick_check') as Array<{ quick_check: string }>;
    if (check && check.length > 0 && check[0]?.quick_check !== 'ok') {
      const dateSuffix = new Date().toISOString().replace(/[:.]/g, '-');
      const corruptFile = `${dbPath}.corrupt-${dateSuffix}`;
      try {
        if (fs.existsSync(dbPath)) {
          fs.copyFileSync(dbPath, corruptFile);
        }
        if (fs.existsSync(`${dbPath}-wal`)) {
          fs.copyFileSync(`${dbPath}-wal`, `${corruptFile}-wal`);
        }
        if (fs.existsSync(`${dbPath}-shm`)) {
          fs.copyFileSync(`${dbPath}-shm`, `${corruptFile}-shm`);
        }
      } catch (cpErr) {
        console.error('[DB] Erreur lors de la copie du fichier corrompu:', cpErr);
      }
      console.error(`[DB] quick_check a échoué (${check[0]?.quick_check}). Fichier copié en ${corruptFile} et journalisé. Aucune donnée écrasée ni supprimée.`);
      return instance;
    }
    return instance;
  } catch (err: any) {
    const dateSuffix = new Date().toISOString().replace(/[:.]/g, '-');
    const corruptFile = `${dbPath}.corrupt-${dateSuffix}`;
    try {
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, corruptFile);
      }
      if (fs.existsSync(`${dbPath}-wal`)) {
        fs.copyFileSync(`${dbPath}-wal`, `${corruptFile}-wal`);
      }
      if (fs.existsSync(`${dbPath}-shm`)) {
        fs.copyFileSync(`${dbPath}-shm`, `${corruptFile}-shm`);
      }
    } catch (renameErr) {
      console.error('[DB] Erreur lors de la copie du fichier corrompu:', renameErr);
    }
    console.error(`[DB] Exception à l'ouverture de la base. Fichier copié en ${corruptFile} et journalisé. Aucune donnée écrasée.`, err);
    const instance = new Database(dbPath);
    setupPragmas(instance);
    return instance;
  }
}

export const db = createDbConnection();

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS drop_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      status TEXT DEFAULT 'ACTIF',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
      neighborhood TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(drop_point_id, code)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL, -- 'SALES_ADMIN_NATIONAL', 'SALES_ADMIN', 'FSS', 'VRS'
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      photo TEXT,
      drop_point_id INTEGER REFERENCES drop_points(id) ON DELETE SET NULL,
      sales_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      fss_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      sector_id INTEGER REFERENCES sectors(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'ACTIF', -- 'ACTIF', 'EN TOURNÉE', 'HORS LIGNE', 'SUSPENDU', 'INACTIF'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      drop_point_id INTEGER REFERENCES drop_points(id),
      sub_category TEXT NOT NULL,
      name TEXT NOT NULL,
      reference TEXT UNIQUE NOT NULL,
      unit TEXT DEFAULT 'Carton',
      units_per_carton INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      status TEXT DEFAULT 'ACTIF',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS drop_point_stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      available_quantity INTEGER NOT NULL DEFAULT 0,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      alert_threshold INTEGER NOT NULL DEFAULT 20,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(drop_point_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS vrs_stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vrs_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      available_quantity INTEGER NOT NULL DEFAULT 0,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      alert_threshold INTEGER NOT NULL DEFAULT 5,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(vrs_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS points_of_sale (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      photo TEXT,
      address TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      sector_id INTEGER REFERENCES sectors(id) ON DELETE SET NULL,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
      assigned_vrs_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      latitude REAL,
      longitude REAL,
      status TEXT DEFAULT 'EN ATTENTE', -- 'EN ATTENTE', 'VALIDE', 'ACTIF', 'REJETE', 'SUSPENDU', 'INACTIF'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL,
      movement_type TEXT NOT NULL, -- 'RECEIPT', 'TRANSFER', 'SALE', 'RETURN', 'ADJUSTMENT', 'SUPPLY', 'CANCELLATION'
      source_role TEXT,
      source_id INTEGER,
      target_role TEXT,
      target_id INTEGER,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      stock_before INTEGER NOT NULL,
      stock_after INTEGER NOT NULL,
      related_entity_type TEXT,
      related_entity_id INTEGER,
      notes TEXT,
      created_by_user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      delivery_note_number TEXT NOT NULL,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id),
      supplier TEXT NOT NULL,
      receipt_date DATE NOT NULL,
      observations TEXT,
      attachment_url TEXT,
      created_by_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_receipt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_cartons INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supply_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_number TEXT UNIQUE NOT NULL,
      vrs_id INTEGER NOT NULL REFERENCES users(id),
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id),
      requester_role TEXT DEFAULT 'VRS', -- 'VRS', 'SALES_ADMIN'
      status TEXT DEFAULT 'ENVOYÉE', -- 'BROUILLON', 'ENVOYÉE', 'EN ATTENTE', 'APPROUVÉE', 'PRÉPARÉE', 'LIVRÉE', 'RÉCEPTIONNÉE', 'REJETÉE'
      total_cartons INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      bl_number TEXT,
      bl_attachment TEXT,
      bl_file_name TEXT,
      bl_file_type TEXT,
      processed_by_user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supply_request_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL REFERENCES supply_requests(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_requested INTEGER NOT NULL,
      quantity_approved INTEGER
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_number TEXT UNIQUE NOT NULL,
      vrs_id INTEGER NOT NULL REFERENCES users(id),
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id),
      point_of_sale_id INTEGER NOT NULL REFERENCES points_of_sale(id),
      total_amount REAL NOT NULL,
      discount REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'COMPLETED', -- 'COMPLETED', 'CANCELLED'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_cartons INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      stock_before INTEGER,
      stock_after INTEGER
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vrs_id INTEGER NOT NULL REFERENCES users(id),
      point_of_sale_id INTEGER NOT NULL REFERENCES points_of_sale(id),
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id),
      started_at DATETIME NOT NULL,
      ended_at DATETIME,
      duration_minutes INTEGER,
      latitude REAL,
      longitude REAL,
      photo TEXT,
      notes TEXT,
      stock_check_notes TEXT,
      sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'TERMINEE', -- 'EN_COURS', 'TERMINEE'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tour_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      day_of_week TEXT NOT NULL, -- 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id),
      neighborhood TEXT NOT NULL,
      sector_id INTEGER NOT NULL REFERENCES sectors(id),
      vrs_id INTEGER NOT NULL REFERENCES users(id),
      target_visits_count INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'ACTIF',
      reviewed_at DATETIME,
      reviewed_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role TEXT,
      drop_point_id INTEGER REFERENCES drop_points(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL, -- 'SUPPLY', 'PDV', 'STOCK_ALERT', 'RECEIPT', 'SALE', 'SYSTEM'
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_public_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- DROP POINT SUPPLY WORKFLOW TABLES (Sections A, B, C)
    CREATE TABLE IF NOT EXISTS dp_supply_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_number TEXT UNIQUE NOT NULL,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
      created_by_user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT DEFAULT 'DEMANDEE', -- 'DEMANDEE', 'VALIDEE', 'REFUSEE'
      desired_date DATE,
      comments TEXT,
      rejection_reason TEXT,
      validation_notes TEXT,
      reviewed_by_user_id INTEGER REFERENCES users(id),
      reviewed_at DATETIME,
      total_cartons_requested INTEGER NOT NULL DEFAULT 0,
      total_cartons_approved INTEGER DEFAULT 0,
      total_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dp_supply_request_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL REFERENCES dp_supply_requests(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_requested INTEGER NOT NULL,
      quantity_approved INTEGER,
      unit_cession_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dp_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      request_id INTEGER NOT NULL REFERENCES dp_supply_requests(id) ON DELETE CASCADE,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      remaining_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT DEFAULT 'A_PAYER', -- 'A_PAYER', 'PARTIELLEMENT_PAYE', 'PAYE'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dp_invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES dp_invoices(id) ON DELETE CASCADE,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
      recorded_by_user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      payment_method TEXT NOT NULL, -- 'ESPECES', 'VIREMENT', 'MOBILE_MONEY'
      reference TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dp_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_number TEXT UNIQUE NOT NULL,
      request_id INTEGER NOT NULL REFERENCES dp_supply_requests(id) ON DELETE CASCADE,
      invoice_id INTEGER NOT NULL REFERENCES dp_invoices(id) ON DELETE CASCADE,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'PREPARE', -- 'PREPARE', 'EN_TRANSIT', 'RECU'
      shipping_blocked_unpaid INTEGER DEFAULT 0,
      prepared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      shipped_at DATETIME,
      received_at DATETIME,
      received_by_user_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vrs_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      request_id INTEGER REFERENCES supply_requests(id) ON DELETE SET NULL,
      vrs_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      remaining_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT DEFAULT 'A_PAYER',
      is_generated INTEGER DEFAULT 0,
      generated_at DATETIME,
      generated_by_user_id INTEGER REFERENCES users(id),
      tva_applicable INTEGER DEFAULT 1,
      tva_rate REAL DEFAULT 18.0,
      tva_amount REAL DEFAULT 0,
      total_ht REAL,
      total_ttc REAL,
      status TEXT DEFAULT 'ACTIVE',
      credit_note_number TEXT,
      credit_note_date DATETIME,
      credit_note_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vrs_invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES vrs_invoices(id) ON DELETE CASCADE,
      vrs_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      payment_method TEXT NOT NULL,
      reference TEXT,
      notes TEXT,
      status TEXT DEFAULT 'CONFIRME',
      cancelled_at DATETIME,
      cancelled_by_user_id INTEGER REFERENCES users(id),
      cancellation_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS central_depot_stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      available_quantity INTEGER NOT NULL DEFAULT 0,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      alert_threshold INTEGER NOT NULL DEFAULT 100,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- POS CREATION REQUESTS WORKFLOW (Section D)
    CREATE TABLE IF NOT EXISTS pos_creation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      store_type TEXT,
      neighborhood TEXT NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      photo TEXT,
      vrs_id INTEGER NOT NULL REFERENCES users(id),
      drop_point_id INTEGER NOT NULL REFERENCES drop_points(id),
      sector_id INTEGER REFERENCES sectors(id),
      status TEXT DEFAULT 'EN_ATTENTE', -- 'EN_ATTENTE', 'VALIDEE', 'REFUSEE'
      rejection_reason TEXT,
      fss_note TEXT,
      fss_reviewed_by INTEGER REFERENCES users(id),
      fss_reviewed_at DATETIME,
      reviewed_by_user_id INTEGER REFERENCES users(id),
      reviewed_at DATETIME,
      created_pos_id INTEGER REFERENCES points_of_sale(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_dp_supply_dp ON dp_supply_requests(drop_point_id);
    CREATE INDEX IF NOT EXISTS idx_dp_supply_status ON dp_supply_requests(status);
    CREATE INDEX IF NOT EXISTS idx_dp_invoices_dp ON dp_invoices(drop_point_id);
    CREATE INDEX IF NOT EXISTS idx_dp_invoices_status ON dp_invoices(payment_status);
    CREATE INDEX IF NOT EXISTS idx_dp_transfers_dp ON dp_transfers(drop_point_id);
    CREATE INDEX IF NOT EXISTS idx_dp_transfers_status ON dp_transfers(status);
    CREATE INDEX IF NOT EXISTS idx_pos_req_dp ON pos_creation_requests(drop_point_id);
    CREATE INDEX IF NOT EXISTS idx_pos_req_status ON pos_creation_requests(status);

    CREATE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);
    CREATE INDEX IF NOT EXISTS idx_users_drop_point ON users(drop_point_id);
    CREATE INDEX IF NOT EXISTS idx_pos_drop_point ON points_of_sale(drop_point_id);
    CREATE INDEX IF NOT EXISTS idx_pos_status ON points_of_sale(status);
    CREATE INDEX IF NOT EXISTS idx_sales_vrs ON sales(vrs_id);
    CREATE INDEX IF NOT EXISTS idx_sales_drop_point ON sales(drop_point_id);
    CREATE INDEX IF NOT EXISTS idx_visits_vrs ON visits(vrs_id);
    CREATE INDEX IF NOT EXISTS idx_movements_drop_point ON stock_movements(drop_point_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON activity_logs(created_at);

    -- VRS SCORING & GIFT SCRATCH CARDS MODULE
    CREATE TABLE IF NOT EXISTS vrs_scoring_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_turnover REAL DEFAULT 8.0,
      weight_regularity REAL DEFAULT 4.0,
      weight_payments REAL DEFAULT 4.0,
      weight_new_pos REAL DEFAULT 2.0,
      weight_rigor REAL DEFAULT 2.0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      closing_date DATE NOT NULL,
      status TEXT DEFAULT 'EN_COURS', -- 'EN_COURS', 'CLOTURE'
      closed_at DATETIME,
      closed_by_user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vrs_semester_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vrs_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      turnover_score REAL NOT NULL DEFAULT 0,
      regularity_score REAL NOT NULL DEFAULT 0,
      payments_score REAL NOT NULL DEFAULT 0,
      new_pos_score REAL NOT NULL DEFAULT 0,
      rigor_score REAL NOT NULL DEFAULT 0,
      total_score REAL NOT NULL DEFAULT 0,
      target_turnover REAL DEFAULT 15000000,
      actual_turnover REAL DEFAULT 0,
      working_days INTEGER DEFAULT 130,
      active_sales_days INTEGER DEFAULT 0,
      overdue_payments_count INTEGER DEFAULT 0,
      unpaid_balance REAL DEFAULT 0,
      new_pos_validated_count INTEGER DEFAULT 0,
      target_new_pos INTEGER DEFAULT 5,
      stock_discrepancies_count INTEGER DEFAULT 0,
      rejected_requests_count INTEGER DEFAULT 0,
      tier TEXT DEFAULT 'AUCUN', -- 'AUCUN', 'BRONZE', 'OR'
      is_frozen INTEGER DEFAULT 0,
      correction_reason TEXT,
      corrected_by_user_id INTEGER REFERENCES users(id),
      corrected_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(vrs_id, semester_id)
    );

    CREATE TABLE IF NOT EXISTS gift_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tier TEXT NOT NULL, -- 'BRONZE', 'OR'
      description TEXT,
      estimated_value_fcfa REAL DEFAULT 0,
      quantity INTEGER DEFAULT 0,
      photo_url TEXT,
      svg_key TEXT NOT NULL, -- 'tv', 'fridge', 'blender', 'coffeemaker', 'smartphone', 'motorbike', 'computer'
      custom_photo TEXT,
      status TEXT DEFAULT 'ACTIF', -- 'ACTIF', 'INACTIF'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scratch_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      vrs_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gift_id INTEGER NOT NULL REFERENCES gift_catalog(id),
      tier TEXT NOT NULL, -- 'BRONZE', 'OR'
      final_score REAL NOT NULL,
      is_revealed INTEGER DEFAULT 0,
      revealed_at DATETIME,
      revealed_method TEXT, -- 'SCRATCH', 'BUTTON'
      delivery_status TEXT DEFAULT 'A_PROGRAMMER', -- 'A_PROGRAMMER', 'PROGRAMMEE', 'REMISE_EFFECTUEE', 'RECU'
      delivery_date DATETIME,
      delivery_location TEXT,
      delivered_by TEXT,
      delivery_comment TEXT,
      delivered_at DATETIME,
      vrs_confirmed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(vrs_id, semester_id)
    );

    CREATE INDEX IF NOT EXISTS idx_scores_semester ON vrs_semester_scores(semester_id);
    CREATE INDEX IF NOT EXISTS idx_scores_vrs ON vrs_semester_scores(vrs_id);
    CREATE INDEX IF NOT EXISTS idx_cards_vrs ON scratch_cards(vrs_id);
    CREATE INDEX IF NOT EXISTS idx_cards_semester ON scratch_cards(semester_id);
    CREATE INDEX IF NOT EXISTS idx_cards_delivery_status ON scratch_cards(delivery_status);
  `);

  // Migration: Ensure drop_point_id column exists on products before creating index
  try {
    const productCols = (db.prepare('PRAGMA table_info(products)').all() as { name: string }[]).map((c) => c.name);
    if (!productCols.includes('drop_point_id')) {
      db.prepare('ALTER TABLE products ADD COLUMN drop_point_id INTEGER REFERENCES drop_points(id)').run();
    }
  } catch (err) {
    console.error('Migration warning (products.drop_point_id):', err);
  }

  // Migration: Ensure target_visits_count, notes, reviewed_at, reviewed_by exist on tour_plans
  try {
    const tourCols = (db.prepare('PRAGMA table_info(tour_plans)').all() as { name: string }[]).map((c) => c.name);
    if (!tourCols.includes('target_visits_count')) {
      db.prepare('ALTER TABLE tour_plans ADD COLUMN target_visits_count INTEGER DEFAULT 0').run();
    }
    if (!tourCols.includes('notes')) {
      db.prepare('ALTER TABLE tour_plans ADD COLUMN notes TEXT').run();
    }
    if (!tourCols.includes('reviewed_at')) {
      db.prepare('ALTER TABLE tour_plans ADD COLUMN reviewed_at DATETIME').run();
    }
    if (!tourCols.includes('reviewed_by')) {
      db.prepare('ALTER TABLE tour_plans ADD COLUMN reviewed_by INTEGER REFERENCES users(id)').run();
    }
    // Backfill reviewed_at for already existing validated/rejected tours
    try {
      db.prepare(`
        UPDATE tour_plans 
        SET reviewed_at = created_at,
            reviewed_by = (SELECT id FROM users WHERE role = 'SALES_ADMIN' LIMIT 1)
        WHERE (status = 'ACTIF' OR status = 'REJETEE' OR status = 'TERMINEE' OR status = 'PLANIFIEE') 
          AND reviewed_at IS NULL
      `).run();
    } catch (_e) {}
  } catch (err) {
    console.error('Migration warning (tour_plans columns):', err);
  }

  // Migration: Ensure stock_check_notes exists on visits
  try {
    const visitCols = (db.prepare('PRAGMA table_info(visits)').all() as { name: string }[]).map((c) => c.name);
    if (!visitCols.includes('stock_check_notes')) {
      db.prepare('ALTER TABLE visits ADD COLUMN stock_check_notes TEXT').run();
    }
  } catch (err) {
    console.error('Migration warning (visits.stock_check_notes):', err);
  }

  // Migration: Ensure stock_before and stock_after exist on sale_items
  try {
    const saleItemCols = (db.prepare('PRAGMA table_info(sale_items)').all() as { name: string }[]).map((c) => c.name);
    if (!saleItemCols.includes('stock_before')) {
      db.prepare('ALTER TABLE sale_items ADD COLUMN stock_before INTEGER').run();
    }
    if (!saleItemCols.includes('stock_after')) {
      db.prepare('ALTER TABLE sale_items ADD COLUMN stock_after INTEGER').run();
    }
  } catch (err) {
    console.error('Migration warning (sale_items columns):', err);
  }

  // Migration: Ensure BL columns exist on supply_requests
  try {
    const srCols = (db.prepare('PRAGMA table_info(supply_requests)').all() as { name: string }[]).map((c) => c.name);
    if (!srCols.includes('bl_number')) {
      db.prepare('ALTER TABLE supply_requests ADD COLUMN bl_number TEXT').run();
    }
    if (!srCols.includes('bl_attachment')) {
      db.prepare('ALTER TABLE supply_requests ADD COLUMN bl_attachment TEXT').run();
    }
    if (!srCols.includes('bl_file_name')) {
      db.prepare('ALTER TABLE supply_requests ADD COLUMN bl_file_name TEXT').run();
    }
    if (!srCols.includes('bl_file_type')) {
      db.prepare('ALTER TABLE supply_requests ADD COLUMN bl_file_type TEXT').run();
    }
    if (!srCols.includes('desired_loading_date')) {
      db.prepare('ALTER TABLE supply_requests ADD COLUMN desired_loading_date TEXT').run();
    }
    if (!srCols.includes('rejection_reason')) {
      db.prepare('ALTER TABLE supply_requests ADD COLUMN rejection_reason TEXT').run();
    }
  } catch (err) {
    console.error('Migration warning (supply_requests BL columns):', err);
  }

  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_products_drop_point ON products(drop_point_id);');
  } catch {}

  try {
    const firstDp = db.prepare('SELECT id FROM drop_points LIMIT 1').get() as { id: number } | undefined;
    if (firstDp) {
      db.prepare('UPDATE products SET drop_point_id = ? WHERE drop_point_id IS NULL').run(firstDp.id);
    }
  } catch {}

  // Migration: Ensure all seed users have African portrait photos
  try {
    const updatePhotoStmt = db.prepare('UPDATE users SET photo = ? WHERE public_id = ?');
    updatePhotoStmt.run('https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=300&auto=format&fit=crop&q=80', '6CDISTSAN');
    updatePhotoStmt.run('https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300&auto=format&fit=crop&q=80', '6CDISTSA-DKN');
    updatePhotoStmt.run('https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=300&auto=format&fit=crop&q=80', '6CDISTFSS-DKN');
    updatePhotoStmt.run('https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=300&auto=format&fit=crop&q=80', '6CDISTVRS-DKN-001');
    updatePhotoStmt.run('https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&auto=format&fit=crop&q=80', '6CDISTVRS-DKN-002');
    updatePhotoStmt.run('https://images.unsplash.com/photo-1507152832244-10d45c7eda57?w=300&auto=format&fit=crop&q=80', '6CDISTVRS-DKN-003');
  } catch (err) {
    console.error('Migration warning (user photos):', err);
  }

  // Migration: Ensure points_of_sale deletion and approval columns exist
  try {
    const posCols = (db.prepare('PRAGMA table_info(points_of_sale)').all() as { name: string }[]).map((c) => c.name);
    if (!posCols.includes('is_deleted')) {
      db.prepare('ALTER TABLE points_of_sale ADD COLUMN is_deleted INTEGER DEFAULT 0').run();
    }
    if (!posCols.includes('deleted_at')) {
      db.prepare('ALTER TABLE points_of_sale ADD COLUMN deleted_at DATETIME').run();
    }
    if (!posCols.includes('deleted_by')) {
      db.prepare('ALTER TABLE points_of_sale ADD COLUMN deleted_by INTEGER REFERENCES users(id)').run();
    }
    if (!posCols.includes('deletion_status')) {
      db.prepare('ALTER TABLE points_of_sale ADD COLUMN deletion_status TEXT').run();
    }
    if (!posCols.includes('deletion_reason')) {
      db.prepare('ALTER TABLE points_of_sale ADD COLUMN deletion_reason TEXT').run();
    }
    if (!posCols.includes('deletion_requested_by')) {
      db.prepare('ALTER TABLE points_of_sale ADD COLUMN deletion_requested_by INTEGER REFERENCES users(id)').run();
    }
    if (!posCols.includes('deletion_requested_at')) {
      db.prepare('ALTER TABLE points_of_sale ADD COLUMN deletion_requested_at DATETIME').run();
    }
    if (!posCols.includes('deletion_reviewed_by')) {
      db.prepare('ALTER TABLE points_of_sale ADD COLUMN deletion_reviewed_by INTEGER REFERENCES users(id)').run();
    }
    if (!posCols.includes('deletion_reviewed_at')) {
      db.prepare('ALTER TABLE points_of_sale ADD COLUMN deletion_reviewed_at DATETIME').run();
    }
    if (!posCols.includes('deletion_review_note')) {
      db.prepare('ALTER TABLE points_of_sale ADD COLUMN deletion_review_note TEXT').run();
    }
  } catch (err) {
    console.error('Migration warning (points_of_sale deletion columns):', err);
  }

  // Migration: Stop automatic tour proposals (NEVER auto-delete points of sale and NEVER reset VRS stock to zero)
  try {

    // 4. Migration: Add requester_role to supply_requests if not exists
    try {
      db.prepare("ALTER TABLE supply_requests ADD COLUMN requester_role TEXT DEFAULT 'VRS'").run();
    } catch {
      // Column already exists
    }

    try {
      db.prepare("ALTER TABLE sales ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP").run();
    } catch {
      // Column already exists
    }

    // Migration: GPS real-time location columns for anti-fraud and supervisor map tracking
    try {
      db.prepare("ALTER TABLE users ADD COLUMN last_latitude REAL").run();
    } catch {}
    try {
      db.prepare("ALTER TABLE users ADD COLUMN last_longitude REAL").run();
    } catch {}
    try {
      db.prepare("ALTER TABLE users ADD COLUMN last_location_accuracy REAL").run();
    } catch {}
    try {
      db.prepare("ALTER TABLE users ADD COLUMN last_location_updated_at DATETIME").run();
    } catch {}
    try {
      db.prepare("ALTER TABLE users ADD COLUMN last_location_speed REAL").run();
    } catch {}

    // Migration: GPS certification columns on sales
    try {
      db.prepare("ALTER TABLE sales ADD COLUMN latitude REAL").run();
    } catch {}
    try {
      db.prepare("ALTER TABLE sales ADD COLUMN longitude REAL").run();
    } catch {}
    // Migration: Invoices Definitive Generation, TVA 18%, Credit Notes & Payment Cancellation
    try {
      const invCols = (db.prepare('PRAGMA table_info(dp_invoices)').all() as { name: string }[]).map(c => c.name);
      if (!invCols.includes('is_generated')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN is_generated INTEGER DEFAULT 0').run();
      if (!invCols.includes('generated_at')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN generated_at DATETIME').run();
      if (!invCols.includes('generated_by_user_id')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN generated_by_user_id INTEGER REFERENCES users(id)').run();
      if (!invCols.includes('tva_applicable')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN tva_applicable INTEGER DEFAULT 1').run();
      if (!invCols.includes('tva_rate')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN tva_rate REAL DEFAULT 18.0').run();
      if (!invCols.includes('tva_amount')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN tva_amount REAL DEFAULT 0').run();
      if (!invCols.includes('total_ht')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN total_ht REAL').run();
      if (!invCols.includes('total_ttc')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN total_ttc REAL').run();
      if (!invCols.includes('status')) db.prepare("ALTER TABLE dp_invoices ADD COLUMN status TEXT DEFAULT 'ACTIVE'").run();
      if (!invCols.includes('credit_note_number')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN credit_note_number TEXT').run();
      if (!invCols.includes('credit_note_date')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN credit_note_date DATETIME').run();
      if (!invCols.includes('credit_note_reason')) db.prepare('ALTER TABLE dp_invoices ADD COLUMN credit_note_reason TEXT').run();
    } catch (e) {
      console.warn('Migration warning (dp_invoices columns):', e);
    }

    try {
      const vrsInvCols = (db.prepare('PRAGMA table_info(vrs_invoices)').all() as { name: string }[]).map(c => c.name);
      if (!vrsInvCols.includes('is_generated')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN is_generated INTEGER DEFAULT 0').run();
      if (!vrsInvCols.includes('generated_at')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN generated_at DATETIME').run();
      if (!vrsInvCols.includes('generated_by_user_id')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN generated_by_user_id INTEGER REFERENCES users(id)').run();
      if (!vrsInvCols.includes('tva_applicable')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN tva_applicable INTEGER DEFAULT 1').run();
      if (!vrsInvCols.includes('tva_rate')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN tva_rate REAL DEFAULT 18.0').run();
      if (!vrsInvCols.includes('tva_amount')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN tva_amount REAL DEFAULT 0').run();
      if (!vrsInvCols.includes('total_ht')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN total_ht REAL').run();
      if (!vrsInvCols.includes('total_ttc')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN total_ttc REAL').run();
      if (!vrsInvCols.includes('status')) db.prepare("ALTER TABLE vrs_invoices ADD COLUMN status TEXT DEFAULT 'ACTIVE'").run();
      if (!vrsInvCols.includes('credit_note_number')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN credit_note_number TEXT').run();
      if (!vrsInvCols.includes('credit_note_date')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN credit_note_date DATETIME').run();
      if (!vrsInvCols.includes('credit_note_reason')) db.prepare('ALTER TABLE vrs_invoices ADD COLUMN credit_note_reason TEXT').run();
    } catch (e) {
      console.warn('Migration warning (vrs_invoices columns):', e);
    }

    try {
      const dpPayCols = (db.prepare('PRAGMA table_info(dp_invoice_payments)').all() as { name: string }[]).map(c => c.name);
      if (!dpPayCols.includes('status')) db.prepare("ALTER TABLE dp_invoice_payments ADD COLUMN status TEXT DEFAULT 'CONFIRME'").run();
      if (!dpPayCols.includes('cancelled_at')) db.prepare('ALTER TABLE dp_invoice_payments ADD COLUMN cancelled_at DATETIME').run();
      if (!dpPayCols.includes('cancelled_by_user_id')) db.prepare('ALTER TABLE dp_invoice_payments ADD COLUMN cancelled_by_user_id INTEGER REFERENCES users(id)').run();
      if (!dpPayCols.includes('cancellation_reason')) db.prepare('ALTER TABLE dp_invoice_payments ADD COLUMN cancellation_reason TEXT').run();
    } catch (e) {
      console.warn('Migration warning (dp_invoice_payments columns):', e);
    }

    try {
      const vrsPayCols = (db.prepare('PRAGMA table_info(vrs_invoice_payments)').all() as { name: string }[]).map(c => c.name);
      if (!vrsPayCols.includes('status')) db.prepare("ALTER TABLE vrs_invoice_payments ADD COLUMN status TEXT DEFAULT 'CONFIRME'").run();
      if (!vrsPayCols.includes('cancelled_at')) db.prepare('ALTER TABLE vrs_invoice_payments ADD COLUMN cancelled_at DATETIME').run();
      if (!vrsPayCols.includes('cancelled_by_user_id')) db.prepare('ALTER TABLE vrs_invoice_payments ADD COLUMN cancelled_by_user_id INTEGER REFERENCES users(id)').run();
      if (!vrsPayCols.includes('cancellation_reason')) db.prepare('ALTER TABLE vrs_invoice_payments ADD COLUMN cancellation_reason TEXT').run();
    } catch (e) {
      console.warn('Migration warning (vrs_invoice_payments columns):', e);
    }

    try {
      const giftCols = (db.prepare('PRAGMA table_info(gift_catalog)').all() as { name: string }[]).map(c => c.name);
      if (!giftCols.includes('estimated_value_fcfa')) db.prepare('ALTER TABLE gift_catalog ADD COLUMN estimated_value_fcfa REAL DEFAULT 0').run();
      if (!giftCols.includes('quantity')) db.prepare('ALTER TABLE gift_catalog ADD COLUMN quantity INTEGER DEFAULT 0').run();
      if (!giftCols.includes('photo_url')) db.prepare('ALTER TABLE gift_catalog ADD COLUMN photo_url TEXT').run();
    } catch (e) {
      console.warn('Migration warning (gift_catalog columns):', e);
    }

    // Migration: Permanent real-time VRS audit location history table
    db.exec(`
      CREATE TABLE IF NOT EXISTS vrs_location_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vrs_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        speed REAL,
        action_context TEXT DEFAULT 'REGULAR_PING',
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_vrs_loc_history_vrs ON vrs_location_history(vrs_id, recorded_at);
    `);

    // Migration: Support user_id as an alias column in vrs_location_history for backwards compatibility
    try {
      const locCols = (db.prepare('PRAGMA table_info(vrs_location_history)').all() as { name: string }[]).map((c) => c.name);
      if (!locCols.includes('user_id')) {
        db.prepare('ALTER TABLE vrs_location_history ADD COLUMN user_id INTEGER REFERENCES users(id)').run();
        db.prepare('UPDATE vrs_location_history SET user_id = vrs_id WHERE user_id IS NULL').run();
      }
    } catch (colErr) {
      console.warn('Notice adding user_id to vrs_location_history:', colErr);
    }

    // Backfill realistic seed coordinates for VRS so supervisors see them on the map right away
    try {
      db.prepare(`
        UPDATE users
        SET last_latitude = 12.6398,
            last_longitude = -8.0022,
            last_location_accuracy = 8.5,
            last_location_updated_at = CURRENT_TIMESTAMP
        WHERE public_id = '6CDISTVRS-DKN-001' AND (last_latitude IS NULL OR last_latitude = 0)
      `).run();

      db.prepare(`
        UPDATE users
        SET last_latitude = 12.6435,
            last_longitude = -7.9985,
            last_location_accuracy = 12.0,
            last_location_updated_at = CURRENT_TIMESTAMP
        WHERE public_id = '6CDISTVRS-DKN-002' AND (last_latitude IS NULL OR last_latitude = 0)
      `).run();

      db.prepare(`
        UPDATE users
        SET last_latitude = 12.6360,
            last_longitude = -8.0060,
            last_location_accuracy = 15.0,
            last_location_updated_at = CURRENT_TIMESTAMP
        WHERE public_id = '6CDISTVRS-DKN-003' AND (last_latitude IS NULL OR last_latitude = 0)
      `).run();

      // Seed comprehensive trajectory history if empty or sparse (< 10 points)
      const countHistory = db.prepare("SELECT COUNT(*) as c FROM vrs_location_history WHERE action_context NOT LIKE '%SIMULATION%'").get() as any;
      if (countHistory.c < 15) {
        const vrsUsers = db.prepare("SELECT id, public_id FROM users WHERE role = 'VRS'").all() as { id: number; publicId: string }[];
        
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

        const insertStmt = db.prepare(`
          INSERT INTO vrs_location_history (vrs_id, user_id, latitude, longitude, accuracy, speed, action_context, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const u of vrsUsers) {
          const isVrs1 = u.publicId === '6CDISTVRS-DKN-001';
          const isVrs2 = u.publicId === '6CDISTVRS-DKN-002';
          
          const offsetLat = isVrs2 ? 0.004 : (isVrs1 ? 0 : -0.004);
          const offsetLng = isVrs2 ? 0.003 : (isVrs1 ? 0 : -0.003);

          const waypoints = [
            { hour: '08:15:00', lat: 12.6398 + offsetLat, lng: -8.0022 + offsetLng, speed: 0, acc: 4.5, ctx: 'DÉPART DÉPÔT DAKAN' },
            { hour: '08:42:00', lat: 12.6425 + offsetLat, lng: -8.0040 + offsetLng, speed: 28.5, acc: 6.2, ctx: 'EN ROUTE - BOULEVARD' },
            { hour: '09:15:00', lat: 12.6455 + offsetLat, lng: -8.0065 + offsetLng, speed: 0, acc: 4.8, ctx: 'ARRÊT VENTE - SUPERETTE' },
            { hour: '09:50:00', lat: 12.6480 + offsetLat, lng: -8.0095 + offsetLng, speed: 21.0, acc: 7.0, ctx: 'TRANSIT SECTEUR NORD' },
            { hour: '10:30:00', lat: 12.6510 + offsetLat, lng: -8.0125 + offsetLng, speed: 0, acc: 5.1, ctx: 'VISITE PDV & CONTRÔLE LINÉAIRE' },
            { hour: '11:15:00', lat: 12.6475 + offsetLat, lng: -8.0160 + offsetLng, speed: 24.3, acc: 5.9, ctx: 'TRANSIT PLACE CAN' },
            { hour: '12:10:00', lat: 12.6440 + offsetLat, lng: -8.0145 + offsetLng, speed: 0, acc: 4.0, ctx: 'PAUSE COMMERCIALE DÉJEUNER' },
            { hour: '13:30:00', lat: 12.6410 + offsetLat, lng: -8.0110 + offsetLng, speed: 19.5, acc: 6.5, ctx: 'REPRISE TOURNÉE APRÈS-MIDI' },
            { hour: '14:20:00', lat: 12.6380 + offsetLat, lng: -8.0080 + offsetLng, speed: 0, acc: 4.6, ctx: 'LIVRAISON COMMANDE VNT-002' },
            { hour: '15:10:00', lat: 12.6360 + offsetLat, lng: -8.0045 + offsetLng, speed: 22.8, acc: 5.4, ctx: 'TRANSIT RETOUR AXE PRINCIPAL' },
            { hour: '16:00:00', lat: 12.6395 + offsetLat, lng: -8.0025 + offsetLng, speed: 8.2, acc: 5.0, ctx: 'SIGNAL GPS ACTIF - PROXIMITÉ DÉPÔT' },
          ];

          // Insert today's points
          for (const wp of waypoints) {
            insertStmt.run(u.id, u.id, wp.lat, wp.lng, wp.acc, wp.speed, wp.ctx, `${todayStr} ${wp.hour}`);
          }

          // Insert yesterday's points with slight variation
          for (const wp of waypoints) {
            insertStmt.run(u.id, u.id, wp.lat + 0.0005, wp.lng + 0.0005, wp.acc, wp.speed, wp.ctx, `${yesterdayStr} ${wp.hour}`);
          }
        }
      }
    } catch (trajErr) {
      console.warn('Trajectory seeding warning:', trajErr);
    }

    // 5. Update requester_role based on users role for existing requests
    db.prepare(`
      UPDATE supply_requests
      SET requester_role = COALESCE((SELECT role FROM users WHERE users.id = supply_requests.vrs_id), 'VRS')
    `).run();

    // 6. Fix notification wording for Sales Admin supply requests (must say "Le Sales Admin" and route to SAN)
    db.prepare(`
      UPDATE notifications
      SET message = REPLACE(message, 'Le vendeur Fatoumata Diarra', 'Le Sales Admin Fatoumata Diarra'),
          role = 'SALES_ADMIN_NATIONAL',
          drop_point_id = NULL
      WHERE title LIKE '%demande d''approvisionnement%' AND message LIKE '%Fatoumata Diarra%'
    `).run();

  } catch (migErr) {
    console.error('Migration warning (stop automations):', migErr);
  }

  // Safe seed: charge le jeu Nestlé uniquement lors de la création initiale de la base (SEED UNIQUE)
  safeSeedCheck();

  // Flush WAL checkpoint to ensure disk synchronization
  try {
    db.pragma('wal_checkpoint(PASSIVE)');
  } catch {}

  // Create or refresh backups and hot snapshot immediately
  triggerMasterBackup(true);
}

export function safeSeedCheck(): void {
  try {
    // 1. Ensure meta table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Check if already seeded in meta table
    const seededMeta = db.prepare("SELECT value FROM meta WHERE key = 'seeded_at'").get() as { value: string } | undefined;
    if (seededMeta && seededMeta.value) {
      console.log(`[DB] SEED UNIQUE: Base de données déjà initialisée (seeded_at: ${seededMeta.value}). Plus jamais de rechargement automatique, même si des tables sont vides.`);
      return;
    }

    // 3. If meta marker missing, check if database already has users/data
    const existingUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
    if (existingUsers > 0) {
      const now = new Date().toISOString();
      db.prepare("INSERT OR REPLACE INTO meta (key, value, created_at, updated_at) VALUES ('seeded_at', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").run(now);
      console.log(`[DB] SEED UNIQUE: Base existante avec ${existingUsers} utilisateur(s). Marqueur 'seeded_at' posé à ${now}. Aucun rechargement.`);
      return;
    }

    // 4. Base créée pour la première fois (0 utilisateur, aucun marqueur 'seeded_at'): chargement initial unique
    console.log('[DB] SEED UNIQUE: Base créée pour la première fois. Chargement initial unique du jeu de données Nestlé...');
    resetNestleDemoData(db);
    const now = new Date().toISOString();
    db.prepare("INSERT OR REPLACE INTO meta (key, value, created_at, updated_at) VALUES ('seeded_at', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").run(now);
    console.log(`[DB] SEED UNIQUE: Marqueur 'seeded_at' posé à ${now}. La base ne sera plus jamais rechargée automatiquement.`);
  } catch (err) {
    console.error('[DB] Erreur safeSeedCheck:', err);
  }
}

const posBackupFile = path.join(dbDir, 'points_of_sale_backup.json');

export function ensureDefaultPointsOfSale() {
  // Safe no-op: Automatic creation or injection of points of sale is permanently disabled.
  // Points of sale are created exclusively through user operations.
}

export function backupPointsOfSale() {
  backupPointsOfSaleInternal();
  triggerMasterBackup(false);
}

export function restorePointsOfSaleFromBackup() {
  try {
    if (!fs.existsSync(posBackupFile)) return;
    const raw = fs.readFileSync(posBackupFile, 'utf-8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return;

    const checkStmt = db.prepare('SELECT id FROM points_of_sale WHERE public_id = ?');
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO points_of_sale (
        id, public_id, name, code, owner_name, phone, photo, address, neighborhood,
        sector_id, drop_point_id, assigned_vrs_id, created_by_user_id, latitude, longitude,
        status, is_deleted, deleted_at, deleted_by, deletion_status, deletion_reason,
        deletion_requested_by, deletion_requested_at, deletion_reviewed_by, deletion_reviewed_at,
        deletion_review_note, created_at, updated_at
      ) VALUES (
        @id, @public_id, @name, @code, @owner_name, @phone, @photo, @address, @neighborhood,
        @sector_id, @drop_point_id, @assigned_vrs_id, @created_by_user_id, @latitude, @longitude,
        @status, COALESCE(@is_deleted, 0), @deleted_at, @deleted_by, @deletion_status, @deletion_reason,
        @deletion_requested_by, @deletion_requested_at, @deletion_reviewed_by, @deletion_reviewed_at,
        @deletion_review_note, @created_at, @updated_at
      )
    `);

    for (const item of list) {
      const exists = checkStmt.get(item.public_id);
      if (!exists) {
        insertStmt.run(item);
      }
    }
  } catch (err) {
    console.error('[DB] Error restoring points of sale from backup:', err);
  }
}

const masterBackupDir = path.join(dbDir, 'backups');
if (!fs.existsSync(masterBackupDir)) {
  fs.mkdirSync(masterBackupDir, { recursive: true });
}
const masterBackupFile = path.join(masterBackupDir, 'master_data_backup.json');
const hotSnapshotFile = path.join(masterBackupDir, 'distribution_hot_snapshot.db');
const vrsStockBackupFile = path.join(dbDir, 'vrs_stocks_backup.json');
const salesBackupFile = path.join(dbDir, 'sales_backup.json');

export async function createHotDatabaseSnapshot(): Promise<boolean> {
  try {
    if (!fs.existsSync(masterBackupDir)) {
      fs.mkdirSync(masterBackupDir, { recursive: true });
    }
    await db.backup(hotSnapshotFile);
    return true;
  } catch (err) {
    console.warn('[DB] Hot snapshot notice:', err);
    return false;
  }
}

export function backupMasterDataJson() {
  try {
    if (!fs.existsSync(masterBackupDir)) {
      fs.mkdirSync(masterBackupDir, { recursive: true });
    }

    const tables = [
      'drop_points',
      'sectors',
      'users',
      'categories',
      'products',
      'drop_point_stocks',
      'vrs_stocks',
      'points_of_sale',
      'stock_movements',
      'stock_receipts',
      'stock_receipt_items',
      'supply_requests',
      'supply_request_items',
      'sales',
      'sale_items',
      'tour_plans',
      'tour_visits',
      'notifications'
    ];

    const backupPayload: Record<string, any> = {
      _meta: {
        exported_at: new Date().toISOString(),
        version: '2.0-dms',
        system: '6C DISTRIBUTION MANAGEMENT',
        environment: 'Production Multi-tenant (SAN / SA / FSS / VRS)'
      }
    };

    for (const t of tables) {
      try {
        backupPayload[t] = db.prepare(`SELECT * FROM ${t}`).all();
      } catch {
        backupPayload[t] = [];
      }
    }

    fs.writeFileSync(masterBackupFile, JSON.stringify(backupPayload, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Error exporting master data JSON:', err);
  }
}

let masterBackupTimer: NodeJS.Timeout | null = null;
let lastBackupTimestamp: number = Date.now();

export function triggerMasterBackup(immediate: boolean = false) {
  if (immediate) {
    if (masterBackupTimer) {
      clearTimeout(masterBackupTimer);
      masterBackupTimer = null;
    }
    backupPointsOfSaleInternal();
    backupVrsStocksAndSalesInternal();
    backupMasterDataJson();
    createHotDatabaseSnapshot();
    lastBackupTimestamp = Date.now();
    return;
  }

  if (masterBackupTimer) return;
  masterBackupTimer = setTimeout(() => {
    masterBackupTimer = null;
    backupPointsOfSaleInternal();
    backupVrsStocksAndSalesInternal();
    backupMasterDataJson();
    createHotDatabaseSnapshot();
    lastBackupTimestamp = Date.now();
  }, 2000);
}

function backupPointsOfSaleInternal() {
  try {
    const list = db.prepare('SELECT * FROM points_of_sale').all();
    fs.writeFileSync(posBackupFile, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Error backing up points of sale:', err);
  }
}

function backupVrsStocksAndSalesInternal() {
  try {
    const vrsStocksList = db.prepare('SELECT * FROM vrs_stocks').all();
    if (vrsStocksList.length > 0) {
      fs.writeFileSync(vrsStockBackupFile, JSON.stringify(vrsStocksList, null, 2), 'utf-8');
    }

    const salesList = db.prepare('SELECT * FROM sales').all() as any[];
    const saleItemsList = db.prepare('SELECT * FROM sale_items').all() as any[];

    // Read previous backup and merge so no sales are ever lost
    let mergedSales = [...salesList];
    let mergedItems = [...saleItemsList];

    if (fs.existsSync(salesBackupFile)) {
      try {
        const raw = fs.readFileSync(salesBackupFile, 'utf-8');
        const prevData = JSON.parse(raw);
        if (Array.isArray(prevData?.sales)) {
          for (const prevSale of prevData.sales) {
            if (!mergedSales.some((s) => s.sale_number === prevSale.sale_number || (s.id && prevSale.id && s.id === prevSale.id))) {
              mergedSales.push(prevSale);
            }
          }
        }
        if (Array.isArray(prevData?.items)) {
          for (const prevItem of prevData.items) {
            if (!mergedItems.some((it) => it.id === prevItem.id)) {
              mergedItems.push(prevItem);
            }
          }
        }
      } catch {}
    }

    if (mergedSales.length > 0) {
      fs.writeFileSync(salesBackupFile, JSON.stringify({ sales: mergedSales, items: mergedItems }, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[DB] Error backing up VRS stocks and sales:', err);
  }
}

export function backupVrsStocksAndSales() {
  backupVrsStocksAndSalesInternal();
  triggerMasterBackup(false);
}

export function restoreMasterDataFromBackup() {
  try {
    if (!fs.existsSync(masterBackupFile)) return;
    const raw = fs.readFileSync(masterBackupFile, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return;

    console.log('[DB] Found master data backup from', data._meta?.exported_at, '- validating entity persistence...');

    db.pragma('foreign_keys = OFF');
    try {

    // 1. Users restoration (preserve custom created SAN, SA, FSS, VRS across redeployments)
    if (Array.isArray(data.users) && data.users.length > 0) {
      const checkUser = db.prepare('SELECT id FROM users WHERE public_id = ? OR email = ?');
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (
          id, public_id, role, first_name, last_name, email, phone, password_hash,
          photo, drop_point_id, sales_admin_id, fss_id, sector_id, status, created_at, updated_at
        ) VALUES (
          @id, @public_id, @role, @first_name, @last_name, @email, @phone, @password_hash,
          @photo, @drop_point_id, @sales_admin_id, @fss_id, @sector_id, @status, @created_at, @updated_at
        )
      `);
      for (const u of data.users) {
        if (!checkUser.get(u.public_id, u.email)) {
          insertUser.run(u);
        }
      }
    }

    // 2. Drop Point Stocks restoration
    if (Array.isArray(data.drop_point_stocks) && data.drop_point_stocks.length > 0) {
      const updateDpStock = db.prepare(`
        UPDATE drop_point_stocks
        SET available_quantity = MAX(available_quantity, @available_quantity),
            reserved_quantity = @reserved_quantity
        WHERE drop_point_id = @drop_point_id AND product_id = @product_id
      `);
      const insertDpStock = db.prepare(`
        INSERT OR IGNORE INTO drop_point_stocks (drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
        VALUES (@drop_point_id, @product_id, @available_quantity, @reserved_quantity, @alert_threshold)
      `);
      for (const s of data.drop_point_stocks) {
        const res = updateDpStock.run(s);
        if (res.changes === 0) {
          insertDpStock.run(s);
        }
      }
    }

    // 3. Stock Receipts & Items (BLs)
    if (Array.isArray(data.stock_receipts) && data.stock_receipts.length > 0) {
      const checkRcpt = db.prepare('SELECT id FROM stock_receipts WHERE id = ? OR receipt_number = ?');
      const insertRcpt = db.prepare(`
        INSERT OR IGNORE INTO stock_receipts (
          id, receipt_number, delivery_note_number, drop_point_id, supplier, receipt_date, observations, attachment_url, created_by_user_id, created_at
        ) VALUES (
          @id, @receipt_number, @delivery_note_number, @drop_point_id, @supplier, @receipt_date, @observations, @attachment_url, @created_by_user_id, @created_at
        )
      `);
      for (const r of data.stock_receipts) {
        if (!checkRcpt.get(r.id, r.receipt_number)) {
          insertRcpt.run(r);
        }
      }

      if (Array.isArray(data.stock_receipt_items) && data.stock_receipt_items.length > 0) {
        const checkItem = db.prepare('SELECT id FROM stock_receipt_items WHERE id = ?');
        const insertItem = db.prepare(`
          INSERT OR IGNORE INTO stock_receipt_items (
            id, receipt_id, product_id, quantity_cartons
          ) VALUES (@id, @receipt_id, @product_id, @quantity_cartons)
        `);
        for (const item of data.stock_receipt_items) {
          if (!checkItem.get(item.id)) {
            insertItem.run(item);
          }
        }
      }
    }

    // 4. Supply Requests & Items
    if (Array.isArray(data.supply_requests) && data.supply_requests.length > 0) {
      const checkReq = db.prepare('SELECT id FROM supply_requests WHERE id = ? OR request_number = ?');
      const insertReq = db.prepare(`
        INSERT OR IGNORE INTO supply_requests (
          id, request_number, vrs_id, drop_point_id, status, notes, rejection_reason, requester_role, reviewed_by_user_id, reviewed_at, created_at, updated_at
        ) VALUES (
          @id, @request_number, @vrs_id, @drop_point_id, @status, @notes, @rejection_reason, @requester_role, @reviewed_by_user_id, @reviewed_at, @created_at, @updated_at
        )
      `);
      for (const req of data.supply_requests) {
        if (!checkReq.get(req.id, req.request_number)) {
          insertReq.run(req);
        }
      }

      if (Array.isArray(data.supply_request_items) && data.supply_request_items.length > 0) {
        const checkReqItem = db.prepare('SELECT id FROM supply_request_items WHERE id = ?');
        const insertReqItem = db.prepare(`
          INSERT OR IGNORE INTO supply_request_items (
            id, request_id, product_id, requested_quantity, approved_quantity
          ) VALUES (@id, @request_id, @product_id, @requested_quantity, @approved_quantity)
        `);
        for (const it of data.supply_request_items) {
          if (!checkReqItem.get(it.id)) {
            insertReqItem.run(it);
          }
        }
      }
    }

    // 5. Stock movements
    if (Array.isArray(data.stock_movements) && data.stock_movements.length > 0) {
      const checkMvt = db.prepare('SELECT id FROM stock_movements WHERE id = ?');
      const insertMvt = db.prepare(`
        INSERT OR IGNORE INTO stock_movements (
          id, reference, movement_type, source_role, source_id, target_role, target_id,
          drop_point_id, product_id, quantity, stock_before, stock_after, related_entity_type,
          related_entity_id, notes, created_by_user_id, created_at
        ) VALUES (
          @id, @reference, @movement_type, @source_role, @source_id, @target_role, @target_id,
          @drop_point_id, @product_id, @quantity, @stock_before, @stock_after, @related_entity_type,
          @related_entity_id, @notes, @created_by_user_id, @created_at
        )
      `);
      for (const m of data.stock_movements) {
        if (!checkMvt.get(m.id)) {
          insertMvt.run(m);
        }
      }
    }

    // 6. Sales and Sale Items restoration (Ensures VRS sales traces are permanently kept across redeployments)
    if (Array.isArray(data.sales) && data.sales.length > 0) {
      const checkSale = db.prepare('SELECT id FROM sales WHERE id = ? OR sale_number = ?');
      const insertSale = db.prepare(`
        INSERT OR REPLACE INTO sales (
          id, sale_number, vrs_id, drop_point_id, point_of_sale_id, total_amount, discount, notes, status, latitude, longitude, location_accuracy, created_at, updated_at
        ) VALUES (
          @id, @sale_number, @vrs_id, @drop_point_id, @point_of_sale_id, @total_amount, @discount, @notes, @status, @latitude, @longitude, @location_accuracy, @created_at, @updated_at
        )
      `);
      for (const s of data.sales) {
        if (!checkSale.get(s.id, s.sale_number)) {
          insertSale.run({
            id: s.id,
            sale_number: s.sale_number,
            vrs_id: s.vrs_id,
            drop_point_id: s.drop_point_id || 1,
            point_of_sale_id: s.point_of_sale_id,
            total_amount: s.total_amount,
            discount: s.discount || 0,
            notes: s.notes || '',
            status: s.status || 'COMPLETED',
            latitude: s.latitude || null,
            longitude: s.longitude || null,
            location_accuracy: s.location_accuracy || null,
            created_at: s.created_at || new Date().toISOString(),
            updated_at: s.updated_at || new Date().toISOString(),
          });
        }
      }

      if (Array.isArray(data.sale_items) && data.sale_items.length > 0) {
        const checkItem = db.prepare('SELECT id FROM sale_items WHERE id = ?');
        const insertItem = db.prepare(`
          INSERT OR REPLACE INTO sale_items (
            id, sale_id, product_id, quantity_cartons, unit_price, total_price, stock_before, stock_after
          ) VALUES (
            @id, @sale_id, @product_id, @quantity_cartons, @unit_price, @total_price, @stock_before, @stock_after
          )
        `);
        for (const item of data.sale_items) {
          if (!checkItem.get(item.id)) {
            insertItem.run(item);
          }
        }
      }
    }
  } finally {
    db.pragma('foreign_keys = ON');
  }
} catch (err) {
    console.error('[DB] Error restoring master data from backup:', err);
  }
}

export function getDatabaseProtectionStats() {
  try {
    let dbSizeBytes = 0;
    let walSizeBytes = 0;
    if (fs.existsSync(dbPath)) dbSizeBytes = fs.statSync(dbPath).size;
    if (fs.existsSync(`${dbPath}-wal`)) walSizeBytes = fs.statSync(`${dbPath}-wal`).size;

    let snapshotSizeBytes = 0;
    if (fs.existsSync(hotSnapshotFile)) snapshotSizeBytes = fs.statSync(hotSnapshotFile).size;

    let jsonBackupSizeBytes = 0;
    if (fs.existsSync(masterBackupFile)) jsonBackupSizeBytes = fs.statSync(masterBackupFile).size;

    const usersCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
    const posCount = (db.prepare('SELECT COUNT(*) as c FROM points_of_sale WHERE is_deleted = 0').get() as any)?.c || 0;
    const salesCount = (db.prepare('SELECT COUNT(*) as c FROM sales').get() as any)?.c || 0;
    const vrsStockCount = (db.prepare('SELECT COUNT(*) as c FROM vrs_stocks WHERE available_quantity > 0').get() as any)?.c || 0;
    const dpStockCount = (db.prepare('SELECT COUNT(*) as c FROM drop_point_stocks').get() as any)?.c || 0;
    const receiptsCount = (db.prepare('SELECT COUNT(*) as c FROM stock_receipts').get() as any)?.c || 0;

    return {
      status: 'PROTECTED',
      mode: 'WAL_ACTIVE_HOT_SNAPSHOT',
      lastBackupTimestamp,
      lastBackupDate: new Date(lastBackupTimestamp).toISOString(),
      storage: {
        databaseFileMb: +(dbSizeBytes / (1024 * 1024)).toFixed(2),
        walFileMb: +(walSizeBytes / (1024 * 1024)).toFixed(2),
        snapshotFileMb: +(snapshotSizeBytes / (1024 * 1024)).toFixed(2),
        jsonBackupFileMb: +(jsonBackupSizeBytes / (1024 * 1024)).toFixed(2),
      },
      counts: {
        users: usersCount,
        pointsOfSale: posCount,
        sales: salesCount,
        vrsStockLines: vrsStockCount,
        dropPointStockLines: dpStockCount,
        receipts: receiptsCount,
      }
    };
  } catch (err: any) {
    return {
      status: 'ERROR',
      error: err.message,
    };
  }
}

export function restoreVrsStocksAndSalesFromBackup() {
  try {
    if (fs.existsSync(vrsStockBackupFile)) {
      const raw = fs.readFileSync(vrsStockBackupFile, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        const updateStmt = db.prepare(`
          UPDATE vrs_stocks
          SET available_quantity = MAX(available_quantity, @available_quantity),
              reserved_quantity = @reserved_quantity
          WHERE vrs_id = @vrs_id AND product_id = @product_id
        `);
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO vrs_stocks (vrs_id, drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
          VALUES (@vrs_id, @drop_point_id, @product_id, @available_quantity, @reserved_quantity, @alert_threshold)
        `);
        for (const item of list) {
          const res = updateStmt.run(item);
          if (res.changes === 0) {
            insertStmt.run(item);
          }
        }
      }
    }

    if (fs.existsSync(salesBackupFile)) {
      const raw = fs.readFileSync(salesBackupFile, 'utf-8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.sales) && data.sales.length > 0) {
        db.pragma('foreign_keys = OFF');
        try {
          const checkSale = db.prepare('SELECT id FROM sales WHERE id = ? OR sale_number = ?');
          const insertSale = db.prepare(`
            INSERT OR REPLACE INTO sales (
              id, sale_number, vrs_id, drop_point_id, point_of_sale_id, total_amount, discount, notes, status, latitude, longitude, location_accuracy, created_at, updated_at
            ) VALUES (
              @id, @sale_number, @vrs_id, @drop_point_id, @point_of_sale_id, @total_amount, @discount, @notes, @status, @latitude, @longitude, @location_accuracy, @created_at, @updated_at
            )
          `);
          for (const s of data.sales) {
            if (!checkSale.get(s.id, s.sale_number)) {
              insertSale.run({
                id: s.id,
                sale_number: s.sale_number,
                vrs_id: s.vrs_id,
                drop_point_id: s.drop_point_id || 1,
                point_of_sale_id: s.point_of_sale_id,
                total_amount: s.total_amount,
                discount: s.discount || 0,
                notes: s.notes || '',
                status: s.status || 'COMPLETED',
                latitude: s.latitude || null,
                longitude: s.longitude || null,
                location_accuracy: s.location_accuracy || null,
                created_at: s.created_at || new Date().toISOString(),
                updated_at: s.updated_at || new Date().toISOString(),
              });
            }
          }
          if (Array.isArray(data.items) && data.items.length > 0) {
            const checkItem = db.prepare('SELECT id FROM sale_items WHERE id = ?');
            const insertItem = db.prepare(`
              INSERT OR REPLACE INTO sale_items (
                id, sale_id, product_id, quantity_cartons, unit_price, total_price, stock_before, stock_after
              ) VALUES (
                @id, @sale_id, @product_id, @quantity_cartons, @unit_price, @total_price, @stock_before, @stock_after
              )
            `);
            for (const it of data.items) {
              if (!checkItem.get(it.id)) {
                insertItem.run(it);
              }
            }
          }
        } finally {
          db.pragma('foreign_keys = ON');
        }
      }
    }
  } catch (err) {
    console.error('[DB] Error restoring VRS stocks and sales from backup:', err);
  }
}

export function ensureVrsOperationalStockAndTraces() {
  // Safe no-op: Automatic modification or injection of stock is permanently disabled.
}

export function ensureVrsSalesHistoryAndTraces() {
  // Safe no-op: Automatic creation or injection of sales is permanently disabled.
}

export function ensurePosHasVrsSales(_posId: number) {
  // Safe no-op: Automatic creation of fake sales upon PDV validation is permanently disabled.
}

function seedInitialData() {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount > 0) {
    return;
  }

  console.log('[DB] Seeding initial database with official 6C DISTRIBUTION data...');

  // Default hashed password for '6CDist@2026'
  const defaultPasswordHash = bcrypt.hashSync('6CDist@2026', 10);

  // 1. Categories
  const categories = ['NIDO', 'MAGGI', 'CERELAC', 'NESCAFE'];
  const catStmt = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
  for (const cat of categories) {
    catStmt.run(cat, `Gamme officielle de produits ${cat}`);
  }

  // 2. Official Products (Section 16)
  const productList = [
    { cat: 'NIDO', sub: 'Lait en poudre', name: 'NIDO Sachet', ref: 'NID-SACH-01', unit: 'Carton', perCarton: 24, price: 48000 },
    { cat: 'MAGGI', sub: 'Bouillon culinaire', name: 'MAGGI Persil', ref: 'MAG-PERS-01', unit: 'Carton', perCarton: 60, price: 28000 },
    { cat: 'MAGGI', sub: 'Bouillon culinaire', name: 'MAGGI Tablette', ref: 'MAG-TABL-01', unit: 'Carton', perCarton: 100, price: 32000 },
    { cat: 'MAGGI', sub: 'Bouillon culinaire', name: 'MAGGI Poulet', ref: 'MAG-POUL-01', unit: 'Carton', perCarton: 60, price: 30000 },
    { cat: 'CERELAC', sub: 'Céréales infantiles', name: 'CERELAC Sachet', ref: 'CER-SACH-01', unit: 'Carton', perCarton: 36, price: 42000 },
    { cat: 'CERELAC', sub: 'Céréales infantiles', name: 'CERELAC Boîte', ref: 'CER-BOIT-01', unit: 'Carton', perCarton: 24, price: 54000 },
    { cat: 'NESCAFE', sub: 'Café soluble', name: 'NESCAFE Coffret', ref: 'NES-COFF-01', unit: 'Carton', perCarton: 20, price: 60000 },
    { cat: 'NESCAFE', sub: 'Café soluble', name: 'NESCAFE Boîte', ref: 'NES-BOIT-01', unit: 'Carton', perCarton: 24, price: 52000 },
  ];

  const prodStmt = db.prepare(`
    INSERT INTO products (category_id, sub_category, name, reference, unit, units_per_carton, unit_price, status)
    VALUES ((SELECT id FROM categories WHERE name = ?), ?, ?, ?, ?, ?, ?, 'ACTIF')
  `);
  for (const p of productList) {
    prodStmt.run(p.cat, p.sub, p.name, p.ref, p.unit, p.perCarton, p.price);
  }

  // 3. Drop Point DAKAN (Code: DKN)
  const dpResult = db.prepare(`
    INSERT INTO drop_points (code, name, city, neighborhood, address, phone, latitude, longitude, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF')
  `).run('DKN', 'Drop Point DAKAN', 'Bamako', 'Dakan', 'Avenue du Commerce, Dakan Entrepôt Principal', '+223 70 00 11 22', 12.6392, -8.0029);
  const dknId = dpResult.lastInsertRowid as number;

  // 4. Sectors for DAKAN
  const sectorStmt = db.prepare('INSERT INTO sectors (drop_point_id, neighborhood, code, name) VALUES (?, ?, ?, ?)');
  const sec1 = sectorStmt.run(dknId, 'Dakan Nord', 'SEC-01', 'Secteur 01 - Dakan Marché').lastInsertRowid as number;
  const sec2 = sectorStmt.run(dknId, 'Dakan Centre', 'SEC-02', 'Secteur 02 - Dakan Résidentiel').lastInsertRowid as number;
  const sec3 = sectorStmt.run(dknId, 'Dakan Sud', 'SEC-03', 'Secteur 03 - Dakan Boulevard').lastInsertRowid as number;

  // 5. Users
  // 5.1 Sales Admin National
  db.prepare(`
    INSERT INTO users (public_id, role, first_name, last_name, email, phone, password_hash, photo, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF')
  `).run('6CDISTSAN', 'SALES_ADMIN_NATIONAL', 'Amadou', 'Touré', 'amadou.toure@6cdist.com', '+223 60 11 22 33', defaultPasswordHash, 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=300&auto=format&fit=crop&q=80');

  // 5.2 Sales Admin DAKAN
  const saResult = db.prepare(`
    INSERT INTO users (public_id, role, first_name, last_name, email, phone, password_hash, photo, drop_point_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF')
  `).run('6CDISTSA-DKN', 'SALES_ADMIN', 'Fatoumata', 'Diarra', 'fatoumata.diarra@6cdist.com', '+223 76 22 33 44', defaultPasswordHash, 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300&auto=format&fit=crop&q=80', dknId);
  const saId = saResult.lastInsertRowid as number;

  // 5.3 FSS DAKAN
  const fssResult = db.prepare(`
    INSERT INTO users (public_id, role, first_name, last_name, email, phone, password_hash, photo, drop_point_id, sales_admin_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF')
  `).run('6CDISTFSS-DKN', 'FSS', 'Oumar', 'Coulibaly', 'oumar.coulibaly@6cdist.com', '+223 75 33 44 55', defaultPasswordHash, 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=300&auto=format&fit=crop&q=80', dknId, saId);
  const fssId = fssResult.lastInsertRowid as number;

  // 5.4 VRS Sellers
  const vrs1Result = db.prepare(`
    INSERT INTO users (public_id, role, first_name, last_name, email, phone, password_hash, photo, drop_point_id, sales_admin_id, fss_id, sector_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF')
  `).run('6CDISTVRS-DKN-001', 'VRS', 'Ibrahim', 'Sangaré', 'ibrahim.sangare@6cdist.com', '+223 66 44 55 66', defaultPasswordHash, 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=300&auto=format&fit=crop&q=80', dknId, saId, fssId, sec1);
  const vrs1Id = vrs1Result.lastInsertRowid as number;

  db.prepare(`
    INSERT INTO users (public_id, role, first_name, last_name, email, phone, password_hash, photo, drop_point_id, sales_admin_id, fss_id, sector_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF')
  `).run('6CDISTVRS-DKN-002', 'VRS', 'Aminata', 'Koné', 'aminata.kone@6cdist.com', '+223 78 55 66 77', defaultPasswordHash, 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&auto=format&fit=crop&q=80', dknId, saId, fssId, sec2);

  db.prepare(`
    INSERT INTO users (public_id, role, first_name, last_name, email, phone, password_hash, photo, drop_point_id, sales_admin_id, fss_id, sector_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF')
  `).run('6CDISTVRS-DKN-003', 'VRS', 'Moussa', 'Traoré', 'moussa.traore@6cdist.com', '+223 90 66 77 88', defaultPasswordHash, 'https://images.unsplash.com/photo-1507152832244-10d45c7eda57?w=300&auto=format&fit=crop&q=80', dknId, saId, fssId, sec3);

  // 6. Initial Stock for Drop Point DAKAN (Section 17)
  const initialDpStocks: Record<string, number> = {
    'NIDO Sachet': 250,
    'MAGGI Persil': 120,
    'MAGGI Tablette': 300,
    'MAGGI Poulet': 200,
    'CERELAC Sachet': 150,
    'CERELAC Boîte': 100,
    'NESCAFE Coffret': 80,
    'NESCAFE Boîte': 130,
  };

  const prods = db.prepare('SELECT id, name, unit_price FROM products').all() as { id: number; name: string; unit_price: number }[];
  const dpStockStmt = db.prepare(`
    INSERT INTO drop_point_stocks (drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
    VALUES (?, ?, ?, 0, 20)
  `);
  const mvtStmt = db.prepare(`
    INSERT INTO stock_movements (reference, movement_type, target_role, target_id, drop_point_id, product_id, quantity, stock_before, stock_after, notes, created_by_user_id)
    VALUES (?, 'RECEIPT', 'DROP_POINT', ?, ?, ?, ?, 0, ?, 'Stock initial d''ouverture du Drop Point', ?)
  `);

  for (const prod of prods) {
    const qty = initialDpStocks[prod.name] || 50;
    dpStockStmt.run(dknId, prod.id, qty);
    mvtStmt.run(`INIT-DP-${prod.id}`, dknId, dknId, prod.id, qty, qty, saId);
  }

  // 7. Initial Stock for VRS (Operational active stock allocation)
  const vrsStockStmt = db.prepare(`
    INSERT INTO vrs_stocks (vrs_id, drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
    VALUES (?, ?, ?, ?, 0, 3)
  `);

  const initialVrsStocks: Record<string, number> = {
    'NIDO Sachet': 25,
    'MAGGI Tablette': 35,
    'MAGGI Persil': 15,
    'MAGGI Poulet': 15,
    'CERELAC Sachet': 15,
    'CERELAC Boîte': 10,
    'NESCAFE Coffret': 12,
    'NESCAFE Boîte': 12,
  };

  for (const prod of prods) {
    const qty = initialVrsStocks[prod.name] || 15;
    vrsStockStmt.run(vrs1Id, dknId, prod.id, qty);
    mvtStmt.run(`INIT-VRS-${prod.id}`, dknId, dknId, prod.id, qty, qty, saId);
  }

  // 8. Points of Sale: STRICTEMENT MANUEL (Aucune création automatique de PDV)
  // Les points de vente doivent être enrôlés manuellement sur le terrain par les utilisateurs selon les besoins réels.

  // 9. Tour plans (Active approved tours only - no automatic tour proposals)
  const tourStmt = db.prepare(`
    INSERT INTO tour_plans (name, day_of_week, drop_point_id, neighborhood, sector_id, vrs_id, status, notes, target_visits_count, reviewed_at, reviewed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  tourStmt.run('Tournée DAKAN Nord', '18/09/2026', dknId, 'Dakan Marché', sec1, vrs1Id, 'ACTIF', 'Tournée principale', 12, '2026-09-17 14:30:00', saId);
  tourStmt.run('Tournée DAKAN Centre', '19/09/2026', dknId, 'Dakan Centre', sec2, vrs1Id, 'ACTIF', 'Tournée centre-ville', 15, '2026-09-18 09:15:00', saId);
  tourStmt.run('Tournée DAKAN Sud', '21/09/2026', dknId, 'Dakan Sud', sec3, vrs1Id, 'ACTIF', 'Tournée sud', 10, '2026-09-18 16:45:00', saId);

  // 10. Initial Stock Receipt (BL000 - Nestlé)
  const nidoProd = prods.find((p) => p.name === 'NIDO Sachet')!;
  const maggiProd = prods.find((p) => p.name === 'MAGGI Tablette')!;
  const rcptResult = db.prepare(`
    INSERT INTO stock_receipts (receipt_number, delivery_note_number, drop_point_id, supplier, receipt_date, observations, attachment_url, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('RCPT-2026-001', 'BL-NESTLE-8841', dknId, 'Nestlé Mali Distribution', '2026-09-10', 'Livraison fournisseur conforme, emballages intacts.', 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400', saId);
  const rcptId = rcptResult.lastInsertRowid as number;

  db.prepare(`
    INSERT INTO stock_receipt_items (receipt_id, product_id, quantity_cartons)
    VALUES (?, ?, ?), (?, ?, ?)
  `).run(rcptId, nidoProd.id, 150, rcptId, maggiProd.id, 200);

  // 11. Notifications (Seulement notifications système initiales réelles, aucune notification automatique de PDV fictif)
  const notifStmt = db.prepare(`
    INSERT INTO notifications (user_id, role, drop_point_id, title, message, type, link)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  notifStmt.run(vrs1Id, 'VRS', dknId, 'Bienvenue sur 6C Distribution', 'Votre compte vendeur est activé. Votre tournée est prête.', 'SYSTEM', '/my-tour');

  // 12. Activity Log
  db.prepare(`
    INSERT INTO activity_logs (user_id, user_public_id, action, resource, details, ip_address)
    VALUES (?, ?, 'SYSTEM_INIT', 'DATABASE', 'Initialisation du système 6C DISTRIBUTION MANAGEMENT avec données officielles.', '127.0.0.1')
  `).run(1, '6CDISTSAN');

  console.log('[DB] Seeding completed successfully.');
}
