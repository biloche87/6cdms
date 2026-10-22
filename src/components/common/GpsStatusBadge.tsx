import React from 'react';
import { useGps } from '../../context/GpsContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export const GpsStatusBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { user } = useAuth();
  const { coords, status, requestRealGps, simulateGpsToggle, initiateVrsAccess } = useGps();

  if (user?.role !== 'VRS') {
    return null;
  }

  const isActive = status === 'ACTIVE' && coords !== null;
  const isRequesting = status === 'REQUESTING';

  return (
    <div className={`inline-flex items-center gap-1 shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (initiateVrsAccess) initiateVrsAccess();
          window.dispatchEvent(new CustomEvent('open-permissions-modal'));
          if (!isActive) {
            requestRealGps();
          }
        }}
        title={
          isActive
            ? `GPS Réel Actif (±${Math.round(coords?.accuracy || 0)}m) - Tournée certifiée en direct`
            : 'Activer le signal GPS réel'
        }
        className={`inline-flex items-center gap-2 px-3 py-2 sm:px-3 sm:py-2 rounded-xl text-sm font-semibold border transition shrink-0 min-h-[44px] cursor-pointer ${
          isActive
            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60 shadow-xs'
            : isRequesting
            ? 'bg-amber-950/60 text-amber-300 border-amber-700/60 animate-pulse'
            : 'bg-red-950/60 text-red-400 border-red-700/60'
        }`}
      >
        {isActive ? (
          <>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">GPS Actif</span>
            <span className="hidden md:inline text-xs text-emerald-300 font-mono">±{Math.round(coords?.accuracy || 0)}m</span>
          </>
        ) : isRequesting ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Satellite...</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="hidden sm:inline font-bold">GPS Requis</span>
          </>
        )}
      </button>

      {/* Simulator test button to test turning physical GPS OFF */}
      {isActive && (
        <button
          type="button"
          onClick={() => simulateGpsToggle(false)}
          title="Tester le verrouillage automatique : simule la désactivation du GPS de l'appareil"
          className="hidden md:inline-flex items-center px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-950/40 border border-slate-800 transition min-h-[36px]"
        >
          Couper GPS
        </button>
      )}
    </div>
  );
};
