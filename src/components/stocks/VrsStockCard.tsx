import React, { useState, useEffect, useMemo } from 'react';
import { StockItem } from '../../types/index.ts';
import { VrsSupplyDraftItem } from '../../utils/vrsSupplyDraft.ts';
import { StockDot, StockStatusBadge, getStockStatus } from './StockStatusIndicator.tsx';
import {
  Truck,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface VrsStockCardProps {
  item: StockItem;
  draftItem?: VrsSupplyDraftItem;
  onValidateLine: (draftItem: VrsSupplyDraftItem) => void;
  onRemoveLine: (productId: number) => void;
  formatCartons: (count: number) => string;
}

export const VrsStockCard: React.FC<VrsStockCardProps> = ({
  item,
  draftItem,
  onValidateLine,
  onRemoveLine,
  formatCartons,
}) => {
  const status = getStockStatus(item.availableQuantity, item.alertThreshold);
  const isCritical = status.level === 'critique';
  const dpStock = Math.max(0, item.dropPointAvailableQuantity ?? 0);

  // Suggested quantity:
  // Cartons needed to cover 7 days of average sales (over 30 days) minus current stock, min 1, capped at DP stock
  const suggestedQuantity = useMemo(() => {
    const sales30d = item.sales30dCartons ?? 0;
    const avgDailySales = sales30d / 30;
    const sevenDaysSales = Math.ceil(avgDailySales * 7);
    const needed = sevenDaysSales - item.availableQuantity;
    const rawSuggested = Math.max(1, needed);
    return Math.min(rawSuggested, dpStock);
  }, [item.sales30dCartons, item.availableQuantity, dpStock]);

  const [isEditing, setIsEditing] = useState(false);
  const [qty, setQty] = useState<number>(() => {
    if (draftItem) return draftItem.quantityRequested;
    return Math.max(1, suggestedQuantity);
  });

  // Keep qty in sync when draftItem or suggestedQuantity changes
  useEffect(() => {
    if (draftItem) {
      setQty(draftItem.quantityRequested);
      setIsEditing(false);
    } else {
      setQty(Math.max(1, suggestedQuantity));
      setIsEditing(false);
    }
  }, [draftItem, suggestedQuantity]);

  const handleMinus = () => {
    setQty((prev) => Math.max(1, prev - 1));
  };

  const handlePlus = () => {
    setQty((prev) => Math.min(dpStock, prev + 1));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      setQty(1);
      return;
    }
    const clamped = Math.max(1, Math.min(dpStock, val));
    setQty(clamped);
  };

  const handleValidate = () => {
    if (dpStock <= 0 || qty <= 0) return;
    const validQty = Math.min(qty, dpStock);
    onValidateLine({
      productId: item.productId,
      productName: item.productName,
      productRef: item.productRef,
      categoryName: item.categoryName,
      quantityRequested: validQty,
      availableStock: dpStock,
    });
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    if (draftItem) {
      setQty(draftItem.quantityRequested);
    }
    setIsEditing(true);
  };

  const handleRemove = () => {
    onRemoveLine(item.productId);
    setIsEditing(false);
    setQty(Math.max(1, suggestedQuantity));
  };

  return (
    <div
      className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm transition ${
        isCritical
          ? 'border-rose-900/60 bg-gradient-to-b from-slate-900 to-rose-950/20'
          : 'border-slate-800'
      }`}
    >
      <div className="space-y-3">
        {/* Top Header: Category & Status Badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 font-semibold border border-slate-700/60">
            {item.categoryName}
          </span>
          <StockStatusBadge
            available={item.availableQuantity}
            threshold={item.alertThreshold}
            className="shrink-0"
          />
        </div>

        {/* Product Name (Never truncated, wraps to 2 lines without ellipsis) */}
        <div className="flex items-start gap-2.5">
          <StockDot
            available={item.availableQuantity}
            threshold={item.alertThreshold}
            size="md"
            className="mt-1"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-white text-sm sm:text-base break-words whitespace-normal leading-snug line-clamp-2">
              {item.productName}
            </h3>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Réf : {item.productRef || `REF-${item.productId}`}
            </div>
          </div>
        </div>

        {/* Stock Numbers Grid */}
        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-mono tracking-wider">
              Mon Stock Ambulant
            </span>
            <strong
              className={`text-sm font-mono font-bold ${
                isCritical ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {formatCartons(item.availableQuantity)}
            </strong>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-mono tracking-wider">
              Seuil d'Alerte
            </span>
            <strong className="text-sm font-mono text-slate-400">
              {formatCartons(item.alertThreshold)}
            </strong>
          </div>
          <div className="col-span-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Dispo au Drop Point :</span>
            <strong
              className={`font-mono font-semibold ${
                dpStock > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCartons(dpStock)}
            </strong>
          </div>
        </div>
      </div>

      {/* Zone Réapprovisionner (Pour les cartes Critique) */}
      {isCritical && (
        <div className="mt-4 pt-3.5 border-t border-slate-800 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Réapprovisionner</span>
            </span>
            {dpStock > 0 && !item.hasPendingRequest && !draftItem && (
              <span className="text-[11px] font-normal text-slate-400 lowercase font-mono">
                suggéré : {formatCartons(suggestedQuantity)}
              </span>
            )}
          </div>

          {/* Condition 5: Demande déjà en cours (statut Demandée non traitée) */}
          {item.hasPendingRequest ? (
            <div className="min-h-[48px] p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-center gap-2 text-xs font-bold text-amber-300">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Demande en cours</span>
            </div>
          ) : dpStock === 0 ? (
            /* Condition 2a: Stock DP est 0 -> Indisponible */
            <div className="min-h-[48px] p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Indisponible au Drop Point</span>
            </div>
          ) : draftItem && !isEditing ? (
            /* Condition 2c: Ligne validée dans le brouillon -> Réduite en une ligne */
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-xl flex items-center justify-between gap-2 text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-emerald-300 truncate">
                  Ajouté : {formatCartons(draftItem.quantityRequested)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                  title="Modifier la quantité"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Modifier</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="min-h-[44px] px-2.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                  title="Retirer de la demande"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Retirer</span>
                </button>
              </div>
            </div>
          ) : (
            /* Condition 2b: Sélecteur de quantité & Bouton Valider */
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {/* Bouton - (48px) */}
                <button
                  type="button"
                  onClick={handleMinus}
                  disabled={qty <= 1}
                  className="w-12 h-12 min-h-[48px] min-w-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xl flex items-center justify-center shrink-0 cursor-pointer shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition"
                  aria-label="Diminuer la quantité"
                >
                  <Minus className="w-4 h-4" />
                </button>

                {/* Champ numérique (48px) */}
                <input
                  type="number"
                  min="1"
                  max={dpStock}
                  value={qty}
                  onChange={handleInputChange}
                  className="h-12 min-h-[48px] w-20 sm:w-24 text-center font-mono font-bold text-base bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner"
                  aria-label="Quantité en cartons"
                />

                {/* Bouton + (48px) */}
                <button
                  type="button"
                  onClick={handlePlus}
                  disabled={qty >= dpStock}
                  className="w-12 h-12 min-h-[48px] min-w-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xl flex items-center justify-center shrink-0 cursor-pointer shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition"
                  aria-label="Augmenter la quantité"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Bouton Valider (48px, vert #15803D, texte blanc) */}
                <button
                  type="button"
                  onClick={handleValidate}
                  className="min-h-[48px] px-4 py-3 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer grow shrink-0 tracking-wide"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Valider</span>
                </button>
              </div>

              {/* Avertissement si plafonné au stock du Drop Point */}
              {qty >= dpStock && dpStock > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium px-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Maximum disponible : {formatCartons(dpStock)}</span>
                </div>
              )}

              {/* Note informative sur la suggestion */}
              <div className="text-[11px] text-slate-400 px-1 flex items-center justify-between">
                <span>Couverture estimée : 7 jours</span>
                <span>Stock Dépôt : {formatCartons(dpStock)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
