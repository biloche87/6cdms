import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { ActivityLogItem } from '../../types/index.ts';
import {
  History,
  Search,
  RefreshCw,
  Clock,
  User,
  Shield,
  ShieldCheck,
  Loader2,
  Activity,
  HardDrive,
  Database,
  CheckCircle2,
} from 'lucide-react';

export const ActivityLogsView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [backupStats, setBackupStats] = useState<any>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.getActivityLogs({ limit: 100 });
      setLogs(res.logs);
      const prot = await api.getDataProtectionStatus();
      setBackupStats(prot);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setBackupSuccessMsg(null);
    try {
      const res = await api.triggerImmediateBackup();
      if (res.stats) {
        setBackupStats(res.stats);
      }
      setBackupSuccessMsg('Sauvegarde miroir et snapshot SQLite synchronisés avec succès.');
      setTimeout(() => setBackupSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsBackingUp(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.user_public_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.resource?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionBadge = (action: string) => {
    if (action.includes('SALE')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/50">{action}</span>;
    }
    if (action.includes('RECEIPT') || action.includes('SUPPLY') || action.includes('STOCK')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800/50">{action}</span>;
    }
    if (action.includes('CREATE') || action.includes('USER')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800/50">{action}</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">{action}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <History className="w-7 h-7 text-red-500" />
            <span>Journal d'Activité & Piste d'Audit</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Traçabilité intégrale et immuable de chaque opération (ventes, réceptions BL, approvisionnements, créations).
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Data Protection & Zero-Data-Loss Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Protection des Données & Persistance Active</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60 uppercase">
                  Zéro Perte Garanti
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Transactions ACID strictes avec journalisation WAL, double miroir (snapshot binaire + archive maître JSON) et reprise automatique sans aucune perte de données lors des déploiements.
              </p>
              {backupStats && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium text-slate-300">
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    Base : {backupStats.storage?.databaseFileMb} Mo (WAL : {backupStats.storage?.walFileMb} Mo)
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 font-medium text-slate-300">
                    <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                    Snapshot miroir : {backupStats.storage?.snapshotFileMb} Mo
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium">
                    {backupStats.counts?.users || 0} utilisateurs, {backupStats.counts?.pointsOfSale || 0} PDV, {backupStats.counts?.vrsStockLines || 0} stocks protégés
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={isBackingUp}
              onClick={handleManualBackup}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold border border-slate-700 transition shadow-sm"
            >
              {isBackingUp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Synchronisation...</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span>Sauvegarder Maintenant</span>
                </>
              )}
            </button>
          </div>
        </div>

        {backupSuccessMsg && (
          <div className="mt-3 p-2.5 bg-emerald-950/60 border border-emerald-800/80 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{backupSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrer par action, utilisateur, entité..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Logs View: Mobile Cards & Desktop Table */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-red-500" />
          <span className="text-xs">Chargement du journal d'audit...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
          Aucun événement dans le journal.
        </div>
      ) : (
        <>
          {/* Mobile Cards (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-white font-mono text-xs">
                      {log.user_public_id || 'Système'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{log.created_at}</span>
                    </div>
                  </div>
                  <div>{getActionBadge(log.action)}</div>
                </div>

                {log.resource && (
                  <div className="text-[11px] font-mono text-amber-400 font-semibold bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-lg inline-block">
                    Ressource : {log.resource}
                  </div>
                )}

                <div className="text-xs text-slate-200 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/70 break-words">
                  {log.details}
                </div>

                <div className="text-[10px] font-mono text-slate-500 pt-1 flex items-center justify-between">
                  <span>IP : {log.ip_address || '127.0.0.1'}</span>
                  <span>ID #{log.id}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Date & Heure</th>
                    <th className="p-3.5">Utilisateur (ID)</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Ressource / Entité</th>
                    <th className="p-3.5">Détails de l'opération</th>
                    <th className="p-3.5">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {log.created_at}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-semibold text-white font-mono">{log.user_public_id || 'Système'}</div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-amber-400 font-semibold whitespace-nowrap">
                        {log.resource || '-'}
                      </td>
                      <td className="p-3.5 text-slate-200 max-w-md break-words">
                        {log.details}
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
