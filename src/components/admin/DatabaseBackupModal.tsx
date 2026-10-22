import React, { useState, useEffect, useRef } from 'react';
import { api, getStoredToken } from '../../services/api.ts';
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Clock,
  X,
  CheckCircle2,
  Loader2,
  FileText,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

interface DatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BackupItem {
  filename: string;
  filepath: string;
  sizeFormatted: string;
  createdAt: string;
  ageDays: number;
}

export const DatabaseBackupModal: React.FC<DatabaseBackupModalProps> = ({ isOpen, onClose }) => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Reset confirmation state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');

  // Messages
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBackups = async () => {
    setIsLoadingList(true);
    try {
      const res = await api.getBackupList();
      setBackups(res.backups || []);
    } catch (err: any) {
      console.warn('Erreur chargement sauvegardes:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBackups();
      setStatusMessage(null);
      setShowResetConfirm(false);
      setResetInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Export: Download active distribution.db directly
  const handleExportBackup = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const token = getStoredToken();
      const res = await fetch('/api/backup/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erreur lors du téléchargement de la sauvegarde.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const todayStr = new Date().toISOString().slice(0, 10);
      a.download = `6C_Distribution_Backup_${todayStr}.db`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStatusMessage({
        type: 'success',
        text: 'Sauvegarde exportée et téléchargée avec succès sur votre appareil.',
      });
      loadBackups();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || "Échec de l'export de sauvegarde." });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Import: File picker and restore with pre-backup
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
      setStatusMessage({
        type: 'error',
        text: 'Format invalide : veuillez sélectionner un fichier de base de données SQLite (.db ou .sqlite).',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const confirmRestore = window.confirm(
      `Confirmez-vous l'importation de la sauvegarde "${file.name}" ? Une copie de sécurité de la base actuelle sera automatiquement créée avant le remplacement.`
    );
    if (!confirmRestore) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsImporting(true);
    setStatusMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (uploadEvent) => {
        try {
          const base64Data = (uploadEvent.target?.result as string).split(',')[1];
          const res = await api.importBackup(base64Data, file.name);
          setStatusMessage({
            type: 'success',
            text: res.message || 'Base restaurée avec succès ! Rechargement des données...',
          });
          setTimeout(() => {
            window.location.reload();
          }, 1400);
        } catch (subErr: any) {
          setStatusMessage({ type: 'error', text: subErr.message || "Échec de l'importation." });
          setIsImporting(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || "Erreur de lecture du fichier." });
      setIsImporting(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 3. Restore from 14-day history file
  const handleRestoreFromHistory = async (filename: string) => {
    const confirm = window.confirm(
      `Restaurer la base depuis l'archive "${filename}" ? Une sauvegarde de sécurité sera effectuée automatiquement.`
    );
    if (!confirm) return;

    setIsRestoring(filename);
    setStatusMessage(null);
    try {
      const res = await api.restoreBackupFile(filename);
      setStatusMessage({
        type: 'success',
        text: res.message || 'Base restaurée avec succès ! Rechargement...',
      });
      setTimeout(() => {
        window.location.reload();
      }, 1400);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Échec de la restauration.' });
      setIsRestoring(null);
    }
  };

  // 4. Reset Demo Data with mandatory 2-step confirmation ("REINITIALISER")
  const handleExecuteReset = async () => {
    if (resetInput.trim() !== 'REINITIALISER') {
      setStatusMessage({
        type: 'error',
        text: "Confirmation invalide : vous devez saisir exactement le mot 'REINITIALISER' en majuscules.",
      });
      return;
    }

    setIsResetting(true);
    setStatusMessage(null);
    try {
      const res = await api.resetDemoData('REINITIALISER');
      setStatusMessage({
        type: 'success',
        text: res.message || 'Jeu de données de démo réinitialisé avec succès après sauvegarde préalable.',
      });
      setShowResetConfirm(false);
      setResetInput('');
      setTimeout(() => {
        window.location.reload();
      }, 1400);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Erreur lors de la réinitialisation.' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Sauvegardes & Intégrité des Données</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-mono">
                  SAN
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sauvegardes quotidiennes automatiques (14 jours), export et restauration sécurisés.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-800/80 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Primary Action Buttons: Exporter & Importer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Exporter */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-white font-semibold text-sm mb-1">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Exporter une sauvegarde</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Télécharge le fichier SQLite actif complet (<code className="text-indigo-300">distribution.db</code>) avec l'ensemble des stocks, ventes, PDVs et utilisateurs.
                </p>
              </div>
              <button
                type="button"
                disabled={isExporting}
                onClick={handleExportBackup}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Préparation du fichier...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Télécharger la base (.db)</span>
                  </>
                )}
              </button>
            </div>

            {/* Importer */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-white font-semibold text-sm mb-1">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Importer une sauvegarde</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Restaure la base depuis un fichier <code className="text-indigo-300">.db</code> avec vérification d'intégrité et sauvegarde de sécurité automatique préalable.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".db,.sqlite"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={isImporting}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Vérification et restauration...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Sélectionner un fichier .db</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Automated Daily Backups List (14 Days) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Sauvegardes automatiques quotidiennes (14 jours)
                </h3>
              </div>
              <button
                type="button"
                onClick={loadBackups}
                disabled={isLoadingList}
                className="p-1 text-slate-400 hover:text-white rounded transition"
                title="Actualiser la liste"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoadingList ? (
              <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Chargement de la liste des sauvegardes...</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-500">
                Aucune archive précédente dans le dossier des sauvegardes. La première sauvegarde quotidienne se créera automatiquement.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 max-h-48 overflow-y-auto rounded-lg border border-slate-800/60 bg-slate-900/60">
                {backups.map((b) => (
                  <div key={b.filename} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <HardDrive className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="truncate">
                        <div className="font-mono text-slate-200 truncate">{b.filename}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(b.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • {b.sizeFormatted} • {b.ageDays === 0 ? "Aujourd'hui" : `Il y a ${b.ageDays}j`}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isRestoring === b.filename}
                      onClick={() => handleRestoreFromHistory(b.filename)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition shrink-0 flex items-center gap-1.5"
                    >
                      {isRestoring === b.filename ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Restauration...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3 h-3 text-amber-400" />
                          <span>Restaurer</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reset Demo Data Card (2-step confirmation) */}
          <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs mb-1">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <span>Réinitialiser les données de démo (Mode Démo)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Restaure le catalogue Nestlé officiel. Une sauvegarde automatique est systématiquement effectuée juste avant.
                </p>
              </div>
              {!showResetConfirm && (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white font-bold text-xs transition shrink-0"
                >
                  Réinitialiser...
                </button>
              )}
            </div>

            {showResetConfirm && (
              <div className="p-3.5 bg-slate-950/90 border border-amber-500/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Confirmation de sécurité en deux étapes requise</span>
                </div>
                <p className="text-xs text-slate-300">
                  Pour confirmer la réinitialisation, veuillez saisir exactement le mot <strong className="text-amber-400 font-mono bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800">REINITIALISER</strong> ci-dessous :
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={resetInput}
                    onChange={(e) => setResetInput(e.target.value)}
                    placeholder="Tapez REINITIALISER"
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-amber-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={resetInput.trim() !== 'REINITIALISER' || isResetting}
                      onClick={handleExecuteReset}
                      className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs transition flex items-center gap-1.5"
                    >
                      {isResetting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Réinitialisation...</span>
                        </>
                      ) : (
                        <span>Confirmer</span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isResetting}
                      onClick={() => {
                        setShowResetConfirm(false);
                        setResetInput('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Protection anti-perte active • Rétention 14 jours</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
