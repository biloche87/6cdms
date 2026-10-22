import React, { useState } from 'react';
import { WifiOff, Database, ChevronRight, X } from 'lucide-react';
import { useOfflineCache } from '../../hooks/useOfflineCache.ts';

interface OfflineNoticeBannerProps {
  onOpenModal: () => void;
}

export const OfflineNoticeBanner: React.FC<OfflineNoticeBannerProps> = ({ onOpenModal }) => {
  const { isOnline, cacheStats } = useOfflineCache();
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // If online, don't show the offline alert banner
  if (isOnline || isDismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Avertissement mode hors-ligne"
      className="bg-[#92400E] text-white px-3 py-2 text-xs shadow-md border-b border-[#B45309] select-none animate-in slide-in-from-top-2 duration-300"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
          <div className="w-6 h-6 rounded-md bg-[#B45309] flex items-center justify-center text-white shrink-0">
            <WifiOff className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold truncate text-white">
            Mode Hors-Ligne Actif — Ventes, Stocks et Tournées consultables via le cache local.
          </span>
          {cacheStats && (
            <span className="hidden md:inline-block bg-[#B45309] text-white px-2 py-0.5 rounded text-sm font-mono border border-amber-300/30">
              {cacheStats.salesCount} ventes • {cacheStats.stocksCount} stocks • {cacheStats.toursCount} tournées
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenModal}
            className="px-2.5 py-1 bg-[#B45309] hover:bg-[#78350F] border border-amber-300/40 rounded-lg text-white font-bold text-sm flex items-center gap-1 transition cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-white" />
            <span className="text-white">Détails du cache</span>
            <ChevronRight className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 text-white hover:bg-[#B45309] rounded transition cursor-pointer"
            aria-label="Fermer l'alerte"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
