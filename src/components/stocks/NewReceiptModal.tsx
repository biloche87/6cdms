import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Product, DropPoint } from '../../types/index.ts';
import { DocumentAttachmentPicker } from '../common/DocumentAttachmentPicker.tsx';
import {
  X,
  FileCheck2,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Boxes,
} from 'lucide-react';

interface NewReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptCreated: () => void;
}

interface ReceiptLineItem {
  productId: number;
  quantityCartons: number;
}

export const NewReceiptModal: React.FC<NewReceiptModalProps> = ({
  isOpen,
  onClose,
  onReceiptCreated,
}) => {
  const { user } = useAuth();
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('BL-');
  const [supplier, setSupplier] = useState('NESTLÉ MALI S.A.');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [observations, setObservations] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [selectedDpId, setSelectedDpId] = useState<string>('');
  const [items, setItems] = useState<ReceiptLineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setDeliveryNoteNumber(`BL-${Date.now().toString().slice(-4)}`);
      setAttachmentUrl('');
      setFileName('');
      setFileType('');
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const needDpList = user?.role === 'SALES_ADMIN_NATIONAL' || !user?.dropPointId;
      const [prodRes, dpRes] = await Promise.all([
        api.getProducts(),
        needDpList ? api.getDropPoints() : Promise.resolve({ dropPoints: [] }),
      ]);
      setProducts(prodRes.products || []);
      if (dpRes.dropPoints && dpRes.dropPoints.length > 0) {
        setDropPoints(dpRes.dropPoints);
        if (!user?.dropPointId && !selectedDpId) {
          setSelectedDpId(String(dpRes.dropPoints[0].id));
        }
      }

      if (prodRes.products && prodRes.products.length > 0 && items.length === 0) {
        setItems([{ productId: prodRes.products[0].id, quantityCartons: 0 }]);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  if (user?.role !== 'SALES_ADMIN_NATIONAL') {
    return (
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Approvisionnement Drop Point</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Le Sales Admin commande du stock <strong>TOUJOURS</strong> auprès de 6C Distribution via le menu <strong>« Mes commandes »</strong> (bouton <em>« Nouvelle commande »</em>).
              <br /><br />
              Seul le Sales Admin National enregistre les livraisons Fournisseur vers 6C Distribution.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Compris, fermer
          </button>
        </div>
      </div>
    );
  }

  const handleAddItem = () => {
    if (products.length === 0) return;
    setItems([...items, { productId: products[0].id, quantityCartons: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!deliveryNoteNumber.trim()) {
      setError('Numéro de Bon de Livraison (BL) obligatoire.');
      return;
    }

    const activeItems = items.filter((it) => (it.quantityCartons || 0) > 0);
    if (activeItems.length === 0) {
      setError('Veuillez indiquer une quantité supérieure à 0 pour au moins un produit.');
      return;
    }

    setLoading(true);
    try {
      const dpId = user?.dropPointId
        ? user.dropPointId
        : (selectedDpId ? parseInt(selectedDpId, 10) : undefined);

      const res = await api.createReceipt({
        deliveryNoteNumber,
        dropPointId: dpId,
        supplier,
        receiptDate,
        observations,
        attachmentUrl: attachmentUrl || undefined,
        items: activeItems,
      });

      setSuccessMsg(res.message);
      setTimeout(() => {
        onReceiptCreated();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement de la réception.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[94vh] sm:max-h-[90vh] bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-sheet-up sm:animate-modal-content"
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-800/60 flex items-center justify-center text-blue-400 shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Réception
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Enregistrement et entrée en stock Drop Point sur bordereau de livraison (BL)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                N° de Bon de Livraison (BL) *
              </label>
              <input
                type="text"
                required
                value={deliveryNoteNumber}
                onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                placeholder="ex. BL001 ou BL-8942"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Fournisseur *
              </label>
              <input
                type="text"
                required
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Date de Réception *
              </label>
              <input
                type="date"
                required
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {(user?.role === 'SALES_ADMIN_NATIONAL' || (!user?.dropPointId && dropPoints.length > 0)) && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Drop Point Réceptionnaire *
                </label>
                <select
                  value={selectedDpId}
                  onChange={(e) => setSelectedDpId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white min-h-[42px]"
                >
                  {dropPoints.map((dp) => (
                    <option key={dp.id} value={dp.id}>
                      {dp.name} ({dp.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-blue-400" />
                <span>Produits Reçus (en Cartons)</span>
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-950/60 border border-blue-800/80 min-h-[36px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs"
                >
                  <div className="flex-1">
                    <select
                      value={it.productId}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].productId = parseInt(e.target.value, 10);
                        setItems(newItems);
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium min-h-[42px]"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.categoryName}) — Réf: {p.reference}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = [...items];
                          newItems[idx].quantityCartons = Math.max(0, (newItems[idx].quantityCartons || 0) - 1);
                          setItems(newItems);
                        }}
                        disabled={(it.quantityCartons || 0) <= 0}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold flex items-center justify-center active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={it.quantityCartons}
                        onFocus={(e) => {
                          if (e.target.value === '0') e.target.select();
                        }}
                        onChange={(e) => {
                          const newItems = [...items];
                          const val = e.target.value;
                          const num = val === '' ? 0 : parseInt(val, 10);
                          newItems[idx].quantityCartons = isNaN(num) ? 0 : Math.max(0, num);
                          setItems(newItems);
                        }}
                        className="w-14 py-1 bg-transparent text-white font-mono text-center text-sm font-bold focus:outline-none"
                      />
                      <span className="text-slate-400 text-[10px] pr-1">ctn</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = [...items];
                          newItems[idx].quantityCartons = (newItems[idx].quantityCartons || 0) + 1;
                          setItems(newItems);
                        }}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center active:scale-95"
                      >
                        +
                      </button>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800/80 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Supprimer la ligne"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observations / Numéro de scellé camion
            </label>
            <input
              type="text"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="ex. Camion 40T immatriculation BF-1234, parfait état"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white min-h-[42px]"
            />
          </div>

          {/* Photo or Scan of BL */}
          <DocumentAttachmentPicker
            label="Document Bon de Livraison (BL) / Scan / Photo"
            helperText="Prenez une photo directe du BL papier ou chargez un fichier PDF / Image"
            value={attachmentUrl}
            fileName={fileName}
            fileType={fileType}
            onChange={({ attachmentUrl: url, fileName: fn, fileType: ft }) => {
              setAttachmentUrl(url);
              setFileName(fn);
              setFileType(ft);
            }}
            onClear={() => {
              setAttachmentUrl('');
              setFileName('');
              setFileType('');
            }}
          />

          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 p-4 sm:px-6 sm:py-3.5 border-t border-slate-800 bg-slate-950/90">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium min-h-[44px] flex items-center justify-center transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow disabled:opacity-50 min-h-[44px] flex items-center justify-center"
            >
              {loading ? 'Enregistrement...' : 'Valider la Réception (+Stock)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
