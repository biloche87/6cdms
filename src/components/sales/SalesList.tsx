import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { offlineSync } from '../../services/offlineSync.ts';
import { Sale } from '../../types/index.ts';
import { SaleReceiptModal } from './SaleReceiptModal.tsx';
import { DropPointSalesExplorer } from './DropPointSalesExplorer.tsx';
import { OfflineCacheBadge } from '../offline/OfflineCacheBadge.tsx';
import {
  ShoppingCart,
  Search,
  Filter,
  Plus,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Clock,
  Boxes,
  FileText,
  Printer,
  Receipt,
  Building2,
  ListFilter,
  Layers,
} from 'lucide-react';

interface SalesListProps {
  onOpenNewSale: () => void;
}

export const SalesList: React.FC<SalesListProps> = ({ onOpenNewSale }) => {
  const { user } = useAuth();
  const isSupervisory =
    user?.role === 'SALES_ADMIN_NATIONAL' ||
    user?.role === 'SALES_ADMIN' ||
    user?.role === 'FSS';

  const [viewMode, setViewMode] = useState<'droppoints' | 'flat'>(
    isSupervisory ? 'droppoints' : 'flat'
  );
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);

  const isVrs = user?.role === 'VRS';

  const loadSales = async () => {
    setLoading(true);
    try {
      const res = await api.getSales({
        vrsId: isVrs ? user?.id : undefined,
        status: statusFilter || undefined,
      });
      // Safety guarantee: filter strictly to the VRS's own sales (tolerant numeric check)
      const rawList = res.sales || [];
      let userSales = isVrs && user?.id
        ? rawList.filter((s: Sale) => {
            const sid = (s as any).vrsId ?? (s as any).vrs_id;
            return sid == null || Number(sid) === Number(user.id);
          })
        : rawList;

      // Anti-loss guarantee: If server returned empty sales, recover from persistent local cache
      if (userSales.length === 0 && user?.id) {
        try {
          const cached = localStorage.getItem(`6c_vrs_sales_history_${user.id}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              userSales = parsed;
            }
          }
        } catch {}
      } else if (userSales.length > 0 && user?.id) {
        try {
          localStorage.setItem(`6c_vrs_sales_history_${user.id}`, JSON.stringify(userSales));
        } catch {}
      }

      // Merge local offline pending sales that are not yet in database
      const pending = offlineSync.getPendingOfflineSales();
      const userPending = isVrs && user?.id
        ? pending.filter((p) => Number(p.vrsId) === Number(user.id))
        : pending;

      setPendingOfflineCount(userPending.length);

      // Filter out pending that might already be in userSales by clientGeneratedId or saleNumber
      const unSynced = userPending.filter(
        (p) => !userSales.some((s) => s.saleNumber === p.saleNumber || (s.notes && s.notes.includes(p.clientGeneratedId)))
      );

      const combined: Sale[] = [...(unSynced as any[]), ...userSales];
      setSales(combined);
    } catch (err: any) {
      console.error(err);
      // If offline or network error, display cached sales plus pending offline sales
      let fallbackSales: Sale[] = [];
      if (user?.id) {
        try {
          const cached = localStorage.getItem(`6c_vrs_sales_history_${user.id}`);
          if (cached) fallbackSales = JSON.parse(cached);
        } catch {}
      }
      const pending = offlineSync.getPendingOfflineSales();
      const userPending = isVrs && user?.id
        ? pending.filter((p) => Number(p.vrsId) === Number(user.id))
        : pending;
      setPendingOfflineCount(userPending.length);
      const combined = [...(userPending as any[]), ...fallbackSales];
      setSales(combined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();

    const handleSyncRefresh = () => {
      loadSales();
    };

    window.addEventListener('6c-sales-updated', handleSyncRefresh);
    window.addEventListener('6c-sales-synced', handleSyncRefresh);
    window.addEventListener('6c:sale-recorded', handleSyncRefresh);
    return () => {
      window.removeEventListener('6c-sales-updated', handleSyncRefresh);
      window.removeEventListener('6c-sales-synced', handleSyncRefresh);
      window.removeEventListener('6c:sale-recorded', handleSyncRefresh);
    };
  }, [statusFilter, user?.id]);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      const res = await offlineSync.syncAllPendingData();
      setActionMsg(res.message);
      await loadSales();
      setTimeout(() => setActionMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la synchronisation.');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleCancelSale = async (sale: Sale) => {
    const reason = window.prompt(`Confirmer l'annulation de la vente #${sale.saleNumber} ? Le stock sera restitué au vendeur. Motif :`, 'Erreur de saisie');
    if (reason === null) return;

    try {
      const res = await api.cancelSale(sale.id, reason);
      setActionMsg(res.message);
      await loadSales();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'annulation.');
    }
  };

  const filteredSales = sales.filter((s) => {
    if (isVrs && user?.id) {
      const sid = (s as any).vrsId ?? (s as any).vrs_id;
      if (sid != null && Number(sid) !== Number(user.id)) {
        return false;
      }
    }
    if (!search) return true;
    const term = search.toLowerCase();
    const saleNum = (s.saleNumber || (s as any).sale_number || '').toLowerCase();
    const posN = (s.posName || '').toLowerCase();
    const vrsN = (s.vrsName || '').toLowerCase();
    const dpCode = (s.dropPointCode || '').toLowerCase();
    return (
      saleNum.includes(term) ||
      posN.includes(term) ||
      vrsN.includes(term) ||
      dpCode.includes(term)
    );
  });

  const totalAmount = filteredSales
    .filter((s) => s.status === 'COMPLETED')
    .reduce((acc, s) => acc + (s.totalAmount ?? (s as any).total_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-red-500" />
              <h1 className="text-xl font-black text-white uppercase tracking-tight">
                {user?.role === 'VRS' ? 'Mes ventes' : 'Ventes'}
              </h1>
            </div>
            <OfflineCacheBadge moduleName="Ventes" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {user?.role === 'VRS'
              ? 'Consultation exclusive de vos ventes personnelles avec traçabilité et reçus'
              : 'Traçabilité intégrale des transactions terrain avec déduction automatique des stocks'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View mode toggle for Supervisory roles */}
          {isSupervisory && (
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                id="viewmode-droppoints-btn"
                onClick={() => setViewMode('droppoints')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-semibold ${
                  viewMode === 'droppoints'
                    ? 'bg-red-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Par Drop Point & Vendeurs</span>
              </button>
              <button
                type="button"
                id="viewmode-flat-btn"
                onClick={() => setViewMode('flat')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-semibold ${
                  viewMode === 'flat'
                    ? 'bg-red-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Journal Global (Liste)</span>
              </button>
            </div>
          )}

          <a
            href="/api/stats/export/csv?type=sales"
            download
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </a>

          {user?.role === 'VRS' && (
            <button
              type="button"
              onClick={onOpenNewSale}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Vente</span>
            </button>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 font-medium">
          {actionMsg}
        </div>
      )}

      {/* Conditional: Drop Point Explorer View vs Flat Sales Journal */}
      {viewMode === 'droppoints' && isSupervisory ? (
        <DropPointSalesExplorer
          onOpenReceipt={(sale) => setSelectedReceiptSale(sale)}
          onCancelSale={handleCancelSale}
        />
      ) : (
        <>
          {/* Banner for pending offline sales */}
          {pendingOfflineCount > 0 && (
            <div className="bg-amber-950/70 border border-amber-600/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span>{pendingOfflineCount} vente(s) enregistrée(s) hors-ligne</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                      Sync en attente
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-300/90 mt-0.5">
                    Effectuées sans connexion internet. Elles seront envoyées à la base de données dès détection du réseau.
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isManualSyncing}
                onClick={handleManualSync}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
                <span>{isManualSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}</span>
              </button>
            </div>
          )}

          {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Rechercher par n° de vente, point de vente, vendeur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="">Tous les statuts</option>
            <option value="COMPLETED">Validées (Actives)</option>
            <option value="CANCELLED">Annulées</option>
          </select>
        </div>
      </div>

      {/* Summary total */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400">
        <span>{filteredSales.length} vente(s) affichée(s)</span>
        <span>
          Total Cumulé : <strong className="text-emerald-400 font-mono text-sm">{totalAmount.toLocaleString('fr-FR')} FCFA</strong>
        </span>
      </div>

      {/* Mobile Card List (< md) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs">Chargement du journal des ventes...</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
            Aucune vente ne correspond aux critères.
          </div>
        ) : (
          filteredSales.map((s) => {
            const isExpanded = expandedSaleId === s.id;
            const saleNum = s.saleNumber || (s as any).sale_number || `VNT-${s.id}`;
            const created = s.createdAt || (s as any).created_at;
            const posName = s.posName || (s as any).pos_name || '-';
            const posOwner = s.posOwner || (s as any).pos_owner || '';
            const vrsName = s.vrsName || (s as any).vrs_name || '-';
            const vrsPublicId = s.vrsPublicId || (s as any).vrs_public_id || '';
            const dropPointCode = s.dropPointCode || (s as any).drop_point_code || '';
            const cartons = s.totalCartons ?? (s as any).total_cartons ?? s.itemCount ?? (s as any).item_count ?? 0;
            const amount = s.totalAmount ?? (s as any).total_amount ?? 0;
            const itemsList = s.items || [];

            return (
              <div
                key={`mob-${s.id}`}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 transition hover:border-slate-700"
              >
                {/* Header: Sale Ref & Status */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-white">{saleNum}</span>
                    {dropPointCode && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {dropPointCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(s as any).isOfflinePending || (s as any).status === 'OFFLINE_PENDING' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800/80 animate-pulse">
                        <Clock className="w-3 h-3 text-amber-400" />
                        Hors-ligne (Sync en attente)
                      </span>
                    ) : s.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#15803D] text-white">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                        Validée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-950 text-red-400 border border-red-800/70">
                        <XCircle className="w-3 h-3" />
                        {s.status || 'Annulée'}
                      </span>
                    )}
                    {s.status === 'COMPLETED' && !(s as any).isOfflinePending && (
                      <button
                        type="button"
                        onClick={() => handleCancelSale(s)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
                        title="Annuler cette vente"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* POS and VRS Info */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 text-sm truncate">{posName}</div>
                      {posOwner && <div className="text-[11px] text-slate-400">Gérant : {posOwner}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-slate-300">{vrsName}</div>
                      {vrsPublicId && <div className="text-[10px] text-slate-500 font-mono">{vrsPublicId}</div>}
                    </div>
                  </div>

                  {created && (
                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 pt-0.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>
                        {new Date(created).toLocaleDateString('fr-FR')} à{' '}
                        {new Date(created).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Items & Total summary */}
                <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Vendu :</span>
                    <span className="font-mono font-bold text-amber-400">
                      {cartons} carton(s)
                    </span>
                  </div>

                  {itemsList.length > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                      {itemsList.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                          <span className="truncate pr-2">{it.productName || (it as any).product_name}</span>
                          <span className="font-mono font-bold text-white shrink-0">
                            {it.quantityCartons ?? (it as any).quantity_cartons} ctn
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase">Net Payé</span>
                    <span className="font-mono font-black text-emerald-400 text-base">
                      {Number(amount).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>

                {/* Print Receipt and Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReceiptSale(s)}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
                    title="Imprimer ou télécharger le reçu pour le client"
                  >
                    <Printer className="w-4 h-4 text-amber-400" />
                    <span>Reçu de vente</span>
                  </button>

                  {s.status === 'COMPLETED' && (
                    <button
                      type="button"
                      onClick={() => handleCancelSale(s)}
                      className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      title="Annuler cette vente"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Annuler</span>
                    </button>
                  )}
                </div>

                {/* Stock Impact accordion toggle */}
                <button
                  type="button"
                  onClick={() => setExpandedSaleId(isExpanded ? null : s.id)}
                  className="w-full py-2 px-3 rounded-lg bg-slate-950/60 hover:bg-slate-800/60 text-slate-400 text-xs flex items-center justify-between transition min-h-[40px]"
                >
                  <span className="flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-purple-400" />
                    <span>Impact stock vendeur ({isExpanded ? 'Masquer' : 'Voir avant/après'})</span>
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isExpanded && itemsList.length > 0 && (
                  <div className="space-y-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                    {itemsList.map((it, idx) => {
                      const before = it.stockBefore ?? (it as any).stock_before;
                      const after = it.stockAfter ?? (it as any).stock_after;
                      const qty = it.quantityCartons ?? (it as any).quantity_cartons ?? 0;
                      return (
                        <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                          <div className="font-semibold text-white truncate">
                            {it.productName || (it as any).product_name}
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-center font-mono text-[11px]">
                            <div className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-400">
                              <span className="block text-[9px] text-slate-500 uppercase">Avant</span>
                              <strong>{before != null ? `${before}` : '-'}</strong>
                            </div>
                            <div className="p-1 rounded bg-red-950/50 border border-red-900/50 text-red-400">
                              <span className="block text-[9px] uppercase">Vendu</span>
                              <strong>-{qty}</strong>
                            </div>
                            <div className="p-1 rounded bg-emerald-950/50 border border-emerald-900/50 text-emerald-300">
                              <span className="block text-[9px] uppercase">Après</span>
                              <strong>{after != null ? `${after}` : '-'}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[960px] border-collapse">
            <thead className="bg-slate-950/90 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 w-40 whitespace-nowrap">Réf Vente</th>
                <th className="py-3 px-3 w-36 whitespace-nowrap">Date & Heure</th>
                <th className="py-3 px-3 min-w-[180px]">Point de Vente</th>
                <th className="py-3 px-3 w-40">Vendeur (VRS)</th>
                <th className="py-3 px-3 min-w-[200px]">Articles & Quantités</th>
                <th className="py-3 px-4 w-36 text-right whitespace-nowrap">Montant Net</th>
                <th className="py-3 px-3 w-28 text-center whitespace-nowrap">Statut</th>
                <th className="py-3 px-3 w-28 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#54a835] border-t-transparent rounded-full animate-spin" />
                      <span>Chargement du journal des ventes...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Aucune vente ne correspond aux critères.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => {
                  const isExpanded = expandedSaleId === s.id;
                  const saleNum = s.saleNumber || (s as any).sale_number || `VNT-${s.id}`;
                  const created = s.createdAt || (s as any).created_at;
                  const posName = s.posName || (s as any).pos_name || '-';
                  const posOwner = s.posOwner || (s as any).pos_owner || '';
                  const vrsName = s.vrsName || (s as any).vrs_name || '-';
                  const vrsPublicId = s.vrsPublicId || (s as any).vrs_public_id || '';
                  const dropPointCode = s.dropPointCode || (s as any).drop_point_code || '';
                  const cartons = s.totalCartons ?? (s as any).total_cartons ?? s.itemCount ?? (s as any).item_count ?? 0;
                  const amount = s.totalAmount ?? (s as any).total_amount ?? 0;
                  const itemsList = s.items || [];

                  return (
                    <React.Fragment key={s.id}>
                      <tr className={`hover:bg-slate-800/50 transition-colors ${isExpanded ? 'bg-slate-800/30' : ''}`}>
                        <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setExpandedSaleId(isExpanded ? null : s.id)}
                            className="hover:text-emerald-400 flex items-center gap-1.5 transition text-left"
                            title="Cliquer pour afficher les détails et variations de stock"
                          >
                            <span>{saleNum}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                          </button>
                          {dropPointCode && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 ml-0.5">
                              {dropPointCode}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {created ? (
                            <div>
                              <div>{new Date(created).toLocaleDateString('fr-FR')}</div>
                              <div className="text-[10px] text-slate-500">
                                {new Date(created).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-200 truncate max-w-[200px]" title={posName}>
                            {posName}
                          </div>
                          {posOwner && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                              {posOwner}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-200 truncate max-w-[150px] font-medium" title={vrsName}>
                            {vrsName}
                          </div>
                          {vrsPublicId && (
                            <div className="text-[10px] text-slate-500 font-mono">{vrsPublicId}</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono font-bold text-[11px] border border-amber-500/30 whitespace-nowrap">
                              {cartons} carton{cartons > 1 ? 's' : ''}
                            </span>
                            {itemsList.length > 0 && (
                              <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                                {itemsList[0]?.productName || 'Article'}
                                {itemsList.length > 1 && ` (+${itemsList.length - 1})`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-right text-emerald-400 text-sm whitespace-nowrap">
                          {Number(amount).toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {(s as any).isOfflinePending || (s as any).status === 'OFFLINE_PENDING' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse" title="Vente effectuée hors-ligne. Synchronisation automatique dès détection du réseau">
                              <Clock className="w-3 h-3 text-amber-400" />
                              Hors-ligne (Sync)
                            </span>
                          ) : s.status === 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#15803D] text-white">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                              Validée
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                              <XCircle className="w-3 h-3" />
                              Annulée
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptSale(s)}
                              className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-slate-800 transition"
                              title="Afficher, télécharger ou imprimer le reçu"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                            {s.status === 'COMPLETED' && !(s as any).isOfflinePending && (
                              <button
                                type="button"
                                onClick={() => handleCancelSale(s)}
                                className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                                title="Annuler cette vente et restituer le stock"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Detailed expandable items row with stock before/after breakdown */}
                      {isExpanded && s.items && (
                        <tr className="bg-slate-950/80">
                          <td colSpan={8} className="p-4">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                              <span>Détail des Produits & Variation des Stocks • Vente #{saleNum}</span>
                              <span className="text-slate-500 font-mono text-[11px] font-normal">
                                Déduction en temps réel du stock VRS
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {s.items.map((it, idx) => {
                                const before = it.stockBefore ?? (it as any).stock_before;
                                const after = it.stockAfter ?? (it as any).stock_after;
                                const qty = it.quantityCartons ?? (it as any).quantity_cartons ?? 0;
                                const price = Number(it.unitPrice ?? (it as any).unit_price ?? 0);
                                const total = Number(it.totalPrice ?? (it as any).total_price ?? 0);

                                return (
                                  <div
                                    key={idx}
                                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <div className="font-bold text-white text-sm">
                                          {it.productName || (it as any).product_name || 'Produit'}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                          {price.toLocaleString('fr-FR')} FCFA / carton
                                        </div>
                                      </div>
                                      <div className="font-mono font-bold text-emerald-400 text-sm">
                                        {total.toLocaleString('fr-FR')} FCFA
                                      </div>
                                    </div>

                                    {/* Stock variation block */}
                                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-center font-mono">
                                      <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                                        <div className="text-[9px] text-slate-500 uppercase">Stock Avant</div>
                                        <div className="font-bold text-slate-200 mt-0.5">
                                          {before != null ? `${before} ctn` : '-'}
                                        </div>
                                      </div>

                                      <div className="p-1.5 rounded-lg bg-red-950/40 border border-red-900/50">
                                        <div className="text-[9px] text-red-400 uppercase">Vendu</div>
                                        <div className="font-bold text-red-400 mt-0.5">
                                          -{qty} ctn
                                        </div>
                                      </div>

                                      <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-900/50">
                                        <div className="text-[9px] text-emerald-400 uppercase">Stock Après</div>
                                        <div className="font-bold text-emerald-300 mt-0.5">
                                          {after != null ? `${after} ctn` : '-'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {s.notes && (
                              <div className="mt-2 text-xs text-slate-400 italic">
                                Note : {s.notes}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Thermal Receipt Modal (80x55mm format) */}
      <SaleReceiptModal
        isOpen={!!selectedReceiptSale}
        onClose={() => setSelectedReceiptSale(null)}
        sale={selectedReceiptSale}
      />
    </div>
  );
};
