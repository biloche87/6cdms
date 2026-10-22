import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Product, DropPoint } from '../../types/index.ts';
import {
  X,
  Truck,
  Plus,
  Trash2,
  Calendar,
  MessageSquare,
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  Check,
  Edit2,
  Package,
  Minus,
} from 'lucide-react';

interface NewDpSupplyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ValidatedLineItem {
  productId: number;
  productName: string;
  productRef: string;
  categoryName?: string;
  quantity: number;
  cessionPrice: number;
  totalPrice: number;
}

interface DraftLineState {
  productId: number | '';
  quantity: number | string;
  isEditingIndex?: number | null;
}

export const NewDpSupplyRequestModal: React.FC<NewDpSupplyRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [selectedDpId, setSelectedDpId] = useState<number>(user?.dropPointId || 1);
  const [desiredDate, setDesiredDate] = useState<string>(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );
  const [comments, setComments] = useState<string>('');

  // Multi-products line-by-line management
  const [validatedLines, setValidatedLines] = useState<ValidatedLineItem[]>([]);
  const [draftLine, setDraftLine] = useState<DraftLineState | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    api.getProducts().then((res) => {
      const prods = res.products || [];
      setProducts(prods);

      // Start with a clean draft line if no lines yet
      if (prods.length > 0 && validatedLines.length === 0) {
        setDraftLine({
          productId: prods[0].id,
          quantity: 20,
          isEditingIndex: null,
        });
      }
    }).catch(console.error);

    if (user?.role === 'SALES_ADMIN_NATIONAL') {
      api.getDropPoints().then((res) => {
        setDropPoints(res.dropPoints || []);
        if (res.dropPoints && res.dropPoints.length > 0) {
          setSelectedDpId(res.dropPoints[0].id);
        }
      }).catch(console.error);
    } else if (user?.dropPointId) {
      setSelectedDpId(user.dropPointId);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const getProductCessionPrice = (prod?: Product): number => {
    if (!prod) return 0;
    if (prod.dpCessionPrice && prod.dpCessionPrice > 0) return prod.dpCessionPrice;
    return Math.round((prod.unitPrice || 0) * 0.85);
  };

  // Products available to be added (excluding already validated ones, unless editing)
  const availableProducts = products.filter((p) => {
    if (draftLine?.isEditingIndex != null) {
      const currentEditingItem = validatedLines[draftLine.isEditingIndex];
      if (currentEditingItem && currentEditingItem.productId === p.id) return true;
    }
    return !validatedLines.some((vl, idx) => vl.productId === p.id && idx !== draftLine?.isEditingIndex);
  });

  const selectedDraftProduct = products.find((p) => p.id === draftLine?.productId);
  const draftCessionPrice = getProductCessionPrice(selectedDraftProduct);
  const draftQuantityNum = typeof draftLine?.quantity === 'number' ? draftLine.quantity : parseInt(String(draftLine?.quantity || '0'), 10) || 0;
  const draftLineTotal = draftCessionPrice * draftQuantityNum;

  const canValidateDraft = Boolean(
    draftLine &&
    draftLine.productId &&
    draftQuantityNum > 0
  );

  const handleValidateChoice = () => {
    if (!draftLine || !selectedDraftProduct || draftQuantityNum <= 0) return;

    const newLine: ValidatedLineItem = {
      productId: selectedDraftProduct.id,
      productName: selectedDraftProduct.name,
      productRef: selectedDraftProduct.reference || `REF-${selectedDraftProduct.id}`,
      categoryName: selectedDraftProduct.categoryName || 'Catalogue',
      quantity: draftQuantityNum,
      cessionPrice: draftCessionPrice,
      totalPrice: draftLineTotal,
    };

    if (draftLine.isEditingIndex != null) {
      const next = [...validatedLines];
      next[draftLine.isEditingIndex] = newLine;
      setValidatedLines(next);
    } else {
      setValidatedLines([...validatedLines, newLine]);
    }

    // Reset draft line after validation
    setDraftLine(null);
    setError(null);
  };

  const handleAddNewLine = () => {
    if (draftLine !== null) return;
    const nextProd = availableProducts[0] || products[0];
    if (!nextProd) return;
    setDraftLine({
      productId: nextProd.id,
      quantity: 10,
      isEditingIndex: null,
    });
  };

  const handleEditLine = (index: number) => {
    const item = validatedLines[index];
    if (!item) return;
    setDraftLine({
      productId: item.productId,
      quantity: item.quantity,
      isEditingIndex: index,
    });
  };

  const handleRemoveLine = (index: number) => {
    setValidatedLines(validatedLines.filter((_, idx) => idx !== index));
    if (draftLine?.isEditingIndex === index) {
      setDraftLine(null);
    }
  };

  const handleCancelDraft = () => {
    setDraftLine(null);
  };

  const totalCartons = validatedLines.reduce((acc, l) => acc + l.quantity, 0);
  const totalAmount = validatedLines.reduce((acc, l) => acc + l.totalPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (validatedLines.length === 0) {
      if (canValidateDraft) {
        setError('Veuillez d\'abord cliquer sur "Valider ce choix" pour confirmer votre produit.');
      } else {
        setError('Veuillez ajouter et valider au moins un produit à la commande.');
      }
      return;
    }

    setLoading(true);
    try {
      await api.createDpSupplyRequest({
        dropPointId: selectedDpId,
        desiredDate,
        comments: comments.trim() || undefined,
        items: validatedLines.map((l) => ({
          productId: l.productId,
          quantityRequested: l.quantity,
        })),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création de la commande.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-order-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-modal-content"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="new-order-modal-title" className="text-base sm:text-lg font-bold text-white truncate">
                  Nouvelle commande
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  Statut : Demandée
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Commande de stock du Drop Point auprès de 6C Distribution (SAN)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-h-0">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Scope selection for SAN or fixed Drop Point info for SA */}
          {user?.role === 'SALES_ADMIN_NATIONAL' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Drop Point demandeur *
              </label>
              <select
                value={selectedDpId}
                onChange={(e) => setSelectedDpId(parseInt(e.target.value, 10))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {dropPoints.map((dp) => (
                  <option key={dp.id} value={dp.id}>
                    {dp.name} ({dp.code}) — {dp.city}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-slate-300">
                  Dépôt demandeur :{' '}
                  <strong className="text-white">
                    {user?.dropPointName || 'Mon Dépôt'} ({user?.dropPointCode || 'DKN'})
                  </strong>
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Destinataire : 6C Distribution (SAN)
              </span>
            </div>
          )}

          {/* Section: Formulaire multi-produits ligne par ligne */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-400" />
                <span>Produits de la commande (Cartons)</span>
              </label>
              {draftLine === null && (
                <button
                  type="button"
                  onClick={handleAddNewLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Ajouter un produit</span>
                </button>
              )}
            </div>

            {/* Zone de saisie d'une ligne (Draft Line) */}
            {draftLine !== null && (
              <div className="p-4 bg-slate-950 border-2 border-blue-500/60 rounded-2xl space-y-3 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    <span>{draftLine.isEditingIndex != null ? 'Modifier la ligne de commande' : 'Saisir un produit ligne par ligne'}</span>
                  </span>
                  {validatedLines.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCancelDraft}
                      className="text-xs text-slate-400 hover:text-white transition"
                    >
                      Annuler cette ligne
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Choix du produit */}
                  <div className="sm:col-span-7">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Produit *
                    </label>
                    <select
                      value={draftLine.productId}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setDraftLine({ ...draftLine, productId: isNaN(val) ? '' : val });
                      }}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
                    >
                      <option value="">-- Sélectionner un produit --</option>
                      {availableProducts.map((p) => {
                        const price = getProductCessionPrice(p);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.reference || `REF-${p.id}`}) — Cession : {price.toLocaleString('fr-FR')} F
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Quantité demandée */}
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Quantité (Cartons) *
                    </label>
                    <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = draftQuantityNum;
                          setDraftLine({ ...draftLine, quantity: Math.max(1, cur - 1) });
                        }}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 transition min-w-[36px] flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={draftLine.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftLine({
                            ...draftLine,
                            quantity: val === '' ? '' : Math.max(1, parseInt(val, 10) || 1),
                          });
                        }}
                        className="w-full py-2 bg-transparent text-center text-sm font-mono font-bold text-white focus:outline-none"
                        placeholder="1"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = draftQuantityNum;
                          setDraftLine({ ...draftLine, quantity: cur + 1 });
                        }}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 transition min-w-[36px] flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Info prix & bouton "Valider ce choix" */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800/80">
                  <div className="text-xs text-slate-400">
                    {selectedDraftProduct ? (
                      <span>
                        Prix cession : <strong className="font-mono text-slate-200">{draftCessionPrice.toLocaleString('fr-FR')} FCFA / ctn</strong>
                        {' • '}
                        Sous-total ligne : <strong className="font-mono text-emerald-400 font-bold">{draftLineTotal.toLocaleString('fr-FR')} FCFA</strong>
                      </span>
                    ) : (
                      <span>Sélectionnez un produit et indiquez la quantité de cartons</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleValidateChoice}
                    disabled={!canValidateDraft}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Valider ce choix</span>
                  </button>
                </div>
              </div>
            )}

            {/* Liste récapitulative des lignes validées */}
            {validatedLines.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Lignes validées ({validatedLines.length})
                </span>
                <div className="space-y-2">
                  {validatedLines.map((line, idx) => (
                    <div
                      key={line.productId}
                      className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-2">
                          <span>{line.productName}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {line.productRef}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {line.quantity} cartons × {line.cessionPrice.toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs sm:text-sm font-bold text-emerald-400">
                          {line.totalPrice.toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditLine(idx)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-900 transition"
                          title="Modifier cette ligne"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition"
                          title="Supprimer cette ligne"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bouton pour ajouter un produit supplémentaire si la ligne de saisie n'est pas ouverte */}
                {draftLine === null && (
                  <button
                    type="button"
                    onClick={handleAddNewLine}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-700 hover:border-blue-500 hover:bg-blue-950/20 text-slate-400 hover:text-blue-300 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Ajouter un produit</span>
                  </button>
                )}
              </div>
            )}

            {validatedLines.length === 0 && draftLine === null && (
              <div className="p-6 text-center bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <p className="text-xs text-slate-400">Aucun produit ajouté à la commande.</p>
                <button
                  type="button"
                  onClick={handleAddNewLine}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Ajouter un produit</span>
                </button>
              </div>
            )}
          </div>

          {/* Date souhaitée & Commentaire */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Date souhaitée *</span>
              </label>
              <input
                type="date"
                value={desiredDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDesiredDate(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Date prévisionnelle pour l'expédition et la mise à disposition par 6C Distribution (SAN).
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>Commentaire (facultatif)</span>
              </label>
              <textarea
                rows={2}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Ex : Réassort prioritaire suite à demande grossiste, horaires d'accès Dépôt..."
                className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Summary Box */}
          <div className="p-4 bg-blue-950/40 border border-blue-800/60 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Total cartons commandés :</span>
              <strong className="text-white font-mono text-base">{totalCartons} cartons</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[11px]">Montant de cession estimé :</span>
              <strong className="text-emerald-400 font-mono text-base">
                {totalAmount.toLocaleString('fr-FR')} FCFA
              </strong>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || validatedLines.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer la commande</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
