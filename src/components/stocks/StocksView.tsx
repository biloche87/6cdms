import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { StockItem, StockMovement } from '../../types/index.ts';
import { formatDateTime } from '../../utils/date.ts';
import { OfflineCacheBadge } from '../offline/OfflineCacheBadge.tsx';
import { StockDot, StockStatusBadge, getStockStatus } from './StockStatusIndicator.tsx';
import { VrsStockCard } from './VrsStockCard.tsx';
import { VrsSupplyDraftModal } from './VrsSupplyDraftModal.tsx';
import { useVrsSupplyDraft, VrsSupplyDraftItem } from '../../utils/vrsSupplyDraft.ts';
import {
  Boxes,
  FileSpreadsheet,
  History,
  User,
  Building2,
  Search,
  X,
  Info,
  Truck,
  Eye,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export function formatCartons(count: number): string {
  const abs = Math.abs(count);
  return `${count.toLocaleString('fr-FR')} ${abs <= 1 ? 'carton' : 'cartons'}`;
}

export const StocksView: React.FC = () => {
  const { user } = useAuth();
  const isVrs = user?.role === 'VRS';
  const [activeTab, setActiveTab] = useState<'dp' | 'vrs' | 'movements'>(user?.role === 'VRS' ? 'vrs' : 'dp');
  const [dpStocks, setDpStocks] = useState<StockItem[]>([]);
  const [vrsStocks, setVrsStocks] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critique' | 'faible' | 'optimal'>('all');

  // Shared supply draft for VRS
  const {
    draft,
    addItem,
    removeItem,
    clearDraft,
    totalCartons,
    totalProducts,
  } = useVrsSupplyDraft(user?.id);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadStocks = async () => {
    setLoading(true);
    try {
      if (user?.role === 'VRS') {
        const [vrsRes, mvtRes] = await Promise.all([
          api.getVrsStocks({ vrsId: user.id }),
          api.getStockMovements(),
        ]);
        setDpStocks([]);
        setVrsStocks(vrsRes.stocks || []);
        setMovements(mvtRes.movements || []);
      } else {
        const [dpRes, vrsRes, mvtRes] = await Promise.all([
          api.getDropPointStocks(),
          api.getVrsStocks(),
          api.getStockMovements(),
        ]);
        setDpStocks(dpRes.stocks || []);
        setVrsStocks(vrsRes.stocks || []);
        setMovements(mvtRes.movements || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStocks();
  }, []);

  // Strict deduplication of VRS stocks: exactly ONE item per product
  const uniqueVrsStocks = useMemo(() => {
    const map = new Map<number, StockItem>();
    vrsStocks.forEach((s) => {
      if (!map.has(s.productId)) {
        map.set(s.productId, s);
      }
    });
    return Array.from(map.values());
  }, [vrsStocks]);

  // Fast map of draft items
  const draftMap = useMemo(() => {
    const map = new Map<number, VrsSupplyDraftItem>();
    draft.items.forEach((it) => map.set(it.productId, it));
    return map;
  }, [draft.items]);

  const dpCounts = useMemo(() => {
    let optimal = 0;
    let faible = 0;
    let critique = 0;
    dpStocks.forEach((s) => {
      const st = getStockStatus(s.availableQuantity, s.alertThreshold).level;
      if (st === 'critique') critique++;
      else if (st === 'faible') faible++;
      else optimal++;
    });
    return { total: dpStocks.length, optimal, faible, critique };
  }, [dpStocks]);

  const vrsCounts = useMemo(() => {
    let optimal = 0;
    let faible = 0;
    let critique = 0;
    uniqueVrsStocks.forEach((s) => {
      const st = getStockStatus(s.availableQuantity, s.alertThreshold).level;
      if (st === 'critique') critique++;
      else if (st === 'faible') faible++;
      else optimal++;
    });
    return { total: uniqueVrsStocks.length, optimal, faible, critique };
  }, [uniqueVrsStocks]);

  const activeCounts = activeTab === 'dp' ? dpCounts : vrsCounts;

  const filteredDpStocks = useMemo(() => {
    return dpStocks.filter((s) => {
      const st = getStockStatus(s.availableQuantity, s.alertThreshold).level;
      const matchesStatus = statusFilter === 'all' || st === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.productName.toLowerCase().includes(q) ||
        s.productRef.toLowerCase().includes(q) ||
        s.categoryName.toLowerCase().includes(q) ||
        (s.dropPointName && s.dropPointName.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [dpStocks, statusFilter, searchQuery]);

  const filteredVrsStocks = useMemo(() => {
    return uniqueVrsStocks.filter((s) => {
      const st = getStockStatus(s.availableQuantity, s.alertThreshold).level;
      const matchesStatus = statusFilter === 'all' || st === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.productName.toLowerCase().includes(q) ||
        s.productRef.toLowerCase().includes(q) ||
        (s.vrsName && s.vrsName.toLowerCase().includes(q)) ||
        (s.dropPointName && s.dropPointName.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [uniqueVrsStocks, statusFilter, searchQuery]);

  // Handle direct submission of the grouped supply request
  const handleSendSupplyRequest = async (desiredDate?: string, notes?: string) => {
    if (draft.items.length === 0) return;
    setSubmittingRequest(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const itemsPayload = draft.items.map((it) => ({
        productId: it.productId,
        quantityRequested: it.quantityRequested,
      }));

      const res = await api.createSupplyRequest({
        items: itemsPayload,
        desiredLoadingDate: desiredDate || new Date().toISOString().split('T')[0],
        notes: notes || undefined,
      });

      clearDraft();
      setIsDetailModalOpen(false);
      setActionSuccess(
        res.message ||
          `Demande de chargement (${formatCartons(totalCartons)}) transmise au Sales Admin avec succès au statut "Demandée".`
      );
      await loadStocks();
    } catch (err: any) {
      setActionError(err.message || "Erreur lors de l'envoi de la demande de chargement.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className={`space-y-6 ${isVrs && totalProducts > 0 ? 'pb-32 sm:pb-24' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-purple-500" />
              <h1 className="text-xl font-black text-white uppercase tracking-tight">
                {isVrs ? 'Mon stock' : 'Stocks'}
              </h1>
            </div>
            <OfflineCacheBadge moduleName="Stocks" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isVrs
              ? 'Inventaire ambulant sous votre responsabilité personnelle exclusive. Suivi des niveaux et réapprovisionnement.'
              : 'Supervision des stocks dépôts, stocks en possession des vendeurs et grand livre des mouvements'}
          </p>
        </div>

        <a
          href="/api/stats/export/csv?type=stocks"
          download
          className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition self-start sm:self-auto cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Exporter les Stocks (CSV)</span>
        </a>
      </div>

      {/* Success / Error Banners */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-2xl text-xs sm:text-sm text-emerald-300 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-2xl text-xs sm:text-sm text-rose-300 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-medium space-x-2 sm:space-x-4 overflow-x-auto pb-0.5 scrollbar-none">
        {!isVrs && (
          <button
            type="button"
            onClick={() => setActiveTab('dp')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 shrink-0 whitespace-nowrap px-1 sm:px-2 min-h-[42px] ${
              activeTab === 'dp'
                ? 'border-red-500 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Stocks Dépôt (Drop Point)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('vrs')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 shrink-0 whitespace-nowrap px-1 sm:px-2 min-h-[42px] ${
            activeTab === 'vrs'
              ? 'border-red-500 text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{isVrs ? 'Mon Stock Ambulant (VRS)' : 'Stocks Vendeurs (VRS)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('movements')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 shrink-0 whitespace-nowrap px-1 sm:px-2 min-h-[42px] ${
            activeTab === 'movements'
              ? 'border-red-500 text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{isVrs ? 'Mes Mouvements de Stock' : 'Mouvements & Traçabilité'}</span>
        </button>
      </div>

      {/* Filter Toolbar & Visual Legend */}
      {activeTab !== 'movements' && (
        <div className="space-y-3">
          {/* Legend Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Info className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Indicateurs de niveau de stock :</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5" title="Quantité supérieure au seuil d'alerte configuré">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-1 ring-emerald-400/30 shrink-0" />
                <span className="text-emerald-300 font-bold">Optimal</span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">(Suffisant)</span>
              </div>
              <div className="flex items-center gap-1.5" title="Quantité sous ou égale au seuil d'alerte">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/30 shadow-xs shadow-amber-400/40 shrink-0" />
                <span className="text-amber-300 font-bold">Faible</span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">(Alerte appro)</span>
              </div>
              <div className="flex items-center gap-1.5" title="Rupture immédiate (0 carton) ou réserve critique minimale (≤ 40% seuil)">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-rose-500/40 shadow-xs shadow-rose-500/50 shrink-0" />
                <span className="text-rose-300 font-bold">Critique</span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">(Rupture / Urgence)</span>
              </div>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
            {/* Quick Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 mr-1 hidden sm:inline">Filtrer :</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-white border-slate-600 shadow-xs'
                    : 'bg-slate-950/60 text-slate-400 hover:text-white border-slate-800'
                }`}
              >
                Tous ({activeCounts.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('optimal')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                  statusFilter === 'optimal'
                    ? 'bg-emerald-950 text-emerald-200 border-emerald-600 ring-1 ring-emerald-500 shadow-xs'
                    : 'bg-slate-950/60 text-emerald-400 hover:bg-emerald-950/40 border-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>Optimal ({activeCounts.optimal})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('faible')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                  statusFilter === 'faible'
                    ? 'bg-amber-950 text-amber-200 border-amber-600 ring-1 ring-amber-500 shadow-xs'
                    : 'bg-slate-950/60 text-amber-400 hover:bg-amber-950/40 border-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span>Faible ({activeCounts.faible})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('critique')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                  statusFilter === 'critique'
                    ? 'bg-rose-950 text-rose-200 border-rose-600 ring-1 ring-rose-500 shadow-xs'
                    : 'bg-slate-950/60 text-rose-400 hover:bg-rose-950/40 border-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span>Critique</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-600 text-white leading-none">
                  {activeCounts.critique}
                </span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit, réf..."
                className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Drop Point Stocks */}
      {activeTab === 'dp' && (
        <div className="space-y-3">
          {/* Mobile Cards (< md) */}
          <div className="block md:hidden space-y-3">
            {filteredDpStocks.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-2">
                <p>Aucun stock dépôt ne correspond à vos critères de recherche ou filtre.</p>
                {(statusFilter !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-purple-400 hover:text-purple-300 underline font-semibold"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            ) : (
              filteredDpStocks.map((s) => (
                <div
                  key={`mob-dp-${s.id}`}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <StockDot
                        available={s.availableQuantity}
                        threshold={s.alertThreshold}
                        size="md"
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-sm break-words leading-snug line-clamp-2">
                          {s.productName}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-500">Réf: {s.productRef}</span>
                          <span>•</span>
                          <span className="text-amber-400 text-[11px]">{s.categoryName}</span>
                        </div>
                      </div>
                    </div>
                    <StockStatusBadge
                      available={s.availableQuantity}
                      threshold={s.alertThreshold}
                      className="shrink-0"
                    />
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-semibold text-slate-300">{s.dropPointName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-mono">Stock Dispo</span>
                      <strong className="text-sm font-mono text-white">
                        {formatCartons(s.availableQuantity)}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-mono">Seuil Alerte</span>
                      <strong className="text-sm font-mono text-slate-400">
                        {formatCartons(s.alertThreshold)}
                      </strong>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-slate-400">Prix unitaire carton :</span>
                      <strong className="font-mono text-emerald-400 text-xs">
                        {s.unitPrice.toLocaleString('fr-FR')} FCFA
                      </strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Produit & État</th>
                    <th className="py-3 px-4">Gamme</th>
                    <th className="py-3 px-4">Dépôt</th>
                    <th className="py-3 px-4 text-center">Stock Dispo</th>
                    <th className="py-3 px-4 text-center">Seuil Alerte</th>
                    <th className="py-3 px-4 text-right">Prix Carton</th>
                    <th className="py-3 px-4 text-center">Niveau de Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredDpStocks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Aucun stock dépôt ne correspond à vos critères de recherche ou filtre.
                      </td>
                    </tr>
                  ) : (
                    filteredDpStocks.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <StockDot
                              available={s.availableQuantity}
                              threshold={s.alertThreshold}
                              size="md"
                            />
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{s.productName}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">Réf: {s.productRef}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{s.categoryName}</td>
                        <td className="py-3 px-4 text-slate-300 font-medium">{s.dropPointName}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-sm text-white">
                          {formatCartons(s.availableQuantity)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-400">
                          {formatCartons(s.alertThreshold)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-200">
                          {s.unitPrice.toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StockStatusBadge
                            available={s.availableQuantity}
                            threshold={s.alertThreshold}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: VRS Stocks */}
      {activeTab === 'vrs' && (
        <div className="space-y-4">
          {/* View for VRS users: Responsive Cards Grid (Works seamlessly at 390px, 768px, and desktop) */}
          {isVrs ? (
            filteredVrsStocks.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-2">
                <p>Aucun produit ne correspond à vos critères de recherche ou filtre.</p>
                {(statusFilter !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-purple-400 hover:text-purple-300 underline font-semibold cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVrsStocks.map((s) => (
                  <VrsStockCard
                    key={`vrs-card-${s.productId}`}
                    item={s}
                    draftItem={draftMap.get(s.productId)}
                    onValidateLine={addItem}
                    onRemoveLine={removeItem}
                    formatCartons={formatCartons}
                  />
                ))}
              </div>
            )
          ) : (
            /* Non-VRS Supervisor View (SA, SAN, FSS) */
            <div className="space-y-3">
              {/* Mobile Cards (< md) */}
              <div className="block md:hidden space-y-3">
                {filteredVrsStocks.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-2">
                    <p>Aucun stock vendeur disponible pour ces critères.</p>
                  </div>
                ) : (
                  filteredVrsStocks.map((s) => (
                    <div
                      key={`mob-vrs-${s.id}`}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white text-sm">{s.vrsName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{s.dropPointName}</div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                          {s.categoryName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                        <div className="flex items-center gap-2 min-w-0">
                          <StockDot
                            available={s.availableQuantity}
                            threshold={s.alertThreshold}
                            size="md"
                          />
                          <div className="text-xs text-slate-200 break-words line-clamp-2">
                            Produit : <strong className="text-white">{s.productName}</strong>
                          </div>
                        </div>
                        <StockStatusBadge
                          available={s.availableQuantity}
                          threshold={s.alertThreshold}
                          className="shrink-0"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                        <div>
                          <span className="block text-[10px] text-slate-500 uppercase font-mono">Stock Dispo</span>
                          <strong className="text-sm font-mono text-emerald-400">
                            {formatCartons(s.availableQuantity)}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-500 uppercase font-mono">Seuil Alerte</span>
                          <strong className="text-sm font-mono text-slate-400">
                            {formatCartons(s.alertThreshold)}
                          </strong>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                          <span className="text-slate-400">Valeur marchande :</span>
                          <strong className="font-mono text-amber-300 text-xs">
                            {(s.availableQuantity * s.unitPrice).toLocaleString('fr-FR')} FCFA
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Vendeur (VRS)</th>
                        <th className="py-3 px-4">Produit & État</th>
                        <th className="py-3 px-4">Gamme</th>
                        <th className="py-3 px-4 text-center">Stock Disponible</th>
                        <th className="py-3 px-4 text-center">Niveau de Stock</th>
                        <th className="py-3 px-4 text-center">Valeur Marchande</th>
                        <th className="py-3 px-4 text-center">Seuil Alerte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {filteredVrsStocks.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500">
                            Aucun stock vendeur ne correspond à vos critères de recherche ou filtre.
                          </td>
                        </tr>
                      ) : (
                        filteredVrsStocks.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-3 px-4">
                              <div className="font-bold text-white">{s.vrsName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{s.dropPointName}</div>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-200">
                              <div className="flex items-center gap-2.5">
                                <StockDot
                                  available={s.availableQuantity}
                                  threshold={s.alertThreshold}
                                  size="md"
                                />
                                <span>{s.productName}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-400">{s.categoryName}</td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-sm text-emerald-400">
                              {formatCartons(s.availableQuantity)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <StockStatusBadge
                                available={s.availableQuantity}
                                threshold={s.alertThreshold}
                              />
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-slate-300">
                              {(s.availableQuantity * s.unitPrice).toLocaleString('fr-FR')} FCFA
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-slate-400">
                              {formatCartons(s.alertThreshold)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Stock Movements */}
      {activeTab === 'movements' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date & Réf</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Produit</th>
                  <th className="py-3 px-4 text-center">Quantité</th>
                  <th className="py-3 px-4 text-center">Avant / Après</th>
                  <th className="py-3 px-4">Opérateur / Dépôt</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Aucun mouvement de stock enregistré.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono text-white text-[11px]">{m.reference}</div>
                        <div className="text-[10px] text-slate-500">{formatDateTime(m.createdAt)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            m.movementType === 'RECEIPT'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : m.movementType === 'TRANSFER'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : m.movementType === 'SALE'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {m.movementType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{m.productName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{m.productRef}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-sm text-white">
                        {formatCartons(m.quantity)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400">
                        {m.stockBefore !== undefined ? `${m.stockBefore} → ${m.stockAfter}` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-300">{m.dropPointName || '—'}</div>
                        {m.createdByName && (
                          <div className="text-[10px] text-slate-500">{m.createdByName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 italic text-[11px]">
                        {m.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Barre Récapitulative Fixe (VRS uniquement, dès qu'une ligne est validée) */}
      {isVrs && totalProducts > 0 && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 z-40 p-3 sm:p-4 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-black text-white flex items-center gap-2 flex-wrap">
                  <span>Ma demande :</span>
                  <span className="text-emerald-400">
                    {totalProducts} {totalProducts > 1 ? 'produits' : 'produit'}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400 font-mono">
                    {formatCartons(totalCartons)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Demande groupée prête à être transmise au Sales Admin
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(true)}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 shrink-0"
              >
                <Eye className="w-4 h-4" />
                <span>Voir</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendSupplyRequest()}
                disabled={submittingRequest}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/50 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {submittingRequest ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Envoyer la demande</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détail et Modification du Brouillon de Chargement */}
      {isVrs && (
        <VrsSupplyDraftModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          draft={draft}
          onUpdateQuantity={(prodId, newQty) => {
            const currentItem = draft.items.find((it) => it.productId === prodId);
            if (currentItem) {
              addItem({ ...currentItem, quantityRequested: newQty });
            }
          }}
          onRemoveItem={removeItem}
          onSendRequest={async (desiredDate, notes) => {
            await handleSendSupplyRequest(desiredDate, notes);
          }}
          submitting={submittingRequest}
          formatCartons={formatCartons}
        />
      )}
    </div>
  );
};

export default StocksView;
