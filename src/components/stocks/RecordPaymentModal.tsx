import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { DpInvoice, VrsInvoice } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import {
  CreditCard,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Landmark,
  Smartphone,
  Banknote,
} from 'lucide-react';

export interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: (DpInvoice | VrsInvoice) | null;
  type?: 'DP' | 'VRS';
  onPaymentSuccess?: () => void;
}

type PaymentMethodType = 'VIREMENT' | 'MOBILE_MONEY' | 'ESPECES';

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  type = 'DP',
  onPaymentSuccess,
}) => {
  const { user } = useAuth();
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('VIREMENT');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize or reset state when modal opens with an invoice
  useEffect(() => {
    if (isOpen && invoice) {
      setPaymentAmount(String(invoice.remaining_amount));
      setPaymentMethod('VIREMENT');
      setPaymentReference('');
      setPaymentNotes('');
      setPaymentError(null);
    }
  }, [isOpen, invoice]);

  // Mask bottom navigation bar and manage scroll locks when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('payment-form-open');
      const bottomNav = document.getElementById('mobile-bottom-navbar');
      if (bottomNav) {
        bottomNav.style.setProperty('display', 'none', 'important');
      }

      // Keep active element visible when virtual keyboard opens on mobile/tablet
      const handleViewportResize = () => {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
          scrollContainerRef.current?.contains(active)
        ) {
          active.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };

      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleViewportResize);
      }

      return () => {
        document.body.classList.remove('payment-form-open');
        if (bottomNav) {
          bottomNav.style.removeProperty('display');
        }
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleViewportResize);
        }
      };
    }
  }, [isOpen]);

  if (!isOpen || !invoice) return null;

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Ensure field remains visible when keyboard opens
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setPaymentError('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }

    if (amt > invoice.remaining_amount) {
      setPaymentError(
        `Le montant ne peut pas dépasser le solde restant (${invoice.remaining_amount.toLocaleString('fr-FR')} FCFA).`
      );
      return;
    }

    setSubmittingPayment(true);
    try {
      const isVrs = type === 'VRS' || (invoice as any).vrs_id !== undefined;
      if (isVrs) {
        await api.recordVrsInvoicePayment(invoice.id, {
          amount: amt,
          paymentMethod,
          reference: paymentReference.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
        });
      } else {
        await api.recordDpInvoicePayment(invoice.id, {
          amount: amt,
          paymentMethod,
          reference: paymentReference.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
        });
      }

      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
      onClose();
    } catch (err: any) {
      setPaymentError(err?.message || "Erreur lors de l'enregistrement du paiement.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const paymentModes = [
    {
      id: 'VIREMENT' as const,
      label: 'Virement',
      subtext: 'Banque',
      icon: Landmark,
    },
    {
      id: 'MOBILE_MONEY' as const,
      label: 'Mobile Money',
      subtext: 'Orange/Wave',
      icon: Smartphone,
    },
    {
      id: 'ESPECES' as const,
      label: 'Espèces',
      subtext: 'Caisse',
      icon: Banknote,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90dvh] bg-slate-900 border-0 sm:border sm:border-slate-800 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* 1. En-tête fixe */}
        <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="payment-modal-title" className="text-base font-bold text-white truncate">
                {user?.role === 'VRS' ? 'Déclarer un paiement' : 'Enregistrer le paiement'}
              </h3>
              <p className="text-xs text-slate-400 truncate">
                Facture {invoice.invoice_number}{invoice.dropPointName ? ` • ${invoice.dropPointName}` : ''}
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

        {/* Formulaire avec zone centrale défilante et bouton fixe en bas */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* 2. Zone centrale défilante (overflow-y: auto, -webkit-overflow-scrolling: touch) */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {paymentError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* Solde restant à régler */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col gap-1 text-left">
              <span className="text-[13px] font-semibold text-slate-400 uppercase tracking-[0.04em] leading-[1.3]">
                Solde restant à régler
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400 whitespace-nowrap leading-tight">
                {invoice.remaining_amount.toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            {/* Montant (FCFA) * */}
            <div>
              <label
                htmlFor="payment-amount-input"
                className="block text-[13px] font-semibold text-slate-300 uppercase tracking-[0.04em] leading-[1.3] mb-1.5"
              >
                Montant (FCFA) *
              </label>
              <input
                id="payment-amount-input"
                type="number"
                min="1"
                max={invoice.remaining_amount}
                value={paymentAmount}
                onFocus={handleInputFocus}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Montant du paiement"
                className="w-full h-[48px] px-3.5 bg-slate-950 border border-slate-700/80 rounded-xl text-[16px] text-white font-mono font-bold placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition"
                required
              />
            </div>

            {/* Mode de règlement : 3 cartes de même taille (88 px) */}
            <div>
              <label className="block text-[13px] font-semibold text-slate-300 uppercase tracking-[0.04em] leading-[1.3] mb-1.5">
                Mode de règlement *
              </label>
              <div className="grid grid-cols-3 gap-2 w-full">
                {paymentModes.map((m) => {
                  const MIcon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`h-[88px] min-h-[88px] max-h-[88px] w-full px-1.5 py-1.5 rounded-xl border flex flex-col items-center justify-center text-center transition select-none cursor-pointer overflow-hidden ${
                        isSelected
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <MIcon className={`w-4 h-4 mb-1 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span className="text-xs sm:text-sm font-bold leading-tight truncate w-full text-center">
                        {m.label}
                      </span>
                      <span className="text-[13px] text-slate-400 leading-tight truncate w-full text-center whitespace-nowrap mt-0.5">
                        {m.subtext}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Référence (optionnel) */}
            <div>
              <label
                htmlFor="payment-reference-input"
                className="block text-[13px] font-semibold text-slate-300 uppercase tracking-[0.04em] leading-[1.3] mb-1.5"
              >
                Référence (optionnel)
              </label>
              <input
                id="payment-reference-input"
                type="text"
                value={paymentReference}
                onFocus={handleInputFocus}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Ex : VIR-00892 ou Réf transaction"
                className="w-full h-[48px] px-3.5 bg-slate-950 border border-slate-700/80 rounded-xl text-[16px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
            </div>

            {/* Commentaire */}
            <div>
              <label
                htmlFor="payment-notes-input"
                className="block text-[13px] font-semibold text-slate-300 uppercase tracking-[0.04em] leading-[1.3] mb-1.5"
              >
                Commentaire
              </label>
              <input
                id="payment-notes-input"
                type="text"
                value={paymentNotes}
                onFocus={handleInputFocus}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Ajouter une observation..."
                className="w-full h-[48px] px-3.5 bg-slate-950 border border-slate-700/80 rounded-xl text-[16px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* 3. Bouton "Enregistrer le paiement" fixe en bas (48 px, pleine largeur) */}
          <div
            className="flex-shrink-0 p-4 sm:px-6 sm:py-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur-xs z-10"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
          >
            <button
              type="submit"
              disabled={submittingPayment}
              className="w-full h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition disabled:opacity-50 active:scale-[0.99] cursor-pointer"
            >
              {submittingPayment ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                  <span>Enregistrement en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>Enregistrer le paiement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordPaymentModal;
