import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.ts';
import { OfflineCacheStats } from '../services/offlineCache.ts';

export function useOfflineCache() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cacheStats, setCacheStats] = useState<OfflineCacheStats | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastOfflineHit, setLastOfflineHit] = useState<{ endpoint: string; timestamp: number } | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const stats = await api.getOfflineStats();
      setCacheStats(stats);
    } catch (e) {
      console.warn('[useOfflineCache] Failed to load cache stats:', e);
    }
  }, []);

  const syncCache = useCallback(async () => {
    if (!isOnline) {
      setSyncMessage('Connexion requise pour précharger les données du terrain.');
      return;
    }
    setIsSyncing(true);
    setSyncMessage('Synchronisation des ventes, stocks et tournées en cours...');
    try {
      const result = await api.syncOfflineCache();
      setCacheStats(result.stats);
      setSyncMessage(result.message);
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err: any) {
      setSyncMessage(err?.message || 'Erreur lors de la synchronisation.');
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  const clearCache = useCallback(async () => {
    try {
      await api.clearOfflineCache();
      await refreshStats();
      setSyncMessage('Cache local IndexedDB réinitialisé.');
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
    }
  }, [refreshStats]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto refresh stats when coming back online
      refreshStats();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleCacheHit = (event: Event) => {
      const customEvent = event as CustomEvent<{ endpoint: string; timestamp: number }>;
      if (customEvent.detail) {
        setLastOfflineHit(customEvent.detail);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('6c-offline-cache-hit', handleCacheHit);

    refreshStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('6c-offline-cache-hit', handleCacheHit);
    };
  }, [refreshStats]);

  return {
    isOnline,
    cacheStats,
    isSyncing,
    syncMessage,
    lastOfflineHit,
    syncCache,
    clearCache,
    refreshStats,
  };
}
