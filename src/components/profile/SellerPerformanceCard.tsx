import React, { useState, useEffect } from 'react';
import { SellerPerformance } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import {
  Award,
  TrendingUp,
  Store,
  Package,
  CheckCircle2,
  AlertCircle,
  Star,
  DollarSign,
  Compass,
  Sparkles,
  ShieldCheck,
  Target,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';

interface SellerPerformanceCardProps {
  userId?: number | 'me';
  userName?: string;
  initialPerformance?: SellerPerformance | null;
  compact?: boolean;
}

export const SellerPerformanceCard: React.FC<SellerPerformanceCardProps> = ({
  userId = 'me',
  userName,
  initialPerformance = null,
  compact = false,
}) => {
  const [performance, setPerformance] = useState<SellerPerformance | null>(initialPerformance);
  const [isLoading, setIsLoading] = useState<boolean>(!initialPerformance);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getUserPerformance(userId);
      setPerformance(res.performance);
    } catch (err: any) {
      setError(err.message || 'Impossible de calculer les performances du vendeur.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialPerformance) {
      fetchPerformance();
    } else {
      setPerformance(initialPerformance);
    }
  }, [userId, initialPerformance]);

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Calcul des indicateurs de performance et de la note sur 10...</span>
      </div>
    );
  }

  if (error || !performance) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center">
        <p className="text-xs text-slate-400">{error || 'Aucune donnée de performance enregistrée pour le moment.'}</p>
        <button
          type="button"
          onClick={fetchPerformance}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold"
        >
          <RefreshCw className="w-3 h-3" />
          Réessayer
        </button>
      </div>
    );
  }

  const {
    ratingScore,
    ratingAppreciation,
    badgeLabel,
    totalSalesCount,
    totalRevenue,
    totalCartons,
    distinctPosServed,
    averageBasket,
    completedVisits,
    criteria,
    strengths,
    recommendations,
  } = performance;

  // Rating color helper
  const getRatingTheme = (score: number) => {
    if (score >= 9.0) {
      return {
        bg: 'from-emerald-950/80 via-slate-900 to-slate-950',
        border: 'border-emerald-500/40',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        text: 'text-emerald-400',
        bar: 'bg-emerald-500',
        stars: 5,
      };
    }
    if (score >= 8.0) {
      return {
        bg: 'from-blue-950/80 via-slate-900 to-slate-950',
        border: 'border-blue-500/40',
        badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        text: 'text-blue-400',
        bar: 'bg-blue-500',
        stars: 4,
      };
    }
    if (score >= 7.0) {
      return {
        bg: 'from-amber-950/80 via-slate-900 to-slate-950',
        border: 'border-amber-500/40',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        text: 'text-amber-400',
        bar: 'bg-amber-500',
        stars: 3,
      };
    }
    return {
      bg: 'from-slate-900 via-slate-900 to-slate-950',
      border: 'border-slate-700',
      badge: 'bg-slate-700 text-slate-300 border-slate-600',
      text: 'text-slate-300',
      bar: 'bg-slate-500',
      stars: 2,
    };
  };

  const theme = getRatingTheme(ratingScore);

  return (
    <div className="space-y-4">
      {/* 1. Primary Score Banner with 10-Point Rating */}
      <div
        className={`relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-slate-900 border ${theme.border} shadow-lg`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left: Global score out of 10 */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-950/90 border border-slate-700/80 flex flex-col items-center justify-center shadow-inner">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Note</span>
              <div className="flex items-baseline">
                <span className={`text-3xl sm:text-4xl font-black tracking-tight ${theme.text}`}>
                  {ratingScore.toFixed(1)}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-400 ml-0.5">/10</span>
              </div>
              {/* Star rating icons */}
              <div className="flex items-center gap-0.5 mt-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-2.5 h-2.5 ${
                      s <= Math.round(ratingScore / 2)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${theme.badge}`}>
                  {badgeLabel}
                </span>
                <span className="text-xs text-slate-400">
                  {performance.sectorName ? `Secteur : ${performance.sectorName}` : 'Réseau Vente'}
                </span>
              </div>
              <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {ratingAppreciation}
              </h4>
              <p className="text-xs text-slate-300">
                Notation calculée en temps réel selon 4 piliers d’excellence commerciale et logistique.
              </p>
            </div>
          </div>

          {/* Right: Quick action */}
          <div className="self-end sm:self-center flex-shrink-0">
            <button
              type="button"
              onClick={fetchPerformance}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition"
              title="Actualiser les statistiques"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Progress Gauge */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex justify-between text-[11px] text-slate-400 mb-1 font-mono">
            <span>Score Global</span>
            <span className="font-bold text-white">{(ratingScore * 10).toFixed(0)}% d'efficacité</span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-700 ${theme.bar}`}
              style={{ width: `${Math.min(100, ratingScore * 10)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Breakdown of the 4 Evaluation Criteria out of 10 */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            Détail des Piliers de Notation (sur 10)
          </h5>
          <span className="text-[11px] text-slate-400 font-mono">Barème 6C Distribution</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Criterion 1: Volume & Revenue */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Volume & Chiffre d'Affaires
              </span>
              <span className="font-bold text-emerald-400 font-mono">
                {criteria.volumeScore.toFixed(1)} / 10
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${criteria.volumeScore * 10}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>{totalCartons} ctn vendus</span>
              <span>{Number(totalRevenue).toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          {/* Criterion 2: POS Coverage */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-blue-400" />
                Couverture & Pénétration PDV
              </span>
              <span className="font-bold text-blue-400 font-mono">
                {criteria.coverageScore.toFixed(1)} / 10
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${criteria.coverageScore * 10}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>{distinctPosServed} points de vente approvisionnés</span>
              <span>Taux : {performance.posCoveragePercent}%</span>
            </div>
          </div>

          {/* Criterion 3: Regularity & Average Basket */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                Régularité & Panier Moyen
              </span>
              <span className="font-bold text-purple-400 font-mono">
                {criteria.regularityScore.toFixed(1)} / 10
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${criteria.regularityScore * 10}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>{totalSalesCount} ventes enregistrées</span>
              <span>Panier : {Number(averageBasket).toLocaleString('fr-FR')} F</span>
            </div>
          </div>

          {/* Criterion 4: Reliability & Zero Disputes */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                Fiabilité & Conformité Stocks
              </span>
              <span className="font-bold text-teal-400 font-mono">
                {criteria.reliabilityScore.toFixed(1)} / 10
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full"
                style={{ width: `${criteria.reliabilityScore * 10}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>{performance.cancelledSalesCount === 0 ? '0 vente annulée' : `${performance.cancelledSalesCount} annulation`}</span>
              <span>100% traçabilité</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Operational KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-sm text-slate-400">Chiffre d'Affaires</div>
          <div className="text-base sm:text-lg font-black text-white mt-0.5 font-mono">
            {Number(totalRevenue).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-400">FCFA</span>
          </div>
          <div className="text-sm text-emerald-400 font-semibold mt-0.5">Encaissé</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-sm text-slate-400">Cartons Vendus</div>
          <div className="text-base sm:text-lg font-black text-amber-400 mt-0.5 font-mono">
            {totalCartons} <span className="text-sm font-normal text-slate-400">ctn</span>
          </div>
          <div className="text-sm text-slate-400 mt-0.5">Rotation directe</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-sm text-slate-400">PDVs Actifs Livrés</div>
          <div className="text-base sm:text-lg font-black text-blue-400 mt-0.5 font-mono">
            {distinctPosServed} <span className="text-sm font-normal text-slate-400">boutiques</span>
          </div>
          <div className="text-sm text-slate-400 mt-0.5">Portefeuille terrain</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-sm text-slate-400">Panier Moyen</div>
          <div className="text-base sm:text-lg font-black text-purple-400 mt-0.5 font-mono">
            {Number(averageBasket).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-400">FCFA</span>
          </div>
          <div className="text-sm text-slate-400 mt-0.5">Par commande</div>
        </div>
      </div>

      {/* 4. Strengths & Recommendations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Strengths */}
        <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/20 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wide">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Points Forts Constatés
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {strengths.map((str, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommendations to reach 10/10 */}
        <div className="p-3.5 bg-amber-950/30 border border-amber-500/20 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            Conseils pour Atteindre 10/10
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
