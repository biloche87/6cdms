import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { DpInvoice, VrsInvoice, DropPoint } from '../../types/index.ts';
import { formatDateTime } from '../../utils/date.ts';
import { RecordPaymentModal } from './RecordPaymentModal.tsx';
import { DefinitiveInvoiceModal } from '../invoices/DefinitiveInvoiceModal.tsx';
import {
  Receipt,
  Plus,
  CheckCircle2,
  Clock,
  Building2,
  CreditCard,
  AlertCircle,
  X,
  History,
  Loader2,
  Wallet,
  Sparkles,
  FileCheck2,
  Edit2,
  Trash2,
  UserCheck,
  ShieldCheck,
  Printer,
  Ban,
  Check,
} from 'lucide-react';

export const DpInvoicesView: React.FC = () => {
  const { user } = useAuth();
  
  // Section tab: 'DP' (Factures Dépôt 6C -> Drop Points) or 'VRS' (Factures Vendeurs Drop Point -> VRS)
  const isVrsUser = user?.role === 'VRS';
  const [activeSection, setActiveSection] = useState<'DP' | 'VRS'>(isVrsUser ? 'VRS' : 'DP');

  // Data states
  const [dpInvoices, setDpInvoices] = useState<DpInvoice[]>([]);
  const [vrsInvoices, setVrsInvoices] = useState<VrsInvoice[]>([]);
  const [dpSummary, setDpSummary] = useState<any>(null);
  const [vrsSummary, setVrsSummary] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [dropPointFilter, setDropPointFilter] = useState('');

  // Payment modal state
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<DpInvoice | VrsInvoice | null>(null);
  const [paymentModalType, setPaymentModalType] = useState<'DP' | 'VRS'>('DP');

  // Definitive invoice modal state
  const [definitiveModalInvoice, setDefinitiveModalInvoice] = useState<DpInvoice | VrsInvoice | null>(null);
  const [definitiveModalType, setDefinitiveModalType] = useState<'DP' | 'VRS'>('DP');

  // History modal state
  const [historyModalInvoice, setHistoryModalInvoice] = useState<DpInvoice | VrsInvoice | null>(null);
  const [historyModalType, setHistoryModalType] = useState<'DP' | 'VRS'>('DP');

  // Edit payment sub-modal
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [paymentActionError, setPaymentActionError] = useState<string | null>(null);

  // Cancel payment confirmation
  const [cancellingPaymentId, setCancellingPaymentId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (user?.role === 'VRS') {
        const vrsRes = await api.getVrsInvoices({
          paymentStatus: statusFilter || undefined,
        });
        setVrsInvoices(vrsRes.invoices || []);
        setVrsSummary(vrsRes.summary || null);
      } else {
        const [dpInvRes, dpSumRes, vrsRes] = await Promise.all([
          api.getDpInvoices({
            paymentStatus: statusFilter || undefined,
            dropPointId: dropPointFilter ? parseInt(dropPointFilter, 10) : undefined,
          }),
          api.getDpInvoicesSummary(),
          api.getVrsInvoices({
            paymentStatus: statusFilter || undefined,
            dropPointId: user?.role === 'SALES_ADMIN' ? user.dropPointId : (dropPointFilter ? parseInt(dropPointFilter, 10) : undefined),
          }),
        ]);
        setDpInvoices(dpInvRes.invoices || []);
        setDpSummary(dpSumRes);
        setVrsInvoices(vrsRes.invoices || []);
        setVrsSummary(vrsRes.summary || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (user?.role === 'SALES_ADMIN_NATIONAL') {
      api.getDropPoints().then((res) => setDropPoints(res.dropPoints || [])).catch(console.error);
    }
  }, [statusFilter, dropPointFilter]);

  const handleOpenPayment = (inv: DpInvoice | VrsInvoice, type: 'DP' | 'VRS') => {
    setPaymentModalInvoice(inv);
    setPaymentModalType(type);
  };

  const handleOpenDefinitive = (inv: DpInvoice | VrsInvoice, type: 'DP' | 'VRS') => {
    setDefinitiveModalInvoice(inv);
    setDefinitiveModalType(type);
  };

  const handleOpenHistory = (inv: DpInvoice | VrsInvoice, type: 'DP' | 'VRS') => {
    setHistoryModalInvoice(inv);
    setHistoryModalType(type);
    setPaymentActionError(null);
  };

  // Start editing a payment
  const handleStartEditPayment = (p: any) => {
    setEditingPayment(p);
    setEditAmount(String(p.amount));
    setEditMethod(p.payment_method);
    setEditReference(p.reference || '');
    setEditNotes(p.notes || '');
    setPaymentActionError(null);
  };

  // Submit payment modification
  const handleSavePaymentEdit = async () => {
    if (!editingPayment) return;
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0) {
      setPaymentActionError('Le montant doit être supérieur à zéro.');
      return;
    }

    setIsSubmittingEdit(true);
    setPaymentActionError(null);
    try {
      if (historyModalType === 'DP') {
        await api.updateDpInvoicePayment(editingPayment.id, {
          amount: amt,
          paymentMethod: editMethod,
          reference: editReference,
          notes: editNotes,
        });
      } else {
        await api.updateVrsInvoicePayment(editingPayment.id, {
          amount: amt,
          paymentMethod: editMethod,
          reference: editReference,
          notes: editNotes,
        });
      }
      setEditingPayment(null);
      setHistoryModalInvoice(null);
      loadData();
    } catch (err: any) {
      setPaymentActionError(err.message || 'Erreur lors de la modification du paiement.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Submit payment cancellation
  const handleConfirmCancelPayment = async () => {
    if (!cancellingPaymentId) return;
    setIsSubmittingCancel(true);
    setPaymentActionError(null);
    try {
      if (historyModalType === 'DP') {
        await api.cancelDpInvoicePayment(cancellingPaymentId, { reason: cancelReason });
      } else {
        await api.cancelVrsInvoicePayment(cancellingPaymentId, { reason: cancelReason });
      }
      setCancellingPaymentId(null);
      setCancelReason('');
      setHistoryModalInvoice(null);
      loadData();
    } catch (err: any) {
      setPaymentActionError(err.message || 'Erreur lors de l\'annulation du paiement.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Active list based on activeSection
  const currentInvoices = activeSection === 'DP' ? dpInvoices : vrsInvoices;
  const currentSummary = activeSection === 'DP' ? dpSummary : vrsSummary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white">
              {user?.role === 'SALES_ADMIN'
                ? 'Factures & Règlements'
                : user?.role === 'VRS'
                ? 'Mes factures de dotation'
                : 'Facturation & Cessions Réseau'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
              {currentInvoices.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Suivi des cessions 6C Distribution, encaissements, TVA 18%, et génération de factures acquittées conformes PDF (A4).
          </p>
        </div>

        {/* Section Tabs for SAN and SA */}
        {!isVrsUser && (
          <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('DP')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeSection === 'DP'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{user?.role === 'SALES_ADMIN' ? 'Mes factures Dépôt (6C)' : 'Factures Drop Points'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('VRS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeSection === 'VRS'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Factures Vendeurs (VRS)</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Creances / Restant Du */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {activeSection === 'DP'
                ? user?.role === 'SALES_ADMIN'
                  ? 'Mon Solde Restant Dû'
                  : 'Créances Drop Points'
                : 'Solde Restant Dû (VRS)'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-800/40 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-400 font-mono">
              {(currentSummary?.totalUnpaid || 0).toLocaleString('fr-FR')}{' '}
              <span className="text-xs font-normal text-slate-400">FCFA</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
              {activeSection === 'DP'
                ? 'Règlements obligatoires avant génération de facture acquittée'
                : 'En cours de recouvrement auprès des vendeurs'}
            </p>
          </div>
        </div>

        {/* Card 2: Total Paye */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Règlements Encaissés
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {(currentSummary?.totalPaid || 0).toLocaleString('fr-FR')}{' '}
              <span className="text-xs font-normal text-slate-400">FCFA</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
              Sur {(currentSummary?.totalBilled || 0).toLocaleString('fr-FR')} FCFA facturés au total
            </p>
          </div>
        </div>

        {/* Card 3: Nombre de factures */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Factures au Compteur
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">
              {currentSummary?.count || currentInvoices.length}{' '}
              <span className="text-xs font-normal text-slate-400">Factures</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
              {activeSection === 'DP' ? 'Cessions 6C → Drop Points' : 'Dotations Dépôt → Vendeurs'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === ''
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Toutes
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('A_PAYER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'A_PAYER'
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>À payer</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PARTIELLEMENT_PAYE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'PARTIELLEMENT_PAYE'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            <span>Partiellement payées</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PAYE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'PAYE'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Payées (Solde 0)</span>
          </button>
        </div>

        {user?.role === 'SALES_ADMIN_NATIONAL' && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={dropPointFilter}
              onChange={(e) => setDropPointFilter(e.target.value)}
              className="p-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">Tous les Drop Points</option>
              {dropPoints.map((dp) => (
                <option key={dp.id} value={dp.id}>
                  {dp.name} ({dp.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-purple-500" />
          <span className="text-xs">Chargement des factures et créances...</span>
        </div>
      ) : currentInvoices.length === 0 ? (
        <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">Aucune facture trouvée</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeSection === 'DP'
              ? "Les factures Drop Point sont créées automatiquement dès que le SAN valide une commande d'approvisionnement."
              : 'Les factures VRS sont créées automatiquement lors de la validation des chargements de stock.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentInvoices.map((inv) => {
            const isPaid = inv.payment_status === 'PAYE' && (inv.remaining_amount || 0) <= 0;
            const isPartial = inv.payment_status === 'PARTIELLEMENT_PAYE';
            const isUnpaid = inv.payment_status === 'A_PAYER';
            const isGenerated = Boolean(inv.is_generated);
            const isCancelledByAvoir = inv.status === 'ANNULEE_AVOIR';

            const canSanGenerate =
              activeSection === 'DP' &&
              user?.role === 'SALES_ADMIN_NATIONAL' &&
              isPaid &&
              !isGenerated;

            const canSaGenerate =
              activeSection === 'VRS' &&
              (user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL') &&
              isPaid &&
              !isGenerated;

            return (
              <div
                key={inv.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                {/* Left Details */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-white tracking-wide">
                      {inv.invoice_number}
                    </span>

                    {/* Recipient identity */}
                    {activeSection === 'DP' ? (
                      <span className="status-badge status-badge-grey font-mono">
                        {inv.dropPointName} ({inv.dropPointCode})
                      </span>
                    ) : (
                      <span className="status-badge status-badge-grey font-mono flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                        <span>{(inv as any).vrsName || 'VRS'} ({(inv as any).vrsPublicId})</span>
                      </span>
                    )}

                    {/* Payment Status Badge */}
                    <span
                      className={`status-badge ${
                        isCancelledByAvoir
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : isPaid
                          ? 'status-badge-green'
                          : isPartial
                          ? 'status-badge-brown'
                          : 'status-badge-grey'
                      }`}
                    >
                      {isCancelledByAvoir && <Ban className="w-4 h-4 text-rose-400" />}
                      {!isCancelledByAvoir && isPaid && <CheckCircle2 className="w-4 h-4 text-white" />}
                      {!isCancelledByAvoir && isPartial && <Wallet className="w-4 h-4 text-white" />}
                      {!isCancelledByAvoir && isUnpaid && <Clock className="w-4 h-4 text-[#0F172A]" />}
                      <span>
                        {isCancelledByAvoir
                          ? 'Annulée par Avoir'
                          : isPaid
                          ? 'Payée (Solde 0)'
                          : isPartial
                          ? 'Partiellement payée'
                          : 'À payer'}
                      </span>
                    </span>

                    {/* Definitive generated indicator */}
                    {isGenerated && !isCancelledByAvoir && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Facture Acquittée
                      </span>
                    )}

                    {inv.requestNumber && (
                      <span className="status-badge status-badge-grey font-mono">
                        Commande : {inv.requestNumber}
                      </span>
                    )}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
                    <div>
                      <span className="text-slate-400">Total TTC : </span>
                      <strong className="font-mono text-white">
                        {(inv.total_amount || 0).toLocaleString('fr-FR')} FCFA
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Déjà réglé : </span>
                      <strong className="font-mono text-emerald-400">
                        {(inv.paid_amount || 0).toLocaleString('fr-FR')} FCFA
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Solde restant : </span>
                      <strong
                        className={`font-mono font-bold ${
                          (inv.remaining_amount || 0) > 0 ? 'text-rose-400' : 'text-slate-400'
                        }`}
                      >
                        {(inv.remaining_amount || 0).toLocaleString('fr-FR')} FCFA
                      </strong>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Émise le : {formatDateTime(inv.created_at)}
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-center flex-wrap">
                  {/* BUTTON: Générer la facture (Visible ONLY IF remaining_amount === 0 and NOT yet generated) */}
                  {(canSanGenerate || canSaGenerate) && (
                    <button
                      type="button"
                      onClick={() => handleOpenDefinitive(inv, activeSection)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950 transition cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>Générer la facture</span>
                    </button>
                  )}

                  {/* BUTTON: Consulter la facture (PDF A4) - visible if generated OR if paid */}
                  {(isGenerated || isPaid) && (
                    <button
                      type="button"
                      onClick={() => handleOpenDefinitive(inv, activeSection)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
                      title="Consulter et imprimer la facture en PDF (A4)"
                    >
                      <Printer className="w-3.5 h-3.5 text-purple-400" />
                      <span>Consulter PDF</span>
                    </button>
                  )}

                  {/* Payment button (only if not yet fully paid) */}
                  {!isPaid && !isCancelledByAvoir && (
                    <button
                      type="button"
                      onClick={() => handleOpenPayment(inv, activeSection)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/20 transition cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>{isVrsUser ? 'Déclarer un paiement' : 'Enregistrer un paiement'}</span>
                    </button>
                  )}

                  {/* Payments History button */}
                  <button
                    type="button"
                    onClick={() => handleOpenHistory(inv, activeSection)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Règlements ({inv.payments?.filter((p: any) => !p.status || p.status === 'CONFIRME')?.length || 0})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reusable Record Payment Modal (Shared between VRS and Sales Admin) */}
      <RecordPaymentModal
        isOpen={!!paymentModalInvoice}
        invoice={paymentModalInvoice}
        type={paymentModalType}
        onClose={() => setPaymentModalInvoice(null)}
        onPaymentSuccess={loadData}
      />

      {/* Definitive Printable A4 Invoice Modal */}
      <DefinitiveInvoiceModal
        isOpen={!!definitiveModalInvoice}
        invoice={definitiveModalInvoice}
        type={definitiveModalType}
        onClose={() => setDefinitiveModalInvoice(null)}
        onGenerateSuccess={loadData}
      />

      {/* Payments History & Management Modal (Allows modifying and cancelling payments) */}
      {historyModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Historique des Règlements</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-purple-300">
                    {historyModalInvoice.invoice_number}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Total : {(historyModalInvoice.total_amount || 0).toLocaleString('fr-FR')} FCFA • Déjà réglé : {(historyModalInvoice.paid_amount || 0).toLocaleString('fr-FR')} FCFA
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalInvoice(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentActionError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{paymentActionError}</span>
              </div>
            )}

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {!historyModalInvoice.payments || historyModalInvoice.payments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Aucun paiement enregistré pour cette facture à ce jour.
                </div>
              ) : (
                historyModalInvoice.payments.map((p: any) => {
                  const isCancelled = p.status === 'ANNULE';

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border space-y-2 text-xs transition ${
                        isCancelled
                          ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-sm ${
                              isCancelled ? 'line-through text-slate-500' : 'text-emerald-400'
                            }`}
                          >
                            +{(p.amount || 0).toLocaleString('fr-FR')} FCFA
                          </span>
                          {isCancelled && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                              ANNULÉ
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {p.payment_method === 'MOBILE_MONEY'
                              ? 'Mobile Money'
                              : p.payment_method === 'VIREMENT'
                              ? 'Virement Bancaire'
                              : 'Espèces'}
                          </span>

                          {/* Action Buttons: Modifier et Annuler (Requirement 6) */}
                          {!isCancelled && !historyModalInvoice.is_generated && (
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditPayment(p)}
                                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition"
                                title="Modifier ce paiement en cas d'erreur"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCancellingPaymentId(p.id);
                                  setCancelReason('');
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                                title="Annuler ce paiement en cas d'erreur"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                        <span>Date : {formatDateTime(p.payment_date)}</span>
                        {p.reference && <span className="font-mono text-purple-300">Réf : {p.reference}</span>}
                      </div>

                      {p.notes && <p className="text-[11px] text-slate-400 italic">« {p.notes} »</p>}
                      {isCancelled && p.cancellation_reason && (
                        <p className="text-[10px] text-rose-400 italic pt-1">
                          Motif annulation : {p.cancellation_reason}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/90">
              <span className="text-[11px] text-slate-500">
                {historyModalInvoice.is_generated
                  ? 'Facture déjà acquittée : règlements verrouillés.'
                  : 'En cas d\'erreur de saisie, vous pouvez modifier ou annuler un paiement.'}
              </span>
              <button
                type="button"
                onClick={() => setHistoryModalInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Sub-Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <span>Modifier le règlement</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingPayment(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Montant (FCFA) *
                </label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mode de règlement
                </label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="VIREMENT">Virement Bancaire</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="ESPECES">Espèces</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Référence de transaction
                </label>
                <input
                  type="text"
                  value={editReference}
                  onChange={(e) => setEditReference(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="Ex: VIR-BDM-12345"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes / Précisions
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="Ex: Correction montant saisi"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingPayment(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSavePaymentEdit}
                disabled={isSubmittingEdit}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Enregistrer la modification</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Payment Confirmation Sub-Modal */}
      {cancellingPaymentId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Annuler ce règlement</h4>
                <p className="text-xs text-slate-400">Le solde restant dû de la facture sera réajusté.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Motif de l'annulation *
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Erreur de saisie, chèque impayé, doublon..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCancellingPaymentId(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelPayment}
                disabled={isSubmittingCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingCancel && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmer l'annulation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DpInvoicesView;
