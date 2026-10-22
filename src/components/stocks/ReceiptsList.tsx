import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { StockReceipt } from '../../types/index.ts';
import { formatDate } from '../../utils/date.ts';
import {
  FileCheck2,
  Plus,
  Search,
  Calendar,
  Building2,
  Boxes,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ReceiptsListProps {
  onOpenNewReceipt: () => void;
}

export const ReceiptsList: React.FC<ReceiptsListProps> = ({ onOpenNewReceipt }) => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<StockReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedReceiptId, setExpandedReceiptId] = useState<number | null>(null);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const res = await api.getReceipts({ blNumber: search || undefined });
      setReceipts(res.receipts);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  const filtered = receipts.filter((r) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      r.receiptNumber.toLowerCase().includes(term) ||
      r.deliveryNoteNumber.toLowerCase().includes(term) ||
      r.supplier.toLowerCase().includes(term) ||
      r.dropPointName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-500" />
            <h1 className="text-xl font-black text-white uppercase tracking-tight">
              Réceptions Fournisseur (6C Distribution)
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enregistrement officiel des livraisons Fournisseur → 6C Distribution avec incrémentation des stocks nationaux.
          </p>
        </div>

        {user?.role === 'SALES_ADMIN_NATIONAL' && (
          <button
            type="button"
            onClick={onOpenNewReceipt}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Réception Fournisseur</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-xl p-3">
        <Search className="w-4 h-4 text-slate-500 absolute left-6 top-5" />
        <input
          type="text"
          placeholder="Rechercher par n° de BL, fournisseur, dépôt..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Mobile Card List (< md) */}
      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
            Aucun Bon de Livraison enregistré.
          </div>
        ) : (
          filtered.map((r) => {
            const isExpanded = expandedReceiptId === r.id;
            return (
              <div
                key={`mob-rcp-${r.id}`}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div>
                    <span className="font-mono font-bold text-white text-sm">{r.receiptNumber}</span>
                    <div className="text-[11px] font-mono text-blue-400 font-semibold">
                      BL: {r.deliveryNoteNumber}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-sm px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                    +{r.totalCartons} ctn
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500">Fournisseur :</span>
                    <span className="font-semibold text-white">{r.supplier}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500">Dépôt :</span>
                    <span className="font-medium text-slate-200">
                      {r.dropPointName} ({r.dropPointCode})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500">Date :</span>
                    <span className="font-mono text-slate-400">
                      {formatDate(r.receiptDate || (r as any).receipt_date)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500">Enregistré par :</span>
                    <span className="text-slate-400">{r.createdByName || '—'}</span>
                  </div>
                </div>

                {/* Items toggle */}
                {r.items && r.items.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedReceiptId(isExpanded ? null : r.id)}
                      className="w-full py-2 px-3 rounded-lg bg-slate-950/80 hover:bg-slate-800/60 text-slate-400 text-xs flex items-center justify-between transition min-h-[38px]"
                    >
                      <span className="flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-blue-400" />
                        <span>Détail des produits ({r.items.length})</span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                        {r.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-white">{it.productName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {it.categoryName} • {it.productRef}
                              </div>
                            </div>
                            <div className="font-mono font-bold text-blue-400">
                              +{it.quantityCartons} ctn
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">N° Réception</th>
                <th className="py-3 px-4">N° BL Fournisseur</th>
                <th className="py-3 px-4">Fournisseur</th>
                <th className="py-3 px-4">Dépôt Réceptionnaire</th>
                <th className="py-3 px-4 text-center">Volume Total</th>
                <th className="py-3 px-4">Date Réception</th>
                <th className="py-3 px-4">Enregistré par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filtered.map((r) => {
                const isExpanded = expandedReceiptId === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <button
                          type="button"
                          onClick={() => setExpandedReceiptId(isExpanded ? null : r.id)}
                          className="hover:text-blue-400 flex items-center gap-1.5"
                        >
                          <span>{r.receiptNumber}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-300 font-semibold">{r.deliveryNoteNumber}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">{r.supplier}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">{r.dropPointName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{r.dropPointCode}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                        {r.totalCartons} cartons
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {formatDate(r.receiptDate || (r as any).receipt_date)}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{r.createdByName}</td>
                    </tr>

                    {/* Expandable items */}
                    {isExpanded && r.items && (
                      <tr className="bg-slate-950/80">
                        <td colSpan={7} className="p-4">
                          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Lignes du Bon de Livraison #{r.deliveryNoteNumber}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {r.items.map((it, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="font-bold text-white">{it.productName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {it.categoryName} • Réf: {it.productRef}
                                  </div>
                                </div>
                                <div className="font-mono font-bold text-blue-400">
                                  +{it.quantityCartons} cartons
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Aucun Bon de Livraison enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
