import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { DpSupplyRequest, DropPoint } from '../../types/index.ts';
import { formatDateTime } from '../../utils/date.ts';
import { NewDpSupplyRequestModal } from './NewDpSupplyRequestModal.tsx';
import {
  Truck,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Calendar,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Loader2,
  Sparkles,
  Receipt,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';

interface DpSupplyRequestsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const DpSupplyRequestsView: React.FC<DpSupplyRequestsViewProps> = ({ onNavigateTab }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DpSupplyRequest[]>([]);
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dropPointFilter, setDropPointFilter] = useState<string>('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Detail / Action modal states
  const [selectedRequest, setSelectedRequest] = useState<DpSupplyRequest | null>(null);
  const [actionType, setActionType] = useState<'VALIDATE' | 'REFUSE' | 'EDIT' | 'CANCEL' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [validationNotes, setValidationNotes] = useState('');
  const [desiredDateInput, setDesiredDateInput] = useState('');
  const [adjustedQuantities, setAdjustedQuantities] = useState<Record<number, number>>({});
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDpSupplyRequests({
        status: statusFilter || undefined,
        dropPointId: dropPointFilter ? parseInt(dropPointFilter, 10) : undefined,
      });
      setRequests(res.requests || []);
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

  const handleOpenValidate = (req: DpSupplyRequest) => {
    setSelectedRequest(req);
    setActionType('VALIDATE');
    setActionError(null);
    setValidationNotes('');
    const initialQtys: Record<number, number> = {};
    if (req.items) {
      req.items.forEach((it) => {
        initialQtys[it.id] = it.quantity_approved || it.quantity_requested;
      });
    }
    setAdjustedQuantities(initialQtys);
  };

  const handleOpenRefuse = (req: DpSupplyRequest) => {
    setSelectedRequest(req);
    setActionType('REFUSE');
    setActionError(null);
    setRejectionReason('');
  };

  const handleOpenEdit = (req: DpSupplyRequest) => {
    setSelectedRequest(req);
    setActionType('EDIT');
    setActionError(null);
    setValidationNotes(req.comments || '');
    setDesiredDateInput(req.desired_date || '');
    const initialQtys: Record<number, number> = {};
    if (req.items) {
      req.items.forEach((it) => {
        initialQtys[it.id] = it.quantity_requested;
      });
    }
    setAdjustedQuantities(initialQtys);
  };

  const handleOpenCancel = (req: DpSupplyRequest) => {
    setSelectedRequest(req);
    setActionType('CANCEL');
    setActionError(null);
    setRejectionReason('');
  };

  const handleSubmitAction = async () => {
    if (!selectedRequest || !actionType) return;
    setActionError(null);

    if (actionType === 'EDIT') {
      const itemsPayload = (selectedRequest.items || []).map((it) => ({
        productId: it.product_id,
        quantityRequested: adjustedQuantities[it.id] != null ? adjustedQuantities[it.id] : it.quantity_requested,
      }));
      const total = itemsPayload.reduce((acc, it) => acc + (it.quantityRequested || 0), 0);
      if (total <= 0) {
        setActionError('La quantité totale demandée doit être supérieure à 0.');
        return;
      }
      setSubmittingAction(true);
      try {
        await api.updateDpSupplyRequest(selectedRequest.id, {
          desiredDate: desiredDateInput || undefined,
          comments: validationNotes.trim() || undefined,
          items: itemsPayload,
        });
        setActionType(null);
        setSelectedRequest(null);
        loadData();
      } catch (err: any) {
        setActionError(err?.message || 'Erreur lors de la modification de la commande.');
      } finally {
        setSubmittingAction(false);
      }
      return;
    }

    if (actionType === 'CANCEL') {
      setSubmittingAction(true);
      try {
        await api.cancelDpSupplyRequest(selectedRequest.id, {
          reason: rejectionReason.trim() || 'Annulation par le Sales Admin',
        });
        setActionType(null);
        setSelectedRequest(null);
        loadData();
      } catch (err: any) {
        setActionError(err?.message || 'Erreur lors de l\'annulation de la commande.');
      } finally {
        setSubmittingAction(false);
      }
      return;
    }

    if (actionType === 'REFUSE') {
      if (!rejectionReason.trim()) {
        setActionError('Le motif de refus est obligatoire.');
        return;
      }

      setSubmittingAction(true);
      try {
        await api.reviewDpSupplyRequest(selectedRequest.id, {
          decision: 'REFUSEE',
          rejectionReason: rejectionReason.trim(),
        });
        setActionType(null);
        setSelectedRequest(null);
        loadData();
      } catch (err: any) {
        setActionError(err?.message || 'Erreur lors du refus de la demande.');
      } finally {
        setSubmittingAction(false);
      }
      return;
    }

    if (actionType === 'VALIDATE') {
      const itemsPayload = (selectedRequest.items || []).map((it) => ({
        id: it.id,
        productId: it.product_id,
        quantityApproved: adjustedQuantities[it.id] != null ? adjustedQuantities[it.id] : it.quantity_requested,
      }));

      const totalApproved = itemsPayload.reduce((acc, it) => acc + (it.quantityApproved || 0), 0);
      if (totalApproved <= 0) {
        setActionError('La quantité totale approuvée doit être supérieure à 0.');
        return;
      }

      setSubmittingAction(true);
      try {
        await api.reviewDpSupplyRequest(selectedRequest.id, {
          decision: 'VALIDEE',
          validationNotes: validationNotes.trim() || undefined,
          items: itemsPayload,
        });
        setActionType(null);
        setSelectedRequest(null);
        loadData();
      } catch (err: any) {
        setActionError(err?.message || 'Erreur lors de la validation.');
      } finally {
        setSubmittingAction(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white">
              {user?.role === 'SALES_ADMIN' ? 'Mes commandes' : 'Commandes stock (6C Distribution)'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
              {requests.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Flux contractuel Drop Points → 6C Distribution : commande, validation SAN, facturation et transfert logistique.
          </p>
        </div>

        {/* Action button */}
        {(user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL') && (
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{user?.role === 'SALES_ADMIN' ? 'Nouvelle commande' : 'Nouvelle commande stock'}</span>
          </button>
        )}
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
            onClick={() => setStatusFilter('DEMANDEE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'DEMANDEE'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Demandées</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('VALIDEE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'VALIDEE'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Validées</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('REFUSEE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'REFUSEE'
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Refusées</span>
          </button>
        </div>

        {user?.role === 'SALES_ADMIN_NATIONAL' && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={dropPointFilter}
              onChange={(e) => setDropPointFilter(e.target.value)}
              className="p-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

      {/* Requests Table / Cards */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          <span className="text-xs">Chargement des commandes de stock...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <Truck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">Aucune commande trouvée</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {statusFilter
              ? `Aucune commande en statut '${statusFilter}'.`
              : 'Les Drop Points soumettent leurs commandes de stock directement depuis leur espace ("Mes commandes").'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isPending = req.status === 'DEMANDEE';
            const isValidated = req.status === 'VALIDEE';
            const isRefused = req.status === 'REFUSEE';

            return (
              <div
                key={req.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                {/* Left Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-white tracking-wide">
                      {req.request_number}
                    </span>
                    <span className="status-badge status-badge-grey font-mono">
                      {req.dropPointName || `Drop Point #${req.drop_point_id}`} ({req.dropPointCode})
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`status-badge ${
                        isPending
                          ? 'status-badge-brown'
                          : isValidated
                          ? 'status-badge-green'
                          : 'status-badge-red'
                      }`}
                    >
                      {isPending && <Clock className="w-4 h-4 text-white" />}
                      {isValidated && <CheckCircle2 className="w-4 h-4 text-white" />}
                      {isRefused && <XCircle className="w-4 h-4 text-white" />}
                      <span>
                        {isPending ? 'Demandée' : isValidated ? 'Validée' : 'Refusée'}
                      </span>
                    </span>

                    {/* Invoice status badge if validated */}
                    {isValidated && req.invoiceNumber && (
                      <span
                        className={`status-badge font-mono ${
                          req.invoicePaymentStatus === 'PAYE'
                            ? 'status-badge-green'
                            : req.invoicePaymentStatus === 'PARTIELLEMENT_PAYE'
                            ? 'status-badge-brown'
                            : 'status-badge-grey'
                        }`}
                      >
                        Facture {req.invoiceNumber} : {req.invoicePaymentStatus === 'PAYE' ? 'Payée' : req.invoicePaymentStatus === 'PARTIELLEMENT_PAYE' ? 'Partiellement payée' : 'À payer'}
                      </span>
                    )}

                    {/* Transfer status if validated */}
                    {isValidated && req.transferNumber && (
                      <span
                        className={`status-badge font-mono ${
                          req.transferStatus === 'RECU'
                            ? 'status-badge-green'
                            : req.transferStatus === 'EN_TRANSIT'
                            ? 'status-badge-brown'
                            : 'status-badge-brown'
                        }`}
                      >
                        Transfert {req.transferNumber} : {req.transferStatus === 'RECU' ? 'Reçu' : req.transferStatus === 'EN_TRANSIT' ? 'En transit' : 'Préparé'}
                      </span>
                    )}
                  </div>

                  {/* Summary & comments */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>
                      Demandé par : <strong className="text-slate-200">{req.requesterName || 'Sales Admin'}</strong>
                    </span>
                    <span>
                      Cartons :{' '}
                      <strong className="text-white font-mono">
                        {isValidated ? req.total_cartons_approved : req.total_cartons_requested} ctn
                      </strong>
                    </span>
                    <span>
                      Montant cession :{' '}
                      <strong className="text-emerald-400 font-mono">
                        {(req.total_amount || 0).toLocaleString('fr-FR')} FCFA
                      </strong>
                    </span>
                    {req.desired_date && (
                      <span className="text-blue-300">
                        Livraison souhaitée : <strong>{req.desired_date}</strong>
                      </span>
                    )}
                    <span>Soumise le : {formatDateTime(req.created_at)}</span>
                  </div>

                  {req.comments && (
                    <p className="text-xs text-slate-300 bg-slate-950/70 p-2 rounded-xl border border-slate-800/60 italic">
                      « {req.comments} »
                    </p>
                  )}

                  {/* Rejection motif box */}
                  {isRefused && req.rejection_reason && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-rose-300">Motif du refus :</strong> {req.rejection_reason}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {user?.role === 'SALES_ADMIN_NATIONAL' && isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenValidate(req)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Valider / Ajuster</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenRefuse(req)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 font-semibold text-xs transition"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Refuser</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequest(req);
                      setActionType(null);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    <span>Détails</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal (Valider / Refuser / Détails) */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    actionType === 'VALIDATE'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {actionType === 'VALIDATE' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {actionType === 'VALIDATE' ? 'Valider la Commande' : 'Refuser la Commande'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Commande #{selectedRequest.request_number} — {selectedRequest.dropPointName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActionType(null);
                  setSelectedRequest(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {actionError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {actionType === 'REFUSE' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-200">
                    Le motif de refus est obligatoire et sera immédiatement notifié au Sales Admin du Drop Point.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Motif obligatoire du refus *
                    </label>
                    <textarea
                      rows={4}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Ex: Stock 6C Distribution temporairement insuffisant, ou capacité maximale du dépôt atteinte..."
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-200">
                    La validation pour 6C Distribution génèrera automatiquement une <strong>facture de cession</strong> et un <strong>transfert logistique</strong> (Préparé). Vous pouvez ajuster les quantités approuvées ci-dessous :
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Quantités approuvées (Cartons)
                    </label>
                    {(selectedRequest.items || []).map((it) => (
                      <div
                        key={it.id}
                        className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">{it.productName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Demandé : {it.quantity_requested} ctn • Cession : {it.unit_cession_price.toLocaleString('fr-FR')} F/ctn
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-slate-400 font-medium">Validé :</label>
                          <input
                            type="number"
                            min="0"
                            value={adjustedQuantities[it.id] ?? it.quantity_requested}
                            onChange={(e) =>
                              setAdjustedQuantities({
                                ...adjustedQuantities,
                                [it.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                              })
                            }
                            className="w-20 p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white text-right font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Notes de validation (optionnel)
                    </label>
                    <textarea
                      rows={2}
                      value={validationNotes}
                      onChange={(e) => setValidationNotes(e.target.value)}
                      placeholder="Ex: Validation complète, expédition prévue jeudi matin..."
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActionType(null);
                  setSelectedRequest(null);
                }}
                disabled={submittingAction}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmitAction}
                disabled={submittingAction || (actionType === 'REFUSE' && !rejectionReason.trim())}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 ${
                  actionType === 'VALIDATE'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20'
                }`}
              >
                {submittingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Traitement...</span>
                  </>
                ) : actionType === 'VALIDATE' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmer la validation & facturer</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Confirmer le refus</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {selectedRequest && !actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
              <div>
                <h3 className="text-base font-bold text-white">
                  Détail de la Demande #{selectedRequest.request_number}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedRequest.dropPointName} ({selectedRequest.dropPointCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Items List */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Articles commandés
                </h4>
                <div className="space-y-2">
                  {(selectedRequest.items || []).map((it) => (
                    <div
                      key={it.id}
                      className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{it.productName}</div>
                        <div className="text-slate-400 font-mono text-[11px]">
                          Réf : {it.productReference} • Prix cession : {it.unit_cession_price.toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-white font-bold">
                          {selectedRequest.status === 'VALIDEE' ? it.quantity_approved : it.quantity_requested} cartons
                        </div>
                        <div className="text-emerald-400 text-[11px]">
                          {((selectedRequest.status === 'VALIDEE' ? it.quantity_approved : it.quantity_requested) * it.unit_cession_price).toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Linked Invoice & Transfer info */}
              {selectedRequest.status === 'VALIDEE' && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                  <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    Flux générés automatiquement
                  </h4>
                  {selectedRequest.invoiceNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Facture associée :</span>
                      <span className="font-mono font-bold text-white">{selectedRequest.invoiceNumber}</span>
                    </div>
                  )}
                  {selectedRequest.transferNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Transfert logistique :</span>
                      <span className="font-mono font-bold text-blue-400">{selectedRequest.transferNumber}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-end bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Request Modal */}
      <NewDpSupplyRequestModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
};
