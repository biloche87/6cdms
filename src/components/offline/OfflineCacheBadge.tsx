import React from 'react';
import { Database, WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useOfflineCache } from '../../hooks/useOfflineCache.ts';

interface OfflineCacheBadgeProps {
  moduleName?: string;
  className?: string;
}

export const OfflineCacheBadge: React.FC<OfflineCacheBadgeProps> = ({ moduleName, className = '' }) => {
  const { isOnline, cacheStats, isSyncing, syncCache } = useOfflineCache();

  const formattedDate = cacheStats?.lastSyncTime
    ? new Date(cacheStats.lastSyncTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  if (isOnline) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-200 text-sm shadow-xs ${className}`}>
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
      <span className="font-semibold text-sm">
        {moduleName ? `${moduleName} hors-ligne (IndexedDB)` : 'Données hors-ligne (IndexedDB)'}
      </span>
      {formattedDate && (
        <span className="text-sm bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded font-mono border border-amber-600/40">
          Synchro {formattedDate}
        </span>
      )}
    </div>
  );
};
