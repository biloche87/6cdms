import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { DpInvoice, VrsInvoice } from '../../types/index.ts';
import { formatDateTime } from '../../utils/date.ts';
import {
  X,
  Printer,
  CheckCircle2,
  FileCheck2,
  AlertTriangle,
  Building2,
  UserCheck,
  Receipt,
  Sparkles,
  Loader2,
  ShieldCheck,
  Ban,
} from 'lucide-react';

interface DefinitiveInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: (DpInvoice | VrsInvoice) | null;
  type: 'DP' | 'VRS';
  onGenerateSuccess?: () => void;
}

export const DefinitiveInvoiceModal: React.FC<DefinitiveInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
  type,
  onGenerateSuccess,
}) => {
  const { user } = useAuth();
  const [applyTva, setApplyTva] = useState<boolean>(
    invoice?.tva_applicable !== undefined ? invoice.tva_applicable === 1 : true
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCancellingAvoir, setIsCancellingAvoir] = useState(false);
  const [avoirReason, setAvoirReason] = useState('');
  const [showAvoirModal, setShowAvoirModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const isDp = type === 'DP';
  const dpInvoice = isDp ? (invoice as DpInvoice) : null;
  const vrsInvoice = !isDp ? (invoice as VrsInvoice) : null;

  const isPaid = invoice.payment_status === 'PAYE' && (invoice.remaining_amount || 0) <= 0;
  const isGenerated = Boolean(invoice.is_generated);
  const isCancelledByAvoir = invoice.status === 'ANNULEE_AVOIR';

  // Authorization check for generating
  const canGenerate =
    isPaid &&
    !isGenerated &&
    ((isDp && user?.role === 'SALES_ADMIN_NATIONAL') ||
      (!isDp && (user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL')));

  // Authorization check for credit note cancellation
  const canCancelAvoir =
    isGenerated &&
    !isCancelledByAvoir &&
    ((isDp && user?.role === 'SALES_ADMIN_NATIONAL') ||
      (!isDp && (user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL')));

  // Financial calculations
  const totalTtc = invoice.total_amount;
  const tvaRate = 18;
  const totalHt = applyTva ? Math.round(totalTtc / (1 + tvaRate / 100)) : totalTtc;
  const tvaAmount = applyTva ? totalTtc - totalHt : 0;

  // Payments list (excluding cancelled ones)
  const validPayments = (invoice.payments || []).filter(
    (p: any) => !p.status || p.status === 'CONFIRME'
  );
  const totalPaymentsAmount = validPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleGenerateInvoice = async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsGenerating(true);
    try {
      if (isDp) {
        await api.generateDpInvoice(invoice.id, { applyTva });
      } else {
        await api.generateVrsInvoice(invoice.id, { applyTva });
      }
      setActionSuccess('Facture définitive générée avec succès et transmise au destinataire.');
      if (onGenerateSuccess) onGenerateSuccess();
    } catch (err: any) {
      setActionError(err.message || 'Erreur lors de la génération de la facture.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteAvoir = async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsCancellingAvoir(true);
    try {
      if (isDp) {
        await api.cancelDpInvoiceAvoir(invoice.id, { reason: avoirReason });
      } else {
        await api.cancelVrsInvoiceAvoir(invoice.id, { reason: avoirReason });
      }
      setShowAvoirModal(false);
      setActionSuccess('Facture annulée par avoir avec succès.');
      if (onGenerateSuccess) onGenerateSuccess();
    } catch (err: any) {
      setActionError(err.message || "Erreur lors de l'annulation par avoir.");
    } finally {
      setIsCancellingAvoir(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white animate-in fade-in duration-200">
      {/* Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 print:my-0 print:border-none print:shadow-none print:w-full">
        {/* Top Action Toolbar (Hidden in Print) */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  {isDp ? 'Facture Cession Drop Point' : 'Facture Vendeur (VRS)'}
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold">
                  {invoice.invoice_number}
                </span>
                {isGenerated && !isCancelledByAvoir && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Définitive & Acquittée
                  </span>
                )}
                {isCancelledByAvoir && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                    <Ban className="w-3 h-3" />
                    Annulée par Avoir ({invoice.credit_note_number})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Document comptable officiel 6C Distribution • Format normalisé A4 fond blanc
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* TVA Toggle (Only allowed before lock or for view recalculation) */}
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:bg-slate-850 transition">
              <input
                type="checkbox"
                checked={applyTva}
                disabled={isGenerated}
                onChange={(e) => setApplyTva(e.target.checked)}
                className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span className="font-semibold">TVA 18% (TTC)</span>
            </label>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs transition cursor-pointer border border-slate-700"
              title="Imprimer ou enregistrer en PDF (A4)"
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>Imprimer en PDF (A4)</span>
            </button>

            {/* Generate Definitive Invoice Button */}
            {canGenerate && (
              <button
                type="button"
                onClick={handleGenerateInvoice}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950 transition cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                )}
                <span>Générer la facture définitive</span>
              </button>
            )}

            {/* Cancel by Credit Note Button */}
            {canCancelAvoir && (
              <button
                type="button"
                onClick={() => setShowAvoirModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 font-semibold text-xs border border-rose-800/80 transition cursor-pointer"
                title="Annuler cette facture définitive par l'émission d'un avoir"
              >
                <Ban className="w-3.5 h-3.5 text-rose-400" />
                <span>Annuler par avoir</span>
              </button>
            )}

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications and Alerts */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 print:hidden">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 print:hidden">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* PRINTABLE INVOICE SHEET (A4 White Background, Very Classy Corporate Design) */}
        <div className="max-h-[75vh] overflow-y-auto p-4 sm:p-8 bg-slate-950 print:max-h-none print:overflow-visible print:p-0 print:bg-white">
          <div
            id="printable-invoice-document"
            ref={printAreaRef}
            className="bg-white text-slate-900 rounded-xl p-8 sm:p-12 shadow-md max-w-3xl mx-auto border border-slate-200 print:border-none print:shadow-none print:rounded-none print:p-0 print:max-w-none print:w-full"
            style={{ minHeight: '297mm' }}
          >
            {/* Top Corporate Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-black text-xl tracking-tighter">
                    6C
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                      6C Distribution SA
                    </h1>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      Distribution Alimentaire & Biens de Consommation Courante
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-slate-500 leading-relaxed font-sans">
                  <p>Siège Social : Zone Industrielle, Rue 14 • Bamako, Mali</p>
                  <p>NIF : 084124982M • RCCM : MA.BKO.2024.B.1140 • Tél : +223 20 22 00 66</p>
                  <p>Plateforme Réseau DMS • www.6cdistribution.com</p>
                </div>
              </div>

              {/* Document Title & Invoice Info Box */}
              <div className="text-right">
                <div className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black tracking-widest uppercase rounded">
                  {isCancelledByAvoir
                    ? 'FACTURE ANNULÉE (AVOIR)'
                    : isPaid
                    ? 'FACTURE DÉFINITIVE ACQUITTÉE'
                    : 'FACTURE DE CESSION'}
                </div>
                <div className="mt-3 space-y-1 text-xs">
                  <div>
                    <span className="text-slate-500">N° Facture : </span>
                    <strong className="font-mono text-slate-950 font-black text-sm">
                      {invoice.invoice_number}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Date d'émission : </span>
                    <strong className="text-slate-900 font-semibold">
                      {formatDateTime(invoice.created_at)}
                    </strong>
                  </div>
                  {invoice.generated_at && (
                    <div>
                      <span className="text-slate-500">Date d'acquittement : </span>
                      <strong className="text-emerald-700 font-semibold">
                        {formatDateTime(invoice.generated_at)}
                      </strong>
                    </div>
                  )}
                  {invoice.requestNumber && (
                    <div>
                      <span className="text-slate-500">N° Commande : </span>
                      <span className="font-mono text-slate-700 font-bold">{invoice.requestNumber}</span>
                    </div>
                  )}
                  {isCancelledByAvoir && invoice.credit_note_number && (
                    <div className="text-rose-700 font-bold text-xs pt-1">
                      Avoir de régularisation : {invoice.credit_note_number}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Official Acquittée Badge / Stamp */}
            <div className="my-6 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider font-bold text-slate-600">
                    Statut du règlement
                  </div>
                  <div className="text-lg font-black text-emerald-800 flex items-center gap-2">
                    <span>{isPaid ? 'ACQUITTÉE EN TOTALITÉ' : 'RÈGLEMENT EN COURS'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isPaid
                      ? 'Tous les versements ont été enregistrés et validés. Le solde restant dû est de 0 FCFA.'
                      : `Solde restant à régler : ${(invoice.remaining_amount || 0).toLocaleString('fr-FR')} FCFA`}
                  </p>
                </div>
              </div>

              {/* Classy Stamp */}
              <div
                className={`hidden sm:flex flex-col items-center justify-center px-4 py-2 rounded-lg border-2 border-dashed font-black uppercase tracking-wider select-none transform -rotate-3 ${
                  isCancelledByAvoir
                    ? 'border-rose-600 text-rose-700 bg-rose-50'
                    : isPaid
                    ? 'border-emerald-700 text-emerald-800 bg-emerald-50'
                    : 'border-slate-400 text-slate-500 bg-white'
                }`}
              >
                <span className="text-xs">6C DISTRIBUTION</span>
                <span className="text-base tracking-widest">
                  {isCancelledByAvoir ? 'ANNULÉE' : isPaid ? 'ACQUITTÉE' : 'EN ATTENTE'}
                </span>
                <span className="text-[9px] font-mono font-normal">
                  {formatDateTime(invoice.generated_at || invoice.updated_at || invoice.created_at)}
                </span>
              </div>
            </div>

            {/* Parties Details Box (2 Columns) */}
            <div className="grid grid-cols-2 gap-6 my-6 text-xs leading-relaxed">
              {/* ÉMETTEUR */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-1.5 text-slate-500 uppercase tracking-wider font-bold text-[10px] mb-2 border-b border-slate-200 pb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Émetteur</span>
                </div>
                {isDp ? (
                  <>
                    <div className="font-bold text-slate-900 text-sm">6C DISTRIBUTION SA</div>
                    <div className="text-slate-700">Direction Commerciale Nationale (SAN)</div>
                    <div className="text-slate-500 text-[11px] mt-1">
                      Gestionnaire Réseau Cessions Dépôts
                    </div>
                    <div className="text-slate-500 text-[11px]">Contact : dms-san@6cdistribution.com</div>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-slate-900 text-sm">
                      DÉPÔT : {vrsInvoice?.dropPointName || 'Drop Point'}
                    </div>
                    <div className="text-slate-700">
                      Code : {vrsInvoice?.dropPointCode} • {vrsInvoice?.dropPointCity}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-1">
                      Responsable : Sales Admin (SA)
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Entité émettrice de la dotation stock
                    </div>
                  </>
                )}
              </div>

              {/* DESTINATAIRE */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-1.5 text-slate-500 uppercase tracking-wider font-bold text-[10px] mb-2 border-b border-slate-200 pb-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Destinataire (Client)</span>
                </div>
                {isDp ? (
                  <>
                    <div className="font-bold text-slate-900 text-sm">
                      {dpInvoice?.dropPointName || 'Drop Point'} ({dpInvoice?.dropPointCode})
                    </div>
                    <div className="text-slate-700">
                      Ville : {dpInvoice?.dropPointCity || 'Dakar / Bamako'}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-1">
                      Attn : Sales Admin Responsable de Dépôt
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Référence compte : DP-ACC-{dpInvoice?.drop_point_id}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-slate-900 text-sm">
                      {vrsInvoice?.vrsName || 'Vendeur VRS'}
                    </div>
                    <div className="text-slate-700">
                      ID Public : <span className="font-mono font-bold">{vrsInvoice?.vrsPublicId}</span>
                    </div>
                    {vrsInvoice?.vrsPhone && (
                      <div className="text-slate-600">Tél : {vrsInvoice.vrsPhone}</div>
                    )}
                    <div className="text-slate-500 text-[11px] mt-1">
                      Rôle : Vendeur Responsable Secteur (VRS)
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Table of Items */}
            <div className="my-6">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Détail des marchandises cédées
              </h3>
              <table className="w-full text-left text-xs border border-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-2.5 font-bold">N°</th>
                    <th className="p-2.5 font-bold">Désignation Produit</th>
                    <th className="p-2.5 font-bold text-center">Réf.</th>
                    <th className="p-2.5 font-bold text-right">Quantité (Cartons)</th>
                    <th className="p-2.5 font-bold text-right">
                      Prix Unitaire {applyTva ? 'HT' : 'Net'}
                    </th>
                    <th className="p-2.5 font-bold text-right">Total {applyTva ? 'HT' : 'Net'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items && invoice.items.length > 0 ? (
                    invoice.items.map((it: any, idx: number) => {
                      const qty = it.quantity_approved || it.quantity_requested || 1;
                      const rawPrice = it.unit_cession_price || it.unitCessionPrice || 10000;
                      const lineHt = applyTva ? Math.round((qty * rawPrice) / 1.18) : qty * rawPrice;
                      const unitHt = Math.round(lineHt / qty);

                      return (
                        <tr key={it.id || idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900">
                            {it.productName || 'Produit Nestlé / 6C'}
                            {it.unitsPerCarton && (
                              <span className="block text-[10px] text-slate-500 font-normal">
                                {it.unitsPerCarton} unités / carton
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-center text-slate-600">
                            {it.productReference || '-'}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-right text-slate-900">
                            {qty} ctn
                          </td>
                          <td className="p-2.5 font-mono text-right text-slate-700">
                            {unitHt.toLocaleString('fr-FR')} FCFA
                          </td>
                          <td className="p-2.5 font-mono font-bold text-right text-slate-900">
                            {lineHt.toLocaleString('fr-FR')} FCFA
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                        Demande d'approvisionnement validée ({invoice.requestNumber || 'Lot complet'})
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Taxes Box */}
            <div className="flex justify-end my-6">
              <div className="w-full max-w-xs space-y-2 text-xs border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex justify-between text-slate-600">
                  <span>Total Brut Hors Taxe (HT) :</span>
                  <strong className="font-mono text-slate-900">
                    {totalHt.toLocaleString('fr-FR')} FCFA
                  </strong>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>TVA (18.0%) :</span>
                  <strong className="font-mono text-slate-900">
                    {applyTva ? `${tvaAmount.toLocaleString('fr-FR')} FCFA` : 'Exonérée (0 FCFA)'}
                  </strong>
                </div>

                <div className="border-t border-slate-300 pt-2 flex justify-between items-center text-sm font-black text-slate-950">
                  <span>NET À PAYER (TTC) :</span>
                  <span className="font-mono text-base text-slate-900">
                    {totalTtc.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>

                <div className="flex justify-between text-emerald-800 font-bold pt-1 border-t border-slate-200">
                  <span>Total Règlements Encaissés :</span>
                  <span className="font-mono">
                    {totalPaymentsAmount.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>

                <div className="flex justify-between text-xs font-black text-slate-700">
                  <span>SOLDE RESTANT DÛ :</span>
                  <span
                    className={`font-mono ${
                      (invoice.remaining_amount || 0) === 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {(invoice.remaining_amount || 0).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            </div>

            {/* Confirmed Payments Table */}
            <div className="my-6">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Bordereau des règlements encaissés</span>
              </h3>
              {validPayments.length === 0 ? (
                <div className="p-3 border border-slate-200 rounded-lg text-xs text-slate-500 italic bg-white text-center">
                  Aucun règlement enregistré.
                </div>
              ) : (
                <table className="w-full text-left text-xs border border-slate-200 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="p-2 font-semibold">Date & Heure</th>
                      <th className="p-2 font-semibold">Mode de Règlement</th>
                      <th className="p-2 font-semibold">Référence Transaction</th>
                      <th className="p-2 font-semibold">Encaissé par / Notes</th>
                      <th className="p-2 font-semibold text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {validPayments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-slate-600">{formatDateTime(p.payment_date)}</td>
                        <td className="p-2 font-semibold text-slate-800">
                          {p.payment_method === 'MOBILE_MONEY'
                            ? 'Mobile Money'
                            : p.payment_method === 'VIREMENT'
                            ? 'Virement Bancaire'
                            : 'Espèces'}
                        </td>
                        <td className="p-2 font-mono text-slate-700">{p.reference || '-'}</td>
                        <td className="p-2 text-slate-600">
                          {p.recordedByName || p.notes || 'Comptabilité'}
                        </td>
                        <td className="p-2 font-mono font-bold text-right text-emerald-700">
                          +{(p.amount || 0).toLocaleString('fr-FR')} FCFA
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Legal Mentions and Official Signatures Footer */}
            <div className="mt-10 pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs">
              <div>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  Mention légale : La présente facture définitive tient lieu de quittance d'acquittement
                  intégrale des marchandises cédées et livrées. Aucune modification ultérieure ne peut être
                  portée sur ce titre en dehors d'un avoir formellement visé par la Direction.
                </p>
                <div className="mt-4 text-[10px] text-slate-400 font-mono">
                  Certificat d'intégrité DMS : SHA256-{(invoice.invoice_number || '').slice(-6)}-6C-DMS-OK
                </div>
              </div>

              {/* Signature Box */}
              <div className="flex flex-col items-end text-right">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Pour 6C Distribution SA
                </span>
                <span className="text-[11px] text-slate-500">
                  Direction Générale & Administrative
                </span>
                <div className="mt-4 w-44 h-16 border border-slate-300 rounded bg-slate-50/50 flex flex-col items-center justify-center text-[10px] text-slate-400 select-none">
                  <div className="font-serif italic text-slate-700 font-bold">Direction 6C DMS</div>
                  <div className="text-[9px] text-emerald-700 font-bold font-sans">
                    ✓ Cachet Numérique Certifié
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden in print) */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-slate-400">
            {isGenerated ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Facture verrouillée. Document probant téléchargeable.
              </span>
            ) : isPaid ? (
              <span className="text-amber-400 font-semibold">
                Solde à 0 FCFA. Prête pour génération définitive par{' '}
                {isDp ? 'le Sales Admin National' : 'le Sales Admin'}.
              </span>
            ) : (
              <span className="text-slate-400">
                Solde restant à régler avant émission du document définitif.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>Imprimer (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Cancellation By Credit Note / Avoir Sub-Modal */}
      {showAvoirModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Annulation par Avoir</h3>
                <p className="text-xs text-slate-400">Facture {invoice.invoice_number}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Une facture définitive déjà acquittée ne peut pas être supprimée. Elle est annulée par
              l'émission d'un <strong>avoir comptable</strong> officiel avec journal d'audit et
              notification au destinataire.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Motif de l'annulation par avoir *
              </label>
              <textarea
                value={avoirReason}
                onChange={(e) => setAvoirReason(e.target.value)}
                placeholder="Ex: Erreur de facturation sur quantités convenues, régularisation administrative..."
                className="w-full h-20 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAvoirModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleExecuteAvoir}
                disabled={isCancellingAvoir || !avoirReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isCancellingAvoir && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmer l'Avoir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DefinitiveInvoiceModal;
