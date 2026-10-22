import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

export type StockLevel = 'critique' | 'faible' | 'optimal';

export interface StockStatus {
  level: StockLevel;
  label: string;
  dotColor: string;
  glowClass: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  title: string;
}

export function getStockStatus(available: number, threshold: number): StockStatus {
  const alertThresh = threshold > 0 ? threshold : 10;
  // Seuil critique : 0 carton ou moins de 40% du seuil d'alerte
  const criticalThresh = Math.max(1, Math.floor(alertThresh * 0.4));

  if (available <= 0) {
    return {
      level: 'critique',
      label: 'Rupture',
      dotColor: 'bg-rose-500',
      glowClass: 'animate-pulse ring-2 ring-rose-500/40 shadow-xs shadow-rose-500/50',
      badgeBg: 'bg-rose-950/80',
      badgeText: 'text-rose-300',
      badgeBorder: 'border-rose-800',
      title: 'Stock épuisé (0 carton disponible)',
    };
  }

  if (available <= criticalThresh) {
    return {
      level: 'critique',
      label: 'Critique',
      dotColor: 'bg-rose-500',
      glowClass: 'animate-pulse ring-2 ring-rose-500/40 shadow-xs shadow-rose-500/50',
      badgeBg: 'bg-rose-950/80',
      badgeText: 'text-rose-300',
      badgeBorder: 'border-rose-800',
      title: `Stock critique : ${available} ${available <= 1 ? 'carton' : 'cartons'} (seuil critique : ${criticalThresh} ${criticalThresh <= 1 ? 'carton' : 'cartons'})`,
    };
  }

  if (available <= alertThresh) {
    return {
      level: 'faible',
      label: 'Faible',
      dotColor: 'bg-amber-400',
      glowClass: 'ring-2 ring-amber-400/30 shadow-xs shadow-amber-400/40',
      badgeBg: 'bg-amber-950/80',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-800',
      title: `Stock sous seuil d'alerte : ${available} ${available <= 1 ? 'carton' : 'cartons'} (seuil d'alerte : ${alertThresh} ${alertThresh <= 1 ? 'carton' : 'cartons'})`,
    };
  }

  return {
    level: 'optimal',
    label: 'Optimal',
    dotColor: 'bg-emerald-400',
    glowClass: 'ring-1 ring-emerald-400/30',
    badgeBg: 'bg-emerald-950/80',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-800',
    title: `Stock optimal : ${available} ${available <= 1 ? 'carton' : 'cartons'} (au-delà du seuil de ${alertThresh} ${alertThresh <= 1 ? 'carton' : 'cartons'})`,
  };
}

export const StockDot: React.FC<{
  available: number;
  threshold: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ available, threshold, size = 'md', className = '' }) => {
  const status = getStockStatus(available, threshold);
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }[size];

  return (
    <span
      className={`inline-block rounded-full shrink-0 ${sizeClasses} ${status.dotColor} ${status.glowClass} ${className}`}
      title={`État du stock : ${status.label} (${status.title})`}
      aria-label={`État : ${status.label}`}
    />
  );
};

export const StockStatusBadge: React.FC<{
  available: number;
  threshold: number;
  showIcon?: boolean;
  className?: string;
}> = ({ available, threshold, showIcon = true, className = '' }) => {
  const status = getStockStatus(available, threshold);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${status.badgeBg} ${status.badgeText} ${status.badgeBorder} ${className}`}
      title={status.title}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor} shrink-0`} />
      {showIcon && (
        <>
          {status.level === 'critique' && <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />}
          {status.level === 'faible' && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
          {status.level === 'optimal' && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
        </>
      )}
      <span>{status.label}</span>
    </span>
  );
};
