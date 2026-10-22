import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Product } from '../../types/index.ts';
import { DocumentAttachmentPicker } from '../common/DocumentAttachmentPicker.tsx';
import {
  X,
  Truck,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Boxes,
  FileCheck2,
  Shield,
  Calendar,
  Search,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { getVrsSupplyDraft, setVrsSupplyDraft, clearVrsSupplyDraft } from '../../utils/vrsSupplyDraft.ts';

interface SupplyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: () => void;
}

interface ValidatedLineItem {
  productId: number;
  productName: string;
  productRef: string;
  categoryName: string;
  quantityRequested: number;
  availableStock: number;
}

interface DraftLineState {
  productId: number | '';
  quantityRequested: string | number;
  isEditingExisting: boolean;
  warningMessage: string | null;
}

export const SupplyRequestModal: React.FC<SupplyRequestModalProps> = ({
  isOpen,
  onClose,
  onRequestCreated,
}) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [dpStocks, setDpStocks] = useState<Record<number, number>>({});
  const [validatedItems, setValidatedItems] = useState<ValidatedLineItem[]>([]);
  const [draftLine, setDraftLine] = useState<DraftLineState | null>({
    productId: '',
    quantityRequested: '',
    isEditingExisting: false,
    warningMessage: null,
  });
  const [productSearch, setProductSearch] = useState('');
  const [desiredLoadingDate, setDesiredLoadingDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [blNumber, setBlNumber] = useState('');
  const [blAttachment, setBlAttachment] = useState<string>('');
  const [blFileName, setBlFileName] = useState<string>('');
  const [blFileType, setBlFileType] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Confirmation modal states
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [editingOriginalItem, setEditingOriginalItem] = useState<ValidatedLineItem | null>(null);

  // Initialize and load data on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setNotes('');
      setDesiredLoadingDate(new Date().toISOString().split('T')[0]);
      setBlNumber('');
      setBlAttachment('');
      setBlFileName('');
      setBlFileType('');
      const existingDraft = getVrsSupplyDraft(user?.id);
      if (existingDraft.items && existingDraft.items.length > 0) {
        setValidatedItems(existingDraft.items);
        setDraftLine(null);
        if (existingDraft.desiredLoadingDate) setDesiredLoadingDate(existingDraft.desiredLoadingDate);
        if (existingDraft.notes) setNotes(existingDraft.notes);
      } else {
        setValidatedItems([]);
        setDraftLine({
          productId: '',
          quantityRequested: '',
          isEditingExisting: false,
          warningMessage: null,
        });
      }

      // Load products and Drop Point available stock
      Promise.all([
        api.getProducts(),
        api.getDropPointStocks(user?.dropPointId).catch(() => ({ stocks: [] })),
      ])
        .then(([prodRes, stockRes]) => {
          setProducts(prodRes.products || []);
          const stockMap: Record<number, number> = {};
          if (stockRes && Array.isArray(stockRes.stocks)) {
            stockRes.stocks.forEach((s) => {
              stockMap[s.productId] = s.availableQuantity || 0;
            });
          }
          setDpStocks(stockMap);
        })
        .catch((err) => {
          console.error(err);
          setError('Impossible de charger le catalogue et les stocks du Dépôt.');
        });
    }
  }, [isOpen, user?.dropPointId]);

  // Filter products available for selection (exclude products already in the récapitulatif)
  const availableProducts = useMemo(() => {
    return products.filter((p) => {
      // If currently editing a product, that specific product remains available in the selector
      const isAlreadyInRecap = validatedItems.some((item) => item.productId === p.id);
      if (isAlreadyInRecap) {
        if (draftLine?.isEditingExisting && draftLine.productId === p.id) {
          return true;
        }
        return false;
      }
      return true;
    });
  }, [products, validatedItems, draftLine]);

  // Filter available products by search query
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return availableProducts;
    const q = productSearch.toLowerCase().trim();
    return availableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.reference && p.reference.toLowerCase().includes(q)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q))
    );
  }, [availableProducts, productSearch]);

  // Selected product details for draft line
  const selectedProduct = useMemo(() => {
    if (!draftLine || !draftLine.productId) return null;
    return products.find((p) => p.id === draftLine.productId) || null;
  }, [draftLine, products]);

  const selectedProductStock = useMemo(() => {
    if (!selectedProduct) return 0;
    return dpStocks[selectedProduct.id] ?? 0;
  }, [selectedProduct, dpStocks]);

  // Handle product selection in draft line
  const handleSelectProduct = (productIdNum: number) => {
    if (!draftLine) return;
    const available = dpStocks[productIdNum] ?? 0;
    let qty: number | string = draftLine.quantityRequested;
    let warn: string | null = null;

    if (qty !== '') {
      const numQty = Number(qty);
      if (numQty > available) {
        qty = available;
        warn = `Quantité plafonnée au stock disponible (${available} carton${available > 1 ? 's' : ''}).`;
      }
    }

    if (available === 0) {
      warn = `Stock épuisé au Dépôt (0 carton disponible).`;
      qty = 0;
    }

    setDraftLine({
      ...draftLine,
      productId: productIdNum,
      quantityRequested: qty,
      warningMessage: warn,
    });
  };

  // Handle quantity change with Drop Point capping
  const handleQuantityChange = (valStr: string) => {
    if (!draftLine) return;
    if (valStr === '') {
      setDraftLine({
        ...draftLine,
        quantityRequested: '',
        warningMessage: null,
      });
      return;
    }

    const parsed = parseInt(valStr, 10);
    if (isNaN(parsed)) return;

    const available = selectedProduct ? (dpStocks[selectedProduct.id] ?? 0) : 999999;
    let finalQty = Math.max(0, parsed);
    let warn: string | null = null;

    if (finalQty > available) {
      finalQty = available;
      warn = `Quantité plafonnée au stock disponible du Dépôt (max ${available} carton${available > 1 ? 's' : ''}).`;
    } else if (available === 0) {
      finalQty = 0;
      warn = `Ce produit est en rupture de stock au Dépôt (0 carton disponible).`;
    }

    setDraftLine({
      ...draftLine,
      quantityRequested: finalQty,
      warningMessage: warn,
    });
  };

  // Increment / decrement quantity
  const handleStepQuantity = (delta: number) => {
    if (!draftLine) return;
    const current = typeof draftLine.quantityRequested === 'number' ? draftLine.quantityRequested : 0;
    const nextVal = Math.max(0, current + delta);
    handleQuantityChange(String(nextVal));
  };

  // Check if "Valider ce choix" is valid:
  // product chosen AND integer > 0 AND <= available stock
  const isValidateChoiceEnabled = useMemo(() => {
    if (!draftLine || !draftLine.productId || !selectedProduct) return false;
    const qty = Number(draftLine.quantityRequested);
    if (!Number.isInteger(qty) || qty <= 0) return false;
    const available = dpStocks[selectedProduct.id] ?? 0;
    if (available <= 0 || qty > available) return false;
    return true;
  }, [draftLine, selectedProduct, dpStocks]);

  // Validating the current line -> freezes and adds to récapitulatif
  const handleValidateChoice = () => {
    if (!isValidateChoiceEnabled || !draftLine || !selectedProduct) return;

    const qty = Number(draftLine.quantityRequested);
    const available = dpStocks[selectedProduct.id] ?? 0;

    const newItem: ValidatedLineItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productRef: selectedProduct.reference || `REF-${selectedProduct.id}`,
      categoryName: selectedProduct.categoryName || 'Catalogue',
      quantityRequested: qty,
      availableStock: available,
    };

    setValidatedItems((prev) => {
      const next = [...prev, newItem];
      setVrsSupplyDraft(user?.id, { items: next, desiredLoadingDate, notes });
      return next;
    });
    setDraftLine(null); // Line completed, no draft line in progress
    setEditingOriginalItem(null);
    setProductSearch('');
  };

  // Trigger adding a new line
  const handleAddNewLine = () => {
    if (draftLine !== null) return; // Cannot add while a line is in progress
    setProductSearch('');
    setEditingOriginalItem(null);
    setDraftLine({
      productId: '',
      quantityRequested: '',
      isEditingExisting: false,
      warningMessage: null,
    });
  };

  // Trigger modifying an existing validated line
  const handleStartEdit = (index: number) => {
    const itemToEdit = validatedItems[index];
    if (!itemToEdit) return;

    // Remove from validatedItems and open in draftLine
    setEditingOriginalItem(itemToEdit);
    setValidatedItems((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      setVrsSupplyDraft(user?.id, { items: next, desiredLoadingDate, notes });
      return next;
    });
    setProductSearch('');
    setDraftLine({
      productId: itemToEdit.productId,
      quantityRequested: itemToEdit.quantityRequested,
      isEditingExisting: true,
      warningMessage: null,
    });
  };

  // Cancel or delete the line currently in progress
  const handleCancelDraftLine = () => {
    if (draftLine?.isEditingExisting && editingOriginalItem) {
      // Restore previous item
      setValidatedItems((prev) => {
        const next = [...prev, editingOriginalItem];
        setVrsSupplyDraft(user?.id, { items: next, desiredLoadingDate, notes });
        return next;
      });
    }
    setEditingOriginalItem(null);
    setDraftLine(null);
    setProductSearch('');
  };

  // Trigger deleting a line with confirmation
  const handleConfirmDelete = () => {
    if (deleteConfirmIndex !== null) {
      setValidatedItems((prev) => {
        const next = prev.filter((_, idx) => idx !== deleteConfirmIndex);
        setVrsSupplyDraft(user?.id, { items: next, desiredLoadingDate, notes });
        return next;
      });
      setDeleteConfirmIndex(null);
    }
  };

  // Check if "Envoyer la demande" can be pressed
  const canSubmit = useMemo(() => {
    return validatedItems.length > 0 && draftLine === null;
  }, [validatedItems, draftLine]);

  // Totals
  const totalCartons = useMemo(() => {
    return validatedItems.reduce((acc, it) => acc + (it.quantityRequested || 0), 0);
  }, [validatedItems]);

  const totalProductsCount = validatedItems.length;

  // Cancel handler with confirmation if lines exist
  const handleCancelClick = () => {
    const hasData = validatedItems.length > 0 || (draftLine && draftLine.productId !== '');
    if (hasData) {
      setCancelConfirmOpen(true);
    } else {
      onClose();
    }
  };

  // Submit supply request to backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!canSubmit) {
      if (draftLine !== null) {
        setError('Validez ou supprimez la ligne en cours avant d\'envoyer la demande.');
      } else {
        setError('Veuillez ajouter et valider au moins un produit.');
      }
      return;
    }

    setLoading(true);
    try {
      const itemsPayload = validatedItems.map((it) => ({
        productId: it.productId,
        quantityRequested: it.quantityRequested,
      }));

      const res = await api.createSupplyRequest({
        items: itemsPayload,
        desiredLoadingDate,
        notes,
        blNumber: blNumber.trim() || undefined,
        blAttachment: blAttachment || undefined,
        blFileName: blFileName || undefined,
        blFileType: blFileType || undefined,
      });

      clearVrsSupplyDraft(user?.id);
      setSuccessMsg(res.message || 'Demande de chargement enregistrée au statut "Demandée".');
      setTimeout(() => {
        onRequestCreated();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi de la demande.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleCancelClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[94vh] sm:max-h-[90vh] bg-[var(--bg-card)] border-t sm:border border-[var(--border-color)] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-sheet-up sm:animate-modal-content"
      >
        {/* Mobile drag handle indicator */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-700/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-[var(--border-color)] bg-[var(--bg-card-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center shrink-0 bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] font-display">
                  Mon chargement
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40">
                  Statut : Demandée
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Demande de chargement véhicule VRS adressée au Sales Admin • Contrôle du stock Dépôt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelClick}
            className="w-11 h-11 min-w-[44px] min-h-[44px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-hover)] transition flex items-center justify-center cursor-pointer"
            title="Fermer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guard for non-VRS roles (SA and SAN) */}
        {user?.role !== 'VRS' ? (
          <div className="p-6 sm:p-8 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
              <Shield className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {user?.role === 'SALES_ADMIN' ? 'Commandes de Stock Dépôt' : 'Supervision Nationale des Stocks'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
                {user?.role === 'SALES_ADMIN'
                  ? "Le Sales Admin commande son stock auprès de 6C Distribution via le menu 'Mes commandes' (bouton 'Nouvelle commande'). Cet écran est exclusivement réservé aux chargements des vendeurs terrain (VRS)."
                  : "Le Sales Admin National ne saisit pas de demande de chargement. En tant que superviseur national, votre rôle est de valider les commandes stock des Drop Points pour 6C Distribution et superviser les chargements du réseau."}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition shadow cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
              {/* Error & Success Messages */}
              {error && (
                <div className="p-3.5 bg-red-500/15 border border-red-500/40 rounded-xl text-sm text-red-600 dark:text-red-300 flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-sm text-emerald-600 dark:text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Notice if draft line is in progress when trying to finalize */}
              {draftLine !== null && validatedItems.length > 0 && (
                <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs sm:text-sm text-amber-700 dark:text-amber-300 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Ligne en cours non validée : validez ou supprimez cette ligne avant d'envoyer la demande.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftLine(null)}
                    className="text-xs font-bold underline text-amber-700 dark:text-amber-300 shrink-0 p-1 cursor-pointer"
                  >
                    Annuler la ligne
                  </button>
                </div>
              )}

              {/* ============================================================ */}
              {/* SECTION 1: RÉCAPITULATIF DES PRODUITS VALIDÉS                */}
              {/* ============================================================ */}
              {validatedItems.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-emerald-500" />
                      <span>Récapitulatif de la demande ({validatedItems.length} référence{validatedItems.length > 1 ? 's' : ''})</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {totalCartons} carton{totalCartons > 1 ? 's' : ''} validé{totalCartons > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="divide-y divide-[var(--border-color)] border border-[var(--border-color)] rounded-xl bg-[var(--bg-card-subtle)] overflow-hidden shadow-xs">
                    {validatedItems.map((item, idx) => (
                      <div
                        key={item.productId}
                        className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[var(--bg-hover)] transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                              {item.productName}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-1 ml-7 flex-wrap">
                            <span className="font-mono text-[var(--text-muted)]">{item.productRef}</span>
                            <span>•</span>
                            <span>{item.categoryName}</span>
                            <span>•</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              Stock Dépôt : <strong className="font-mono">{item.availableStock} ctn</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 ml-7 sm:ml-0 shrink-0">
                          <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-right">
                            <span className="text-xs text-[var(--text-secondary)] block sm:inline mr-1">Quantité :</span>
                            <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                              {item.quantityRequested} ctn
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Bouton Modifier */}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(idx)}
                              className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                              title={`Modifier la quantité de ${item.productName}`}
                              aria-label={`Modifier ${item.productName}`}
                            >
                              <Edit2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Modifier</span>
                            </button>

                            {/* Bouton Supprimer */}
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmIndex(idx)}
                              className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl border border-red-500/30 bg-[var(--bg-card)] hover:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                              title={`Supprimer ${item.productName} de la demande`}
                              aria-label={`Supprimer ${item.productName}`}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Supprimer</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* SECTION 2: LIGNE EN COURS DE SAISIE                           */}
              {/* ============================================================ */}
              {draftLine !== null ? (
                <div className="p-4 sm:p-5 rounded-2xl border-2 border-[#54a835]/40 bg-[var(--bg-card-subtle)] space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#54a835] animate-pulse" />
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        {draftLine.isEditingExisting
                          ? 'Modification de la ligne'
                          : validatedItems.length === 0
                          ? '1. Ligne en cours de saisie'
                          : `Ajout d'un nouveau produit (Ligne ${validatedItems.length + 1})`}
                      </h3>
                    </div>
                    {validatedItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCancelDraftLine}
                        className="min-h-[36px] px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer flex items-center gap-1 font-semibold transition"
                        title={draftLine.isEditingExisting ? "Annuler la modification de cette ligne" : "Supprimer cette ligne en cours"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{draftLine.isEditingExisting ? "Annuler modification" : "Supprimer la ligne"}</span>
                      </button>
                    )}
                  </div>

                  {/* Sélecteur de produit avec recherche + Stock disponible à côté du produit */}
                  <div className="space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="block text-xs font-bold text-[var(--text-primary)]">
                        Produit du catalogue *
                      </label>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[var(--text-secondary)] font-medium">Stock disponible Dépôt :</span>
                        <span
                          className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg inline-flex items-center gap-1 ${
                            selectedProductStock > 10
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : selectedProductStock > 0
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : selectedProduct
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                              : 'bg-slate-500/10 text-[var(--text-secondary)] border border-[var(--border-color)]'
                          }`}
                        >
                          {selectedProduct
                            ? selectedProductStock > 0
                              ? `${selectedProductStock} carton${selectedProductStock > 1 ? 's' : ''}`
                              : '0 carton (Rupture)'
                            : 'Sélectionnez un produit'}
                        </span>
                      </div>
                    </div>

                    {/* Champ de recherche pour filtrer le catalogue */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Rechercher un produit (nom, gamme, référence)..."
                        className="w-full pl-10 pr-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#54a835]"
                      />
                    </div>

                    {/* Liste déroulante des produits filtrés */}
                    <select
                      value={draftLine.productId}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setDraftLine({
                            ...draftLine,
                            productId: '',
                            quantityRequested: '',
                            warningMessage: null,
                          });
                        } else {
                          handleSelectProduct(parseInt(val, 10));
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-sm text-[var(--text-primary)] min-h-[44px] font-medium focus:outline-none focus:ring-2 focus:ring-[#54a835] cursor-pointer"
                    >
                      <option value="">-- Choisissez un produit du catalogue --</option>
                      {filteredProducts.map((p) => {
                        const stock = dpStocks[p.id] ?? 0;
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} [{p.categoryName || 'Catalogue'}] — Stock Dépôt : {stock} carton{stock > 1 ? 's' : ''} {stock === 0 ? '(Rupture)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Détail du produit sélectionné + Stock disponible du Drop Point */}
                  {selectedProduct && (
                    <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-[var(--text-primary)] text-sm block">
                          {selectedProduct.name}
                        </span>
                        <span className="text-[var(--text-secondary)] font-mono">
                          {selectedProduct.reference} • {selectedProduct.categoryName} • {selectedProduct.unitsPerCarton || 24} unités/carton
                        </span>
                      </div>
                      <div className="sm:text-right">
                        <span className="text-[var(--text-secondary)] block text-[11px]">Stock disponible Dépôt :</span>
                        <span
                          className={`font-mono text-sm font-black px-2 py-0.5 rounded-lg inline-block mt-0.5 ${
                            selectedProductStock > 10
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : selectedProductStock > 0
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                          }`}
                        >
                          {selectedProductStock} carton{selectedProductStock > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Champ Quantité en cartons avec stepper */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[var(--text-primary)]">
                      Quantité demandée (en cartons) *
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-1 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl p-1 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(-1)}
                          disabled={!draftLine.productId || Number(draftLine.quantityRequested || 0) <= 0}
                          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-[var(--border-color)] disabled:opacity-30 text-lg font-bold flex items-center justify-center transition active:scale-95 cursor-pointer"
                          aria-label="Diminuer la quantité"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={selectedProductStock > 0 ? selectedProductStock : 1}
                          disabled={!draftLine.productId}
                          value={draftLine.quantityRequested}
                          onChange={(e) => handleQuantityChange(e.target.value)}
                          placeholder="0"
                          className="w-24 sm:w-28 py-2 bg-transparent text-[var(--text-primary)] font-mono text-center text-base font-black focus:outline-none min-h-[44px]"
                        />
                        <span className="text-[var(--text-secondary)] text-xs pr-2 font-medium">ctn</span>
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(1)}
                          disabled={!draftLine.productId || Number(draftLine.quantityRequested || 0) >= selectedProductStock}
                          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-[var(--border-color)] disabled:opacity-30 text-lg font-bold flex items-center justify-center transition active:scale-95 cursor-pointer"
                          aria-label="Augmenter la quantité"
                        >
                          +
                        </button>
                      </div>

                      {/* Bouton "Valider ce choix" sur la ligne */}
                      <button
                        type="button"
                        onClick={handleValidateChoice}
                        disabled={!isValidateChoiceEnabled}
                        className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-[#54a835] hover:bg-[#46912b] disabled:opacity-40 disabled:cursor-not-allowed shadow transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Valider ce choix</span>
                      </button>

                      {validatedItems.length > 0 && (
                        <button
                          type="button"
                          onClick={handleCancelDraftLine}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-red-500/30 hover:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                          title={draftLine.isEditingExisting ? "Annuler la modification" : "Supprimer la ligne en cours"}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">{draftLine.isEditingExisting ? "Annuler modif" : "Supprimer ligne"}</span>
                        </button>
                      )}
                    </div>

                    {/* Avertissement si dépassement ou stock insuffisant */}
                    {draftLine.warningMessage && (
                      <div className="p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2 animate-in fade-in">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>{draftLine.warningMessage}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Bouton "+ Ajouter un produit" apparaît automatiquement sous le récapitulatif quand aucune ligne n'est en saisie */
                <div>
                  {availableProducts.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleAddNewLine}
                      className="w-full min-h-[44px] py-3 px-4 rounded-xl border-2 border-dashed border-[#54a835]/60 hover:border-[#54a835] bg-[#54a835]/5 hover:bg-[#54a835]/10 text-[#54a835] font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                    >
                      <Plus className="w-5 h-5" />
                      <span>+ Ajouter un produit</span>
                    </button>
                  ) : (
                    <div className="p-3 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl font-medium">
                      ✓ Tous les produits du catalogue ont été ajoutés à la demande.
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* SECTION 3: TOTAUX ET CHAMPS FINAUX DE LA DEMANDE              */}
              {/* ============================================================ */}
              {validatedItems.length > 0 && (
                <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] space-y-3 shadow-xs">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)] font-medium">Nombre de produits validés :</span>
                    <span className="font-bold font-mono text-[var(--text-primary)]">
                      {totalProductsCount} référence{totalProductsCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-[var(--border-color)]">
                    <span className="text-[var(--text-secondary)] font-medium">Volume total demandé :</span>
                    <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {totalCartons} carton{totalCartons > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Date de chargement souhaitée */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <span>Date de chargement souhaitée *</span>
                </label>
                <input
                  type="date"
                  required
                  value={desiredLoadingDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDesiredLoadingDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-sm text-[var(--text-primary)] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#54a835] font-mono"
                />
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Date prévue pour le passage physique au Dépôt et le chargement des cartons.
                </p>
              </div>

              {/* Commentaire */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Commentaire (optionnel)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ex. Réassort pour tournée commerciale, forte demande sur secteur..."
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-sm text-[var(--text-primary)] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#54a835]"
                />
              </div>

              {/* Bon de Livraison optionnel */}
              <div className="p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] space-y-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Bon de Livraison (BL) / Document Justificatif (Optionnel)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Numéro du Bon de Livraison (BL)
                  </label>
                  <input
                    type="text"
                    value={blNumber}
                    onChange={(e) => setBlNumber(e.target.value)}
                    placeholder="ex. BL-2026-0042 ou réf. fiche papier"
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-sm text-[var(--text-primary)] font-mono min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#54a835]"
                  />
                </div>

                <DocumentAttachmentPicker
                  label="Photo ou Scan du Bon de Livraison (BL)"
                  helperText="Prenez une photo de votre fiche BL ou chargez un PDF / JPG / PNG"
                  value={blAttachment}
                  fileName={blFileName}
                  fileType={blFileType}
                  onChange={({ attachmentUrl, fileName, fileType }) => {
                    setBlAttachment(attachmentUrl);
                    setBlFileName(fileName);
                    setBlFileType(fileType);
                  }}
                  onClear={() => {
                    setBlAttachment('');
                    setBlFileName('');
                    setBlFileType('');
                  }}
                />
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 p-4 sm:px-6 sm:py-4 border-t border-[var(--border-color)] bg-[var(--bg-card-subtle)]">
              <button
                type="button"
                onClick={handleCancelClick}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-semibold min-h-[44px] flex items-center justify-center transition cursor-pointer"
              >
                Annuler
              </button>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
                {draftLine !== null && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold text-center sm:text-right">
                    Validez ou supprimez la ligne en cours
                  </span>
                )}

                <button
                  type="submit"
                  disabled={loading || !canSubmit}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-white text-sm font-bold transition shadow disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center cursor-pointer active:scale-95 bg-[#54a835] hover:bg-[#46912b]"
                >
                  {loading
                    ? 'Envoi en cours...'
                    : `Envoyer la demande (${totalCartons} ctn)`}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* MODAL CONFIRMATION SUPPRESSION LIGNE                         */}
        {/* ============================================================ */}
        {deleteConfirmIndex !== null && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Supprimer ce produit ?
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {validatedItems[deleteConfirmIndex]?.productName}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Cette référence sera retirée du récapitulatif de votre demande de chargement.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmIndex(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--bg-hover)] transition cursor-pointer"
                >
                  Garder
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow cursor-pointer"
                >
                  Oui, supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL CONFIRMATION ANNULATION DE LA DEMANDE                  */}
        {/* ============================================================ */}
        {cancelConfirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Abandonner la saisie ?
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {validatedItems.length} produit(s) saisi(s)
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Êtes-vous sûr de vouloir fermer ce formulaire ? Toutes les lignes de produits déjà validées seront perdues.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelConfirmOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--bg-hover)] transition cursor-pointer"
                >
                  Continuer la saisie
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCancelConfirmOpen(false);
                    onClose();
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow cursor-pointer"
                >
                  Abandonner
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
