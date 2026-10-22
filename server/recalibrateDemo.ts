import type Database from 'better-sqlite3';

/**
 * Recalibrate demo data safe no-op:
 * Data deletion or table clearing is permanently disabled.
 * The Nestlé demo dataset is seeded strictly once upon initial creation.
 */
export function recalibrateDemoData(_db: Database.Database, _triggerMasterBackup?: (immediate?: boolean) => void): void {
  // Safe no-op: persistent data is never altered or deleted automatically.
}
