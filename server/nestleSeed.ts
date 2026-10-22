import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { getBamakoDateInfo } from './salesAggregation.ts';

export interface NestleProductDef {
  cat: 'NIDO' | 'CERELAC' | 'NESCAFÉ' | 'MAGGI';
  sub: string;
  name: string;
  ref: string;
  unitsPerCarton: number;
  dpCessionPrice: number;
  vrsCessionPrice: number;
  pdvPrice: number;
}

export const NESTLE_PRODUCTS: NestleProductDef[] = [
  // 1. NIDO
  {
    cat: 'NIDO',
    sub: 'Lait en poudre',
    name: 'Nido Sachet',
    ref: 'NID-SACH-100',
    unitsPerCarton: 100,
    dpCessionPrice: 26000,
    vrsCessionPrice: 27000,
    pdvPrice: 28500,
  },
  {
    cat: 'NIDO',
    sub: 'Lait en boîte',
    name: 'Nido boîte 400g',
    ref: 'NID-B400-24',
    unitsPerCarton: 24,
    dpCessionPrice: 38000,
    vrsCessionPrice: 39500,
    pdvPrice: 41500,
  },
  {
    cat: 'NIDO',
    sub: 'Lait en boîte',
    name: 'Nido boîte 800g',
    ref: 'NID-B800-12',
    unitsPerCarton: 12,
    dpCessionPrice: 40000,
    vrsCessionPrice: 41500,
    pdvPrice: 43500,
  },
  {
    cat: 'NIDO',
    sub: 'Lait en boîte',
    name: 'Nido boîte 2500g',
    ref: 'NID-B2500-06',
    unitsPerCarton: 6,
    dpCessionPrice: 52000,
    vrsCessionPrice: 54000,
    pdvPrice: 57000,
  },

  // 2. CERELAC
  {
    cat: 'CERELAC',
    sub: 'Céréales infantiles',
    name: 'Cerelac boîte',
    ref: 'CER-BOIT-24',
    unitsPerCarton: 24,
    dpCessionPrice: 31000,
    vrsCessionPrice: 32500,
    pdvPrice: 34500,
  },
  {
    cat: 'CERELAC',
    sub: 'Céréales infantiles',
    name: 'Cerelac sachet',
    ref: 'CER-SACH-48',
    unitsPerCarton: 48,
    dpCessionPrice: 18000,
    vrsCessionPrice: 19000,
    pdvPrice: 20500,
  },
  {
    cat: 'CERELAC',
    sub: 'Céréales infantiles',
    name: 'Cerelac carton 150g',
    ref: 'CER-CTN-150G',
    unitsPerCarton: 24,
    dpCessionPrice: 22000,
    vrsCessionPrice: 23000,
    pdvPrice: 24500,
  },

  // 3. NESCAFÉ
  {
    cat: 'NESCAFÉ',
    sub: 'Café soluble',
    name: 'Nescafé boîte 50g',
    ref: 'NES-B050-24',
    unitsPerCarton: 24,
    dpCessionPrice: 27000,
    vrsCessionPrice: 28000,
    pdvPrice: 30000,
  },
  {
    cat: 'NESCAFÉ',
    sub: 'Café soluble',
    name: 'Nescafé boîte 200g',
    ref: 'NES-B200-12',
    unitsPerCarton: 12,
    dpCessionPrice: 42000,
    vrsCessionPrice: 43500,
    pdvPrice: 46000,
  },
  {
    cat: 'NESCAFÉ',
    sub: 'Café soluble',
    name: 'Nescafé sachet 5g',
    ref: 'NES-SACH-200',
    unitsPerCarton: 200,
    dpCessionPrice: 20000,
    vrsCessionPrice: 21000,
    pdvPrice: 22500,
  },

  // 4. MAGGI
  {
    cat: 'MAGGI',
    sub: 'Bouillon culinaire',
    name: 'Maggi tablette cube',
    ref: 'MAG-TABL-100',
    unitsPerCarton: 100,
    dpCessionPrice: 14000,
    vrsCessionPrice: 14700,
    pdvPrice: 15700,
  },
  {
    cat: 'MAGGI',
    sub: 'Bouillon culinaire',
    name: 'Maggi poulet cube',
    ref: 'MAG-POUL-100',
    unitsPerCarton: 100,
    dpCessionPrice: 15500,
    vrsCessionPrice: 16300,
    pdvPrice: 17300,
  },
  {
    cat: 'MAGGI',
    sub: 'Bouillon culinaire',
    name: 'Maggi persil cube',
    ref: 'MAG-PERS-100',
    unitsPerCarton: 100,
    dpCessionPrice: 15000,
    vrsCessionPrice: 15800,
    pdvPrice: 16800,
  },
  {
    cat: 'MAGGI',
    sub: 'Bouillon culinaire',
    name: 'Maggi oignon cube',
    ref: 'MAG-OIGN-100',
    unitsPerCarton: 100,
    dpCessionPrice: 15000,
    vrsCessionPrice: 15800,
    pdvPrice: 16800,
  },
  {
    cat: 'MAGGI',
    sub: 'Assaisonnement',
    name: 'Maggi La Star sachet 25g',
    ref: 'MAG-STAR-150',
    unitsPerCarton: 150,
    dpCessionPrice: 12000,
    vrsCessionPrice: 12700,
    pdvPrice: 13500,
  },
  {
    cat: 'MAGGI',
    sub: 'Assaisonnement',
    name: 'Maggi tablette en poudre 125g',
    ref: 'MAG-POUD-060',
    unitsPerCarton: 60,
    dpCessionPrice: 13000,
    vrsCessionPrice: 13700,
    pdvPrice: 14600,
  },
];

export function resetNestleDemoData(db: Database.Database): void {
  console.log('[NESTLE-SEED] Starting clean reset with official 16 Nestlé products dataset...');

  const defaultPasswordHash = bcrypt.hashSync('6CDist@2026', 10);

  // Disable foreign keys temporarily during atomic re-seed transaction
  db.pragma('foreign_keys = OFF');

  const runSeed = db.transaction(() => {
    // 0. Ensure additional tables and columns
    db.exec(`
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure columns dp_cession_price and vrs_cession_price on products
    try {
      const pCols = (db.prepare('PRAGMA table_info(products)').all() as { name: string }[]).map(c => c.name);
      if (!pCols.includes('dp_cession_price')) {
        db.prepare('ALTER TABLE products ADD COLUMN dp_cession_price REAL').run();
      }
      if (!pCols.includes('vrs_cession_price')) {
        db.prepare('ALTER TABLE products ADD COLUMN vrs_cession_price REAL').run();
      }
    } catch {}

    // Clear dependent tables cleanly
    db.prepare('DELETE FROM dp_invoice_payments').run();
    db.prepare('DELETE FROM dp_transfers').run();
    db.prepare('DELETE FROM dp_invoices').run();
    db.prepare('DELETE FROM dp_supply_request_items').run();
    db.prepare('DELETE FROM dp_supply_requests').run();

    db.prepare('DELETE FROM vrs_invoice_payments').run();
    db.prepare('DELETE FROM vrs_invoices').run();
    db.prepare('DELETE FROM supply_request_items').run();
    db.prepare('DELETE FROM supply_requests').run();

    db.prepare('DELETE FROM pos_creation_requests').run();
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM visits').run();
    db.prepare('DELETE FROM stock_movements').run();
    db.prepare('DELETE FROM stock_receipt_items').run();
    db.prepare('DELETE FROM stock_receipts').run();
    db.prepare('DELETE FROM drop_point_stocks').run();
    db.prepare('DELETE FROM vrs_stocks').run();
    db.prepare('DELETE FROM central_depot_stocks').run();
    db.prepare('DELETE FROM tour_plans').run();
    db.prepare('DELETE FROM notifications').run();
    db.prepare('DELETE FROM points_of_sale').run();
    db.prepare('DELETE FROM sectors').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM categories').run();

    // 1. Categories (4 gammes: NIDO, CERELAC, NESCAFÉ, MAGGI)
    const catInsert = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    const catMap = new Map<string, number>();
    const gammes: Array<[string, string]> = [
      ['NIDO', 'Gamme laits infantiles et enrichis Nestlé NIDO'],
      ['CERELAC', 'Gamme céréales infantiles Nestlé CERELAC'],
      ['NESCAFÉ', 'Gamme cafés solubles et boissons chaudes Nestlé NESCAFÉ'],
      ['MAGGI', 'Gamme bouillons et assaisonnements culinaires Nestlé MAGGI'],
    ];

    for (const [name, desc] of gammes) {
      const res = catInsert.run(name, desc);
      catMap.set(name, Number(res.lastInsertRowid));
    }

    // 2. Drop Points: DAKAN (DKN) and BAMAKO (BKO)
    // Check or insert DKN
    let dkn = db.prepare("SELECT id FROM drop_points WHERE code = 'DKN'").get() as any;
    if (!dkn) {
      const res = db.prepare(`
        INSERT INTO drop_points (code, name, city, neighborhood, address, phone, latitude, longitude, status)
        VALUES ('DKN', 'Drop Point DAKAN', 'Bamako', 'Dakan', 'Avenue du Commerce, Dakan Entrepôt Principal', '+223 70 00 11 22', 12.6392, -8.0029, 'ACTIF')
      `).run();
      dkn = { id: Number(res.lastInsertRowid) };
    } else {
      db.prepare(`
        UPDATE drop_points
        SET name = 'Drop Point DAKAN', city = 'Bamako', neighborhood = 'Dakan', status = 'ACTIF'
        WHERE id = ?
      `).run(dkn.id);
    }
    const dknId = dkn.id;

    // Check or insert BKO
    let bko = db.prepare("SELECT id FROM drop_points WHERE code = 'BKO'").get() as any;
    if (!bko) {
      const res = db.prepare(`
        INSERT INTO drop_points (code, name, city, neighborhood, address, phone, latitude, longitude, status)
        VALUES ('BKO', 'Drop Point BAMAKO', 'Bamako', 'Hamdallaye ACI 2000', 'Boulevard du 22 Octobre, Hamdallaye ACI 2000', '+223 20 29 11 22', 12.6310, -8.0190, 'ACTIF')
      `).run();
      bko = { id: Number(res.lastInsertRowid) };
    } else {
      db.prepare(`
        UPDATE drop_points
        SET name = 'Drop Point BAMAKO', city = 'Bamako', neighborhood = 'Hamdallaye ACI 2000', status = 'ACTIF'
        WHERE id = ?
      `).run(bko.id);
    }
    const bkoId = bko.id;

    // 3. Sectors:
    // Sector 01 - Dakan Marché for DKN
    const secDknRes = db.prepare(`
      INSERT INTO sectors (drop_point_id, neighborhood, code, name)
      VALUES (?, 'Dakan Nord', 'SEC-01', 'Secteur 01 - Dakan Marché')
    `).run(dknId);
    const secDkn = Number(secDknRes.lastInsertRowid);

    // Sector for BKO
    const secBkoRes = db.prepare(`
      INSERT INTO sectors (drop_point_id, neighborhood, code, name)
      VALUES (?, 'Hamdallaye ACI 2000', 'SEC-BKO-01', 'Secteur 01 - ACI 2000 Marché')
    `).run(bkoId);
    const secBko = Number(secBkoRes.lastInsertRowid);

    // 4. Products: 16 official Nestlé products
    const prodInsert = db.prepare(`
      INSERT INTO products (
        category_id, drop_point_id, sub_category, name, reference, unit,
        units_per_carton, dp_cession_price, vrs_cession_price, unit_price, status
      ) VALUES (?, ?, ?, ?, ?, 'Carton', ?, ?, ?, ?, 'ACTIF')
    `);

    const productMap = new Map<string, { id: number; ref: string; def: NestleProductDef }>();
    const productList: Array<{ id: number; ref: string; def: NestleProductDef }> = [];

    for (const p of NESTLE_PRODUCTS) {
      const catId = catMap.get(p.cat)!;
      const res = prodInsert.run(
        catId,
        dknId,
        p.sub,
        p.name,
        p.ref,
        p.unitsPerCarton,
        p.dpCessionPrice,
        p.vrsCessionPrice,
        p.pdvPrice
      );
      const prodId = Number(res.lastInsertRowid);
      const entry = { id: prodId, ref: p.ref, def: p };
      productMap.set(p.name, entry);
      productList.push(entry);
    }

    // 5. Users: Accounts of the 4 roles remain strictly unchanged
    // 6CDISTSAN, 6CDISTSA-DKN, 6CDISTFSS-DKN, 6CDISTVRS-DKN-001
    const upsertUser = db.prepare(`
      INSERT INTO users (
        public_id, role, first_name, last_name, email, phone, password_hash,
        photo, drop_point_id, sales_admin_id, fss_id, sector_id, status
      ) VALUES (
        @public_id, @role, @first_name, @last_name, @email, @phone, @password_hash,
        @photo, @drop_point_id, @sales_admin_id, @fss_id, @sector_id, 'ACTIF'
      )
      ON CONFLICT(public_id) DO UPDATE SET
        role = excluded.role,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        email = excluded.email,
        phone = excluded.phone,
        password_hash = excluded.password_hash,
        drop_point_id = excluded.drop_point_id,
        sales_admin_id = excluded.sales_admin_id,
        fss_id = excluded.fss_id,
        sector_id = excluded.sector_id,
        status = 'ACTIF'
    `);

    // 5.1 SAN: Amadou Touré
    upsertUser.run({
      public_id: '6CDISTSAN',
      role: 'SALES_ADMIN_NATIONAL',
      first_name: 'Amadou',
      last_name: 'Touré',
      email: 'amadou.toure@6cdist.com',
      phone: '+223 60 11 22 33',
      password_hash: defaultPasswordHash,
      photo: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=300&auto=format&fit=crop&q=80',
      drop_point_id: null,
      sales_admin_id: null,
      fss_id: null,
      sector_id: null,
    });
    const sanUser = db.prepare("SELECT id FROM users WHERE public_id = '6CDISTSAN'").get() as any;
    const sanId = sanUser.id;

    // 5.2 SA DAKAN: Fatoumata Diarra
    upsertUser.run({
      public_id: '6CDISTSA-DKN',
      role: 'SALES_ADMIN',
      first_name: 'Fatoumata',
      last_name: 'Diarra',
      email: 'fatoumata.diarra@6cdist.com',
      phone: '+223 76 22 33 44',
      password_hash: defaultPasswordHash,
      photo: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300&auto=format&fit=crop&q=80',
      drop_point_id: dknId,
      sales_admin_id: null,
      fss_id: null,
      sector_id: null,
    });
    const saDkn = db.prepare("SELECT id FROM users WHERE public_id = '6CDISTSA-DKN'").get() as any;
    const saDknId = saDkn.id;

    // 5.3 FSS DAKAN: Oumar Coulibaly
    upsertUser.run({
      public_id: '6CDISTFSS-DKN',
      role: 'FSS',
      first_name: 'Oumar',
      last_name: 'Coulibaly',
      email: 'oumar.coulibaly@6cdist.com',
      phone: '+223 75 33 44 55',
      password_hash: defaultPasswordHash,
      photo: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=300&auto=format&fit=crop&q=80',
      drop_point_id: dknId,
      sales_admin_id: saDknId,
      fss_id: null,
      sector_id: null,
    });
    const fssDkn = db.prepare("SELECT id FROM users WHERE public_id = '6CDISTFSS-DKN'").get() as any;
    const fssDknId = fssDkn.id;

    // 5.4 VRS Ibrahim Sangaré: 6CDISTVRS-DKN-001 (rattaché à DKN et Secteur 01 - Dakan Marché)
    upsertUser.run({
      public_id: '6CDISTVRS-DKN-001',
      role: 'VRS',
      first_name: 'Ibrahim',
      last_name: 'Sangaré',
      email: 'ibrahim.sangare@6cdist.com',
      phone: '+223 66 44 55 66',
      password_hash: defaultPasswordHash,
      photo: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=300&auto=format&fit=crop&q=80',
      drop_point_id: dknId,
      sales_admin_id: saDknId,
      fss_id: fssDknId,
      sector_id: secDkn,
    });
    const vrsIbrahim = db.prepare("SELECT id FROM users WHERE public_id = '6CDISTVRS-DKN-001'").get() as any;
    const vrsIbrahimId = vrsIbrahim.id;

    // 5.5 SA BKO & VRS BKO for multi-tenant and national aggregate
    upsertUser.run({
      public_id: '6CDISTSA-BKO',
      role: 'SALES_ADMIN',
      first_name: 'Adama',
      last_name: 'Sidibé',
      email: 'adama.sidibe@6cdist.com',
      phone: '+223 75 00 11 22',
      password_hash: defaultPasswordHash,
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
      drop_point_id: bkoId,
      sales_admin_id: null,
      fss_id: null,
      sector_id: null,
    });
    const saBko = db.prepare("SELECT id FROM users WHERE public_id = '6CDISTSA-BKO'").get() as any;
    const saBkoId = saBko.id;

    upsertUser.run({
      public_id: '6CDISTVRS-BKO-001',
      role: 'VRS',
      first_name: 'Bakary',
      last_name: 'Coulibaly',
      email: 'bakary.coulibaly@6cdist.com',
      phone: '+223 76 111 22 33',
      password_hash: defaultPasswordHash,
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
      drop_point_id: bkoId,
      sales_admin_id: saBkoId,
      fss_id: null,
      sector_id: secBko,
    });
    const vrsBko = db.prepare("SELECT id FROM users WHERE public_id = '6CDISTVRS-BKO-001'").get() as any;
    const vrsBkoId = vrsBko.id;

    // 6. Points of Sale: 8 PDVs (6 for Ibrahim in DAKAN Sector 01, 2 for BKO)
    const posInsert = db.prepare(`
      INSERT INTO points_of_sale (
        public_id, name, code, owner_name, phone, photo, address, neighborhood,
        sector_id, drop_point_id, assigned_vrs_id, created_by_user_id,
        latitude, longitude, status, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF', 0)
    `);

    const eightStores = [
      // 6 PDVs for Ibrahim (DKN - Secteur 01 - Dakan Marché)
      {
        pubId: 'PDV-1001',
        name: 'Boutique Chez Alima',
        code: 'POS-DKN-001',
        owner: 'Alima Coulibaly',
        phone: '+223 70 22 33 44',
        photo: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
        addr: 'Dakan Marché, Rue 14 Porte 25',
        neigh: 'Dakan Nord',
        secId: secDkn,
        dpId: dknId,
        vrsId: vrsIbrahimId,
        lat: 12.6410,
        lng: -8.0015,
      },
      {
        pubId: 'PDV-1002',
        name: 'Alimentation Générale Dakan',
        code: 'POS-DKN-002',
        owner: 'Mamadou Traoré',
        phone: '+223 76 11 22 33',
        photo: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=500&auto=format&fit=crop&q=80',
        addr: 'Avenue Principale Marché Dakan',
        neigh: 'Dakan Nord',
        secId: secDkn,
        dpId: dknId,
        vrsId: vrsIbrahimId,
        lat: 12.6398,
        lng: -8.0022,
      },
      {
        pubId: 'PDV-1003',
        name: 'Superette Le Palmier',
        code: 'POS-DKN-003',
        owner: 'Ousmane Diarra',
        phone: '+223 66 33 44 55',
        photo: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=500&auto=format&fit=crop&q=80',
        addr: 'Dakan Marché Secteur Est',
        neigh: 'Dakan Nord',
        secId: secDkn,
        dpId: dknId,
        vrsId: vrsIbrahimId,
        lat: 12.6385,
        lng: -8.0040,
      },
      {
        pubId: 'PDV-1004',
        name: 'Kiosque Moussa Dakan',
        code: 'POS-DKN-004',
        owner: 'Moussa Fofana',
        phone: '+223 75 44 55 66',
        photo: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=500&auto=format&fit=crop&q=80',
        addr: 'Carrefour Marché Dakan',
        neigh: 'Dakan Nord',
        secId: secDkn,
        dpId: dknId,
        vrsId: vrsIbrahimId,
        lat: 12.6372,
        lng: -8.0035,
      },
      {
        pubId: 'PDV-1005',
        name: 'Boutique Baraka Mandé',
        code: 'POS-DKN-005',
        owner: 'Mariam Sidibé',
        phone: '+223 72 88 99 00',
        photo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
        addr: 'Allée Centrale Dakan Marché',
        neigh: 'Dakan Nord',
        secId: secDkn,
        dpId: dknId,
        vrsId: vrsIbrahimId,
        lat: 12.6402,
        lng: -8.0028,
      },
      {
        pubId: 'PDV-1006',
        name: 'Alimentation Djoliba Dakan',
        code: 'POS-DKN-006',
        owner: 'Sekou Samaké',
        phone: '+223 65 44 11 22',
        photo: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=500&auto=format&fit=crop&q=80',
        addr: 'Boulevard du Commerce, Dakan Marché',
        neigh: 'Dakan Nord',
        secId: secDkn,
        dpId: dknId,
        vrsId: vrsIbrahimId,
        lat: 12.6420,
        lng: -8.0038,
      },

      // 2 PDVs for BKO
      {
        pubId: 'PDV-1007',
        name: 'Épicerie Centrale Hamdallaye',
        code: 'POS-BKO-001',
        owner: 'Fatoumata Coulibaly',
        phone: '+223 77 222 33 44',
        photo: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
        addr: 'Avenue de l OUA, Hamdallaye ACI 2000',
        neigh: 'Hamdallaye ACI 2000',
        secId: secBko,
        dpId: bkoId,
        vrsId: vrsBkoId,
        lat: 12.6320,
        lng: -8.0210,
      },
      {
        pubId: 'PDV-1008',
        name: 'Boutique Grand Marché Bamako',
        code: 'POS-BKO-002',
        owner: 'Seydou Diarra',
        phone: '+223 76 444 55 66',
        photo: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=500&auto=format&fit=crop&q=80',
        addr: 'Grand Marché, Allée des Épices',
        neigh: 'Grand Marché',
        secId: secBko,
        dpId: bkoId,
        vrsId: vrsBkoId,
        lat: 12.6450,
        lng: -8.0010,
      },
    ];

    const posMap = new Map<string, number>();
    for (const s of eightStores) {
      const res = posInsert.run(
        s.pubId, s.name, s.code, s.owner, s.phone, s.photo,
        s.addr, s.neigh, s.secId, s.dpId, s.vrsId, s.vrsId,
        s.lat, s.lng
      );
      posMap.set(s.pubId, Number(res.lastInsertRowid));
    }

    // 7. STOCKS COHÉRENTS (Calculés selon ventes moyennes journalières ~9.5 cartons/jour)
    // 6C Distribution: 45 à 60 jours (~52 jours = 494 cartons)
    const centralStockInsert = db.prepare(`
      INSERT INTO central_depot_stocks (product_id, available_quantity, reserved_quantity, alert_threshold)
      VALUES (?, ?, 0, ?)
    `);

    // Quantités cibles 6C Distribution par produit (Total = 494 cartons)
    const centralStockTargets: Record<string, number> = {
      'Nido Sachet': 55,
      'Nido boîte 400g': 40,
      'Nido boîte 800g': 40,
      'Nido boîte 2500g': 35,
      'Cerelac boîte': 16,
      'Cerelac sachet': 14,
      'Cerelac carton 150g': 10,
      'Nescafé boîte 50g': 22,
      'Nescafé boîte 200g': 18,
      'Nescafé sachet 5g': 20,
      'Maggi tablette cube': 50,
      'Maggi poulet cube': 45,
      'Maggi persil cube': 45,
      'Maggi oignon cube': 35,
      'Maggi La Star sachet 25g': 25,
      'Maggi tablette en poudre 125g': 24,
    };

    for (const p of productList) {
      const qty = centralStockTargets[p.def.name] || 25;
      centralStockInsert.run(p.id, qty, 20);
    }

    // Drop Point DAKAN (DKN): 15 à 30 jours (~22 jours = 138 cartons)
    // Drop Point BAMAKO (BKO): 15 à 30 jours (~22 jours = 70 cartons)
    const dpStockInsert = db.prepare(`
      INSERT INTO drop_point_stocks (drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
      VALUES (?, ?, ?, 0, ?)
    `);

    const dknStockTargets: Record<string, number> = {
      'Nido Sachet': 18,
      'Nido boîte 400g': 12,
      'Nido boîte 800g': 10,
      'Nido boîte 2500g': 8,
      'Cerelac boîte': 5,
      'Cerelac sachet': 4,
      'Cerelac carton 150g': 3,
      'Nescafé boîte 50g': 6,
      'Nescafé boîte 200g': 5,
      'Nescafé sachet 5g': 5,
      'Maggi tablette cube': 16,
      'Maggi poulet cube': 14,
      'Maggi persil cube': 12,
      'Maggi oignon cube': 10,
      'Maggi La Star sachet 25g': 5,
      'Maggi tablette en poudre 125g': 5,
    };

    const bkoStockTargets: Record<string, number> = {
      'Nido Sachet': 9,
      'Nido boîte 400g': 6,
      'Nido boîte 800g': 5,
      'Nido boîte 2500g': 4,
      'Cerelac boîte': 3,
      'Cerelac sachet': 2,
      'Cerelac carton 150g': 2,
      'Nescafé boîte 50g': 3,
      'Nescafé boîte 200g': 3,
      'Nescafé sachet 5g': 3,
      'Maggi tablette cube': 8,
      'Maggi poulet cube': 7,
      'Maggi persil cube': 6,
      'Maggi oignon cube': 5,
      'Maggi La Star sachet 25g': 2,
      'Maggi tablette en poudre 125g': 2,
    };

    const mvtInsert = db.prepare(`
      INSERT INTO stock_movements (
        reference, movement_type, source_role, source_id, target_role, target_id,
        drop_point_id, product_id, quantity, stock_before, stock_after, notes,
        created_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of productList) {
      const qtyDkn = dknStockTargets[p.def.name] || 6;
      dpStockInsert.run(dknId, p.id, qtyDkn, 5);
      mvtInsert.run(
        `INIT-DP-DKN-${p.id}`, 'RECEIPT', 'CENTRAL', null, 'DROP_POINT', dknId,
        dknId, p.id, qtyDkn, 0, qtyDkn, `Approvisionnement initial Drop Point DAKAN (${p.def.name})`,
        saDknId, '2026-05-01 08:00:00'
      );

      const qtyBko = bkoStockTargets[p.def.name] || 3;
      dpStockInsert.run(bkoId, p.id, qtyBko, 3);
      mvtInsert.run(
        `INIT-DP-BKO-${p.id}`, 'RECEIPT', 'CENTRAL', null, 'DROP_POINT', bkoId,
        bkoId, p.id, qtyBko, 0, qtyBko, `Approvisionnement initial Drop Point BAMAKO (${p.def.name})`,
        saBkoId, '2026-05-01 08:00:00'
      );
    }

    // VRS Ibrahim Sangaré: 3 à 7 jours de ventes journalières (~4.5 jours = 14 cartons)
    // Avec des produits en stock bas et rupture pour illustrer les alertes:
    const vrsStockInsert = db.prepare(`
      INSERT INTO vrs_stocks (vrs_id, drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
      VALUES (?, ?, ?, ?, 0, ?)
    `);

    const vrsIbrahimStockTargets: Record<string, { qty: number; alert: number }> = {
      'Nido Sachet': { qty: 3, alert: 2 },
      'Nido boîte 400g': { qty: 1, alert: 2 }, // Stock bas !
      'Nido boîte 800g': { qty: 1, alert: 1 },
      'Nido boîte 2500g': { qty: 0, alert: 1 }, // Rupture !
      'Cerelac boîte': { qty: 1, alert: 1 },
      'Cerelac sachet': { qty: 0, alert: 1 }, // Rupture !
      'Cerelac carton 150g': { qty: 1, alert: 1 },
      'Nescafé boîte 50g': { qty: 1, alert: 2 }, // Stock bas !
      'Nescafé boîte 200g': { qty: 0, alert: 1 }, // Rupture !
      'Nescafé sachet 5g': { qty: 1, alert: 1 },
      'Maggi tablette cube': { qty: 2, alert: 2 },
      'Maggi poulet cube': { qty: 2, alert: 2 },
      'Maggi persil cube': { qty: 1, alert: 1 },
      'Maggi oignon cube': { qty: 1, alert: 1 },
      'Maggi La Star sachet 25g': { qty: 0, alert: 1 }, // Rupture !
      'Maggi tablette en poudre 125g': { qty: 0, alert: 1 },
    };

    for (const p of productList) {
      const cfg = vrsIbrahimStockTargets[p.def.name] || { qty: 0, alert: 1 };
      vrsStockInsert.run(vrsIbrahimId, dknId, p.id, cfg.qty, cfg.alert);
      if (cfg.qty > 0) {
        mvtInsert.run(
          `INIT-VRS-IBRA-${p.id}`, 'TRANSFER', 'DROP_POINT', dknId, 'VRS', vrsIbrahimId,
          dknId, p.id, cfg.qty, cfg.qty + 5, cfg.qty, `Dotation véhicule Ibrahim Sangaré (${p.def.name})`,
          saDknId, '2026-10-09 07:30:00'
        );
      }
    }

    const vrsBakaryStockTargets: Record<string, { qty: number; alert: number }> = {
      'Nido Sachet': { qty: 4, alert: 2 },
      'Nido boîte 400g': { qty: 2, alert: 1 },
      'Nido boîte 800g': { qty: 1, alert: 1 },
      'Nido boîte 2500g': { qty: 1, alert: 1 },
      'Cerelac boîte': { qty: 2, alert: 1 },
      'Cerelac sachet': { qty: 1, alert: 1 },
      'Cerelac carton 150g': { qty: 1, alert: 1 },
      'Nescafé boîte 50g': { qty: 2, alert: 2 },
      'Nescafé boîte 200g': { qty: 1, alert: 1 },
      'Nescafé sachet 5g': { qty: 2, alert: 1 },
      'Maggi tablette cube': { qty: 3, alert: 2 },
      'Maggi poulet cube': { qty: 3, alert: 2 },
      'Maggi persil cube': { qty: 2, alert: 1 },
      'Maggi oignon cube': { qty: 2, alert: 1 },
      'Maggi La Star sachet 25g': { qty: 1, alert: 1 },
      'Maggi tablette en poudre 125g': { qty: 1, alert: 1 },
    };

    for (const p of productList) {
      const cfg = vrsBakaryStockTargets[p.def.name] || { qty: 1, alert: 1 };
      vrsStockInsert.run(vrsBkoId, bkoId, p.id, cfg.qty, cfg.alert);
      if (cfg.qty > 0) {
        mvtInsert.run(
          `INIT-VRS-BKO-${p.id}`, 'TRANSFER', 'DROP_POINT', bkoId, 'VRS', vrsBkoId,
          bkoId, p.id, cfg.qty, cfg.qty + 5, cfg.qty, `Dotation véhicule Bakary Coulibaly (${p.def.name})`,
          saBkoId, '2026-10-09 08:00:00'
        );
      }
    }

    // 8. VENTES : sur les 6 derniers mois (environ 60 à 120 cartons/mois pour Ibrahim, total national ~3 fois celui d'Ibrahim)
    // Mix réaliste: Maggi et Nido élevés, Nescafé et Cerelac plus faibles.
    const saleInsert = db.prepare(`
      INSERT INTO sales (
        sale_number, vrs_id, drop_point_id, point_of_sale_id, total_amount, discount,
        notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, 'COMPLETED', ?, ?)
    `);

    const saleItemInsert = db.prepare(`
      INSERT INTO sale_items (
        sale_id, product_id, quantity_cartons, unit_price, total_price, stock_before, stock_after
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Helper to get product by ref
    const getP = (ref: string) => productList.find(p => p.ref === ref)!;

    let saleSeq = 1000;

    const recordSale = (
      posPubId: string,
      sellerId: number,
      targetDp: number,
      dateTimeStr: string,
      items: Array<{ ref: string; qty: number }>,
      note: string
    ) => {
      saleSeq++;
      const posId = posMap.get(posPubId)!;
      let totalSaleAmount = 0;

      const lines = items.map(it => {
        const prod = getP(it.ref);
        const lineTotal = it.qty * prod.def.pdvPrice;
        totalSaleAmount += lineTotal;
        return { prod, qty: it.qty, lineTotal };
      });

      const saleNumber = `VNT-2026-${String(saleSeq).padStart(5, '0')}`;
      const res = saleInsert.run(saleNumber, sellerId, targetDp, posId, totalSaleAmount, note, dateTimeStr, dateTimeStr);
      const saleId = Number(res.lastInsertRowid);

      for (const line of lines) {
        saleItemInsert.run(saleId, line.prod.id, line.qty, line.prod.def.pdvPrice, line.lineTotal, line.qty + 10, 10);
        mvtInsert.run(
          `MVT-${saleNumber}-${line.prod.id}`, 'SALE', 'VRS', sellerId, 'POS', posId,
          targetDp, line.prod.id, -line.qty, line.qty + 10, 10,
          `Vente #${saleNumber} au PDV (${line.qty} ctn ${line.prod.def.name})`,
          sellerId, dateTimeStr
        );
      }
    };

    // Realistic monthly schedule:
    // M-5 (May 2026): Ibrahim = 78 ctn, National = 234 ctn
    // M-4 (Jun 2026): Ibrahim = 88 ctn, National = 265 ctn
    // M-3 (Jul 2026): Ibrahim = 112 ctn (pic rentrée/fêtes), National = 336 ctn
    // M-2 (Aug 2026): Ibrahim = 82 ctn, National = 246 ctn
    // M-1 (Sep 2026): Ibrahim = 96 ctn, National = 288 ctn
    // M-0 (Oct 2026, au 11 octobre): Ibrahim = 33 ctn, National = 99 ctn

    const monthsConfig = [
      { y: 2026, m: '05', ibrahimTarget: 78, days: [3, 8, 12, 17, 21, 26, 29] },
      { y: 2026, m: '06', ibrahimTarget: 88, days: [2, 7, 11, 16, 20, 24, 28] },
      { y: 2026, m: '07', ibrahimTarget: 112, days: [1, 5, 9, 13, 17, 21, 25, 29] },
      { y: 2026, m: '08', ibrahimTarget: 82, days: [3, 7, 12, 16, 21, 25, 29] },
      { y: 2026, m: '09', ibrahimTarget: 96, days: [2, 6, 10, 15, 19, 23, 27, 30] },
      { y: 2026, m: '10', ibrahimTarget: 33, days: [2, 4, 7, 9, 11] }, // October up to today (11th)
    ];

    // Standard product mixes with Maggi & Nido high, Nescafé & Cerelac low
    const mixA = [
      { ref: 'MAG-TABL-100', qty: 3 },
      { ref: 'NID-SACH-100', qty: 2 },
      { ref: 'MAG-POUL-100', qty: 2 },
      { ref: 'NES-B050-24', qty: 1 },
    ]; // 8 cartons
    const mixB = [
      { ref: 'NID-SACH-100', qty: 3 },
      { ref: 'MAG-PERS-100', qty: 2 },
      { ref: 'MAG-OIGN-100', qty: 2 },
      { ref: 'CER-BOIT-24', qty: 1 },
    ]; // 8 cartons
    const mixC = [
      { ref: 'MAG-TABL-100', qty: 4 },
      { ref: 'NID-B400-24', qty: 2 },
      { ref: 'NES-SACH-200', qty: 1 },
      { ref: 'MAG-STAR-150', qty: 1 },
    ]; // 8 cartons
    const mixD = [
      { ref: 'MAG-POUL-100', qty: 3 },
      { ref: 'NID-SACH-100', qty: 3 },
      { ref: 'CER-SACH-48', qty: 1 },
      { ref: 'NES-B200-12', qty: 1 },
    ]; // 8 cartons

    const mixes = [mixA, mixB, mixC, mixD];
    const ibrahimPosKeys = ['PDV-1001', 'PDV-1002', 'PDV-1003', 'PDV-1004', 'PDV-1005', 'PDV-1006'];

    for (const mCfg of monthsConfig) {
      for (let i = 0; i < mCfg.days.length; i++) {
        const day = mCfg.days[i];
        const dayStr = String(day).padStart(2, '0');
        const dtIbra = `${mCfg.y}-${mCfg.m}-${dayStr} 10:${String(15 + (i * 7) % 40).padStart(2, '0')}:00`;
        const dtBko = `${mCfg.y}-${mCfg.m}-${dayStr} 11:${String(20 + (i * 9) % 35).padStart(2, '0')}:00`;
        const dtDkn2 = `${mCfg.y}-${mCfg.m}-${dayStr} 14:${String(10 + (i * 5) % 45).padStart(2, '0')}:00`;

        const curMix = mixes[i % mixes.length];
        const posIbra = ibrahimPosKeys[i % ibrahimPosKeys.length];

        // 1. Ibrahim sale (DKN)
        recordSale(posIbra, vrsIbrahimId, dknId, dtIbra, curMix, `Tournée DAKAN Marché - ${posIbra}`);

        // 2. Secondary DKN sale (to balance DAKAN and make national = ~3x Ibrahim)
        const altMix = mixes[(i + 1) % mixes.length];
        const posAlt = ibrahimPosKeys[(i + 2) % ibrahimPosKeys.length];
        recordSale(posAlt, vrsIbrahimId, dknId, dtDkn2, altMix, `Réassort DAKAN secteur 01 - ${posAlt}`);

        // 3. Bamako (BKO) sale
        const bkoMix = mixes[(i + 2) % mixes.length];
        const posBkoKey = i % 2 === 0 ? 'PDV-1007' : 'PDV-1008';
        recordSale(posBkoKey, vrsBkoId, bkoId, dtBko, bkoMix, `Livraison BKO - ${posBkoKey}`);
      }
    }

    // Explicitly record sales for today (jour J) and 7 days ago (S-1) for real-time dashboard KPIs
    const dateInfo = getBamakoDateInfo();
    const todayDate = dateInfo.today;
    const lastWeekDate = dateInfo.lastWeekDate;

    // Sales today for Ibrahim (DKN)
    recordSale('PDV-1001', vrsIbrahimId, dknId, `${todayDate} 09:30:00`, [
      { ref: 'NID-SACH-100', qty: 2 },
      { ref: 'MAG-TABL-100', qty: 3 },
    ], 'Vente du jour Chez Alima (NIDO & MAGGI)');

    recordSale('PDV-1002', vrsIbrahimId, dknId, `${todayDate} 10:45:00`, [
      { ref: 'MAG-POUL-100', qty: 2 },
      { ref: 'NES-B050-24', qty: 1 },
    ], 'Vente du jour Alimentation Générale Dakan');

    // Sales today for Bakary (BKO)
    recordSale('PDV-1007', vrsBkoId, bkoId, `${todayDate} 10:15:00`, [
      { ref: 'MAG-POUL-100', qty: 3 },
      { ref: 'NES-B050-24', qty: 1 },
    ], 'Vente du jour Bamako Hamdallaye');

    recordSale('PDV-1008', vrsBkoId, bkoId, `${todayDate} 11:20:00`, [
      { ref: 'NID-SACH-100', qty: 2 },
      { ref: 'CER-BOIT-24', qty: 1 },
    ], 'Vente du jour Grand Marché Bamako');

    // Sales S-1 for Ibrahim (DKN)
    recordSale('PDV-1002', vrsIbrahimId, dknId, `${lastWeekDate} 10:15:00`, [
      { ref: 'NID-SACH-100', qty: 2 },
      { ref: 'MAG-TABL-100', qty: 2 },
    ], 'Vente S-1 Alimentation Générale Dakan');

    // Sales S-1 for Bakary (BKO)
    recordSale('PDV-1007', vrsBkoId, bkoId, `${lastWeekDate} 11:00:00`, [
      { ref: 'MAG-TABL-100', qty: 2 },
      { ref: 'NES-B050-24', qty: 1 },
    ], 'Vente S-1 Épicerie Centrale Hamdallaye');

    // 9. PROCESSUS :
    // 9.1 Demandes d'approvisionnement des Drop Points (dp_supply_requests)
    // 1 Demandée, 1 Validée avec facture partiellement payée, 1 Refusée avec motif, et 1 facture Payée
    const dpReqInsert = db.prepare(`
      INSERT INTO dp_supply_requests (
        request_number, drop_point_id, created_by_user_id, status, desired_date,
        comments, rejection_reason, validation_notes, reviewed_by_user_id, reviewed_at,
        total_cartons_requested, total_cartons_approved, total_amount, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const dpReqItemInsert = db.prepare(`
      INSERT INTO dp_supply_request_items (
        request_id, product_id, quantity_requested, quantity_approved, unit_cession_price
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const dpInvoiceInsert = db.prepare(`
      INSERT INTO dp_invoices (
        invoice_number, request_id, drop_point_id, total_amount, paid_amount,
        remaining_amount, payment_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const dpPaymentInsert = db.prepare(`
      INSERT INTO dp_invoice_payments (
        invoice_id, drop_point_id, recorded_by_user_id, amount, payment_date,
        payment_method, reference, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const dpTransferInsert = db.prepare(`
      INSERT INTO dp_transfers (
        transfer_number, request_id, invoice_id, drop_point_id, status,
        shipping_blocked_unpaid, prepared_at, shipped_at, received_at, received_by_user_id,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const prodNidSach = getP('NID-SACH-100');
    const prodMagTabl = getP('MAG-TABL-100');
    const prodNidB400 = getP('NID-B400-24');
    const prodMagPoul = getP('MAG-POUL-100');
    const prodCerBoit = getP('CER-BOIT-24');
    const prodNesB050 = getP('NES-B050-24');

    // Demande 1: Demandée (SA BKO -> SAN)
    const req1Amt = (20 * prodNidSach.def.dpCessionPrice) + (25 * prodMagTabl.def.dpCessionPrice); // 520,000 + 350,000 = 870,000
    const r1 = dpReqInsert.run(
      'CMD-DP-2026-0010', bkoId, saBkoId, 'DEMANDEE', '2026-10-15',
      'Réapprovisionnement prévisionnel pour le dépôt de Bamako - forte rotation NIDO et MAGGI',
      null, null, null, null,
      45, 0, req1Amt, '2026-10-10 14:00:00', '2026-10-10 14:00:00'
    );
    const req1Id = Number(r1.lastInsertRowid);
    dpReqItemInsert.run(req1Id, prodNidSach.id, 20, 0, prodNidSach.def.dpCessionPrice);
    dpReqItemInsert.run(req1Id, prodMagTabl.id, 25, 0, prodMagTabl.def.dpCessionPrice);

    // Demande 2: Validée avec Facture Partiellement Payée (SA DKN -> SAN)
    const req2Amt = (15 * prodNidB400.def.dpCessionPrice) + (20 * prodMagPoul.def.dpCessionPrice); // 570,000 + 310,000 = 880,000
    const r2 = dpReqInsert.run(
      'CMD-DP-2026-0008', dknId, saDknId, 'VALIDEE', '2026-10-12',
      'Commande réassort DAKAN quinzaine en cours',
      null, 'Validée intégralement par la Direction Nationale. Préparation logistique prioritaire.',
      sanId, '2026-10-09 10:00:00',
      35, 35, req2Amt, '2026-10-08 09:30:00', '2026-10-09 10:00:00'
    );
    const req2Id = Number(r2.lastInsertRowid);
    dpReqItemInsert.run(req2Id, prodNidB400.id, 15, 15, prodNidB400.def.dpCessionPrice);
    dpReqItemInsert.run(req2Id, prodMagPoul.id, 20, 20, prodMagPoul.def.dpCessionPrice);

    const paid2 = 440000; // 50%
    const rem2 = req2Amt - paid2;
    const inv2 = dpInvoiceInsert.run(
      'FAC-2026-0112', req2Id, dknId, req2Amt, paid2, rem2, 'PARTIELLEMENT_PAYE',
      '2026-10-09 10:05:00', '2026-10-09 14:30:00'
    );
    const inv2Id = Number(inv2.lastInsertRowid);

    dpPaymentInsert.run(
      inv2Id, dknId, saDknId, paid2, '2026-10-09 14:30:00',
      'VIREMENT', 'VIR-BDM-77402', 'Acompte de 50% par virement bancaire BDM-SA', '2026-10-09 14:30:00'
    );

    dpTransferInsert.run(
      'TRF-2026-0055', req2Id, inv2Id, dknId, 'EN_TRANSIT', 0,
      '2026-10-09 11:00:00', '2026-10-10 08:00:00', null, null,
      'En cours d acheminement camion 6C-02 vers DAKAN', '2026-10-09 11:00:00', '2026-10-10 08:00:00'
    );

    // Demande 3: Refusée avec motif (SA BKO -> SAN)
    const req3Amt = (30 * prodCerBoit.def.dpCessionPrice) + (20 * prodNesB050.def.dpCessionPrice); // 930,000 + 540,000 = 1,470,000
    const r3 = dpReqInsert.run(
      'CMD-DP-2026-0009', bkoId, saBkoId, 'REFUSEE', '2026-10-14',
      'Demande de stock additionnel gamme Cerelac et Nescafé',
      'Capacité de stockage physique du dépôt Bamako saturée pour cette quinzaine. Veuillez fractionner la demande à 20 cartons maximum.',
      null, sanId, '2026-10-08 16:30:00',
      50, 0, req3Amt, '2026-10-07 11:00:00', '2026-10-08 16:30:00'
    );
    const req3Id = Number(r3.lastInsertRowid);
    dpReqItemInsert.run(req3Id, prodCerBoit.id, 30, 0, prodCerBoit.def.dpCessionPrice);
    dpReqItemInsert.run(req3Id, prodNesB050.id, 20, 0, prodNesB050.def.dpCessionPrice);

    // Facture 4: Facture Payée (SA DKN -> SAN)
    const req4Amt = (15 * prodNidSach.def.dpCessionPrice) + (15 * prodMagTabl.def.dpCessionPrice); // 390,000 + 210,000 = 600,000
    const r4 = dpReqInsert.run(
      'CMD-DP-2026-0005', dknId, saDknId, 'VALIDEE', '2026-09-28',
      'Commande de renouvellement de stock DAKAN fin septembre',
      null, 'Validée sans modification par SAN.', sanId, '2026-09-26 15:00:00',
      30, 30, req4Amt, '2026-09-25 14:00:00', '2026-09-26 15:00:00'
    );
    const req4Id = Number(r4.lastInsertRowid);
    dpReqItemInsert.run(req4Id, prodNidSach.id, 15, 15, prodNidSach.def.dpCessionPrice);
    dpReqItemInsert.run(req4Id, prodMagTabl.id, 15, 15, prodMagTabl.def.dpCessionPrice);

    const inv4 = dpInvoiceInsert.run(
      'FAC-2026-0100', req4Id, dknId, req4Amt, req4Amt, 0, 'PAYE',
      '2026-09-26 15:30:00', '2026-09-28 11:00:00'
    );
    const inv4Id = Number(inv4.lastInsertRowid);

    dpPaymentInsert.run(
      inv4Id, dknId, saDknId, 300000, '2026-09-27 10:00:00',
      'VIREMENT', 'VIR-BDM-66100', 'Premier versement virement BDM', '2026-09-27 10:00:00'
    );
    dpPaymentInsert.run(
      inv4Id, dknId, saDknId, 300000, '2026-09-28 11:00:00',
      'MOBILE_MONEY', 'OM-ML-99201', 'Solde Orange Money Dépôt DAKAN', '2026-09-28 11:00:00'
    );

    dpTransferInsert.run(
      'TRF-2026-0048', req4Id, inv4Id, dknId, 'RECU', 0,
      '2026-09-27 08:00:00', '2026-09-28 09:00:00', '2026-09-29 14:00:00', saDknId,
      'Réception conforme 30 cartons vérifiée sans avarie', '2026-09-27 08:00:00', '2026-09-29 14:00:00'
    );

    // 9.2 Demandes de chargement VRS (supply_requests)
    // Demandée, Validée, Chargée, Rejetée avec motif + Factures VRS (Payée, Partiellement payée, À payer) + paiement "En attente de confirmation"
    const vrsReqInsert = db.prepare(`
      INSERT INTO supply_requests (
        request_number, vrs_id, drop_point_id, requester_role, status, total_cartons,
        notes, desired_loading_date, rejection_reason, bl_number, processed_by_user_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'VRS', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const vrsReqItemInsert = db.prepare(`
      INSERT INTO supply_request_items (
        request_id, product_id, quantity_requested, quantity_approved
      ) VALUES (?, ?, ?, ?)
    `);

    const vrsInvInsert = db.prepare(`
      INSERT INTO vrs_invoices (
        invoice_number, request_id, vrs_id, drop_point_id, total_amount, paid_amount,
        remaining_amount, payment_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const vrsPayInsert = db.prepare(`
      INSERT INTO vrs_invoice_payments (
        invoice_id, vrs_id, drop_point_id, amount, payment_date, payment_method,
        reference, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // VRS 1: Demandée (Ibrahim Sangaré, facture VRS À payer)
    // 4 ctn Nido Sachet (27,000) + 4 ctn Maggi Tablette (14,700) = 108,000 + 58,800 = 166,800 FCFA
    const vrsReq1Amt = (4 * prodNidSach.def.vrsCessionPrice) + (4 * prodMagTabl.def.vrsCessionPrice);
    const vr1 = vrsReqInsert.run(
      'CHG-2026-0004', vrsIbrahimId, dknId, 'DEMANDEE', 8,
      'Dotation prévisionnelle tournée Secteur 01 - Facture VRS FAC-VRS-004 à payer',
      '2026-10-12', null, null, null, '2026-10-11 08:30:00', '2026-10-11 08:30:00'
    );
    const vr1Id = Number(vr1.lastInsertRowid);
    vrsReqItemInsert.run(vr1Id, prodNidSach.id, 4, null);
    vrsReqItemInsert.run(vr1Id, prodMagTabl.id, 4, null);

    vrsInvInsert.run(
      'FAC-VRS-004', vr1Id, vrsIbrahimId, dknId, vrsReq1Amt, 0, vrsReq1Amt, 'A_PAYER',
      '2026-10-11 08:35:00', '2026-10-11 08:35:00'
    );

    // VRS 2: Validée (Ibrahim Sangaré, facture VRS Partiellement payée avec paiement en attente de confirmation)
    // 2 ctn Nido boîte 400g (39,500) + 4 ctn Maggi Poulet (16,300) = 79,000 + 65,200 = 144,200 FCFA
    const vrsReq2Amt = (2 * prodNidB400.def.vrsCessionPrice) + (4 * prodMagPoul.def.vrsCessionPrice);
    const vr2 = vrsReqInsert.run(
      'CHG-2026-0003', vrsIbrahimId, dknId, 'APPROUVÉE', 6,
      'Validée par le Sales Admin - Facture VRS FAC-VRS-003 partiellement réglée (paiement en attente de confirmation)',
      '2026-10-11', null, 'BL-VRS-2026-03', saDknId, '2026-10-10 09:15:00', '2026-10-10 16:00:00'
    );
    const vr2Id = Number(vr2.lastInsertRowid);
    vrsReqItemInsert.run(vr2Id, prodNidB400.id, 2, 2);
    vrsReqItemInsert.run(vr2Id, prodMagPoul.id, 4, 4);

    const paidVr2 = 70000;
    const remVr2 = vrsReq2Amt - paidVr2;
    const invVr2 = vrsInvInsert.run(
      'FAC-VRS-003', vr2Id, vrsIbrahimId, dknId, vrsReq2Amt, paidVr2, remVr2, 'PARTIELLEMENT_PAYE',
      '2026-10-10 16:05:00', '2026-10-10 17:00:00'
    );
    const invVr2Id = Number(invVr2.lastInsertRowid);

    vrsPayInsert.run(
      invVr2Id, vrsIbrahimId, dknId, paidVr2, '2026-10-10 17:00:00',
      'MOBILE_MONEY', 'OM-VRS-44210', 'En attente de confirmation', 'EN_ATTENTE_CONFIRMATION', '2026-10-10 17:00:00'
    );

    // VRS 3: Chargée (Ibrahim Sangaré, facture VRS Payée)
    // 5 ctn Nido Sachet (27,000) + 5 ctn Maggi Tablette (14,700) = 135,000 + 73,500 = 208,500 FCFA
    const vrsReq3Amt = (5 * prodNidSach.def.vrsCessionPrice) + (5 * prodMagTabl.def.vrsCessionPrice);
    const vr3 = vrsReqInsert.run(
      'CHG-2026-0001', vrsIbrahimId, dknId, 'RÉCEPTIONNÉE', 10,
      'Marchandise chargée et réceptionnée dans le véhicule. Facture VRS FAC-VRS-001 Payée.',
      '2026-10-09', null, 'BL-VRS-2026-01', saDknId, '2026-10-08 14:00:00', '2026-10-09 08:30:00'
    );
    const vr3Id = Number(vr3.lastInsertRowid);
    vrsReqItemInsert.run(vr3Id, prodNidSach.id, 5, 5);
    vrsReqItemInsert.run(vr3Id, prodMagTabl.id, 5, 5);

    const invVr3 = vrsInvInsert.run(
      'FAC-VRS-001', vr3Id, vrsIbrahimId, dknId, vrsReq3Amt, vrsReq3Amt, 0, 'PAYE',
      '2026-10-08 17:00:00', '2026-10-09 08:30:00'
    );
    const invVr3Id = Number(invVr3.lastInsertRowid);

    vrsPayInsert.run(
      invVr3Id, vrsIbrahimId, dknId, vrsReq3Amt, '2026-10-09 08:20:00',
      'ESPECES', 'RECU-ESP-0089', 'Règlement intégral en espèces au comptoir DAKAN', 'CONFIRME', '2026-10-09 08:20:00'
    );

    // VRS 4: Rejetée avec motif (Ibrahim Sangaré)
    const vr4 = vrsReqInsert.run(
      'CHG-2026-0002', vrsIbrahimId, dknId, 'REJETÉE', 12,
      'Demande de stock volumineux pour week-end',
      '2026-10-09',
      'Dépassement du plafond d encours de crédit autorisé pour le secteur. Veuillez régulariser les créances clients avant tout nouveau chargement.',
      null, saDknId, '2026-10-09 09:00:00', '2026-10-09 11:30:00'
    );
    const vr4Id = Number(vr4.lastInsertRowid);
    vrsReqItemInsert.run(vr4Id, getP('NID-B800-12').id, 6, 0);
    vrsReqItemInsert.run(vr4Id, getP('NES-B200-12').id, 6, 0);

    // 9.3 Demandes de création de PDV (pos_creation_requests)
    // 1 En attente, 1 Validée, 1 Refusée avec motif
    const posReqInsert = db.prepare(`
      INSERT INTO pos_creation_requests (
        request_number, name, owner_name, phone, store_type, neighborhood, address,
        latitude, longitude, photo, vrs_id, drop_point_id, sector_id, status,
        rejection_reason, fss_note, fss_reviewed_by, fss_reviewed_at,
        reviewed_by_user_id, reviewed_at, created_pos_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. En attente (VRS Ibrahim Sangaré)
    posReqInsert.run(
      'REQ-PDV-2026-001', 'Boutique Le Progrès Dakan', 'Kassoum Dembélé', '+223 76 99 88 77',
      'Alimentation Générale', 'Dakan Est', 'Rue 18 Porte 42, Près de l école fondamentale',
      12.6415, -8.0018,
      'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
      vrsIbrahimId, dknId, secDkn, 'EN_ATTENTE',
      null,
      'Point de vente idéalement placé en sortie d école avec fort débit piéton. Solvabilité confirmée par le FSS.',
      fssDknId, '2026-10-10 14:00:00',
      null, null, null,
      '2026-10-09 11:20:00', '2026-10-10 14:00:00'
    );

    // 2. Validée (VRS Bakary Coulibaly -> Épicerie Centrale Hamdallaye)
    const pos7Id = posMap.get('PDV-1007')!;
    posReqInsert.run(
      'REQ-PDV-2026-002', 'Épicerie Centrale Hamdallaye', 'Fatoumata Coulibaly', '+223 77 222 33 44',
      'Supérette & Demi-Grossiste', 'Hamdallaye ACI 2000', 'Avenue de l OUA, ACI 2000',
      12.6320, -8.0210,
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
      vrsBkoId, bkoId, secBko, 'VALIDEE',
      null,
      'Emplacement stratégique validé par le FSS avec forte affluence.',
      fssDknId, '2026-10-06 09:30:00',
      sanId, '2026-10-07 10:15:00', pos7Id,
      '2026-10-05 16:45:00', '2026-10-07 10:15:00'
    );

    // 3. Refusée avec motif obligatoire (VRS Ibrahim Sangaré)
    posReqInsert.run(
      'REQ-PDV-2026-003', 'Kiosque Sans Papier', 'Moussa Keïta', '+223 66 11 00 22',
      'Kiosque de rue éphémère', 'Dakan Nord', 'Carrefour Rue 14 face Boutique Chez Alima',
      12.6412, -8.0016,
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=500&auto=format&fit=crop&q=80',
      vrsIbrahimId, dknId, secDkn, 'REFUSEE',
      'Zone commerciale non couverte par l accord d implantation et risque de cannibalisation direct à moins de 25 mètres de la Boutique Chez Alima.',
      'Avis défavorable : concurrence frontale avec un client historique fidèle.',
      fssDknId, '2026-10-08 11:00:00',
      sanId, '2026-10-08 17:30:00', null,
      '2026-10-07 14:15:00', '2026-10-08 17:30:00'
    );

    // 9.4 Notifications (3 à 5 par rôle : SAN, Sales Admin, FSS, VRS)
    const notifInsert = db.prepare(`
      INSERT INTO notifications (user_id, role, drop_point_id, title, message, type, is_read, link, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // SAN (4 notifs)
    notifInsert.run(
      sanId, 'SALES_ADMIN_NATIONAL', null,
      'Rapport national consolidé disponible',
      'Les performances de clôture des 2 Drop Points (DKN & BKO) ont été compilées. 8 PDVs audités avec succès.',
      'SYSTEM', 0, 'dashboard', '2026-10-11 08:30:00'
    );
    notifInsert.run(
      sanId, 'SALES_ADMIN_NATIONAL', null,
      'Validation stock national Nestlé',
      'Livraison 6C Distribution BL-NESTLE-8841 réceptionnée et vérifiée pour le Drop Point DAKAN (138 cartons).',
      'RECEIPT', 0, 'reports', '2026-10-10 16:15:00'
    );
    notifInsert.run(
      sanId, 'SALES_ADMIN_NATIONAL', null,
      'Seuil de sécurité Drop Point Bamako',
      'La couverture de stock du Drop Point BAMAKO est sécurisée à 22 jours. Risque de rupture maîtrisé.',
      'STOCK_ALERT', 0, 'drop-points', '2026-10-09 15:40:00'
    );
    notifInsert.run(
      sanId, 'SALES_ADMIN_NATIONAL', null,
      'Nouveau PDV en attente d arbitrage',
      'Le FSS Oumar Coulibaly a pré-validé la demande REQ-PDV-2026-001 (Boutique Le Progrès Dakan). DécISION requise.',
      'PDV', 1, 'pos-requests', '2026-10-09 11:25:00'
    );

    // SALES ADMIN DAKAN (4 notifs)
    notifInsert.run(
      saDknId, 'SALES_ADMIN', dknId,
      'Demande de chargement VRS reçue',
      'Le vendeur Ibrahim Sangaré a transmis la demande de chargement CHG-2026-0004 (8 cartons Nestlé). À valider.',
      'SUPPLY', 0, 'supply-requests', '2026-10-11 08:35:00'
    );
    notifInsert.run(
      saDknId, 'SALES_ADMIN', dknId,
      'Clôture de caisse validée',
      'La session de vente secteur Dakan Marché a été clôturée avec succès. Espèces encaissées certifiées.',
      'SALE', 0, 'sales', '2026-10-10 18:00:00'
    );
    notifInsert.run(
      saDknId, 'SALES_ADMIN', dknId,
      'Alerte stock Dépôt DAKAN',
      'Stock bas détecté sur Nido boîte 2500g et Cerelac sachet. Réapprovisionnement auprès de 6C Distribution conseillé.',
      'STOCK_ALERT', 1, 'stock', '2026-10-10 12:30:00'
    );
    notifInsert.run(
      saDknId, 'SALES_ADMIN', dknId,
      'Bon de livraison Nestlé enregistré',
      'BL N° BL-NESTLE-8841 enregistré. Les stocks du dépôt DAKAN ont été incrémentés.',
      'RECEIPT', 1, 'receipts', '2026-10-08 14:10:00'
    );

    // FSS DAKAN (4 notifs)
    notifInsert.run(
      fssDknId, 'FSS', dknId,
      'Visite terrain effectuée par VRS',
      'Ibrahim Sangaré a clôturé sa visite au PDV Boutique Chez Alima avec relevé de linéaire et inventaire sur place.',
      'VISIT', 0, 'visits', '2026-10-11 11:45:00'
    );
    notifInsert.run(
      fssDknId, 'FSS', dknId,
      'Point de vente en attente d avis',
      'Nouvelle demande REQ-PDV-2026-001 (Boutique Le Progrès Dakan) soumise sur votre secteur.',
      'PDV', 0, 'pos-requests', '2026-10-10 09:15:00'
    );
    notifInsert.run(
      fssDknId, 'FSS', dknId,
      'Suivi de tournée : Objectif à 85%',
      'L équipe de vente Dakan a réalisé 18 visites sur 22 programmées pour la matinée.',
      'TOUR', 0, 'tours', '2026-10-09 17:20:00'
    );
    notifInsert.run(
      fssDknId, 'FSS', dknId,
      'Performance commerciale hebdomadaire',
      'Le secteur Dakan Marché a dépassé son objectif de chiffre d affaires hebdomadaire de +12%.',
      'SYSTEM', 1, 'stats', '2026-10-08 12:00:00'
    );

    // VRS Ibrahim Sangaré (4 notifs)
    notifInsert.run(
      vrsIbrahimId, 'VRS', dknId,
      'Plan de tournée activé',
      'Votre tournée commerciale du jour "Tournée DAKAN Marché" compte 6 points de vente à visiter.',
      'TOUR', 0, 'visits', '2026-10-11 08:00:00'
    );
    notifInsert.run(
      vrsIbrahimId, 'VRS', dknId,
      'Chargement validé prêt pour retrait',
      'Votre chargement CHG-2026-0003 (6 cartons) a été validé au comptoir du Drop Point DAKAN.',
      'SUPPLY', 0, 'my-stock', '2026-10-10 16:05:00'
    );
    notifInsert.run(
      vrsIbrahimId, 'VRS', dknId,
      'Objectif de vente journalier atteint',
      'Félicitations Ibrahim ! Vous avez franchi la barre des 150 000 FCFA de ventes aujourd hui.',
      'SALE', 0, 'sales', '2026-10-09 17:15:00'
    );
    notifInsert.run(
      vrsIbrahimId, 'VRS', dknId,
      'Alerte stock véhicule',
      'Rupture de stock sur Nido boîte 2500g et Cerelac sachet dans votre dotation véhicule.',
      'STOCK_ALERT', 1, 'my-stock', '2026-10-08 15:45:00'
    );

    // Tour plan for Ibrahim (Active)
    db.prepare(`
      INSERT INTO tour_plans (
        name, day_of_week, drop_point_id, neighborhood, sector_id, vrs_id,
        status, notes, target_visits_count, reviewed_at, reviewed_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIF', ?, ?, ?, ?, ?)
    `).run(
      'Tournée DAKAN Marché', 'Lundi', dknId, 'Dakan Nord', secDkn, vrsIbrahimId,
      'Tournée commerciale principale des 6 PDVs du Secteur 01', 6,
      '2026-10-10 18:00:00', saDknId, '2026-10-10 17:30:00'
    );

    // Stock Receipt (BL Nestlé)
    const rcptRes = db.prepare(`
      INSERT INTO stock_receipts (
        receipt_number, delivery_note_number, drop_point_id, supplier,
        receipt_date, observations, attachment_url, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'RCPT-2026-001', 'BL-NESTLE-8841', dknId, 'Nestlé Mali Distribution',
      '2026-10-08', 'Livraison fournisseur conforme aux spécifications Nestlé.',
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400', saDknId
    );
    const rcptId = Number(rcptRes.lastInsertRowid);
    db.prepare(`
      INSERT INTO stock_receipt_items (receipt_id, product_id, quantity_cartons)
      VALUES (?, ?, ?), (?, ?, ?)
    `).run(rcptId, prodNidSach.id, 50, rcptId, prodMagTabl.id, 50);

    // Initial log
    db.prepare(`
      INSERT INTO activity_logs (user_id, user_public_id, action, resource, details, ip_address)
      VALUES (?, '6CDISTSAN', 'RESET_DEMO_DATA', 'DATABASE', 'Réinitialisation complète du jeu de données démo Nestlé.', '127.0.0.1')
    `).run(sanId);
  });

  runSeed();
  db.pragma('foreign_keys = ON');
  console.log('[NESTLE-SEED] Clean reset completed successfully with 16 Nestlé products, 8 PDVs, and coherent sales/stocks.');
}
