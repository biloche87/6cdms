import React from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  RefreshCw,
  Trash2,
  X,
  CheckCircle2,
  HardDrive,
  ShoppingBag,
  Package,
  Compass,
  MapPin,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useOfflineCache } from '../../hooks/useOfflineCache.ts';

interface OfflineStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineStatusModal: React.FC<OfflineStatusModalProps> = ({ isOpen, onClose }) => {
  const {
    isOnline,
    cacheStats,
    isSyncing,
    syncMessage,
    syncCache,
    clearCache,
  } = useOfflineCache();

  if (!isOpen) return null;

  const formatDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return 'Aucune synchronisation';
    return new Date(timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-modal-backdrop">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-content">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${
              isOnline
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400 animate-pulse'
            }`}>
              {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Gestion du Cache Hors-Ligne</span>
                <span className={`text-sm uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                  isOnline
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                }`}>
                  {isOnline ? 'En Ligne' : 'Hors-Ligne'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Service Worker & IndexedDB pour utilisation sur le terrain
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-sm">
          {/* Status highlight alert */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
            isOnline
              ? 'bg-emerald-950/30 border-emerald-600/30 text-emerald-200'
              : 'bg-amber-950/30 border-amber-600/30 text-amber-200'
          }`}>
            {isOnline ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs leading-relaxed">
              <span className="font-bold">
                {isOnline ? 'Mode Connecté' : 'Mode Hors-Ligne Actif'} :
              </span>{' '}
              {isOnline
                ? 'Les données consultées sont automatiquement archivées dans votre IndexedDB locale. Vous pouvez les consulter même sans connexion.'
                : 'Pas de réseau détecté. L\'application utilise les ventes, stocks et tournées conservés dans la mémoire locale de votre appareil.'}
            </div>
          </div>

          {/* Sync notification message if active */}
          {syncMessage && (
            <div className="p-3 bg-blue-950/50 border border-blue-500/40 rounded-xl text-blue-200 text-xs flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{syncMessage}</span>
            </div>
          )}

          {/* Modules cached overview grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-red-400" />
                Données mémorisées localement
              </span>
              <span className="text-sm text-slate-400 font-mono">
                {cacheStats?.totalEntries || 0} requêtes en cache
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex flex-col">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <ShoppingBag className="w-3.5 h-3.5 text-red-400" />
                  <span>Ventes</span>
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {cacheStats?.salesCount ?? 0}
                </div>
                <div className="text-sm text-slate-400 mt-0.5">transactions prêtes</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex flex-col">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>Stocks</span>
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {cacheStats?.stocksCount ?? 0}
                </div>
                <div className="text-sm text-slate-400 mt-0.5">lignes d'inventaire</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex flex-col">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <Compass className="w-3.5 h-3.5 text-blue-400" />
                  <span>Tournées</span>
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {cacheStats?.toursCount ?? 0}
                </div>
                <div className="text-sm text-slate-400 mt-0.5">circuits & arrêts</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex flex-col">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-teal-400" />
                  <span>Points de Vente</span>
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {cacheStats?.posCount ?? 0}
                </div>
                <div className="text-sm text-slate-400 mt-0.5">boutiques & GPS</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex flex-col">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                  <span>Produits</span>
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {cacheStats?.productsCount ?? 0}
                </div>
                <div className="text-sm text-slate-400 mt-0.5">catalogue actif</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex flex-col">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Visites</span>
                </div>
                <div className="text-lg font-black text-white mt-1">
                  {cacheStats?.visitsCount ?? 0}
                </div>
                <div className="text-sm text-slate-400 mt-0.5">rapports de visite</div>
              </div>
            </div>
          </div>

          {/* Last sync info */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between text-sm text-slate-300">
            <span className="text-slate-400">Dernière mise en mémoire :</span>
            <span className="font-mono font-semibold text-white">
              {formatDate(cacheStats?.lastSyncTime)}
            </span>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed">
            💡 <strong>Conseil terrain pour les VRS & FSS :</strong> Avant de partir dans une zone à faible couverture réseau (marchés, sous-préfectures), cliquez sur <em>"Pré-charger pour le terrain"</em> afin de stocker l'intégralité des données à jour.
          </p>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={clearCache}
            className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition flex items-center gap-1.5"
            title="Supprimer les données stockées dans IndexedDB"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vider le cache</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Fermer
            </button>

            <button
              type="button"
              onClick={syncCache}
              disabled={isSyncing || !isOnline}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl transition shadow-lg shadow-red-950/40 flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronisation...' : 'Pré-charger pour le terrain'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
