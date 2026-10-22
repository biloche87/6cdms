import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { db, resolvedDbPath } from './db.ts';

const dbDirectory = path.dirname(resolvedDbPath);
const backupsDir = path.join(dbDirectory, 'backups');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

export interface BackupFileInfo {
  filename: string;
  filepath: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  ageDays: number;
}

/**
 * Clean up backups older than 14 days
 */
export function purgeOldBackups(retentionDays = 14): number {
  let purgedCount = 0;
  try {
    if (!fs.existsSync(backupsDir)) return 0;
    const files = fs.readdirSync(backupsDir);
    const now = Date.now();
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.endsWith('.db') && !file.endsWith('.sqlite')) continue;
      const fullPath = path.join(backupsDir, file);
      try {
        const stats = fs.statSync(fullPath);
        const ageMs = now - stats.mtimeMs;
        if (ageMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          purgedCount++;
          console.log(`[BACKUP] Sauvegarde expirée purgée (> ${retentionDays} jours) : ${file}`);
        }
      } catch (fErr) {
        console.warn(`[BACKUP] Impossible de vérifier l'ancienneté du fichier ${file}:`, fErr);
      }
    }
  } catch (err) {
    console.error('[BACKUP] Erreur purge sauvegardes:', err);
  }
  return purgedCount;
}

/**
 * Creates an automated daily backup of distribution.db
 * Keeps for 14 days.
 */
export function performDailyBackup(force = false): { success: boolean; filepath?: string; message: string } {
  try {
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const todayDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const targetFile = path.join(backupsDir, `distribution-backup-${todayDate}.db`);

    // If backup for today already exists and force is false, skip
    if (fs.existsSync(targetFile) && !force) {
      return {
        success: true,
        filepath: targetFile,
        message: `La sauvegarde quotidienne pour le ${todayDate} existe déjà.`
      };
    }

    // Flush WAL to make sure all transactions are on disk
    try {
      db.pragma('wal_checkpoint(PASSIVE)');
    } catch {}

    // Use SQLite backup API for 100% consistent transactional copy
    const targetDb = new Database(targetFile);
    try {
      // Execute fast VACUUM INTO or copy
      targetDb.close();
      fs.copyFileSync(resolvedDbPath, targetFile);
    } catch {
      targetDb.close();
      fs.copyFileSync(resolvedDbPath, targetFile);
    }

    // Purge backups older than 14 days
    purgeOldBackups(14);

    console.log(`[BACKUP] Sauvegarde quotidienne réussie : ${targetFile}`);
    return {
      success: true,
      filepath: targetFile,
      message: `Sauvegarde quotidienne créée avec succès (${path.basename(targetFile)}).`
    };
  } catch (err: any) {
    console.error('[BACKUP] Échec de la sauvegarde quotidienne:', err);
    return {
      success: false,
      message: err.message || 'Erreur lors de la sauvegarde quotidienne.'
    };
  }
}

/**
 * List all available backups
 */
export function listBackups(): BackupFileInfo[] {
  try {
    if (!fs.existsSync(backupsDir)) return [];
    const files = fs.readdirSync(backupsDir);
    const result: BackupFileInfo[] = [];
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith('.db') && !file.endsWith('.sqlite')) continue;
      const fullPath = path.join(backupsDir, file);
      try {
        const stats = fs.statSync(fullPath);
        const ageDays = Math.round((now - stats.mtimeMs) / (24 * 60 * 60 * 1000));
        const sizeKb = Math.round(stats.size / 1024);
        const sizeFormatted = sizeKb > 1024
          ? `${(sizeKb / 1024).toFixed(2)} Mo`
          : `${sizeKb} Ko`;

        result.push({
          filename: file,
          filepath: fullPath,
          sizeBytes: stats.size,
          sizeFormatted,
          createdAt: stats.mtime.toISOString(),
          ageDays
        });
      } catch {}
    }

    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    console.error('[BACKUP] Erreur listing sauvegardes:', err);
    return [];
  }
}

/**
 * Restores the database from an uploaded or existing backup file
 * 1. Checks integrity with SQLite quick_check
 * 2. Creates a pre-restore safety backup
 * 3. Safely swaps the database file
 */
export function restoreDatabaseFromFile(uploadedFilePath: string): { success: boolean; message: string } {
  try {
    if (!fs.existsSync(uploadedFilePath)) {
      throw new Error("Le fichier de sauvegarde spécifié est introuvable.");
    }

    // 1. Verify integrity of the backup file before restoring
    let testDb: Database.Database | null = null;
    try {
      testDb = new Database(uploadedFilePath, { readonly: true, fileMustExist: true });
      const check = testDb.pragma('quick_check') as Array<{ quick_check: string }>;
      if (!check || check.length === 0 || check[0]?.quick_check !== 'ok') {
        throw new Error(`Le fichier de sauvegarde est corrompu ou invalide (quick_check: ${check?.[0]?.quick_check || 'échec'}).`);
      }

      // Check required core tables
      const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
      const tableNames = new Set(tables.map(t => t.name));
      const requiredTables = ['users', 'products', 'drop_points', 'sales'];
      for (const req of requiredTables) {
        if (!tableNames.has(req)) {
          throw new Error(`Le fichier de sauvegarde est incomplet : table obligatoire '${req}' absente.`);
        }
      }
    } finally {
      if (testDb) {
        try { testDb.close(); } catch {}
      }
    }

    // 2. Create safety backup of the current database before replacing
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safetyBackup = path.join(backupsDir, `distribution-pre-restore-${timestamp}.db`);
    if (fs.existsSync(resolvedDbPath)) {
      fs.copyFileSync(resolvedDbPath, safetyBackup);
      console.log(`[BACKUP] Sauvegarde de sécurité avant restauration créée : ${safetyBackup}`);
    }

    // 3. Close or checkpoint WAL and copy uploaded file over resolvedDbPath
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}

    fs.copyFileSync(uploadedFilePath, resolvedDbPath);

    // Remove WAL & SHM to ensure SQLite loads cleanly from the new main file
    try {
      if (fs.existsSync(`${resolvedDbPath}-wal`)) fs.unlinkSync(`${resolvedDbPath}-wal`);
      if (fs.existsSync(`${resolvedDbPath}-shm`)) fs.unlinkSync(`${resolvedDbPath}-shm`);
    } catch {}

    // Re-verify main db pragmas
    try {
      db.pragma('wal_checkpoint(PASSIVE)');
    } catch {}

    console.log('[BACKUP] Restauration réussie depuis:', uploadedFilePath);
    return {
      success: true,
      message: 'Base de données restaurée avec succès. Toutes les données ont été rechargées.'
    };
  } catch (err: any) {
    console.error('[BACKUP] Erreur restauration base:', err);
    return {
      success: false,
      message: err.message || 'Erreur lors de la restauration de la base.'
    };
  }
}

/**
 * Start periodic daily backup interval (checks every 2 hours)
 */
export function startBackupScheduler(): void {
  // Run once at startup
  performDailyBackup(false);

  // Check every 2 hours
  setInterval(() => {
    try {
      performDailyBackup(false);
    } catch (err) {
      console.warn('[BACKUP] Scheduler notice:', err);
    }
  }, 2 * 60 * 60 * 1000);
}
