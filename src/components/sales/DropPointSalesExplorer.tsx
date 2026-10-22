import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Sale, DropPoint, User, SellerPerformance } from '../../types/index.ts';
import { SellerPerformanceCard } from '../profile/SellerPerformanceCard.tsx';
import {
  Building2,
  Users,
  ShoppingCart,
  TrendingUp,
  Award,
  Star,
  Calendar,
  Clock,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Receipt,
  Package,
  Store,
  MapPin,
  Phone,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Sparkles,
  BarChart3,
  DollarSign,
  Boxes,
  UserCheck,
  RotateCcw,
} from 'lucide-react';

interface DropPointSalesExplorerProps {
  onOpenReceipt: (sale: Sale) => void;
  onCancelSale?: (sale: Sale) => void;
}

export const DropPointSalesExplorer: React.FC<DropPointSalesExplorerProps> = ({
  onOpenReceipt,
  onCancelSale,
}) => {
  const { user } = useAuth();

  // Data states
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation states
  const [selectedDpId, setSelectedDpId] = useState<number | null>(null);
  const [expandedSellerId, setExpandedSellerId] = useState<number | null>(null);
  const [expandedSaleDetailId, setExpandedSaleDetailId] = useState<number | null>(null);
  const [showCriteriaModalSeller, setShowCriteriaModalSeller] = useState<User | null>(null);

  // Filters
  const [sellerSearch, setSellerSearch] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');

  // Load all initial data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dpRes, salesRes, usersRes] = await Promise.all([
        api.getDropPoints(),
        api.getSales(),
        api.getUsers({ role: 'VRS' }),
      ]);

      const dps = dpRes.dropPoints || [];
      const allSales = salesRes.sales || [];
      const allSellers = usersRes.users || [];

      setDropPoints(dps);
      setSales(allSales);
      setSellers(allSellers);

      // If user is SALES_ADMIN with an assigned drop point, default select their drop point
      if (user?.role === 'SALES_ADMIN' && user.dropPointId) {
        setSelectedDpId(user.dropPointId);
      }
    } catch (err: any) {
      console.error('Error loading Drop Point Sales Explorer data:', err);
      setError(err.message || 'Impossible de charger les données des ventes par Drop Point.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleSaleRecorded = () => {
      loadData();
    };

    window.addEventListener('6c:sale-recorded', handleSaleRecorded);
    window.addEventListener('6c-sales-updated', handleSaleRecorded);
    window.addEventListener('6c-sales-synced', handleSaleRecorded);

    return () => {
      window.removeEventListener('6c:sale-recorded', handleSaleRecorded);
      window.removeEventListener('6c-sales-updated', handleSaleRecorded);
      window.removeEventListener('6c-sales-synced', handleSaleRecorded);
    };
  }, [user]);

  // Date filtering logic on sales
  const filteredSalesByDate = useMemo(() => {
    if (dateRangeFilter === 'all') return sales;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return sales.filter((s) => {
      const saleDateStr = (s.createdAt || (s as any).created_at || '').slice(0, 10);
      if (!saleDateStr) return true;

      if (dateRangeFilter === 'today') {
        return saleDateStr === todayStr;
      }
      if (dateRangeFilter === '7days') {
        const saleDate = new Date(saleDateStr);
        const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (dateRangeFilter === 'month') {
        const currentMonth = now.toISOString().slice(0, 7);
        return saleDateStr.startsWith(currentMonth);
      }
      return true;
    });
  }, [sales, dateRangeFilter]);

  // Drop points aggregated metrics
  const dropPointsWithMetrics = useMemo(() => {
    return dropPoints.map((dp) => {
      const dpSales = filteredSalesByDate.filter((s) => {
        const saleDpId = s.dropPointId ?? (s as any).drop_point_id;
        return Number(saleDpId) === Number(dp.id);
      });

      const completedSales = dpSales.filter((s) => s.status === 'COMPLETED');
      const totalAmount = completedSales.reduce(
        (sum, s) => sum + (s.totalAmount ?? (s as any).total_amount ?? 0),
        0
      );

      const totalCartons = completedSales.reduce((sum, s) => {
        const c = s.totalCartons ?? (s as any).total_cartons ?? (s.items ? s.items.reduce((acc: number, it: any) => acc + (it.quantityCartons || it.quantity_cartons || 0), 0) : 0);
        return sum + c;
      }, 0);

      const dpSellers = sellers.filter((u) => Number(u.dropPointId) === Number(dp.id));
      const distinctPos = new Set(completedSales.map((s) => s.pointOfSaleId ?? (s as any).point_of_sale_id)).size;

      // Find last sale date
      const lastSale = dpSales.length > 0
        ? dpSales.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]
        : null;

      return {
        ...dp,
        salesCount: completedSales.length,
        totalAmount,
        totalCartons,
        sellerCount: dpSellers.length,
        distinctPosCount: distinctPos,
        averageBasket: completedSales.length > 0 ? Math.round(totalAmount / completedSales.length) : 0,
        lastSaleDate: lastSale?.createdAt || null,
      };
    });
  }, [dropPoints, filteredSalesByDate, sellers]);

  // Network Totals
  const networkTotals = useMemo(() => {
    const totalRevenue = dropPointsWithMetrics.reduce((sum, dp) => sum + dp.totalAmount, 0);
    const totalTransactions = dropPointsWithMetrics.reduce((sum, dp) => sum + dp.salesCount, 0);
    const totalCartons = dropPointsWithMetrics.reduce((sum, dp) => sum + dp.totalCartons, 0);
    const totalActiveSellers = sellers.length;
    const avgBasket = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    return {
      totalRevenue,
      totalTransactions,
      totalCartons,
      totalActiveSellers,
      avgBasket,
    };
  }, [dropPointsWithMetrics, sellers]);

  // Selected Drop Point data
  const selectedDropPoint = useMemo(() => {
    if (!selectedDpId) return null;
    return dropPointsWithMetrics.find((dp) => Number(dp.id) === Number(selectedDpId)) || null;
  }, [selectedDpId, dropPointsWithMetrics]);

  // Sellers belonging to selected Drop Point (assigned OR who have made sales in this drop point)
  const selectedDpSellers = useMemo(() => {
    if (!selectedDpId) return [];
    const dpSalesSellerIds = new Set(
      sales
        .filter((s) => Number(s.dropPointId ?? (s as any).drop_point_id) === Number(selectedDpId))
        .map((s) => Number(s.vrsId ?? (s as any).vrs_id))
    );

    const dpSellers = sellers.filter(
      (u) => Number(u.dropPointId) === Number(selectedDpId) || dpSalesSellerIds.has(Number(u.id))
    );

    if (!sellerSearch.trim()) return dpSellers;
    const term = sellerSearch.toLowerCase().trim();
    return dpSellers.filter(
      (u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(term) ||
        (u.publicId || '').toLowerCase().includes(term) ||
        (u.phone || '').includes(term) ||
        (u.sectorName || '').toLowerCase().includes(term)
    );
  }, [selectedDpId, sellers, sales, sellerSearch]);

  // Compute performance & rating for a specific seller based on sales
  const getSellerMetrics = (sellerId: number) => {
    const sellerSales = filteredSalesByDate.filter((s) => {
      const vrsId = s.vrsId ?? (s as any).vrs_id;
      const saleDpId = s.dropPointId ?? (s as any).drop_point_id;
      const matchesSeller = Number(vrsId) === Number(sellerId);
      if (!matchesSeller) return false;
      if (selectedDpId) {
        return Number(saleDpId) === Number(selectedDpId);
      }
      return true;
    });

    const completed = sellerSales.filter((s) => s.status === 'COMPLETED');
    const cancelled = sellerSales.filter((s) => s.status === 'CANCELLED');
    const totalRevenue = completed.reduce((sum, s) => sum + (s.totalAmount ?? (s as any).total_amount ?? 0), 0);
    const totalCartons = completed.reduce((sum, s) => {
      const c = s.totalCartons ?? (s as any).total_cartons ?? (s.items ? s.items.reduce((acc: number, it: any) => acc + (it.quantityCartons || it.quantity_cartons || 0), 0) : 0);
      return sum + c;
    }, 0);
    const distinctPos = new Set(completed.map((s) => s.pointOfSaleId ?? (s as any).point_of_sale_id)).size;
    const avgBasket = completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0;

    // Notation Calculation (Consistent with 6C Performance Matrix)
    // 1. Volume (35%)
    let volScore = 6.0;
    if (totalCartons >= 100 || totalRevenue >= 2500000) volScore = 10.0;
    else if (totalCartons >= 60 || totalRevenue >= 1500000) volScore = 9.2;
    else if (totalCartons >= 30 || totalRevenue >= 750000) volScore = 8.5;
    else if (totalCartons >= 15 || totalRevenue >= 300000) volScore = 7.8;
    else if (totalCartons > 0) volScore = 7.0;

    // 2. Couverture PDV (25%)
    let covScore = 6.0;
    if (distinctPos >= 10) covScore = 9.8;
    else if (distinctPos >= 6) covScore = 9.0;
    else if (distinctPos >= 3) covScore = 8.2;
    else if (distinctPos >= 1) covScore = 7.4;

    // 3. Régularité & Panier Moyen (20%)
    let regScore = 6.5;
    if (avgBasket >= 150000 && completed.length >= 5) regScore = 9.6;
    else if (avgBasket >= 80000) regScore = 8.8;
    else if (avgBasket >= 40000) regScore = 8.0;
    else if (completed.length > 0) regScore = 7.5;

    // 4. Fiabilité / Zéro Litige (20%)
    let relScore = 10.0;
    if (cancelled.length > 0) {
      const errRate = cancelled.length / (completed.length + cancelled.length);
      relScore = Math.max(5.0, Number((10 - errRate * 15).toFixed(1)));
    }

    const ratingScore = Number(
      (volScore * 0.35 + covScore * 0.25 + regScore * 0.20 + relScore * 0.20).toFixed(1)
    );

    let badgeLabel = 'AGENT CONFIRMÉ';
    let badgeColor = 'bg-blue-950 text-blue-300 border-blue-800';
    let appreciation = 'Bonne Activité Régulière';
    let stars = 4;

    if (ratingScore >= 9.0) {
      badgeLabel = 'TOP VENDEUR ÉLITE';
      badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-800';
      appreciation = 'Performance Exceptionnelle (Élite Réseau)';
      stars = 5;
    } else if (ratingScore >= 8.0) {
      badgeLabel = 'PERFORMER CLASSE A';
      badgeColor = 'bg-teal-950 text-teal-300 border-teal-800';
      appreciation = 'Très Bon Rendement Commercial';
      stars = 4;
    } else if (ratingScore >= 7.0) {
      badgeLabel = 'VENDEUR ACTIF';
      badgeColor = 'bg-blue-950 text-blue-300 border-blue-800';
      appreciation = 'Activité Régulière Confirmée';
      stars = 4;
    } else {
      badgeLabel = 'EN PROGRESSION';
      badgeColor = 'bg-amber-950 text-amber-300 border-amber-800';
      appreciation = 'Potentiel en phase de montée en charge';
      stars = 3;
    }

    // Sort seller's sales by date descending
    const salesByDate = [...sellerSales].sort((a, b) => {
      const da = new Date(a.createdAt || (a as any).created_at || 0).getTime();
      const db = new Date(b.createdAt || (b as any).created_at || 0).getTime();
      return db - da;
    });

    return {
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      totalRevenue,
      totalCartons,
      distinctPos,
      avgBasket,
      ratingScore,
      badgeLabel,
      badgeColor,
      appreciation,
      stars,
      volScore,
      covScore,
      regScore,
      relScore,
      salesByDate,
    };
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-sm">
        <div className="w-8 h-8 border-3 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Chargement des Ventes par Drop Point</h3>
        <p className="text-xs text-slate-400 mt-1">Consolidation des données dépôts, profils vendeurs et notations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-800/60 rounded-2xl p-6 text-center shadow-sm">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-200 font-medium">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Filter and Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          {selectedDpId ? (
            <button
              type="button"
              id="back-to-droppoints-btn"
              onClick={() => {
                setSelectedDpId(null);
                setExpandedSellerId(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Tous les Drop Points</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-900/50 text-red-300 text-xs font-bold uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-red-400" />
              <span>Supervision par Drop Point</span>
            </div>
          )}

          {selectedDropPoint && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="font-bold text-white">{selectedDropPoint.name}</span>
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                {selectedDropPoint.code}
              </span>
            </div>
          )}
        </div>

        {/* Date Filter selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400 hidden md:inline">Période :</span>
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setDateRangeFilter('all')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                dateRangeFilter === 'all'
                  ? 'bg-red-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tout
            </button>
            <button
              type="button"
              onClick={() => setDateRangeFilter('today')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                dateRangeFilter === 'today'
                  ? 'bg-red-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => setDateRangeFilter('7days')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                dateRangeFilter === '7days'
                  ? 'bg-red-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 jours
            </button>
            <button
              type="button"
              onClick={() => setDateRangeFilter('month')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                dateRangeFilter === 'month'
                  ? 'bg-red-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Ce mois
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 1: DROP POINTS AS BLOCKS/CARDS                                     */}
      {/* ========================================================================= */}
      {!selectedDpId && (
        <div className="space-y-6">
          {/* Network Consolidated KPIs (Only for Sales Admin National or Multi-DP) */}
          {user?.role === 'SALES_ADMIN_NATIONAL' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                  Chiffre d'Affaires Réseau
                </span>
                <div className="text-xl font-mono font-black text-emerald-400">
                  {networkTotals.totalRevenue.toLocaleString('fr-FR')} <span className="text-xs">FCFA</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Toutes ventes validées</span>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                  Transactions Terrain
                </span>
                <div className="text-xl font-mono font-black text-white">
                  {networkTotals.totalTransactions} <span className="text-xs text-slate-400 font-sans">ventes</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Déductions automatiques</span>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                  Volume de Cartons
                </span>
                <div className="text-xl font-mono font-black text-amber-400">
                  {networkTotals.totalCartons} <span className="text-xs text-slate-400 font-sans">cartons</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Assortiment complet</span>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                  Vendeurs VRS Actifs
                </span>
                <div className="text-xl font-mono font-black text-blue-400">
                  {networkTotals.totalActiveSellers} <span className="text-xs text-slate-400 font-sans">agents</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Panier moy: {networkTotals.avgBasket.toLocaleString('fr-FR')} F
                </span>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Ventes par Drop Point (Dépôts)</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                    {dropPointsWithMetrics.length} centre(s)
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cliquez sur un bloc Drop Point pour afficher tous les profils vendeurs, leurs performances, notations et l'historique détaillé de leurs ventes par date.
                </p>
              </div>
            </div>

            {/* Grid of Drop Point Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {dropPointsWithMetrics.map((dp) => {
                const isUserDp = user?.dropPointId && Number(user.dropPointId) === Number(dp.id);

                return (
                  <div
                    key={dp.id}
                    id={`droppoint-block-${dp.id}`}
                    onClick={() => {
                      setSelectedDpId(dp.id);
                      setExpandedSellerId(null);
                    }}
                    className={`group relative bg-slate-900 border rounded-2xl p-5 shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                      isUserDp
                        ? 'border-red-600/70 hover:border-red-500 bg-slate-900'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Row: Drop Point Identity */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0 group-hover:bg-red-600/30 transition">
                          <Building2 className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white group-hover:text-red-400 transition leading-snug">
                              {dp.name}
                            </h3>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {dp.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{dp.city || 'Mali'}{dp.neighborhood ? ` • ${dp.neighborhood}` : ''}</span>
                          </div>
                        </div>
                      </div>

                      {isUserDp && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white uppercase tracking-wider shrink-0">
                          Votre Dépôt
                        </span>
                      )}
                    </div>

                    {/* Prominent Revenue */}
                    <div className="mb-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                        Chiffre d'Affaires Réalisé
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xl font-mono font-black text-emerald-400">
                          {dp.totalAmount.toLocaleString('fr-FR')} <span className="text-xs font-sans text-emerald-500">FCFA</span>
                        </span>
                        <span className="text-xs font-bold text-slate-300">
                          {dp.salesCount} vente{dp.salesCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Operational Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-800/80 text-center mb-4">
                      <div className="p-2 rounded-lg bg-slate-950/40">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Volume</span>
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {dp.totalCartons} ctns
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/40">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Vendeurs</span>
                        <span className="text-xs font-mono font-bold text-blue-300">
                          {dp.sellerCount} VRS
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/40">
                        <span className="text-[10px] text-slate-400 block mb-0.5">PDVs Servis</span>
                        <span className="text-xs font-mono font-bold text-slate-200">
                          {dp.distinctPosCount} PDV
                        </span>
                      </div>
                    </div>

                    {/* Bottom CTA Button */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {dp.lastSaleDate
                          ? `Dernière vente le ${new Date(dp.lastSaleDate).toLocaleDateString('fr-FR')}`
                          : 'Aucune vente enregistrée'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 group-hover:text-red-300 group-hover:translate-x-0.5 transition">
                        <span>Voir les vendeurs</span>
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                );
              })}

              {dropPointsWithMetrics.length === 0 && (
                <div className="col-span-full p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
                  Aucun Drop Point accessible pour votre compte.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 2 & 3: SELLERS OF SELECTED DROP POINT, THEIR PERFORMANCES & SALES   */}
      {/* ========================================================================= */}
      {selectedDropPoint && (
        <div className="space-y-6">
          {/* Drop Point Header Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white uppercase tracking-wider">
                    Dépôt {selectedDropPoint.code}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedDropPoint.city} {selectedDropPoint.neighborhood ? `• ${selectedDropPoint.neighborhood}` : ''}
                  </span>
                </div>
                <h1 className="text-xl font-black text-white uppercase tracking-tight">
                  {selectedDropPoint.name}
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  {selectedDropPoint.address} • Tél: {selectedDropPoint.phone || 'Non renseigné'}
                </p>
              </div>

              {/* Aggregated totals for this specific drop point */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">CA Cumulé Dépôt</span>
                  <span className="text-base font-mono font-black text-emerald-400">
                    {selectedDropPoint.totalAmount.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Ventes</span>
                  <span className="text-base font-mono font-bold text-white">
                    {selectedDropPoint.salesCount}
                  </span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Cartons</span>
                  <span className="text-base font-mono font-bold text-amber-400">
                    {selectedDropPoint.totalCartons}
                  </span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Vendeurs VRS</span>
                  <span className="text-base font-mono font-bold text-blue-400">
                    {selectedDpSellers.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sellers Search bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Rechercher un vendeur VRS par nom, identifiant 6CDISTVRS-... ou téléphone"
                value={sellerSearch}
                onChange={(e) => setSellerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="text-xs text-slate-400 font-medium whitespace-nowrap">
              {selectedDpSellers.length} profil{selectedDpSellers.length > 1 ? 's' : ''} vendeur{selectedDpSellers.length > 1 ? 's' : ''} rattaché{selectedDpSellers.length > 1 ? 's' : ''}
            </div>
          </div>

          {/* List of Seller Profiles */}
          <div className="space-y-5">
            {selectedDpSellers.map((seller) => {
              const metrics = getSellerMetrics(seller.id);
              const isExpanded = expandedSellerId === seller.id;

              return (
                <div
                  key={seller.id}
                  id={`seller-card-${seller.id}`}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm transition hover:border-slate-700"
                >
                  {/* Seller Header Summary */}
                  <div className="p-5 md:p-6 bg-slate-900 border-b border-slate-800/80">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Avatar, Name, IDs */}
                      <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                          {seller.photo ? (
                            <img
                              src={seller.photo}
                              alt={`${seller.firstName} ${seller.lastName}`}
                              className="w-13 h-13 rounded-2xl object-cover border-2 border-slate-700"
                            />
                          ) : (
                            <div className="w-13 h-13 rounded-2xl bg-red-700 flex items-center justify-center text-white font-bold text-base shadow-inner">
                              {seller.firstName?.charAt(0)}
                              {seller.lastName?.charAt(0)}
                            </div>
                          )}
                          <span
                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"
                            title="Vendeur Actif"
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-white">
                              {seller.firstName} {seller.lastName}
                            </h3>
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {seller.publicId}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${metrics.badgeColor}`}>
                              {metrics.badgeLabel}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {seller.sectorName || 'Secteur Non assigné'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {seller.phone || 'Non renseigné'}
                            </span>
                            <span className="text-slate-500">
                              Dépôt {selectedDropPoint.code}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Notation & Performance Highlights */}
                      <div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end">
                        {/* Rating block */}
                        <div className="p-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center shrink-0">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="text-sm font-mono font-black text-amber-300">
                              {metrics.ratingScore}
                            </span>
                            <span className="text-[10px] text-slate-400">/10</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {metrics.appreciation}
                          </span>
                        </div>

                        {/* Revenue block */}
                        <div className="p-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-right shrink-0">
                          <span className="text-[10px] font-mono uppercase text-slate-400 block">CA Réalisé</span>
                          <span className="text-sm font-mono font-black text-emerald-400">
                            {metrics.totalRevenue.toLocaleString('fr-FR')} FCFA
                          </span>
                        </div>

                        {/* Expand / Collapse Button */}
                        <button
                          type="button"
                          id={`toggle-sales-seller-${seller.id}`}
                          onClick={() => setExpandedSellerId(isExpanded ? null : seller.id)}
                          className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                            isExpanded
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                              : 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/20'
                          }`}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>
                            {isExpanded
                              ? 'Masquer les ventes'
                              : `Voir les ventes (${metrics.salesByDate.length})`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Detailed Performance Metrics Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-slate-800/80">
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Ventes Effectuées</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xs font-mono font-bold text-white">{metrics.completedCount}</span>
                          <span className="text-[10px] text-slate-500">transactions</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Volume Cartons</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xs font-mono font-bold text-amber-300">{metrics.totalCartons}</span>
                          <span className="text-[10px] text-slate-500">cartons livrés</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Couverture PDV</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xs font-mono font-bold text-blue-300">{metrics.distinctPos}</span>
                          <span className="text-[10px] text-slate-500">boutiques servies</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Panier Moyen</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {metrics.avgBasket.toLocaleString('fr-FR')}
                          </span>
                          <span className="text-[10px] text-slate-500">FCFA</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Section: Sales List by Date for this Seller */}
                  {isExpanded && (
                    <div className="p-5 md:p-6 bg-slate-950/70 border-t border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-red-400" />
                            <span>Ventes effectuées par date ({metrics.salesByDate.length})</span>
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Historique chronologique des transactions enregistrées sur le terrain par {seller.firstName} {seller.lastName}.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowCriteriaModalSeller(seller)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-slate-700 transition"
                        >
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                          <span>Fiche Notation Complète</span>
                        </button>
                      </div>

                      {/* Sales List Ordered by Date */}
                      <div className="space-y-3">
                        {metrics.salesByDate.map((sale) => {
                          const isDetailOpen = expandedSaleDetailId === sale.id;
                          const saleDate = new Date(sale.createdAt || (sale as any).created_at || Date.now());
                          const dateFormatted = saleDate.toLocaleDateString('fr-FR', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          });
                          const timeFormatted = saleDate.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                          const cartonsCount =
                            sale.totalCartons ??
                            (sale as any).total_cartons ??
                            (sale.items ? sale.items.reduce((sum: number, it: any) => sum + (it.quantityCartons || it.quantity_cartons || 0), 0) : 0);

                          const itemsList = sale.items || [];

                          return (
                            <div
                              key={sale.id}
                              className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition hover:border-slate-700"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                {/* Date, Sale number & POS */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-black text-xs text-white">
                                      {sale.saleNumber || (sale as any).sale_number || `VNT-${sale.id}`}
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-slate-500" />
                                      {dateFormatted} à {timeFormatted}
                                    </span>
                                    {sale.status === 'COMPLETED' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#15803D] text-[#FFFFFF]">
                                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                        Validée
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-300 border border-red-800/80">
                                        <XCircle className="w-2.5 h-2.5 text-red-400" />
                                        Annulée
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                    <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span>{sale.posName || (sale as any).pos_name || 'Point de Vente'}</span>
                                    {sale.posNeighborhood && (
                                      <span className="text-slate-500">
                                        • {sale.posNeighborhood}
                                      </span>
                                    )}
                                  </div>

                                  {/* Quick items preview badges */}
                                  {itemsList.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                      {itemsList.map((item: any, idx: number) => (
                                        <span
                                          key={idx}
                                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800"
                                        >
                                          {item.quantityCartons || item.quantity_cartons}x {item.productName || item.product_name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Amount & Actions */}
                                <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                                  <div className="text-right">
                                    <span className="text-xs font-mono font-bold text-emerald-400 block">
                                      {(sale.totalAmount ?? (sale as any).total_amount ?? 0).toLocaleString('fr-FR')} FCFA
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {cartonsCount} carton{cartonsCount > 1 ? 's' : ''}
                                    </span>
                                  </div>

                                  {/* Reçu Button */}
                                  <button
                                    type="button"
                                    onClick={() => onOpenReceipt(sale)}
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                                    title="Imprimer / Consulter le reçu de vente"
                                  >
                                    <Receipt className="w-3.5 h-3.5 text-red-400" />
                                  </button>

                                  {/* Accordion detail button */}
                                  <button
                                    type="button"
                                    onClick={() => setExpandedSaleDetailId(isDetailOpen ? null : sale.id)}
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                                    title="Détails des articles et prix"
                                  >
                                    {isDetailOpen ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Sale Item Details */}
                              {isDetailOpen && itemsList.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-800 text-xs overflow-x-auto">
                                  <table className="w-full text-left min-w-[320px]">
                                    <thead className="text-[10px] font-mono uppercase text-slate-500 border-b border-slate-800">
                                      <tr>
                                        <th className="py-1">Produit</th>
                                        <th className="py-1 text-center">Quantité</th>
                                        <th className="py-1 text-right">Prix Unitaire</th>
                                        <th className="py-1 text-right">Total Ligne</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                      {itemsList.map((item: any, idx: number) => (
                                        <tr key={idx}>
                                          <td className="py-1.5 font-medium">{item.productName || item.product_name}</td>
                                          <td className="py-1.5 text-center font-mono font-bold text-amber-300">
                                            {item.quantityCartons || item.quantity_cartons} carton(s)
                                          </td>
                                          <td className="py-1.5 text-right font-mono text-slate-400">
                                            {(item.unitPrice || item.unit_price || 0).toLocaleString('fr-FR')} F
                                          </td>
                                          <td className="py-1.5 text-right font-mono font-bold text-emerald-400">
                                            {(item.totalPrice || item.total_price || 0).toLocaleString('fr-FR')} F
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {metrics.salesByDate.length === 0 && (
                          <div className="py-6 text-center text-xs text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
                            Aucune vente enregistrée pour ce vendeur sur la période sélectionnée.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {selectedDpSellers.length === 0 && (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                Aucun vendeur ne correspond aux critères de recherche dans ce Drop Point.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Full Performance & Notation Details */}
      {showCriteriaModalSeller && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold tracking-wider">
                  Évaluation Commerciale Réseau
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Notation & Performance : {showCriteriaModalSeller.firstName} {showCriteriaModalSeller.lastName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCriteriaModalSeller(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <SellerPerformanceCard
              userId={showCriteriaModalSeller.id}
              userName={`${showCriteriaModalSeller.firstName} ${showCriteriaModalSeller.lastName}`}
            />

            <div className="mt-5 pt-4 border-t border-slate-800 text-right">
              <button
                type="button"
                onClick={() => setShowCriteriaModalSeller(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
