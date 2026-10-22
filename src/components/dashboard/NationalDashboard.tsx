import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { apiCache } from '../../services/apiCache.ts';
import { TourPlan } from '../../types/index.ts';
import { MonthlySalesChart } from './MonthlySalesChart.tsx';
import { StockCategoryLevelsChart } from './StockCategoryLevelsChart.tsx';
import { LazyViewportSection } from '../common/LazyViewportSection.tsx';
import { CounterBadge } from '../common/CounterBadge.tsx';
import { formatDateTime } from '../../utils/date.ts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Boxes,
  Store,
  Truck,
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Plus,
  FileCheck2,
  ShoppingCart,
  Users,
  Receipt,
  X,
  RefreshCw,
  Loader2,
  ArrowRightLeft,
  CalendarCheck,
  UserCheck,
  Compass,
  MoreHorizontal,
  Map,
  FileSpreadsheet,
  Database,
  Download,
  Upload,
  Gift,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { DatabaseBackupModal } from '../admin/DatabaseBackupModal.tsx';

interface DashboardProps {
  onNavigate: (view: string) => void;
  onOpenNewSale: () => void;
  onOpenNewReceipt: () => void;
  onOpenNewPos: () => void;
  onOpenNewSupply: () => void;
  onOpenAcceptanceTests: () => void;
}

export const NationalDashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onOpenNewSale,
  onOpenNewReceipt,
  onOpenNewPos,
  onOpenNewSupply,
  onOpenAcceptanceTests,
}) => {
  const {
    user,
    pendingSupplyCount = 0,
    readySupplyCount = 0,
    pendingDpSupplyCount = 0,
    pendingPosRequestsCount = 0,
    giftsBadgeCount = 0,
  } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDp, setSelectedDp] = useState<string>('');
  const [dropPoints, setDropPoints] = useState<any[]>([]);
  const [pendingTourPlans, setPendingTourPlans] = useState<TourPlan[]>([]);
  const [isProcessingTour, setIsProcessingTour] = useState(false);
  const [rejectingTourId, setRejectingTourId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [hasReadyGiftCard, setHasReadyGiftCard] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Check if VRS has an unrevealed gift card ready
  useEffect(() => {
    if (user?.role === 'VRS') {
      api.getMyScratchCard()
        .then((res) => {
          if (res.card && res.card.is_revealed === 0) {
            setHasReadyGiftCard(true);
          } else {
            setHasReadyGiftCard(false);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMoreMenuOpen]);

  const loadData = useCallback(async (isSilent = false, signal?: AbortSignal, forceRefresh = false) => {
    if (!user) return;
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const isSalesAdmin = user.role === 'SALES_ADMIN_NATIONAL' || user.role === 'SALES_ADMIN';

      if (forceRefresh) {
        apiCache.invalidate('dashboard-stats');
      }

      const results = await Promise.allSettled([
        api.getDashboardStats({
          dropPointId: selectedDp ? parseInt(selectedDp, 10) : undefined,
          signal,
          forceRefresh,
        }),
        user.role === 'SALES_ADMIN_NATIONAL' ? api.getDropPoints() : Promise.resolve({ dropPoints: [] }),
        isSalesAdmin ? api.getTourPlans() : Promise.resolve({ tourPlans: [] }),
      ]);

      if (signal?.aborted) return;

      const [statsRes, dpRes, toursRes] = results;

      if (statsRes.status === 'fulfilled') {
        setData(statsRes.value);
      } else if (!signal?.aborted) {
        const isAbort =
          statsRes.reason?.name === 'AbortError' ||
          statsRes.reason?.name === 'CanceledError' ||
          statsRes.reason?.code === 20 ||
          (typeof statsRes.reason?.message === 'string' &&
            (statsRes.reason.message.includes('aborted') ||
             statsRes.reason.message.includes('aborter') ||
             statsRes.reason.message.includes('The user aborted')));

        if (!isAbort) {
          console.warn('Notice chargement stats dashboard:', statsRes.reason);
          // Only show error message if no dashboard data is currently loaded
          setData((current) => {
            if (!current) {
              setError(statsRes.reason?.message || 'Impossible de récupérer les statistiques du tableau de bord.');
            }
            return current;
          });
        }
      }

      if (dpRes.status === 'fulfilled' && dpRes.value?.dropPoints) {
        setDropPoints(dpRes.value.dropPoints);
      }

      if (toursRes.status === 'fulfilled' && toursRes.value?.tourPlans) {
        const pending = (toursRes.value.tourPlans || [])
          .filter((t: TourPlan) => t.status === 'EN_ATTENTE_APPROBATION' || t.status === 'EN_ATTENTE')
          .sort((a: TourPlan, b: TourPlan) => a.id - b.id);
        setPendingTourPlans(pending);
      }
    } catch (err: any) {
      const isAbort =
        err?.name === 'AbortError' ||
        err?.name === 'CanceledError' ||
        err?.code === 20 ||
        signal?.aborted ||
        (typeof err?.message === 'string' &&
          (err.message.includes('aborted') || err.message.includes('aborter') || err.message.includes('The user aborted')));
      if (isAbort) return;
      console.warn('Notice inattendue dashboard:', err);
      setData((current) => {
        if (!current) {
          setError(err?.message || 'Une erreur inattendue est survenue.');
        }
        return current;
      });
    } finally {
      if (!signal?.aborted && !isSilent) {
        setLoading(false);
      }
    }
  }, [user?.id, user?.role, selectedDp]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    // Return on dashboard: always reload fresh KPI data
    loadData(false, controller.signal, true);

    // Listen to real-time sales creation events from anywhere in the application
    const handleSaleRecorded = () => {
      loadData(true, undefined, true);
    };
    window.addEventListener('6c:sale-recorded', handleSaleRecorded);

    // Refresh every 60 seconds strictly when tab is visible
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData(true, undefined, true);
      }
    }, 60000);

    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('6c:sale-recorded', handleSaleRecorded);
    };
  }, [loadData, user?.id, user?.role, selectedDp]);

  const handleApproveProposal = async (tourId: number) => {
    setIsProcessingTour(true);
    try {
      const res = await api.approveTourPlan(tourId);
      setActionMsg(res.message || 'Tournée validée et activée avec succès !');
      await loadData();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la validation.');
    } finally {
      setIsProcessingTour(false);
    }
  };

  const handleRejectProposal = async (tourId: number) => {
    setIsProcessingTour(true);
    try {
      const res = await api.rejectTourPlan(tourId, rejectReason.trim() || undefined);
      setActionMsg(res.message || 'Tournée rejetée.');
      setRejectingTourId(null);
      setRejectReason('');
      await loadData();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du rejet.');
    } finally {
      setIsProcessingTour(false);
    }
  };

  if (!user) return null;

  // Render initial loading skeleton if no data has been loaded yet
  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-5 w-32 bg-slate-800 rounded-full" />
            <div className="h-7 w-64 bg-slate-800 rounded-lg" />
            <div className="h-4 w-96 bg-slate-800/60 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-slate-800 rounded-xl" />
            <div className="h-9 w-28 bg-slate-800 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-slate-800 rounded" />
                <div className="h-7 w-7 bg-slate-800 rounded-lg" />
              </div>
              <div className="h-8 w-36 bg-slate-800 rounded" />
              <div className="h-3 w-28 bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-96 flex flex-col justify-between">
            <div className="h-5 w-48 bg-slate-800 rounded" />
            <div className="flex items-center justify-center text-slate-500 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
              <span>Chargement du graphique des ventes...</span>
            </div>
            <div className="h-8 w-full bg-slate-800/40 rounded" />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-96 flex flex-col justify-between">
            <div className="h-5 w-48 bg-slate-800 rounded" />
            <div className="flex items-center justify-center text-slate-500 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span>Chargement des niveaux de stocks...</span>
            </div>
            <div className="h-8 w-full bg-slate-800/40 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Render error fallback if loading failed and no cached data exists
  if (error && !data) {
    return (
      <div className="p-8 my-6 bg-rose-950/30 border border-rose-800/80 rounded-2xl max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-900/60 border border-rose-700 mx-auto flex items-center justify-center text-rose-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Impossible de charger le tableau de bord</h2>
        <p className="text-xs text-rose-200/80">{error}</p>
        <button
          type="button"
          onClick={() => loadData()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-red-900/30"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Réessayer le chargement</span>
        </button>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const recentSales = data?.recentSales || [];

  const pendingPosCount = kpis.pendingPosRequestsCount ?? pendingPosRequestsCount ?? 0;
  const pendingDpCount = kpis.pendingDpSupplyCount ?? pendingDpSupplyCount ?? 0;
  const pendingSupplyAlerts = data?.alerts?.pendingSupplies ?? pendingSupplyCount ?? 0;

  const getRoleActions = () => {
    switch (user.role) {
      case 'SALES_ADMIN_NATIONAL':
        return {
          primary: {
            label: 'Commandes stock',
            icon: Truck,
            onClick: () => onNavigate('dp-supply-requests'),
            count: pendingDpCount > 0 ? pendingDpCount : null,
            title: 'Commandes stock',
          },
          secondaries: [
            {
              label: 'Demandes PDV',
              icon: Store,
              onClick: () => onNavigate('pos-requests'),
              count: pendingPosCount > 0 ? pendingPosCount : null,
              countColor: 'amber' as const,
              title: 'Demandes PDV',
            },
            {
              label: 'Réception',
              icon: FileCheck2,
              onClick: onOpenNewReceipt,
              title: 'Réception',
            },
            {
              label: 'Affecter un VRS',
              icon: ArrowRightLeft,
              onClick: () => onNavigate('users'),
              title: 'Affecter un VRS',
            },
            {
              label: 'Chargements',
              icon: Truck,
              onClick: () => onNavigate('supply-requests'),
              count: pendingSupplyAlerts > 0 ? pendingSupplyAlerts : null,
              countColor: 'emerald' as const,
              title: 'Chargements',
            },
            {
              label: 'Sauvegardes',
              icon: Database,
              onClick: () => setIsBackupModalOpen(true),
              title: 'Sauvegardes de la base',
            },
          ],
          more: [] as Array<{
            label: string;
            icon: React.ComponentType<{ className?: string }>;
            onClick: () => void;
            title?: string;
          }>,
        };

      case 'SALES_ADMIN':
        return {
          primary: {
            label: 'Chargements VRS',
            icon: Truck,
            onClick: () => onNavigate('supply-requests'),
            count: pendingSupplyAlerts > 0 ? pendingSupplyAlerts : null,
            title: 'Chargements VRS',
          },
          secondaries: [
            {
              label: 'Mes commandes',
              icon: Truck,
              onClick: () => onNavigate('dp-supply-requests'),
              count: pendingDpCount > 0 ? pendingDpCount : null,
              title: 'Mes commandes',
            },
            {
              label: 'Mes factures',
              icon: Receipt,
              onClick: () => onNavigate('dp-invoices'),
              title: 'Mes factures',
            },
            {
              label: 'Stock DP',
              icon: Boxes,
              onClick: () => onNavigate('stocks'),
              title: 'Stock DP',
            },
            {
              label: 'Demandes PDV',
              icon: Store,
              onClick: () => onNavigate('pos-requests'),
              count: pendingPosCount > 0 ? pendingPosCount : null,
              countColor: 'amber' as const,
              title: 'Demandes PDV',
            },
          ],
          more: [],
        };

      case 'FSS':
        return {
          primary: {
            label: 'Visites',
            icon: CalendarCheck,
            onClick: () => onNavigate('visits'),
            title: 'Visites',
          },
          secondaries: [
            {
              label: 'Demandes PDV',
              icon: Store,
              onClick: () => onNavigate('pos-requests'),
              count: pendingPosCount > 0 ? pendingPosCount : null,
              countColor: 'amber' as const,
              title: 'Demandes PDV',
            },
            {
              label: 'Mes VRS',
              icon: UserCheck,
              onClick: () => onNavigate('my-vrs'),
              title: 'Mes VRS',
            },
            {
              label: 'Carte',
              icon: Map,
              onClick: () => onNavigate('map'),
              title: 'Carte',
            },
            {
              label: 'Rapports',
              icon: FileSpreadsheet,
              onClick: () => onNavigate('reports'),
              title: 'Rapports',
            },
          ],
          more: [],
        };

      case 'VRS':
      default:
        return {
          primary: {
            label: 'Nouvelle vente',
            icon: ShoppingCart,
            onClick: onOpenNewSale,
            title: 'Nouvelle vente',
          },
          secondaries: [
            {
              label: 'Mon chargement',
              icon: Truck,
              onClick: onOpenNewSupply,
              count: readySupplyCount > 0 ? readySupplyCount : pendingSupplyCount > 0 ? pendingSupplyCount : null,
              countColor: 'emerald' as const,
              title: 'Mon chargement',
            },
            {
              label: 'Nouveau PDV',
              icon: Store,
              onClick: onOpenNewPos,
              title: 'Nouveau PDV',
            },
            {
              label: 'Mon stock',
              icon: Boxes,
              onClick: () => onNavigate('my-stock'),
              title: 'Mon stock',
            },
            {
              label: 'Ma tournée',
              icon: Compass,
              onClick: () => onNavigate('tours'),
              title: 'Ma tournée',
            },
          ],
          more: [
            {
              label: 'Mes factures',
              icon: Receipt,
              onClick: () => onNavigate('dp-invoices'),
              title: 'Mes factures',
            },
          ],
        };
    }
  };

  const actions = getRoleActions();
  const gridColsLg = actions.more.length > 0 ? 'lg:grid-cols-6' : 'lg:grid-cols-5';

  return (
    <div className="space-y-6">
      {/* Action Notification Toast */}
      {actionMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700 rounded-xl text-xs text-emerald-300 font-medium flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending Tour Proposals Widget for Sales Admin National & Sales Admin */}
      {(user.role === 'SALES_ADMIN_NATIONAL' || user.role === 'SALES_ADMIN') && pendingTourPlans.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 space-y-3 shadow-md shadow-amber-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[20px] font-black text-white uppercase tracking-tight font-display leading-[1.25]">
                    Propositions de Tournées à Valider
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-mono font-bold">
                    {pendingTourPlans.length} nouvelle(s) proposition(s)
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  Propositions soumises par les vendeurs (VRS) avec validation directe.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tours')}
              className="text-sm text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Gérer les tournées</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5 pt-1">
            {pendingTourPlans.map((tour) => (
              <div
                key={`dash-pending-${tour.id}`}
                className="p-3.5 bg-slate-950/80 border border-amber-500/30 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-sm font-mono font-black bg-amber-500 text-slate-950">
                      #{tour.id}
                    </span>
                    <h4 className="font-bold text-white text-base">{tour.name}</h4>
                    <span className="text-slate-400 text-sm">
                      Vendeur : <strong className="text-white">{tour.assignedVrsName || tour.vrsName || 'VRS'}</strong>
                    </span>
                    {tour.dropPointCode && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-sm font-mono">
                        {tour.dropPointCode}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-slate-300">
                    <span>
                      Date : <strong className="text-cyan-300">{tour.dayOfWeek}</strong>
                    </span>
                    {tour.createdAt && (
                      <span className="text-amber-300/90 font-medium">
                        Soumise le : <strong>{formatDateTime(tour.createdAt)}</strong>
                      </span>
                    )}
                    {tour.sectorName && (
                      <span>
                        Secteur : <strong className="text-white">{tour.sectorName}</strong>
                      </span>
                    )}
                    {tour.neighborhood && <span>Quartier : {tour.neighborhood}</span>}
                    {tour.targetVisitsCount && (
                      <span className="text-slate-400">
                        Objectif : <strong className="text-white">{tour.targetVisitsCount} visites</strong>
                      </span>
                    )}
                  </div>
                  {tour.notes && (
                    <p className="text-sm text-slate-400 italic">
                      « {tour.notes} »
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                  <button
                    type="button"
                    disabled={isProcessingTour}
                    onClick={() => handleApproveProposal(tour.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#54a835] hover:bg-[#468e2c] text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                    title="Valider la tournée"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Valider</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessingTour}
                    onClick={() => {
                      setRejectingTourId(tour.id);
                      setRejectReason('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950 hover:bg-red-900/80 text-red-300 border border-red-800/80 font-semibold text-xs transition disabled:opacity-50"
                    title="Rejeter la proposition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Rejeter</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Inline Rejection Box */}
          {rejectingTourId && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl space-y-2 mt-2">
              <div className="text-xs text-red-200 font-semibold flex items-center justify-between">
                <span>Motif du rejet pour la proposition #{rejectingTourId} (optionnel) :</span>
                <button
                  type="button"
                  onClick={() => setRejectingTourId(null)}
                  className="text-red-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Conflit avec la tournée de réapprovisionnement..."
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRejectingTourId(null)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isProcessingTour}
                  onClick={() => handleRejectProposal(rejectingTourId)}
                  className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {isProcessingTour ? 'Traitement...' : 'Confirmer Rejet'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Welcome & Actions Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-[20px] p-5 md:p-6 shadow-sm">
        {/* Bandeau Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Pastille du rôle au-dessus du titre */}
            <div className="mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider">
                {user.role === 'SALES_ADMIN_NATIONAL'
                  ? 'SAN'
                  : user.role === 'SALES_ADMIN'
                  ? 'Sales Admin'
                  : user.role === 'FSS'
                  ? 'FSS'
                  : 'VRS'}
              </span>
            </div>

            {/* Titre "Bonjour, [Prénom]" 24 px mobile, 28-32 px tablette, peut passer sur 2 lignes, jamais de points de suspension */}
            <h1 className="text-[24px] md:text-[28px] lg:text-[32px] font-bold text-white leading-tight break-words font-display">
              Bonjour, {user.firstName || 'Utilisateur'}
            </h1>

            {/* Description du bandeau : jamais coupée par des points de suspension (supprime line-clamp, 3 lignes autorisées) */}
            <p className="text-[15px] text-slate-400 mt-1 leading-snug whitespace-normal break-words max-h-[4.5em] overflow-visible">
              {user.role === 'SALES_ADMIN_NATIONAL'
                ? 'Vue nationale : 2 Drop Points, stocks, ventes et équipes.'
                : user.role === 'SALES_ADMIN'
                ? 'Votre Drop Point : stocks, VRS, commandes et factures.'
                : user.role === 'FSS'
                ? 'Votre équipe terrain : visites, PDV et performances.'
                : 'Votre secteur : ventes, stock et tournée du jour.'}
            </p>
          </div>

          {/* Bouton "Actualiser" : icône ronde de 44 px en haut à droite du bandeau (infobulle "Actualiser"), retiré de la liste des boutons */}
          <button
            type="button"
            onClick={() => loadData(false, undefined, true)}
            disabled={loading}
            title="Actualiser"
            aria-label="Actualiser"
            className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white border border-slate-700/80 transition shadow-xs shrink-0 self-start"
          >
            <RefreshCw className={`w-5 h-5 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Boutons d'actions rapides (Marge de 20 px entre la description et les boutons : mt-5) */}
        <div className={`grid grid-cols-2 md:grid-cols-3 ${gridColsLg} gap-3 mt-5`}>
          {/* Bouton principal : pleine largeur sur mobile (col-span-2), 52 px (h-[52px]), vert #15803D, icône 20px à gauche, texte blanc 15px */}
          <button
            type="button"
            onClick={actions.primary.onClick}
            title={actions.primary.title || actions.primary.label}
            className="col-span-2 md:col-span-1 h-[52px] md:h-[56px] w-full px-4 rounded-xl bg-[#15803D] hover:bg-[#166534] active:bg-[#166534] text-white flex items-center gap-2.5 transition shadow-sm font-semibold text-[15px] select-none text-left cursor-pointer"
          >
            <actions.primary.icon className="w-5 h-5 shrink-0 text-white" />
            <span className="truncate text-white">{actions.primary.label}</span>
            <CounterBadge
              count={actions.primary.count}
              containerBg="#15803D"
              className="ml-auto shrink-0"
            />
          </button>

          {/* Boutons secondaires : mobile h-72px, padding 8px, icône 18px au-dessus, texte 14px (2 lignes sans coupure) */}
          {actions.secondaries.map((btn, idx) => {
            const IconComponent = btn.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={btn.onClick}
                title={btn.title || btn.label}
                className="col-span-1 h-[72px] md:h-[56px] w-full p-2 md:px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 active:bg-slate-700 text-slate-200 border border-slate-700/80 flex flex-col items-center justify-center text-center md:flex-row md:items-center md:text-left md:justify-start gap-1 md:gap-2.5 transition shadow-xs font-medium text-[14px] md:text-[15px] select-none relative"
              >
                <IconComponent className="w-[18px] h-[18px] md:w-5 md:h-5 shrink-0 text-slate-300" />
                <span className="text-[14px] md:text-[15px] leading-[1.2] whitespace-normal break-words">
                  {btn.label}
                </span>
                <CounterBadge
                  count={btn.count}
                  containerBg="var(--bg-card)"
                  className="absolute top-1.5 right-1.5 md:static md:ml-auto shrink-0"
                />
              </button>
            );
          })}

          {/* Bouton Plus ⋯ (si le rôle a des actions dans Plus) */}
          {actions.more.length > 0 && (
            <div className="relative col-span-1 h-[72px] md:h-[56px] w-full" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                className={`h-[72px] md:h-[56px] w-full p-2 md:px-4 rounded-xl border flex flex-col items-center justify-center text-center md:flex-row md:items-center md:text-left md:justify-start gap-1 md:gap-2.5 transition shadow-xs font-medium text-[14px] md:text-[15px] select-none relative ${
                  isMoreMenuOpen
                    ? 'bg-slate-700 text-white border-slate-600'
                    : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border-slate-700/80'
                }`}
                title="Plus d'actions"
              >
                <MoreHorizontal className="w-[18px] h-[18px] md:w-5 md:h-5 shrink-0 text-slate-300" />
                <span className="text-[14px] md:text-[15px] leading-[1.2]">Plus</span>
              </button>

              {/* Bottom Sheet sur mobile (< 768px) */}
              {isMoreMenuOpen && (
                <div className="md:hidden">
                  <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-modal-backdrop"
                    onClick={() => setIsMoreMenuOpen(false)}
                  />
                  <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 rounded-t-2xl p-4 pb-8 space-y-3 shadow-2xl animate-sheet-up">
                    <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-2" />
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <span className="text-sm font-bold text-white">Plus d'actions</span>
                      <button
                        type="button"
                        onClick={() => setIsMoreMenuOpen(false)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {actions.more.map((item, mIdx) => {
                        const MoreIcon = item.icon;
                        return (
                          <button
                            key={mIdx}
                            type="button"
                            onClick={() => {
                              setIsMoreMenuOpen(false);
                              item.onClick();
                            }}
                            title={item.title || item.label}
                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-medium transition text-left"
                          >
                            <MoreIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Panneau ancré sur Tablette / Desktop (≥ 768px) */}
              {isMoreMenuOpen && (
                <div className="hidden md:block absolute right-0 top-full mt-2 w-52 max-w-[calc(100vw-32px)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 animate-modal-content">
                  {actions.more.map((item, mIdx) => {
                    const MoreIcon = item.icon;
                    return (
                      <button
                        key={mIdx}
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          item.onClick();
                        }}
                        title={item.title || item.label}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800 hover:text-white transition text-left"
                      >
                        <MoreIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Optional Filter for SAN */}
        {user.role === 'SALES_ADMIN_NATIONAL' && dropPoints.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Filtrer par Drop Point :</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDp('')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  selectedDp === ''
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Tous les Drop Points
              </button>
              {dropPoints.map((dp) => (
                <button
                  key={dp.id}
                  type="button"
                  onClick={() => setSelectedDp(String(dp.id))}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    selectedDp === String(dp.id)
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {dp.name} ({dp.code})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bannière Carte Cadeau Prête pour le VRS */}
      {user.role === 'VRS' && (giftsBadgeCount > 0 || hasReadyGiftCard) && (
        <div
          onClick={() => onNavigate('gifts')}
          className="cursor-pointer bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border-2 border-amber-400 dark:border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition hover:border-amber-300 group"
        >
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Gift className="w-6 h-6 text-slate-950 animate-bounce" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 border-2 border-white dark:border-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-amber-500 transition">
                  Votre carte cadeau est prête !
                </h3>
                <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                  Nouveau
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Félicitations pour vos performances sur le semestre. Cliquez pour gratter votre carte et découvrir votre cadeau !
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('gifts');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer shrink-0"
          >
            <span>Découvrir ma carte</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SAN Backup & Data Safety Controls */}
      {user.role === 'SALES_ADMIN_NATIONAL' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Sauvegardes & Intégrité de la Base</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-mono">
                  Rétention 14 jours
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sauvegarde automatique quotidienne active. Exportez ou importez vos données sans risque de perte.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter une sauvegarde</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importer une sauvegarde</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      {user.role === 'SALES_ADMIN_NATIONAL' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 min-[1200px]:grid-cols-3 gap-6 auto-rows-fr">
          {/* Card 1: Ventes aujourd'hui */}
          <div className="bg-slate-900 border border-slate-800 rounded-[16px] p-5 sm:p-6 shadow-sm min-h-[168px] h-full flex flex-col justify-between select-none">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-slate-400 uppercase tracking-wider">
                  Ventes aujourd'hui
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>

              <div
                className="flex items-baseline flex-nowrap whitespace-nowrap gap-1.5"
                title={`${(kpis.salesTodayAmount || 0).toLocaleString('fr-FR')} FCFA`}
              >
                <span className="text-[clamp(32px,2.4vw,36px)] font-bold text-white font-mono leading-none tracking-tight">
                  <span className="hidden min-[1350px]:inline">{(kpis.salesTodayAmount || 0).toLocaleString('fr-FR')}</span>
                  <span className="min-[1350px]:hidden">
                    {(kpis.salesTodayAmount || 0) >= 1_000_000
                      ? `${((kpis.salesTodayAmount || 0) / 1_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`
                      : (kpis.salesTodayAmount || 0).toLocaleString('fr-FR')}
                  </span>
                </span>
                <span className="text-[14px] font-normal text-slate-400 select-none shrink-0">FCFA</span>
              </div>

              <div className="text-[13px] sm:text-[14px] text-slate-400 leading-snug break-words whitespace-normal">
                {(kpis.salesTodayAmount || 0) === 0 ? (
                  <span className="text-slate-400">Aucune vente enregistrée aujourd'hui</span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    {kpis.salesTodayCount || 0} commandes validées • {kpis.salesTodayCartons || 0} cartons
                  </span>
                )}
              </div>
            </div>

            {/* Ligne basse / comparaison vs S-1 */}
            <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs sm:text-[13px]">
              <span className="text-slate-400">Vs même jour S-1 :</span>
              {kpis.salesSameDayLastWeekGrowth !== undefined && kpis.salesSameDayLastWeekGrowth !== null ? (
                kpis.salesSameDayLastWeekGrowth >= 0 ? (
                  <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{kpis.salesSameDayLastWeekGrowth}%
                  </span>
                ) : (
                  <span className="font-mono font-bold text-rose-400 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {kpis.salesSameDayLastWeekGrowth}%
                  </span>
                )
              ) : (
                <span className="font-mono text-slate-400">—</span>
              )}
            </div>
          </div>

          {/* Card 2: CA du mois */}
          <div className="bg-slate-900 border border-slate-800 rounded-[16px] p-5 sm:p-6 shadow-sm min-h-[168px] h-full flex flex-col justify-between select-none">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-slate-400 uppercase tracking-wider">
                  CA du mois
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400 shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>

              <div
                className="flex items-baseline flex-nowrap whitespace-nowrap gap-1.5"
                title={`${(kpis.salesMonthAmount || 0).toLocaleString('fr-FR')} FCFA`}
              >
                <span className="text-[clamp(32px,2.4vw,36px)] font-bold text-white font-mono leading-none tracking-tight">
                  <span className="hidden min-[1350px]:inline">{(kpis.salesMonthAmount || 0).toLocaleString('fr-FR')}</span>
                  <span className="min-[1350px]:hidden">
                    {(kpis.salesMonthAmount || 0) >= 1_000_000
                      ? `${((kpis.salesMonthAmount || 0) / 1_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`
                      : (kpis.salesMonthAmount || 0).toLocaleString('fr-FR')}
                  </span>
                </span>
                <span className="text-[14px] font-normal text-slate-400 select-none shrink-0">FCFA</span>
              </div>

              <div className="text-[13px] sm:text-[14px] text-slate-400 leading-snug break-words whitespace-normal">
                {(kpis.salesMonthAmount || 0) === 0 ? (
                  <span className="text-slate-400">Aucune vente enregistrée ce mois</span>
                ) : (
                  <span className="text-blue-400 font-medium">
                    {kpis.salesMonthCount || 0} ventes totales • {kpis.salesMonthCartons || 0} cartons
                  </span>
                )}
              </div>
            </div>

            {/* Ligne basse / Tendance MTD */}
            <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs sm:text-[13px]">
              <span className="text-slate-400">Tendance MTD :</span>
              {kpis.recentTrend && kpis.recentTrend.percentage !== null && !kpis.recentTrend.isInsufficientData ? (
                kpis.recentTrend.percentage >= 0 ? (
                  <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{kpis.recentTrend.percentage}%
                  </span>
                ) : (
                  <span className="font-mono font-bold text-rose-400 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {kpis.recentTrend.percentage}%
                  </span>
                )
              ) : (
                <span className="font-mono text-slate-400">—</span>
              )}
            </div>
          </div>

          {/* Card 3: Stock 6C Distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-[16px] p-5 sm:p-6 shadow-sm min-h-[168px] h-full flex flex-col justify-between select-none">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-slate-400 uppercase tracking-wider">
                  Stock 6C Distribution
                </span>
                <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>

              <div
                className="flex items-baseline flex-nowrap whitespace-nowrap gap-1.5"
                title={`${((kpis.centralDepotStockCartons ?? 0)).toLocaleString('fr-FR')} cartons`}
              >
                <span className="text-[clamp(32px,2.4vw,36px)] font-bold text-white font-mono leading-none tracking-tight">
                  {((kpis.centralDepotStockCartons ?? 0)).toLocaleString('fr-FR')}
                </span>
                <span className="text-[14px] font-normal text-slate-400 select-none shrink-0">cartons</span>
              </div>

              <div className="text-[13px] sm:text-[14px] text-slate-400 leading-snug break-words whitespace-normal">
                {(kpis.centralDepotStockCartons ?? 0) === 0
                  ? 'Aucun stock disponible chez 6C Distribution'
                  : 'Stock 6C Distribution • Approvisionnement National'}
              </div>
            </div>

            {/* Badge de statut unique sur sa propre ligne en bas de la carte */}
            <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 text-xs sm:text-[13px]">Statut stock</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border tracking-tight ${
                (kpis.centralDepotStockCartons ?? 0) === 0
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : (kpis.centralDepotStockCartons ?? 0) < 10000
                  ? 'bg-[#92400E] text-white border-none'
                  : 'bg-[#15803D] text-white border-none'
              }`}>
                {(kpis.centralDepotStockCartons ?? 0) === 0
                  ? 'Rupture'
                  : (kpis.centralDepotStockCartons ?? 0) < 10000
                  ? 'Stock bas'
                  : 'Niveau normal'}
              </span>
            </div>
          </div>

          {/* Card 4: Stock Drop Points */}
          <div className="bg-slate-900 border border-slate-800 rounded-[16px] p-5 sm:p-6 shadow-sm min-h-[168px] h-full flex flex-col justify-between select-none">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-slate-400 uppercase tracking-wider">
                  Stock Drop Points
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>

              <div
                className="flex items-baseline flex-nowrap whitespace-nowrap gap-1.5"
                title={`${((kpis.dropPointStockCartons ?? kpis.totalStockCartons ?? 0)).toLocaleString('fr-FR')} cartons`}
              >
                <span className="text-[clamp(32px,2.4vw,36px)] font-bold text-white font-mono leading-none tracking-tight">
                  {((kpis.dropPointStockCartons ?? kpis.totalStockCartons ?? 0)).toLocaleString('fr-FR')}
                </span>
                <span className="text-[14px] font-normal text-slate-400 select-none shrink-0">cartons</span>
              </div>

              <div className="text-[13px] sm:text-[14px] text-slate-400 leading-snug break-words whitespace-normal">
                {((kpis.dropPointStockCartons ?? kpis.totalStockCartons ?? 0)) === 0
                  ? 'Aucun stock disponible en Drop Point'
                  : 'Stocks régionaux sous gestion'}
              </div>

              {/* Ligne de détail dédiée */}
              <div className="text-[13px] text-slate-300 font-mono leading-snug break-words whitespace-normal">
                {((kpis.dropPointStockCartons ?? kpis.totalStockCartons ?? 0)) === 0
                  ? 'Aucun stock en Dépôt'
                  : kpis.dropPointStockBreakdown && kpis.dropPointStockBreakdown.length > 0
                  ? kpis.dropPointStockBreakdown.map((dp: any) => `${dp.dropPointCode || dp.dropPointName} : ${(dp.totalCartons || 0).toLocaleString('fr-FR')}`).join(' • ')
                  : `${(kpis.totalStockCartons || 0).toLocaleString('fr-FR')} cartons`}
              </div>
            </div>

            {/* Badge de statut unique sur sa propre ligne en bas de la carte */}
            <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 text-xs sm:text-[13px]">Couverture</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border tracking-tight ${
                ((kpis.dropPointStockCartons ?? kpis.totalStockCartons ?? 0)) === 0
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : kpis.stockCoverageStatus === 'RUPTURE'
                  ? 'bg-rose-950/70 text-rose-300 border-rose-800/70'
                  : kpis.stockCoverageStatus === 'BAS'
                  ? 'bg-[#92400E] text-white border-none'
                  : kpis.stockCoverageStatus === 'SURSTOCK'
                  ? 'bg-blue-950/70 text-blue-300 border-blue-800/70'
                  : 'bg-[#15803D] text-white border-none'
              }`}>
                {((kpis.dropPointStockCartons ?? kpis.totalStockCartons ?? 0)) === 0
                  ? 'Rupture'
                  : kpis.stockCoverageLabel || 'Niveau normal'}
              </span>
            </div>
          </div>

          {/* Card 5: Points de vente */}
          <div className="bg-slate-900 border border-slate-800 rounded-[16px] p-5 sm:p-6 shadow-sm min-h-[168px] h-full flex flex-col justify-between select-none">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-slate-400 uppercase tracking-wider">
                  Points de vente
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Store className="w-4 h-4" />
                </div>
              </div>

              <div
                className="flex items-baseline flex-nowrap whitespace-nowrap gap-1.5"
                title={`${(kpis.totalPos || 0).toLocaleString('fr-FR')} points de vente`}
              >
                <span className="text-[clamp(32px,2.4vw,36px)] font-bold text-white font-mono leading-none tracking-tight">
                  {(kpis.totalPos || 0).toLocaleString('fr-FR')}
                </span>
                <span className="text-[14px] font-normal text-slate-400 select-none shrink-0">PDV</span>
              </div>

              <div className="text-[13px] sm:text-[14px] text-slate-400 leading-snug break-words whitespace-normal">
                {(kpis.totalPos || 0) === 0 ? (
                  <span className="text-slate-400">Aucun point de vente enregistré</span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    {kpis.activePos || 0} PDV actifs sur le réseau
                  </span>
                )}
              </div>
            </div>

            {/* Ligne basse / Demandes en attente */}
            <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs sm:text-[13px]">
              <span className="text-slate-400">Demandes en attente :</span>
              <span className="font-mono font-bold text-amber-400">
                {kpis.pendingPos || 0}
              </span>
            </div>
          </div>

          {/* Card 6: Créances Drop Points */}
          <div
            onClick={() => onNavigate('dp-invoices')}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-[16px] p-5 sm:p-6 shadow-sm min-h-[168px] h-full flex flex-col justify-between cursor-pointer transition group select-none"
            title="Consulter les factures et paiements des Drop Points"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-slate-400 uppercase tracking-wider group-hover:text-slate-200 transition">
                  Créances Drop Points
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-800/40 flex items-center justify-center text-rose-400 shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>

              <div
                className="flex items-baseline flex-nowrap whitespace-nowrap gap-1.5"
                title={`${((kpis.creancesDropPoints?.total ?? 0)).toLocaleString('fr-FR')} FCFA`}
              >
                <span className={`text-[clamp(32px,2.4vw,36px)] font-bold font-mono leading-none tracking-tight ${
                  (kpis.creancesDropPoints?.total ?? 0) === 0 ? 'text-white' : 'text-rose-400'
                }`}>
                  <span className="hidden min-[1350px]:inline">{((kpis.creancesDropPoints?.total ?? 0)).toLocaleString('fr-FR')}</span>
                  <span className="min-[1350px]:hidden">
                    {(kpis.creancesDropPoints?.total ?? 0) >= 1_000_000
                      ? `${(((kpis.creancesDropPoints?.total ?? 0)) / 1_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`
                      : ((kpis.creancesDropPoints?.total ?? 0)).toLocaleString('fr-FR')}
                  </span>
                </span>
                <span className="text-[14px] font-normal text-slate-400 select-none shrink-0">FCFA</span>
              </div>

              <div className="text-[13px] sm:text-[14px] text-slate-400 leading-snug break-words whitespace-normal">
                {(kpis.creancesDropPoints?.total ?? 0) === 0
                  ? 'Aucune créance en cours'
                  : 'Factures Drop Points non réglées'}
              </div>

              {/* Ligne de détail dédiée (BKO : X • DKN : Y) */}
              <div className="text-[13px] text-slate-300 font-mono leading-snug break-words whitespace-normal">
                {(kpis.creancesDropPoints?.total ?? 0) === 0
                  ? 'BKO : 0 FCFA • DKN : 0 FCFA'
                  : kpis.creancesDropPoints?.breakdown && kpis.creancesDropPoints.breakdown.length > 0
                  ? kpis.creancesDropPoints.breakdown.map((dp: any) => `${dp.dropPointCode || dp.dropPointName} : ${(dp.amount || 0).toLocaleString('fr-FR')} FCFA`).join(' • ')
                  : 'BKO : 0 FCFA • DKN : 0 FCFA'}
              </div>
            </div>

            {/* Ligne basse / consultation factures */}
            <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs sm:text-[13px] text-slate-400 font-medium">
              <span>Factures Drop Points</span>
              <span className="text-blue-400 group-hover:underline flex items-center gap-1">
                Consulter <ArrowRightLeft className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Sales Today */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  Ventes Aujourd'hui
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[32px] sm:text-[36px] font-bold text-white font-mono leading-[1.25]">
                  {(kpis.salesTodayAmount || 0).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-400">FCFA</span>
                </div>
                <div className="text-sm text-emerald-400 font-medium mt-1 flex items-center gap-1.5">
                  <span>{kpis.salesTodayCount || 0} commandes validées</span>
                  <span>•</span>
                  <span>{kpis.salesTodayCartons || 0} cartons</span>
                </div>
              </div>
            </div>

            {/* Indicateur de comparaison avec le même jour de la semaine précédente */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-sm">
              <span className="text-slate-400">Vs même jour S-1 :</span>
              {kpis.salesSameDayLastWeekGrowth !== undefined && kpis.salesSameDayLastWeekGrowth !== null ? (
                kpis.salesSameDayLastWeekGrowth >= 0 ? (
                  <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{kpis.salesSameDayLastWeekGrowth}%
                  </span>
                ) : (
                  <span className="font-mono font-bold text-rose-400 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {kpis.salesSameDayLastWeekGrowth}%
                  </span>
                )
              ) : (
                <span className="font-mono text-slate-400 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pas de donnée</span>
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Sales This Month */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  Chiffre d'Affaires Mois
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[32px] sm:text-[36px] font-bold text-white font-mono leading-[1.25]">
                  {(kpis.salesMonthAmount || 0).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-400">FCFA</span>
                </div>
                <div className="text-sm text-blue-400 font-medium mt-1 flex items-center gap-1.5">
                  <span>{kpis.salesMonthCount || 0} ventes totales</span>
                  <span>•</span>
                  <span>{kpis.salesMonthCartons || 0} cartons</span>
                </div>
              </div>
            </div>

            {/* Tendance équivalente du mois */}
            {kpis.recentTrend && (
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-sm">
                <span className="text-slate-400">Tendance MTD :</span>
                {kpis.recentTrend.isInsufficientData ? (
                  <span className="text-slate-400 font-medium">Données insuffisantes</span>
                ) : kpis.recentTrend.percentage !== null ? (
                  kpis.recentTrend.percentage >= 0 ? (
                    <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +{kpis.recentTrend.percentage}%
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-rose-400 flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {kpis.recentTrend.percentage}%
                    </span>
                  )
                ) : (
                  <span className="font-mono text-slate-400">—</span>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Stock Cartons & Alert */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  {user.role === 'VRS' ? 'Mon stock' : 'Stock Dépositaire'}
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[32px] sm:text-[36px] font-bold text-white font-display leading-[1.25]">
                  {(kpis.totalStockCartons || 0).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-400">Cartons</span>
                </div>

                {/* Couverture en jours et Statut coloré */}
                <div className="text-sm mt-1.5 flex items-center justify-between flex-wrap gap-1.5">
                  <span className="text-slate-400">
                    Couverture : <strong className="text-white font-mono">{kpis.stockCoverageDays !== undefined ? `${kpis.stockCoverageDays} j` : '—'}</strong>
                  </span>
                  {kpis.stockCoverageStatus && (
                    <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold border tracking-tight ${
                      kpis.stockCoverageStatus === 'RUPTURE'
                        ? 'bg-rose-950/70 text-rose-300 border-rose-800/70'
                        : kpis.stockCoverageStatus === 'BAS'
                        ? 'bg-[#92400E] text-white border-none'
                        : kpis.stockCoverageStatus === 'NORMAL'
                        ? 'bg-[#15803D] text-white border-none'
                        : 'bg-blue-950/70 text-blue-300 border-blue-800/70'
                    }`}>
                      {kpis.stockCoverageLabel || (
                        kpis.stockCoverageStatus === 'RUPTURE' ? 'Risque de rupture' :
                        kpis.stockCoverageStatus === 'BAS' ? 'Stock bas' :
                        kpis.stockCoverageStatus === 'NORMAL' ? 'Niveau normal' : 'Surstock'
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-sm flex items-center gap-1.5">
              {kpis.lowStockAlerts > 0 ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {kpis.lowStockAlerts} produit(s) sous seuil
                </span>
              ) : (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Niveaux de stock nominaux
                </span>
              )}
            </div>
          </div>

          {/* Card 4: Points of Sale */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Points de Vente
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400">
                <Store className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[32px] sm:text-[36px] font-bold text-white font-display leading-[1.25]">
                {(kpis.totalPos || 0).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-400">PDV</span>
              </div>
              <div className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                <span className="text-emerald-400 font-medium">{kpis.activePos || 0} actifs</span>
                {kpis.pendingPos > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-semibold border border-amber-800/50">
                    {kpis.pendingPos} en attente
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Sales Evolution Chart - Displayed for all roles */}
      {charts.monthlySales && charts.monthlySales.length > 0 && (
        <LazyViewportSection minHeight="380px">
          <MonthlySalesChart
            data={charts.monthlySales || []}
            recentTrend={charts.recentTrend || kpis.recentTrend || data?.recentTrend}
            selectedDropPointName={
              selectedDp
                ? dropPoints.find((dp) => String(dp.id) === selectedDp)?.name
                : user.role === 'SALES_ADMIN'
                ? user.dropPointName || 'Mon Dépôt'
                : user.role === 'FSS'
                ? 'Équipe VRS Supervisée'
                : user.role === 'VRS'
                ? 'Mes Ventes Personnelles'
                : 'Périmètre National Consolidé'
            }
          />
        </LazyViewportSection>
      )}

      {/* Sales Realized Breakdown Section (Drop Points & VRS) */}
      <LazyViewportSection minHeight="240px">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Drop Points Breakdown (All roles: SAN, SA, FSS, VRS) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2 font-display">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <span>
                  {user.role === 'SALES_ADMIN_NATIONAL'
                    ? 'Ventes Réalisées par Drop Point'
                    : 'Performance du Drop Point de Rattachement'}
                </span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {user.role === 'SALES_ADMIN_NATIONAL' ? 'Consolidé' : user.dropPointCode || 'Dépôt'}
              </span>
            </div>

            {charts.salesByDropPoint && charts.salesByDropPoint.length > 0 ? (
              <div className="space-y-2.5">
                {charts.salesByDropPoint.map((dp: any, idx: number) => {
                  const totalAllDp = charts.salesByDropPoint.reduce((sum: number, it: any) => sum + (it.totalAmount || 0), 0) || 1;
                  const pct = Math.round(((dp.totalAmount || 0) / totalAllDp) * 100);
                  return (
                    <div key={idx} className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 hover:border-slate-700 transition">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{dp.dropPointName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold">
                            {dp.dropPointCode}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">
                          {(dp.totalAmount || 0).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                        <span>{dp.salesCount || 0} ventes enregistrées</span>
                        <span className="font-mono text-slate-300">{pct}% du total</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-sm bg-slate-950/40 rounded-xl border border-slate-800">
                Aucune vente par Drop Point pour le moment.
              </div>
            )}
          </div>

          {/* VRS Breakdown (All roles: SAN, SA, FSS, VRS) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2 font-display">
                <Users className="w-5 h-5 text-blue-400" />
                <span>
                  {user.role === 'VRS'
                    ? 'Mon Bilan Commercial Personnel'
                    : user.role === 'FSS'
                    ? 'Ventes Réalisées par mes Vendeurs (VRS)'
                    : 'Ventes Réalisées par Vendeur (VRS)'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('sales')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Détail des ventes</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {charts.salesByVrs && charts.salesByVrs.length > 0 ? (
              <div className="space-y-2.5">
                {charts.salesByVrs.map((vrs: any, idx: number) => {
                  const totalAllVrs = charts.salesByVrs.reduce((sum: number, it: any) => sum + (it.totalAmount || 0), 0) || 1;
                  const pct = Math.round(((vrs.totalAmount || 0) / totalAllVrs) * 100);
                  return (
                    <div key={idx} className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 hover:border-slate-700 transition">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-blue-950/80 border border-blue-800/50 flex items-center justify-center text-blue-400 font-mono text-xs font-bold">
                            #{idx + 1}
                          </div>
                          <span className="font-bold text-white">{vrs.vrsName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {vrs.vrsPublicId}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-blue-400">
                          {(vrs.totalAmount || 0).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                        <span>{vrs.salesCount || 0} ventes validées</span>
                        <span className="font-mono text-slate-300">{pct}% du total</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-sm bg-slate-950/40 rounded-xl border border-slate-800">
                Aucune vente enregistrée par vendeur.
              </div>
            )}
          </div>
        </div>
      </LazyViewportSection>

      {/* Stock Levels by Category Chart - Lazy loaded on viewport approach */}
      {(user.role === 'SALES_ADMIN_NATIONAL' || user.role === 'SALES_ADMIN' || user.role === 'FSS') && (
        <LazyViewportSection minHeight="380px">
          <StockCategoryLevelsChart
            data={charts.stockLevelsByCategory || []}
            selectedDropPointName={
              selectedDp
                ? dropPoints.find((dp) => String(dp.id) === selectedDp)?.name
                : user.role === 'SALES_ADMIN'
                ? user.dropPointName || 'Mon Dépôt'
                : 'Périmètre National Consolidé'
            }
          />
        </LazyViewportSection>
      )}

      {/* Acceptance Test Banner Card - Fond uni vert #15803D sans dégradé */}
      <LazyViewportSection minHeight="96px">
        <div className="bg-[#15803D] border border-[#166534] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-white shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#166534] flex items-center justify-center text-white shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white/90">
                Cahier des Charges — Section 62
              </div>
              <div className="text-sm font-bold text-white mt-0.5">
                10/10 Scénarios d'Acceptation Validés
              </div>
              <div className="text-xs text-white/90">
                Authentification SAN, Drop Point DAKAN, création FSS/VRS, réception BL001 (+100c), approvisionnement (+10c), vente atomique (-3c), rejet stock insuffisant, validation PDV GPS et isolation multi-tenant.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAcceptanceTests}
            className="px-4 py-2.5 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white font-bold text-xs shadow transition shrink-0 cursor-pointer"
          >
            Ouvrir la Console de Test
          </button>
        </div>
      </LazyViewportSection>

      {/* Category breakdown & Top Products - Lazy loaded */}
      <LazyViewportSection minHeight="280px">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Category */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[20px] font-bold text-white uppercase tracking-wider font-display leading-[1.25]">
                Ventes par Gamme (Catégories)
              </h3>
              <span className="text-sm text-slate-400 font-mono">Total FCFA</span>
            </div>

            <div className="space-y-3">
              {charts.salesByCategory && charts.salesByCategory.length > 0 ? (
                charts.salesByCategory.map((c: any, idx: number) => {
                  const total = charts.salesByCategory.reduce((sum: number, it: any) => sum + it.amount, 0) || 1;
                  const percent = Math.round((c.amount / total) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-slate-200">{c.category}</span>
                        <span className="font-mono font-medium text-slate-300">
                          {c.amount.toLocaleString('fr-FR')} FCFA ({c.cartons} ctn)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-slate-400 py-6 text-center">
                  Aucune vente pour le moment.
                </div>
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[20px] font-bold text-white uppercase tracking-wider font-display leading-[1.25]">
                Top Produits Vendus
              </h3>
              <span className="text-sm text-slate-400 font-mono">Volume</span>
            </div>

            <div className="space-y-2.5">
              {charts.topProducts && charts.topProducts.length > 0 ? (
                charts.topProducts.map((p: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-sm font-mono">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{p.productName}</div>
                        <div className="text-sm text-slate-400">{p.category}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-white text-sm">
                        {p.cartonsSold} cartons
                      </div>
                      <div className="text-sm text-slate-400 font-mono">
                        {p.totalRevenue.toLocaleString('fr-FR')} FCFA
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400 py-6 text-center">
                  Pas encore de produit vendu.
                </div>
              )}
            </div>
          </div>
        </div>
      </LazyViewportSection>

      {/* Recent Sales Table - Lazy loaded */}
      <LazyViewportSection minHeight="280px">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[20px] sm:text-[22px] font-bold text-white uppercase tracking-wider font-display leading-[1.25]">
                {user.role === 'VRS' ? 'Mes Dernières Ventes Enregistrées' : 'Dernières Ventes Enregistrées'}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {user.role === 'VRS'
                  ? 'Vos transactions personnelles validées sur votre tournée commerciale'
                  : 'Transactions validées en temps réel sur le terrain'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-sm text-red-400 hover:text-red-300 font-medium inline-flex items-center gap-1"
            >
              <span>Voir toutes les ventes</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Cards (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {recentSales.map((s: any) => (
              <div
                key={s.id}
                onClick={() => onNavigate('sales')}
                className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 cursor-pointer hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono font-bold text-white text-sm">{s.saleNumber}</div>
                    <div className="font-medium text-slate-200 text-sm mt-0.5">{s.posName}</div>
                  </div>
                  <div className="font-mono font-bold text-sm text-emerald-400">
                    {s.totalAmount.toLocaleString('fr-FR')} FCFA
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400 pt-1.5 border-t border-slate-800/60">
                  <span>VRS: {s.vrsName}</span>
                  <span className="font-mono text-slate-400">{s.dropPointCode} • {new Date(s.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            ))}
            {recentSales.length === 0 && (
              <div className="py-6 text-center text-sm text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
                Aucune vente enregistrée.
              </div>
            )}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-sm border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3.5">Numéro</th>
                  <th className="py-3 px-3.5">Point de Vente</th>
                  <th className="py-3 px-3.5">Vendeur (VRS)</th>
                  <th className="py-3 px-3.5">Dépôt</th>
                  <th className="py-3 px-3.5 text-right">Montant</th>
                  <th className="py-3 px-3.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {recentSales.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3.5 font-mono font-bold text-white">{s.saleNumber}</td>
                    <td className="py-3 px-3.5 font-medium text-slate-200">{s.posName}</td>
                    <td className="py-3 px-3.5">{s.vrsName}</td>
                    <td className="py-3 px-3.5 font-mono text-slate-400">{s.dropPointCode}</td>
                    <td className="py-3 px-3.5 font-mono font-bold text-right text-emerald-400">
                      {s.totalAmount.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="py-3 px-3.5 text-slate-400">{new Date(s.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-slate-400">
                      Aucune vente enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </LazyViewportSection>

      {/* SAN Database Backup & Restore Modal */}
      <DatabaseBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </div>
  );
};
