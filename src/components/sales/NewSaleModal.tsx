import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useGps } from '../../context/GpsContext.tsx';
import { api } from '../../services/api.ts';
import { offlineSync } from '../../services/offlineSync.ts';
import { PointOfSale, StockItem } from '../../types/index.ts';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  ShoppingCart,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Store,
  Boxes,
  Search,
  Lock,
  RotateCcw,
  CreditCard,
  Check,
} from 'lucide-react';

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleCreated: () => void;
  initialPosId?: number | string | null;
}

export interface ValidatedSaleLineItem {
  productId: number;
  productName: string;
  productRef: string;
  categoryName: string;
  unitsPerCarton?: number;
  availableStock: number;
  unitPrice: number;
  quantityCartons: number;
  subtotal: number;
}

interface DraftLineState {
  productId: number | '';
  quantityCartons: number | string;
  isEditingExisting: boolean;
  warningMessage: string | null;
}

const PAYMENT_METHODS = [
  { id: 'ESPECES', label: 'Espèces (Comptant)' },
  { id: 'MOBILE_MONEY', label: 'Mobile Money (Orange / Wave / Moov)' },
  { id: 'VIREMENT', label: 'Virement bancaire' },
  { id: 'CHEQUE', label: 'Chèque' },
  { id: 'A_TERME', label: 'À terme / Crédit client' },
];

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  onSaleCreated,
  initialPosId,
}) => {
  const { user } = useAuth();
  const { coords, requestGps } = useGps();

  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [selectedPosId, setSelectedPosId] = useState<string>(
    initialPosId ? String(initialPosId) : ''
  );
  const [posSearch, setPosSearch] = useState<string>('');

  // Validated items in the récapitulatif
  const [validatedItems, setValidatedItems] = useState<ValidatedSaleLineItem[]>([]);

  // Draft line currently being filled
  const [draftLine, setDraftLine] = useState<DraftLineState | null>({
    productId: '',
    quantityCartons: '',
    isEditingExisting: false,
    warningMessage: null,
  });

  const [productSearch, setProductSearch] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('ESPECES');
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Confirmation modals
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState<boolean>(false);
  const [editingOriginalItem, setEditingOriginalItem] = useState<ValidatedSaleLineItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setNotes('');
      setDiscount(0);
      setPaymentMethod('ESPECES');
      setPosSearch('');
      setProductSearch('');
      setValidatedItems([]);
      setDeleteConfirmIndex(null);
      setCancelConfirmOpen(false);
      setEditingOriginalItem(null);

      if (initialPosId) {
        setSelectedPosId(String(initialPosId));
      } else {
        setSelectedPosId('');
      }

      // Initial single empty line in progress
      setDraftLine({
        productId: '',
        quantityCartons: '',
        isEditingExisting: false,
        warningMessage: null,
      });

      loadPosAndStocks();
    }
  }, [isOpen, initialPosId]);

  const getProdId = (s: any): number => {
    const id = s?.productId ?? s?.product_id ?? s?.id;
    return typeof id === 'number' ? id : parseInt(id, 10) || 0;
  };

  const getAvail = (s: any): number => {
    const q = s?.availableQuantity ?? s?.available_quantity;
    return typeof q === 'number' ? q : parseInt(q, 10) || 0;
  };

  const loadPosAndStocks = async () => {
    try {
      const [posRes, stocksRes] = await Promise.all([
        api.getPointsOfSale(),
        user?.role === 'VRS' ? api.getVrsStocks({ vrsId: user.id }) : api.getDropPointStocks(),
      ]);

      const activePos = (posRes.pointsOfSale || []).filter(
        (p) => p.status === 'ACTIF' || p.status === 'VALIDE'
      );
      setPointsOfSale(activePos);
      setStocks(stocksRes?.stocks || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données.');
    }
  };

  // Filtered PDVs based on search query
  const filteredPointsOfSale = useMemo(() => {
    if (!posSearch.trim()) return pointsOfSale;
    const q = posSearch.toLowerCase().trim();
    return pointsOfSale.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.ownerName && p.ownerName.toLowerCase().includes(q)) ||
        (p.neighborhood && p.neighborhood.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q))
    );
  }, [pointsOfSale, posSearch]);

  const selectedPos = useMemo(() => {
    if (!selectedPosId) return null;
    return pointsOfSale.find((p) => String(p.id) === String(selectedPosId)) || null;
  }, [pointsOfSale, selectedPosId]);

  // Products available in stock for selection (exclude products already in récapitulatif to prevent duplicates)
  const availableStockItems = useMemo(() => {
    return stocks.filter((s) => {
      const pId = getProdId(s);
      const isAlreadyInRecap = validatedItems.some((item) => item.productId === pId);
      if (isAlreadyInRecap) {
        if (draftLine?.isEditingExisting && draftLine.productId === pId) {
          return true;
        }
        return false;
      }
      return true;
    });
  }, [stocks, validatedItems, draftLine]);

  // Filter available products by search query
  const filteredAvailableStocks = useMemo(() => {
    if (!productSearch.trim()) return availableStockItems;
    const q = productSearch.toLowerCase().trim();
    return availableStockItems.filter(
      (s) =>
        (s.productName && s.productName.toLowerCase().includes(q)) ||
        (s.productRef && s.productRef.toLowerCase().includes(q)) ||
        (s.categoryName && s.categoryName.toLowerCase().includes(q))
    );
  }, [availableStockItems, productSearch]);

  // Group filtered available stocks by category / gamme
  const stocksGroupedByCategory = useMemo(() => {
    const groups: Record<string, StockItem[]> = {};
    for (const item of filteredAvailableStocks) {
      const cat = item.categoryName || 'Catalogue Général';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(item);
    }
    return groups;
  }, [filteredAvailableStocks]);

  // Selected product in draft line
  const selectedProductStockItem = useMemo(() => {
    if (!draftLine || !draftLine.productId) return null;
    return stocks.find((s) => getProdId(s) === draftLine.productId) || null;
  }, [draftLine, stocks]);

  const currentAvailableStock = useMemo(() => {
    if (!selectedProductStockItem) return 0;
    return getAvail(selectedProductStockItem);
  }, [selectedProductStockItem]);

  const currentUnitPrice = useMemo(() => {
    if (!selectedProductStockItem) return 0;
    const p = selectedProductStockItem.unitPrice ?? (selectedProductStockItem as any).unit_price;
    return typeof p === 'number' ? p : parseFloat(p) || 0;
  }, [selectedProductStockItem]);

  // Handle product selection in draft line
  const handleSelectProduct = (productIdNum: number) => {
    if (!draftLine) return;
    const stockItem = stocks.find((s) => getProdId(s) === productIdNum);
    const available = stockItem ? getAvail(stockItem) : 0;
    let qty: number | string = draftLine.quantityCartons;
    let warn: string | null = null;

    if (qty !== '') {
      const numQty = Number(qty);
      if (numQty > available) {
        qty = available;
        warn = `Quantité plafonnée au stock disponible (${available} carton${available > 1 ? 's' : ''}).`;
      }
    }

    if (available === 0) {
      warn = `Stock épuisé chez le vendeur (0 carton disponible).`;
      qty = 0;
    }

    setDraftLine({
      ...draftLine,
      productId: productIdNum,
      quantityCartons: qty,
      warningMessage: warn,
    });
  };

  // Handle quantity change with VRS stock capping
  const handleQuantityChange = (valStr: string) => {
    if (!draftLine) return;
    if (valStr === '') {
      setDraftLine({
        ...draftLine,
        quantityCartons: '',
        warningMessage: null,
      });
      return;
    }

    const parsed = parseInt(valStr, 10);
    if (isNaN(parsed)) return;

    const available = selectedProductStockItem ? getAvail(selectedProductStockItem) : 999999;
    let finalQty = Math.max(0, parsed);
    let warn: string | null = null;

    if (finalQty > available) {
      finalQty = available;
      warn = `Quantité plafonnée au stock disponible du VRS (max ${available} carton${available > 1 ? 's' : ''}).`;
    } else if (available === 0) {
      finalQty = 0;
      warn = `Ce produit est en rupture dans votre stock (0 carton disponible).`;
    }

    setDraftLine({
      ...draftLine,
      quantityCartons: finalQty,
      warningMessage: warn,
    });
  };

  // Increment / decrement quantity
  const handleStepQuantity = (delta: number) => {
    if (!draftLine) return;
    const current = typeof draftLine.quantityCartons === 'number' ? draftLine.quantityCartons : 0;
    const nextVal = Math.max(0, current + delta);
    handleQuantityChange(String(nextVal));
  };

  // Check if "Valider ce choix" is valid:
  // product chosen AND integer > 0 AND <= available stock
  const isValidateChoiceEnabled = useMemo(() => {
    if (!draftLine || !draftLine.productId || !selectedProductStockItem) return false;
    const qty = Number(draftLine.quantityCartons);
    if (!Number.isInteger(qty) || qty <= 0) return false;
    const available = getAvail(selectedProductStockItem);
    if (available <= 0 || qty > available) return false;
    return true;
  }, [draftLine, selectedProductStockItem]);

  // Validating the current line -> freezes and adds to récapitulatif
  const handleValidateChoice = () => {
    if (!isValidateChoiceEnabled || !draftLine || !selectedProductStockItem) return;

    const qty = Number(draftLine.quantityCartons);
    const available = getAvail(selectedProductStockItem);
    const pId = getProdId(selectedProductStockItem);
    const unitP = currentUnitPrice;

    const newItem: ValidatedSaleLineItem = {
      productId: pId,
      productName: selectedProductStockItem.productName,
      productRef: selectedProductStockItem.productRef || `REF-${pId}`,
      categoryName: selectedProductStockItem.categoryName || 'Catalogue',
      unitsPerCarton: selectedProductStockItem.unitsPerCarton || 24,
      availableStock: available,
      unitPrice: unitP,
      quantityCartons: qty,
      subtotal: qty * unitP,
    };

    setValidatedItems((prev) => [...prev, newItem]);
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
      quantityCartons: '',
      isEditingExisting: false,
      warningMessage: null,
    });
  };

  // Trigger modifying an existing validated line
  const handleStartEdit = (index: number) => {
    const itemToEdit = validatedItems[index];
    if (!itemToEdit) return;

    setEditingOriginalItem(itemToEdit);
    setValidatedItems((prev) => prev.filter((_, idx) => idx !== index));
    setProductSearch('');
    setDraftLine({
      productId: itemToEdit.productId,
      quantityCartons: itemToEdit.quantityCartons,
      isEditingExisting: true,
      warningMessage: null,
    });
  };

  // Cancel or delete the line currently in progress
  const handleCancelDraftLine = () => {
    if (draftLine?.isEditingExisting && editingOriginalItem) {
      // Restore previous item
      setValidatedItems((prev) => [...prev, editingOriginalItem]);
    }
    setEditingOriginalItem(null);
    setDraftLine(null);
    setProductSearch('');
  };

  // Trigger deleting a line with confirmation
  const handleConfirmDelete = () => {
    if (deleteConfirmIndex !== null) {
      setValidatedItems((prev) => prev.filter((_, idx) => idx !== deleteConfirmIndex));
      setDeleteConfirmIndex(null);
    }
  };

  // Totals
  const totalProductsCount = validatedItems.length;
  const totalCartons = useMemo(() => {
    return validatedItems.reduce((acc, it) => acc + (it.quantityCartons || 0), 0);
  }, [validatedItems]);

  const grossSubTotal = useMemo(() => {
    return validatedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  }, [validatedItems]);

  const totalAmount = Math.max(0, grossSubTotal - (discount || 0));

  // Validation rules for "Enregistrer la vente" button
  // Active only if:
  // - at least one validated line
  // - no open draft line
  // - a point of sale is chosen
  const isSaleReadyToSubmit = useMemo(() => {
    return validatedItems.length > 0 && draftLine === null && Boolean(selectedPosId);
  }, [validatedItems, draftLine, selectedPosId]);

  const disabledReasonMessage = useMemo(() => {
    if (!selectedPosId) return 'Choisissez un PDV';
    if (draftLine !== null) return 'Validez ou supprimez la ligne en cours';
    if (validatedItems.length === 0) return 'Ajoutez au moins un produit';
    return null;
  }, [selectedPosId, draftLine, validatedItems]);

  // Cancel handler with confirmation if lines exist
  const handleCancelClick = () => {
    const hasData =
      validatedItems.length > 0 || (draftLine && draftLine.productId !== '');
    if (hasData) {
      setCancelConfirmOpen(true);
    } else {
      onClose();
    }
  };

  // Submit sale to backend (Atomic transaction)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedPosId) {
      setError('Choisissez un PDV pour continuer.');
      return;
    }

    if (draftLine !== null) {
      setError('Validez ou supprimez la ligne en cours avant d\'enregistrer la vente.');
      return;
    }

    if (validatedItems.length === 0) {
      setError('Ajoutez et validez au moins un produit à la vente.');
      return;
    }

    setLoading(true);
    setError(null);

    // Enforce GPS for VRS seller
    let saleCoords = coords;
    if (user?.role === 'VRS') {
      if (!saleCoords) {
        saleCoords = await requestGps();
      }
      if (!saleCoords) {
        setError(
          'Géolocalisation GPS obligatoire : impossible d\'enregistrer une vente terrain sans signal GPS actif. Veuillez activer votre GPS.'
        );
        setLoading(false);
        return;
      }
    }

    const pos = pointsOfSale.find((p) => String(p.id) === String(selectedPosId));
    const paymentLabel =
      PAYMENT_METHODS.find((pm) => pm.id === paymentMethod)?.label || paymentMethod;
    const formattedNotes = notes.trim()
      ? `[Mode: ${paymentLabel}] ${notes.trim()}`
      : `[Mode: ${paymentLabel}]`;

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const performOfflineSale = async () => {
      const offlineItems = validatedItems.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantityCartons: i.quantityCartons,
        unitPrice: i.unitPrice,
      }));

      await offlineSync.recordOfflineSale({
        pointOfSaleId: parseInt(selectedPosId, 10),
        posName: pos?.name,
        posOwner: pos?.ownerName,
        posPhone: pos?.phone,
        posAddress: pos?.address,
        posNeighborhood: pos?.neighborhood,
        items: offlineItems,
        discount,
        notes: formattedNotes,
        latitude: saleCoords?.latitude,
        longitude: saleCoords?.longitude,
        accuracy: saleCoords?.accuracy,
        user,
      });

      setSuccessMsg(
        '✅ Vente enregistrée avec succès en mode hors-ligne ! Le stock a été déduit localement et la vente sera synchronisée dès la reconnexion.'
      );
      setTimeout(() => {
        onSaleCreated();
        onClose();
      }, 1200);
    };

    if (isOffline) {
      try {
        await performOfflineSale();
      } catch (offErr: any) {
        setError(offErr.message || 'Erreur lors de l\'enregistrement hors-ligne.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await api.createSale({
        pointOfSaleId: parseInt(selectedPosId, 10),
        items: validatedItems.map((i) => ({
          productId: i.productId,
          quantityCartons: i.quantityCartons,
          unitPrice: i.unitPrice,
        })),
        discount,
        notes: formattedNotes,
        latitude: saleCoords?.latitude,
        longitude: saleCoords?.longitude,
        accuracy: saleCoords?.accuracy,
      } as any);

      setSuccessMsg(res.message || 'Vente enregistrée avec succès !');
      setTimeout(() => {
        onSaleCreated();
        onClose();
      }, 1100);
    } catch (err: any) {
      const isNetError =
        !navigator.onLine ||
        err.isNetworkError ||
        err.message?.toLowerCase().includes('network') ||
        err.message?.toLowerCase().includes('hors-ligne') ||
        err.message?.toLowerCase().includes('fetch');

      if (isNetError) {
        try {
          await performOfflineSale();
          return;
        } catch (fallbackErr: any) {
          setError(fallbackErr.message || 'Erreur lors de l\'enregistrement de la vente.');
        }
      } else {
        setError(err.message || 'Erreur lors de l\'enregistrement de la vente par le serveur.');
      }
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
        {/* Mobile drag handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-700/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Modal Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-[var(--border-color)] bg-[var(--bg-card-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center shrink-0 bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] font-display">
                  Enregistrer une vente
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#15803D]/15 text-[#15803D] dark:text-emerald-300 border border-[#15803D]/30">
                  Vente ligne par ligne
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                VRS • Saisie progressive & déduction atomique du stock vendeur
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1">
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

            {/* GPS Certification Badge for VRS */}
            {user?.role === 'VRS' && (
              <div className="p-2.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                        coords ? 'bg-emerald-400' : 'bg-red-400'
                      } opacity-75`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        coords ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                  </span>
                  <span className="text-[var(--text-secondary)] font-medium">Certification GPS :</span>
                  <span
                    className={`font-bold ${
                      coords ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                    }`}
                  >
                    {coords
                      ? `Position active (±${Math.round(coords.accuracy)}m)`
                      : 'Signal GPS requis'}
                  </span>
                </div>
                {!coords && (
                  <button
                    type="button"
                    onClick={() => requestGps()}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] transition cursor-pointer"
                  >
                    Activer GPS
                  </button>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 1: POINT DE VENTE (PDV DU VRS)                       */}
            {/* En lecture seule dès qu'une ligne est validée                */}
            {/* ============================================================ */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-subtle)] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-amber-500" />
                  <span>Point de Vente Acheteur *</span>
                </label>
                {validatedItems.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    <Lock className="w-3 h-3" />
                    Lecture seule (ligne validée)
                  </span>
                )}
              </div>

              {validatedItems.length > 0 && selectedPos ? (
                /* Mode lecture seule : affichage sous forme de carte verrouillée */
                <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--text-primary)] truncate">
                        {selectedPos.name}
                      </span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-500/10 text-[var(--text-secondary)]">
                        {selectedPos.code}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                      {selectedPos.ownerName} • {selectedPos.address || selectedPos.neighborhood || 'Client terrain'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-[var(--text-muted)] block">Verrouillé</span>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      PDV assigné
                    </span>
                  </div>
                </div>
              ) : (
                /* Mode sélection active avec filtre de recherche */
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={posSearch}
                      onChange={(e) => setPosSearch(e.target.value)}
                      placeholder="Filtrer le PDV par nom, code, quartier..."
                      className="w-full pl-9 pr-3 py-2 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#15803D]"
                    />
                  </div>

                  <select
                    required
                    disabled={pointsOfSale.length === 0}
                    value={selectedPosId}
                    onChange={(e) => setSelectedPosId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#15803D] cursor-pointer"
                  >
                    <option value="">-- Choisissez un Point de Vente actif --</option>
                    {filteredPointsOfSale.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.name} ({pos.code}) • {pos.ownerName} - {pos.neighborhood || pos.address || ''}
                      </option>
                    ))}
                  </select>

                  {pointsOfSale.length === 0 && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Aucun PDV actif disponible. Enregistrez d'abord un PDV terrain pour lui attribuer cette vente.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notice if draft line is open when lines already exist */}
            {draftLine !== null && validatedItems.length > 0 && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs sm:text-sm text-amber-700 dark:text-amber-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Ligne en cours non validée : validez ou supprimez cette ligne avant de finaliser la vente.</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelDraftLine}
                  className="text-xs font-bold underline text-amber-700 dark:text-amber-300 shrink-0 p-1 cursor-pointer"
                >
                  Annuler la ligne
                </button>
              </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 2: RÉCAPITULATIF DES LIGNES VALIDÉES                */}
            {/* ============================================================ */}
            {validatedItems.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-[#15803D]" />
                    <span>
                      Récapitulatif de la vente ({validatedItems.length} référence
                      {validatedItems.length > 1 ? 's' : ''})
                    </span>
                  </label>
                  <span className="text-xs font-mono font-bold text-[#15803D] dark:text-emerald-400">
                    {totalCartons} ctn • {grossSubTotal.toLocaleString('fr-FR')} FCFA
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
                          <span className="w-5 h-5 rounded-full bg-[#15803D]/20 text-[#15803D] dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">
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
                          <span className="font-mono">
                            {item.unitPrice.toLocaleString('fr-FR')} FCFA/ctn
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 ml-7 sm:ml-0 shrink-0">
                        {/* Quantité & Sous-total */}
                        <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-right">
                          <div className="text-xs text-[var(--text-secondary)]">
                            <span className="font-mono font-bold text-[var(--text-primary)] mr-1">
                              {item.quantityCartons} ctn
                            </span>
                            <span>× {item.unitPrice.toLocaleString('fr-FR')} FCFA</span>
                          </div>
                          <div className="text-xs sm:text-sm font-black font-mono text-[#15803D] dark:text-emerald-400">
                            {item.subtotal.toLocaleString('fr-FR')} FCFA
                          </div>
                        </div>

                        {/* Actions Modifier & Supprimer */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(idx)}
                            className="min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            title={`Modifier la quantité de ${item.productName}`}
                            aria-label={`Modifier ${item.productName}`}
                          >
                            <Edit2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Modifier</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmIndex(idx)}
                            className="min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-xl border border-red-500/30 bg-[var(--bg-card)] hover:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            title={`Supprimer ${item.productName} de la vente`}
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
            {/* SECTION 3: LIGNE EN COURS DE SAISIE                           */}
            {/* Groupée par gamme, stock & prix affichés, bouton Valider     */}
            {/* ============================================================ */}
            {draftLine !== null ? (
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-[#15803D]/40 bg-[var(--bg-card-subtle)] space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#15803D] animate-pulse" />
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
                      title={
                        draftLine.isEditingExisting
                          ? 'Annuler la modification de cette ligne'
                          : 'Supprimer cette ligne en cours'
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {draftLine.isEditingExisting ? 'Annuler modification' : 'Supprimer ligne'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Sélecteur de produit groupé par gamme avec recherche */}
                <div className="space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <label className="block text-xs font-bold text-[var(--text-primary)]">
                      Produit en stock chez le vendeur *
                    </label>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[var(--text-secondary)] font-medium">
                        Stock disponible VRS :
                      </span>
                      <span
                        className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg inline-flex items-center gap-1 ${
                          currentAvailableStock > 5
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : currentAvailableStock > 0
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : selectedProductStockItem
                            ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                            : 'bg-slate-500/10 text-[var(--text-secondary)] border border-[var(--border-color)]'
                        }`}
                      >
                        {selectedProductStockItem
                          ? currentAvailableStock > 0
                            ? `${currentAvailableStock} carton${currentAvailableStock > 1 ? 's' : ''}`
                            : '0 carton (Épuisé)'
                          : 'Sélectionnez un produit'}
                      </span>
                    </div>
                  </div>

                  {/* Filtre de recherche produit */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Rechercher par référence, nom ou gamme..."
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#15803D]"
                    />
                  </div>

                  {/* Dropdown groupé par gamme */}
                  <select
                    value={draftLine.productId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setDraftLine({
                          ...draftLine,
                          productId: '',
                          quantityCartons: '',
                          warningMessage: null,
                        });
                      } else {
                        handleSelectProduct(parseInt(val, 10));
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-sm text-[var(--text-primary)] min-h-[44px] font-medium focus:outline-none focus:ring-2 focus:ring-[#15803D] cursor-pointer"
                  >
                    <option value="">-- Choisissez un produit en stock --</option>
                    {Object.keys(stocksGroupedByCategory).map((catName) => (
                      <optgroup key={catName} label={`📦 Gamme : ${catName}`}>
                        {stocksGroupedByCategory[catName].map((s) => {
                          const pId = getProdId(s);
                          const avail = getAvail(s);
                          const price = s.unitPrice ?? (s as any).unit_price ?? 0;
                          return (
                            <option key={pId} value={pId}>
                              {s.productName} [{s.productRef || `REF-${pId}`}] — Stock: {avail} ctn • {price.toLocaleString('fr-FR')} FCFA/ctn
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Détail du produit sélectionné : Gamme, Stock, Prix unitaire */}
                {selectedProductStockItem && (
                  <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold text-[var(--text-primary)] text-sm block">
                        {selectedProductStockItem.productName}
                      </span>
                      <span className="text-[var(--text-secondary)] font-mono">
                        {selectedProductStockItem.productRef} • {selectedProductStockItem.categoryName} •{' '}
                        {selectedProductStockItem.unitsPerCarton || 24} unités/carton
                      </span>
                    </div>
                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-1">
                      <span className="text-[var(--text-secondary)] text-[11px]">Prix unitaire :</span>
                      <span className="font-mono text-sm font-black text-[#15803D] dark:text-emerald-400">
                        {currentUnitPrice.toLocaleString('fr-FR')} FCFA / ctn
                      </span>
                    </div>
                  </div>
                )}

                {/* Quantité en cartons avec Stepper */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    Quantité vendue (en cartons) *
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-1 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl p-1 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleStepQuantity(-1)}
                        disabled={
                          !draftLine.productId || Number(draftLine.quantityCartons || 0) <= 0
                        }
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-[var(--border-color)] disabled:opacity-30 text-lg font-bold flex items-center justify-center transition active:scale-95 cursor-pointer"
                        aria-label="Diminuer la quantité"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={currentAvailableStock > 0 ? currentAvailableStock : 1}
                        disabled={!draftLine.productId}
                        value={draftLine.quantityCartons}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                        placeholder="0"
                        className="w-24 sm:w-28 py-2 bg-transparent text-[var(--text-primary)] font-mono text-center text-base font-black focus:outline-none min-h-[44px]"
                      />
                      <span className="text-[var(--text-secondary)] text-xs pr-2 font-medium">ctn</span>
                      <button
                        type="button"
                        onClick={() => handleStepQuantity(1)}
                        disabled={
                          !draftLine.productId ||
                          Number(draftLine.quantityCartons || 0) >= currentAvailableStock
                        }
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-[var(--border-color)] disabled:opacity-30 text-lg font-bold flex items-center justify-center transition active:scale-95 cursor-pointer"
                        aria-label="Augmenter la quantité"
                      >
                        +
                      </button>
                    </div>

                    {/* Sous-total estimé de la ligne en cours */}
                    {selectedProductStockItem && Number(draftLine.quantityCartons) > 0 && (
                      <div className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-right hidden sm:block">
                        <span className="block text-[10px] text-[var(--text-secondary)] uppercase">
                          Sous-total ligne
                        </span>
                        <span className="font-mono font-bold text-xs text-[#15803D] dark:text-emerald-400">
                          {(Number(draftLine.quantityCartons) * currentUnitPrice).toLocaleString(
                            'fr-FR'
                          )}{' '}
                          FCFA
                        </span>
                      </div>
                    )}

                    {/* Bouton "Valider ce choix" */}
                    <button
                      type="button"
                      onClick={handleValidateChoice}
                      disabled={!isValidateChoiceEnabled}
                      className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-[#15803D] hover:bg-[#166534] disabled:opacity-40 disabled:cursor-not-allowed shadow transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      <span>Valider ce choix</span>
                    </button>

                    {validatedItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCancelDraftLine}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-red-500/30 hover:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        title={
                          draftLine.isEditingExisting
                            ? 'Annuler la modification'
                            : 'Supprimer la ligne en cours'
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {draftLine.isEditingExisting ? 'Annuler' : 'Supprimer'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Avertissement si plafonnement ou rupture */}
                  {draftLine.warningMessage && (
                    <div className="p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>{draftLine.warningMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Bouton "+ Ajouter un produit" apparaît automatiquement sous le récapitulatif quand aucune ligne n'est en cours */
              <div>
                {availableStockItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleAddNewLine}
                    className="w-full min-h-[44px] py-3 px-4 rounded-xl border-2 border-dashed border-[#15803D]/60 hover:border-[#15803D] bg-[#15803D]/5 hover:bg-[#15803D]/10 text-[#15803D] dark:text-emerald-400 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                  >
                    <Plus className="w-5 h-5 text-[#15803D] dark:text-emerald-400" />
                    <span>+ Ajouter un produit</span>
                  </button>
                ) : (
                  <div className="p-3 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl font-medium">
                    ✓ Tous les produits disponibles dans votre stock ont été ajoutés à la vente.
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 4: TOTAUX (PRODUITS, CARTONS, MONTANT EN FCFA)      */}
            {/* ============================================================ */}
            {validatedItems.length > 0 && (
              <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border-color)] space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)] font-medium">
                    Nombre de produits :
                  </span>
                  <span className="font-bold font-mono text-[var(--text-primary)]">
                    {totalProductsCount} référence{totalProductsCount > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)] font-medium">Total en cartons :</span>
                  <span className="font-bold font-mono text-[var(--text-primary)]">
                    {totalCartons} carton{totalCartons > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Remise commerciale facultative */}
                <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)]">Remise commerciale (FCFA) :</span>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-32 px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-xs text-[var(--text-primary)] font-mono text-right"
                  />
                </div>

                {/* MONTANT TOTAL EN FCFA */}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-[var(--border-color)]">
                  <span className="text-[var(--text-primary)] font-bold text-base">
                    MONTANT TOTAL :
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono text-[#15803D] dark:text-emerald-400">
                    {totalAmount.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 5: MODE DE PAIEMENT & COMMENTAIRE                    */}
            {/* ============================================================ */}
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Mode de paiement *</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const isSelected = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#15803D]/10 border-[#15803D] text-[#15803D] dark:text-emerald-300'
                            : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <span>{method.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#15803D] dark:text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Commentaire / Observations (facultatif)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ex. Reçu paiement partiel, livraison directe en boutique, n° chèque..."
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-sm text-[var(--text-primary)] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#15803D]"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* SECTION 6: BOUTON FIXE EN BAS (48px, VERT #15803D, PLEINE L.) */}
          {/* ============================================================ */}
          <div className="flex-shrink-0 flex flex-col gap-2 p-3 sm:px-6 sm:py-3.5 border-t border-[var(--border-color)] bg-[var(--bg-card-subtle)]">
            {/* Message d'état si le bouton est désactivé */}
            {!isSaleReadyToSubmit && disabledReasonMessage && (
              <div className="text-center text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{disabledReasonMessage}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleCancelClick}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold min-h-[44px] flex items-center justify-center transition cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={loading || !isSaleReadyToSubmit}
                style={{ backgroundColor: isSaleReadyToSubmit ? '#15803D' : undefined }}
                className={`w-full flex-1 h-[48px] min-h-[48px] px-6 rounded-xl text-white font-bold text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSaleReadyToSubmit
                    ? 'hover:brightness-95'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Enregistrement de la vente...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span>
                      Enregistrer la vente
                      {validatedItems.length > 0
                        ? ` • ${totalAmount.toLocaleString('fr-FR')} FCFA`
                        : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Modal Confirmation Suppression de ligne */}
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
                Cette référence sera retirée du récapitulatif de votre vente.
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

        {/* Modal Confirmation Abandon de la saisie */}
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
