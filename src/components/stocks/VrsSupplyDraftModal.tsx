import React, { useState } from 'react';
import { VrsSupplyDraft } from '../../utils/vrsSupplyDraft.ts';
import {
  X,
  Truck,
  Trash2,
  Plus,
  Minus,
  Send,
  Loader2,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface VrsSupplyDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: VrsSupplyDraft;
  onUpdateQuantity: (productId: number, qty: number) => void;
  onRemoveItem: (productId: number) => void;
  onSendRequest: (desiredDate: string, notes: string) => Promise<void>;
  submitting: boolean;
  formatCartons: (count: number) => string;
}

export const VrsSupplyDraftModal: React.FC<VrsSupplyDraftModalProps> = ({
  isOpen,
  onClose,
  draft,
  onUpdateQuantity,
  onRemoveItem,
  onSendRequest,
  submitting,
  formatCartons,
}) => {
  const [desiredDate, setDesiredDate] = useState(() => {
    return draft.desiredLoadingDate || new Date().toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState(() => draft.notes || '');

  if (!isOpen) return null;

  const totalCartons = draft.items.reduce((sum, it) => sum + (it.quantityRequested || 0), 0);
  const totalProducts = draft.items.length;

  const handleSend = async () => {
    await onSendRequest(desiredDate, notes);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[92vh] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-sheet-up sm:animate-modal-content"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Ma Demande de Chargement
              </h2>
              <p className="text-xs text-slate-400">
                {totalProducts} {totalProducts > 1 ? 'produits' : 'produit'} • {formatCartons(totalCartons)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {draft.items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
              <p>Aucun produit dans votre demande en cours.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Produits sélectionnés ({totalProducts})
              </span>
              {draft.items.map((it) => {
                const maxAvailable = it.availableStock || 9999;
                return (
                  <div
                    key={it.productId}
                    className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white break-words line-clamp-2">
                        {it.productName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Réf: {it.productRef} • Stock Dépôt: {formatCartons(maxAvailable)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(it.productId, Math.max(1, it.quantityRequested - 1))}
                        disabled={it.quantityRequested <= 1}
                        className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer disabled:opacity-30"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        min="1"
                        max={maxAvailable}
                        value={it.quantityRequested}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) {
                            onUpdateQuantity(it.productId, Math.min(maxAvailable, val));
                          }
                        }}
                        className="w-14 h-9 text-center font-mono font-bold text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
                      />

                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(it.productId, Math.min(maxAvailable, it.quantityRequested + 1))}
                        disabled={it.quantityRequested >= maxAvailable}
                        className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer disabled:opacity-30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(it.productId)}
                        className="w-9 h-9 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 flex items-center justify-center cursor-pointer ml-1"
                        title="Retirer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form options: Date & Notes */}
          {draft.items.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date de chargement souhaitée</span>
                </label>
                <input
                  type="date"
                  value={desiredDate}
                  onChange={(e) => setDesiredDate(e.target.value)}
                  className="w-full min-h-[48px] p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Observations / Remarques (Optionnel)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Passage au Dépôt prévu à 8h30..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3.5 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-900/95 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Ajouter d'autres produits
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={draft.items.length === 0 || submitting}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/50 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Envoyer la demande</span>
          </button>
        </div>
      </div>
    </div>
  );
};
