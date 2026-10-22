import { Router, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth, type AuthRequest, logActivity } from '../auth.ts';
import { resolvedDbPath, db } from '../db.ts';
import {
  performDailyBackup,
  listBackups,
  restoreDatabaseFromFile,
  purgeOldBackups
} from '../backupManager.ts';

const router = Router();

// Middleware ensuring strictly SAN access
function requireSan(req: AuthRequest, res: Response, next: () => void) {
  const user = req.user;
  if (!user || user.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: "Accès réservé exclusivement au Sales Admin National (SAN)." });
  }
  next();
}

/**
 * GET /api/backup/list
 * Returns list of automated daily backups (kept 14 days)
 */
router.get('/list', requireAuth, requireSan, (_req: AuthRequest, res: Response) => {
  purgeOldBackups(14);
  const backups = listBackups();
  res.json({ backups });
});

/**
 * GET /api/backup/export
 * Downloads the active distribution.db file directly
 */
router.get('/export', requireAuth, requireSan, (req: AuthRequest, res: Response) => {
  try {
    if (!fs.existsSync(resolvedDbPath)) {
      return res.status(404).json({ error: "Fichier de base de données introuvable." });
    }

    // Flush WAL to disk first
    try {
      db.pragma('wal_checkpoint(PASSIVE)');
    } catch {}

    const todayStr = new Date().toISOString().slice(0, 10);
    const downloadFilename = `6C_Distribution_Backup_${todayStr}.db`;

    logActivity(req.user!, 'BACKUP_EXPORT', downloadFilename, 'Export complet de la base de données par le SAN', req);

    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    const fileStream = fs.createReadStream(resolvedDbPath);
    fileStream.pipe(res);
  } catch (err: any) {
    console.error('[BACKUP] Erreur export:', err);
    res.status(500).json({ error: err.message || "Erreur lors du téléchargement de la sauvegarde." });
  }
});

/**
 * POST /api/backup/import
 * Imports and restores a backup from base64 data
 */
router.post('/import', requireAuth, requireSan, (req: AuthRequest, res: Response) => {
  const { fileData, fileName } = req.body;

  if (!fileData) {
    return res.status(400).json({ error: "Données de fichier manquantes (format base64 attendu)." });
  }

  const tempDir = path.join(path.dirname(resolvedDbPath), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFilePath = path.join(tempDir, `import-temp-${Date.now()}.db`);

  try {
    // Strip data URL header if present (e.g. data:application/octet-stream;base64,...)
    const base64Content = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const buffer = Buffer.from(base64Content, 'base64');

    if (buffer.length < 512) {
      return res.status(400).json({ error: "Fichier invalide ou trop petit pour être une base SQLite." });
    }

    fs.writeFileSync(tempFilePath, buffer);

    // Perform safe restoration
    const outcome = restoreDatabaseFromFile(tempFilePath);

    if (!outcome.success) {
      return res.status(400).json({ error: outcome.message });
    }

    logActivity(req.user!, 'BACKUP_IMPORT', fileName || 'imported.db', 'Restauration de la base de données depuis une sauvegarde par le SAN', req);

    res.json({
      success: true,
      message: outcome.message,
    });
  } catch (err: any) {
    console.error('[BACKUP] Erreur import:', err);
    res.status(500).json({ error: err.message || "Erreur lors de l'importation de la sauvegarde." });
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    } catch {}
  }
});

/**
 * POST /api/backup/trigger-daily
 * Manually trigger daily backup
 */
router.post('/trigger-daily', requireAuth, requireSan, (_req: AuthRequest, res: Response) => {
  const outcome = performDailyBackup(true);
  res.json(outcome);
});

/**
 * POST /api/backup/restore-file
 * Restore from a selected file in the 14-day backups folder
 */
router.post('/restore-file', requireAuth, requireSan, (req: AuthRequest, res: Response) => {
  const { filename } = req.body;
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: "Nom de fichier requis." });
  }

  const cleanFilename = path.basename(filename);
  const targetPath = path.join(path.dirname(resolvedDbPath), 'backups', cleanFilename);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: "Fichier de sauvegarde introuvable dans le dossier des sauvegardes." });
  }

  const outcome = restoreDatabaseFromFile(targetPath);
  if (!outcome.success) {
    return res.status(400).json({ error: outcome.message });
  }

  logActivity(req.user!, 'BACKUP_RESTORE', cleanFilename, `Restauration de la base depuis l'archive ${cleanFilename}`, req);

  res.json({
    success: true,
    message: outcome.message,
  });
});

export default router;
