import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { SupplyRequest, DropPoint } from '../../types/index.ts';
import { formatDateTime } from '../../utils/date.ts';
import { DocumentAttachmentPicker } from '../common/DocumentAttachmentPicker.tsx';
import { CounterBadge } from '../common/CounterBadge.tsx';
import {
  Truck,
  Plus,
  CheckCircle2,
  Clock,
  PackageCheck,
  RotateCw,
  XCircle,
  FileCheck2,
  FileText,
  Eye,
  Camera,
  Download,
  AlertTriangle,
  X,
  Sparkles,
  Building2,
  Shield,
  MessageSquare,
  AlertCircle,
  Loader2,
  Calendar,
  Boxes,
  Minus,
  RotateCcw,
  Edit2,
  Trash2,
} from 'lucide-react';

interface SupplyRequestsListProps {
  onOpenNewSupply: () => void;
}

interface LineReviewItem {
  quantityApproved: number;
  isRejected: boolean;
}

export const SupplyRequestsList: React.FC<SupplyRequestsListProps> = ({ onOpenNewSupply }) => {
  const { user, pendingSupplyCount, readySupplyCount, refreshSupplyBadgeCounts } = useAuth();
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [dpStocks, setDpStocks] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dropPointFilter, setDropPointFilter] = useState('');
  const [roleTab, setRoleTab] = useState<'ALL' | 'VRS' | 'SALES_ADMIN'>(
    user?.role === 'SALES_ADMIN' ? 'VRS' : 'ALL'
  );
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Line by line review state: RequestId -> ItemId -> LineReviewItem
  const [lineReviews, setLineReviews] = useState<Record<number, Record<number, LineReviewItem>>>({});

  // BL Attachment Modal state
  const [blModalOpen, setBlModalOpen] = useState(false);
  const [targetRequest, setTargetRequest] = useState<SupplyRequest | null>(null);
  const [isValidationFlow, setIsValidationFlow] = useState(false);
  const [blNumberInput, setBlNumberInput] = useState('');
  const [blAttachmentInput, setBlAttachmentInput] = useState('');
  const [blFileNameInput, setBlFileNameInput] = useState('');
  const [blFileTypeInput, setBlFileTypeInput] = useState('');
  const [blSaving, setBlSaving] = useState(false);

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetRequest, setRejectTargetRequest] = useState<SupplyRequest | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [rejectionSubmitting, setRejectionSubmitting] = useState(false);

  // Partial validation modal state
  const [partialModalOpen, setPartialModalOpen] = useState(false);
  const [partialTargetRequest, setPartialTargetRequest] = useState<SupplyRequest | null>(null);
  const [partialItems, setPartialItems] = useState<{ id: number; productId: number; productName: string; quantityRequested: number; quantityApproved: number }[]>([]);
  const [partialSubmitting, setPartialSubmitting] = useState(false);

  // Edit supply request modal state (Requirement 6: VRS & SA modification in case of error)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTargetRequest, setEditTargetRequest] = useState<SupplyRequest | null>(null);
  const [editNotesInput, setEditNotesInput] = useState('');
  const [editDateInput, setEditDateInput] = useState('');
  const [editQuantities, setEditQuantities] = useState<Record<number, number>>({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Cancel supply request modal state (Requirement 6: VRS & SA cancellation in case of error)
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTargetRequest, setCancelTargetRequest] = useState<SupplyRequest | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Image full preview modal
  const [viewImageModal, setViewImageModal] = useState<{ url: string; title: string } | null>(null);

  const loadRequests = async (isManual = false) => {
    if (isManual || requests.length === 0) {
      setLoading(true);
    }
    try {
      const res = await api.getSupplyRequests({
        status: statusFilter || undefined,
      });
      setRequests(res.requests);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'SALES_ADMIN_NATIONAL') {
      api.getDropPoints().then((res) => {
        setDropPoints(res.dropPoints || []);
      }).catch(console.error);
    }

    // Load available Drop Point stocks to ensure live availability check
    const dpId = user?.dropPointId || (dropPointFilter ? parseInt(dropPointFilter, 10) : undefined);
    api.getDropPointStocks(dpId).then((res) => {
      const map: Record<number, number> = {};
      (res.stocks || []).forEach((s) => {
        map[s.productId] = s.availableQuantity ?? 0;
      });
      setDpStocks(map);
    }).catch(console.error);
  }, [user?.role, user?.dropPointId, dropPointFilter]);

  // Line-by-line review helper methods for Sales Admin
  const getLineState = (requestId: number, item: any): LineReviewItem => {
    const key = item.id || item.productId;
    const custom = lineReviews[requestId]?.[key];
    if (custom) return custom;
    const initialApproved = item.quantityApproved !== undefined && item.quantityApproved !== null
      ? item.quantityApproved
      : item.quantityRequested;
    return {
      quantityApproved: initialApproved,
      isRejected: initialApproved === 0,
    };
  };

  const handleAdjustLineQty = (requestId: number, item: any, newQty: number) => {
    const key = item.id || item.productId;
    const clamped = Math.max(0, Math.min(item.quantityRequested, newQty));
    setLineReviews((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || {}),
        [key]: {
          quantityApproved: clamped,
          isRejected: clamped === 0,
        },
      },
    }));
  };

  const handleToggleRejectLine = (requestId: number, item: any) => {
    const key = item.id || item.productId;
    const current = getLineState(requestId, item);
    const willReject = !current.isRejected;
    setLineReviews((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || {}),
        [key]: {
          quantityApproved: willReject ? 0 : item.quantityRequested,
          isRejected: willReject,
        },
      },
    }));
  };

  const handleValidateWholeRequest = async (r: SupplyRequest, withBL = false) => {
    if (!r.items || r.items.length === 0) return;

    const approvedItemsPayload = r.items.map((it) => {
      const st = getLineState(r.id, it);
      return {
        id: it.id,
        quantityApproved: st.isRejected ? 0 : st.quantityApproved,
      };
    });

    const totalApproved = approvedItemsPayload.reduce((sum, it) => sum + it.quantityApproved, 0);
    const totalRequested = r.items.reduce((sum, it) => sum + it.quantityRequested, 0);

    if (totalApproved === 0) {
      if (window.confirm(`Toutes les lignes de la demande #${r.requestNumber} sont ajustées à 0 carton. Confirmez-vous le rejet de l'ensemble de la demande ?`)) {
        setRejectTargetRequest(r);
        setRejectionReasonInput('Toutes les lignes ont été rejetées par le Sales Admin.');
        setRejectModalOpen(true);
      }
      return;
    }

    if (withBL) {
      openBlModal(r, true);
      return;
    }

    const targetStatus = totalApproved === totalRequested ? 'Validée' : 'Partiellement validée';
    await handleUpdateStatus(r.id, targetStatus, { approvedItems: approvedItemsPayload });
  };

  const handleRejectWholeRequest = (r: SupplyRequest) => {
    setRejectTargetRequest(r);
    setRejectionReasonInput('');
    setRejectModalOpen(true);
  };

  useEffect(() => {
    loadRequests(true);
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadRequests(false);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const handleUpdateStatus = async (
    requestId: number,
    newStatus: string,
    extraData?: {
      approvedItems?: any[];
      blNumber?: string;
      blAttachment?: string;
      blFileName?: string;
      blFileType?: string;
      rejectionReason?: string;
    }
  ) => {
    setProcessingId(requestId);
    setErrorMsg(null);
    try {
      const res = await api.updateSupplyRequestStatus(requestId, {
        newStatus,
        ...extraData,
      });
      setActionMsg(res.message);
      await Promise.all([loadRequests(), refreshSupplyBadgeCounts()]);
      setTimeout(() => setActionMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la mise à jour du statut.');
      setTimeout(() => setErrorMsg(null), 6000);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDirectApprove = async (r: SupplyRequest) => {
    if (!window.confirm(`Confirmer la validation totale de la demande #${r.requestNumber} (${r.totalCartons} cartons pour ${r.vrsName}) ?`)) {
      return;
    }
    handleUpdateStatus(r.id, 'Validée');
  };

  const openPartialModal = (r: SupplyRequest) => {
    setPartialTargetRequest(r);
    const mapped = (r.items || []).map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName || 'Produit',
      quantityRequested: it.quantityRequested,
      quantityApproved: it.quantityApproved !== undefined && it.quantityApproved !== null ? it.quantityApproved : it.quantityRequested,
    }));
    setPartialItems(mapped);
    setPartialModalOpen(true);
  };

  const handlePartialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialTargetRequest) return;
    setPartialSubmitting(true);
    setErrorMsg(null);
    try {
      await api.updateSupplyRequestStatus(partialTargetRequest.id, {
        newStatus: 'Partiellement validée',
        approvedItems: partialItems.map((pi) => ({
          id: pi.id,
          quantityApproved: pi.quantityApproved,
        })),
      });
      setActionMsg(`Demande #${partialTargetRequest.requestNumber} validée partiellement avec succès.`);
      setPartialModalOpen(false);
      setPartialTargetRequest(null);
      await Promise.all([loadRequests(), refreshSupplyBadgeCounts()]);
      setTimeout(() => setActionMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la validation partielle.');
      setTimeout(() => setErrorMsg(null), 6000);
    } finally {
      setPartialSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetRequest) return;
    const motif = rejectionReasonInput.trim();
    if (!motif) {
      setErrorMsg('Veuillez préciser le motif du rejet.');
      return;
    }
    setRejectionSubmitting(true);
    setErrorMsg(null);
    try {
      await api.updateSupplyRequestStatus(rejectTargetRequest.id, {
        newStatus: 'Rejetée',
        rejectionReason: motif,
      });
      setActionMsg(`Demande #${rejectTargetRequest.requestNumber} rejetée. Vendeur notifié.`);
      setRejectModalOpen(false);
      setRejectTargetRequest(null);
      setRejectionReasonInput('');
      await Promise.all([loadRequests(), refreshSupplyBadgeCounts()]);
      setTimeout(() => setActionMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors du rejet de la demande.');
      setTimeout(() => setErrorMsg(null), 6000);
    } finally {
      setRejectionSubmitting(false);
    }
  };

  const openBlModal = (req: SupplyRequest, isApproval = false) => {
    setTargetRequest(req);
    setIsValidationFlow(isApproval);
    setBlNumberInput(req.blNumber || '');
    setBlAttachmentInput(req.blAttachment || '');
    setBlFileNameInput(req.blFileName || '');
    setBlFileTypeInput(req.blFileType || '');
    setBlModalOpen(true);
  };

  const closeBlModal = () => {
    setBlModalOpen(false);
    setTargetRequest(null);
    setIsValidationFlow(false);
    setBlNumberInput('');
    setBlAttachmentInput('');
    setBlFileNameInput('');
    setBlFileTypeInput('');
  };

  const handleSaveBL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRequest) return;
    setBlSaving(true);
    setErrorMsg(null);

    try {
      if (isValidationFlow) {
        // Approve + save BL simultaneously
        await handleUpdateStatus(targetRequest.id, 'APPROUVÉE', {
          blNumber: blNumberInput.trim() || undefined,
          blAttachment: blAttachmentInput || undefined,
          blFileName: blFileNameInput || undefined,
          blFileType: blFileTypeInput || undefined,
        });
      } else {
        // Just save/update BL document
        const res = await api.updateSupplyRequestBL(targetRequest.id, {
          blNumber: blNumberInput.trim() || undefined,
          blAttachment: blAttachmentInput || undefined,
          blFileName: blFileNameInput || undefined,
          blFileType: blFileTypeInput || undefined,
        });
        setActionMsg(res.message);
        await Promise.all([loadRequests(), refreshSupplyBadgeCounts()]);
        setTimeout(() => setActionMsg(null), 4000);
      }
      closeBlModal();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de l\'enregistrement du BL.');
    } finally {
      setBlSaving(false);
    }
  };

  const handleOpenEditRequest = (r: SupplyRequest) => {
    setEditTargetRequest(r);
    setEditNotesInput(r.notes || '');
    setEditDateInput((r.desiredLoadingDate || (r as any).desired_loading_date || ''));
    const initial: Record<number, number> = {};
    (r.items || []).forEach((it: any) => {
      initial[it.productId || it.id] = it.quantityRequested;
    });
    setEditQuantities(initial);
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleSaveEditRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editTargetRequest) return;
    setEditError(null);

    const itemsPayload = (editTargetRequest.items || []).map((it: any) => ({
      productId: it.productId || it.id,
      quantityRequested: editQuantities[it.productId || it.id] != null ? editQuantities[it.productId || it.id] : it.quantityRequested,
    }));

    const total = itemsPayload.reduce((acc, it) => acc + (Number(it.quantityRequested) || 0), 0);
    if (total <= 0) {
      setEditError('La quantité totale demandée doit être supérieure à 0 carton.');
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await api.updateSupplyRequest(editTargetRequest.id, {
        notes: editNotesInput,
        desiredLoadingDate: editDateInput,
        items: itemsPayload,
      });
      setActionMsg(res.message || 'Demande modifiée avec succès.');
      setEditModalOpen(false);
      setEditTargetRequest(null);
      await Promise.all([loadRequests(true), refreshSupplyBadgeCounts()]);
      setTimeout(() => setActionMsg(null), 5000);
    } catch (err: any) {
      setEditError(err.message || 'Erreur lors de la modification de la demande.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenCancelRequest = (r: SupplyRequest) => {
    setCancelTargetRequest(r);
    setCancelReasonInput('');
    setCancelModalOpen(true);
  };

  const handleConfirmCancelRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cancelTargetRequest) return;
    setCancelSubmitting(true);
    try {
      const res = await api.cancelSupplyRequest(cancelTargetRequest.id, {
        reason: cancelReasonInput.trim() || undefined,
      });
      setActionMsg(res.message || 'Demande annulée avec succès.');
      setCancelModalOpen(false);
      setCancelTargetRequest(null);
      await Promise.all([loadRequests(true), refreshSupplyBadgeCounts()]);
      setTimeout(() => setActionMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'annulation de la demande.");
      setTimeout(() => setErrorMsg(null), 6000);
    } finally {
      setCancelSubmitting(false);
    }
  };

  const getCleanStatus = (status: string) => {
    if (status === 'DEMANDEE' || status === 'ENVOYÉE' || status === 'EN ATTENTE') return 'Demandée';
    if (status === 'APPROUVÉE') return 'Validée';
    if (status === 'PARTIELLEMENT_VALIDÉE') return 'Partiellement validée';
    if (status === 'REJETÉE') return 'Rejetée';
    if (status === 'RÉCEPTIONNÉE' || status === 'CHARGÉE') return 'Chargée';
    return status;
  };

  const getStatusBadge = (status: string) => {
    const clean = getCleanStatus(status);
    switch (clean) {
      case 'Demandée':
        return 'status-badge status-badge-brown';
      case 'Validée':
        return 'status-badge status-badge-green';
      case 'Partiellement validée':
        return 'status-badge status-badge-brown';
      case 'Chargée':
        return 'status-badge status-badge-green';
      case 'Rejetée':
        return 'status-badge status-badge-red';
      case 'PRÉPARÉE':
        return 'status-badge status-badge-brown';
      case 'LIVRÉE':
        return 'status-badge status-badge-green';
      default:
        return 'status-badge status-badge-grey';
    }
  };

  const isSA = user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL';

  return (
    <div className="space-y-5">
      {/* Top Banner: Bloc d'alerte / "DÉCISION REQUISE" / Bandeau d'attention (Fond UNI marron foncé #92400E, sans dégradé) */}
      {isSA && pendingSupplyCount > 0 && (
        <div className="rounded-2xl p-4 bg-[#92400E] border border-[#B45309] shadow-lg flex items-center justify-between gap-3 animate-in fade-in text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B45309] flex items-center justify-center text-white shrink-0">
              <Clock className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Décision Requise • Sales Admin
                </span>
                <CounterBadge
                  count={pendingSupplyCount}
                  containerBg="#92400E"
                  ariaLabel={`${pendingSupplyCount} chargement${pendingSupplyCount > 1 ? 's' : ''} en attente`}
                />
              </div>
              <p className="text-xs text-white/95 mt-0.5">
                Des vendeurs (VRS) attendent la validation ou le rejet de leur chargement. Un vendeur ne se sert jamais seul dans le stock.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('Demandée')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#B45309] hover:bg-[#78350F] text-white text-xs font-bold transition shrink-0 cursor-pointer"
          >
            <span>Filtrer les chargements</span>
          </button>
        </div>
      )}

      {/* Bandeau d'attention pour VRS : Marchandises Validées (Fond UNI vert #15803D, sans dégradé) */}
      {user?.role === 'VRS' && readySupplyCount > 0 && (
        <div className="rounded-2xl p-4 bg-[#15803D] border border-[#166534] shadow-lg flex items-center justify-between gap-3 animate-in fade-in text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#166534] flex items-center justify-center text-white shrink-0">
              <Sparkles className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Marchandises Validées • Prêtes pour Chargement
                </span>
                <CounterBadge
                  count={readySupplyCount}
                  containerBg="#15803D"
                  ariaLabel={`${readySupplyCount} chargement${readySupplyCount > 1 ? 's' : ''} prêt${readySupplyCount > 1 ? 's' : ''}`}
                />
              </div>
              <p className="text-xs text-white/95 mt-0.5">
                Le Sales Admin a validé vos dotations. Présentez-vous au magasinier du Dépôt pour charger physiquement vos cartons et scanner le bon.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('Validée')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold transition shrink-0 cursor-pointer"
          >
            <span>Filtrer les prêts</span>
          </button>
        </div>
      )}

      {user?.role === 'VRS' && readySupplyCount === 0 && pendingSupplyCount > 0 && (
        <div className="rounded-2xl p-3.5 bg-[#92400E] border border-[#B45309] flex items-center gap-3 text-xs text-white shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#B45309] flex items-center justify-center text-white shrink-0">
            <Clock className="w-4 h-4 text-white animate-pulse" />
          </div>
          <span className="text-white">
            Vous avez <strong>{pendingSupplyCount} demande(s) de chargement (statut Demandée)</strong> en cours d'examen par le Sales Admin de votre Dépôt. Vous recevrez une notification instantanée dès sa décision (validation, validation partielle ou rejet).
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              {user?.role === 'VRS' ? 'Mes chargements' : 'Chargements VRS'}
            </h1>
            <CounterBadge
              count={pendingSupplyCount}
              containerBg="var(--bg-card)"
              ariaLabel={`${pendingSupplyCount} chargement${pendingSupplyCount > 1 ? 's' : ''} en attente`}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {user?.role === 'VRS'
              ? 'Règle : le VRS ne se sert jamais seul. Demande > Validation ou Rejet SA > Chargement (+Stock).'
              : 'Supervision & validation des chargements vendeurs : Demande VRS > Validation SA > Chargement physique.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadRequests(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
            title="Rafraîchir les demandes"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Rafraîchir</span>
          </button>
          {user?.role === 'VRS' && (
            <button
              type="button"
              onClick={onOpenNewSupply}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Mon chargement</span>
            </button>
          )}
          {user?.role === 'SALES_ADMIN_NATIONAL' && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-950/60 border border-purple-800/50 text-purple-300 text-xs font-bold shadow-xs">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Supervision Nationale (Validation / Rejet)</span>
            </div>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-700 rounded-xl text-xs text-emerald-300 font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-950/70 border border-red-700 rounded-xl text-xs text-red-300 font-medium flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="space-y-3 bg-slate-900 border border-slate-800 rounded-xl p-3.5">
        {/* Role Sub-Tabs strictly for SAN */}
        {user?.role === 'SALES_ADMIN_NATIONAL' && (
          <div className="flex flex-wrap items-center gap-2 pb-2.5 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setRoleTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                roleTab === 'ALL'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Toutes ({requests.length})
            </button>

            <button
              type="button"
              onClick={() => setRoleTab('VRS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                roleTab === 'VRS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Demandes des Vendeurs (VRS)</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-950 text-blue-200 border border-blue-700/60">
                {requests.filter((r) => (r.requesterRole || (r as any).requester_role) !== 'SALES_ADMIN').length}
              </span>
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Statut :</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-slate-700"
              >
                <option value="">Tous les statuts</option>
                <option value="Demandée">Demandée</option>
                <option value="Validée">Validée</option>
                <option value="Partiellement validée">Partiellement validée</option>
                <option value="Chargée">Chargée</option>
                <option value="Rejetée">Rejetée</option>
              </select>
            </div>

            {user?.role === 'SALES_ADMIN_NATIONAL' && dropPoints.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium">Dépôt :</span>
                <select
                  value={dropPointFilter}
                  onChange={(e) => setDropPointFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-slate-700"
                >
                  <option value="">Tous les Dépôts ({dropPoints.length})</option>
                  {dropPoints.map((dp) => (
                    <option key={dp.id} value={String(dp.id)}>
                      {dp.name} ({dp.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <span className="text-xs text-slate-500 font-mono">
            {requests
              .filter((r) => !dropPointFilter || String(r.dropPointId) === dropPointFilter)
              .filter((r) => {
                if (!statusFilter) return true;
                return getCleanStatus(r.status) === statusFilter;
              })
              .filter((r) => {
                const isSa = (r.requesterRole || (r as any).requester_role) === 'SALES_ADMIN';
                if (roleTab === 'VRS') return !isSa;
                if (roleTab === 'SALES_ADMIN') return isSa;
                return true;
              }).length} demande(s) affichée(s)
          </span>
        </div>
      </div>

      {/* Requests Cards List */}
      <div className="space-y-3.5">
        {requests
          .filter((r) => !dropPointFilter || String(r.dropPointId) === dropPointFilter)
          .filter((r) => {
            if (!statusFilter) return true;
            return getCleanStatus(r.status) === statusFilter;
          })
          .filter((r) => {
            const isSa = (r.requesterRole || (r as any).requester_role) === 'SALES_ADMIN';
            if (roleTab === 'VRS') return !isSa;
            if (roleTab === 'SALES_ADMIN') return isSa;
            return true;
          })
          .map((r) => {
          const isSaRequest = (r.requesterRole || (r as any).requester_role) === 'SALES_ADMIN';
          const isRequester = Boolean(user?.id && (Number(user.id) === Number(r.vrsId) || Number(user.id) === Number((r as any).vrs_id)));
          const cleanStatus = getCleanStatus(r.status);
          const isPending = cleanStatus === 'Demandée';
          const isApproved = cleanStatus === 'Validée';
          const isPartial = cleanStatus === 'Partiellement validée';
          const isRejected = cleanStatus === 'Rejetée';
          const isLoaded = cleanStatus === 'Chargée';
          const isReadyForReception = isApproved || isPartial || r.status === 'APPROUVÉE' || r.status === 'PRÉPARÉE' || r.status === 'LIVRÉE';
          const hasBL = !!(r.blNumber || r.blAttachment);
          const isPdf = r.blFileType?.includes('pdf') || r.blFileName?.toLowerCase().endsWith('.pdf');
          const canManageBL = isSA || isRequester || user?.role === 'VRS';

          return (
            <div
              key={r.id}
              className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 transition space-y-3.5 ${
                isPending && isSA
                  ? 'border-amber-500/50 shadow-md shadow-amber-950/20'
                  : isReadyForReception && (isRequester || (isSaRequest && user?.role === 'SALES_ADMIN'))
                  ? 'border-emerald-500/50 shadow-md shadow-emerald-950/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Header: Request ID, Circuit Badge, Status Badge, Date */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-white text-sm tracking-wide">
                    {r.requestNumber}
                  </span>

                  {/* Explicit Role Circuit Badge */}
                  {isSaRequest ? (
                    <span className="status-badge status-badge-grey">
                      <Shield className="w-4 h-4 text-[#0F172A]" />
                      <span>Réappro Dépôt (SA vers SAN)</span>
                    </span>
                  ) : (
                    <span className="status-badge status-badge-grey">
                      <Truck className="w-4 h-4 text-[#0F172A]" />
                      <span>Vendeur (VRS vers SA)</span>
                    </span>
                  )}

                  <span className={getStatusBadge(r.status)}>
                    {r.status}
                  </span>

                  {isPending && (
                    <span className="status-badge status-badge-brown">
                      <Clock className="w-4 h-4 text-white" />
                      <span>En attente</span>
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  {formatDateTime(r.createdAt || (r as any).created_at)}
                </div>
              </div>

              {/* Parties: Requester (explicit Sales Admin vs Vendeur), Drop point, Cartons count */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 border-t border-slate-800/70 pt-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    Demandeur :{' '}
                    {isSaRequest ? (
                      <>
                        <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-semibold text-[10px] mr-1.5">
                          Sales Admin
                        </span>
                        <strong className="text-white">{r.vrsName}</strong> ({r.vrsPublicId})
                      </>
                    ) : (
                      <>
                        <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-semibold text-[10px] mr-1.5">
                          Vendeur (VRS)
                        </span>
                        <strong className="text-white">{r.vrsName}</strong> ({r.vrsPublicId})
                      </>
                    )}
                  </span>
                  <span className="hidden sm:inline text-slate-600">•</span>
                  <span>
                    Dépôt : <strong className="text-slate-300">{r.dropPointName}</strong>
                  </span>
                </div>

                <div className="font-mono font-bold text-emerald-400 text-sm">
                  {r.totalCartons} cartons demandés
                </div>
              </div>

              {/* Lignes de la demande - Contrôle ligne par ligne avec stock disponible du Drop Point */}
              {r.items && r.items.length > 0 && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden space-y-0 shadow-inner">
                  <div className="px-3.5 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-200">
                        Lignes de la demande ({r.items.length} référence{r.items.length > 1 ? 's' : ''})
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      Total demandé : <strong className="text-emerald-400 font-bold">{r.totalCartons} ctn</strong>
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {r.items.map((it, idx) => {
                      const availableStock = it.availableDropPointStock !== undefined && it.availableDropPointStock !== null
                        ? it.availableDropPointStock
                        : (dpStocks[it.productId] ?? 0);
                      const lineState = getLineState(r.id, it);
                      const isLineAdjustable = isPending && (user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL') && !isSaRequest;

                      return (
                        <div
                          key={it.id || idx}
                          className={`p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                            lineState.isRejected ? 'bg-red-950/20 opacity-80' : 'hover:bg-slate-900/40'
                          }`}
                        >
                          {/* Produit & Stock Dépôt */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-sm text-white truncate">
                                {it.productName}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 ml-7">
                              {it.productRef && <span className="font-mono text-slate-500">{it.productRef}</span>}
                              {it.categoryName && <span>• {it.categoryName}</span>}
                              <span>•</span>
                              {/* Stock disponible du Drop Point */}
                              <span className="flex items-center gap-1">
                                <span>Stock disponible Dépôt :</span>
                                <span
                                  className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                                    availableStock >= it.quantityRequested
                                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/70'
                                      : availableStock > 0
                                      ? 'bg-amber-950/80 text-amber-300 border border-amber-800/70'
                                      : 'bg-red-950/80 text-red-300 border border-red-800/70'
                                  }`}
                                >
                                  {availableStock} ctn {availableStock >= it.quantityRequested ? '(Suffisant)' : availableStock > 0 ? '(Inférieur)' : '(Rupture)'}
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Quantités et Contrôles ligne par ligne */}
                          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 ml-7 md:ml-0 shrink-0">
                            {/* Quantité demandée */}
                            <div className="text-right">
                              <span className="text-[11px] text-slate-400 block">Demandé :</span>
                              <span className="font-mono font-bold text-sm text-slate-200">
                                {it.quantityRequested} ctn
                              </span>
                            </div>

                            {/* Si demande en attente et examinateur SA : Ajuster ou Rejeter ligne par ligne */}
                            {isLineAdjustable ? (
                              <div className="flex items-center gap-2">
                                {lineState.isRejected ? (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1.5 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs font-bold">
                                      Ligne rejetée (0 ctn)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleRejectLine(r.id, it)}
                                      className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                      title="Rétablir cette ligne de produit"
                                    >
                                      <RotateCcw className="w-4 h-4 text-emerald-400" />
                                      <span>Rétablir</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {/* Stepper ajustement quantité */}
                                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1 min-h-[44px]">
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustLineQty(r.id, it, lineState.quantityApproved - 1)}
                                        disabled={lineState.quantityApproved <= 0}
                                        className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-base font-bold flex items-center justify-center transition active:scale-95 cursor-pointer"
                                        aria-label="Diminuer la quantité validée"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        max={it.quantityRequested}
                                        value={lineState.quantityApproved}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value, 10);
                                          handleAdjustLineQty(r.id, it, isNaN(val) ? 0 : val);
                                        }}
                                        className="w-14 py-1.5 bg-transparent text-white font-mono text-center text-sm font-black focus:outline-none min-h-[40px]"
                                      />
                                      <span className="text-slate-400 text-xs pr-1 font-medium">ctn</span>
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustLineQty(r.id, it, lineState.quantityApproved + 1)}
                                        disabled={lineState.quantityApproved >= it.quantityRequested}
                                        className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-base font-bold flex items-center justify-center transition active:scale-95 cursor-pointer"
                                        aria-label="Augmenter la quantité validée"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Bouton Rejeter cette ligne */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleRejectLine(r.id, it)}
                                      className="min-h-[44px] px-3 py-2 rounded-xl border border-red-500/40 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                                      title="Rejeter cette ligne de produit"
                                    >
                                      <XCircle className="w-4 h-4 text-red-400" />
                                      <span className="hidden sm:inline">Rejeter</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Lecture seule si pas en saisie ou autre statut */
                              <div className="text-right">
                                <span className="text-[11px] text-slate-400 block">Validé :</span>
                                <span className={`font-mono font-bold text-sm ${
                                  it.quantityApproved === 0
                                    ? 'text-red-400 line-through'
                                    : it.quantityApproved !== undefined && it.quantityApproved !== null && it.quantityApproved < it.quantityRequested
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}>
                                  {it.quantityApproved !== undefined && it.quantityApproved !== null
                                    ? `${it.quantityApproved} ctn`
                                    : `${it.quantityRequested} ctn`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Récapitulatif et validation de l'ensemble (côté SA pour demande en attente) */}
                  {isPending && (user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL') && !isSaRequest && (() => {
                    const currentApprovedTotal = r.items.reduce((sum, it) => {
                      const st = getLineState(r.id, it);
                      return sum + (st.isRejected ? 0 : st.quantityApproved);
                    }, 0);
                    const isPartiallyAdjusted = currentApprovedTotal < r.totalCartons && currentApprovedTotal > 0;
                    const allRejected = currentApprovedTotal === 0;

                    return (
                      <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-medium">Bilan validation :</span>
                            <span className="font-mono font-black text-sm text-white">
                              {currentApprovedTotal} / {r.totalCartons} cartons autorisés
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {allRejected
                              ? '⚠️ Toutes les lignes sont à 0 carton (rejet recommandé).'
                              : isPartiallyAdjusted
                              ? 'Quantités ajustées : la demande passera au statut Partiellement validée.'
                              : 'Toutes les lignes sont intégralement approuvées (statut Validée).'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={processingId === r.id}
                            onClick={() => handleRejectWholeRequest(r)}
                            className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span>Rejeter l'ensemble</span>
                          </button>

                          <button
                            type="button"
                            disabled={processingId === r.id}
                            onClick={() => handleValidateWholeRequest(r, false)}
                            className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {processingId === r.id
                                ? 'Traitement...'
                                : isPartiallyAdjusted
                                ? `Valider l'ensemble (${currentApprovedTotal} ctn)`
                                : 'Valider l\'ensemble'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={processingId === r.id}
                            onClick={() => handleValidateWholeRequest(r, true)}
                            className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                            title="Valider la demande et insérer le Bon de Livraison"
                          >
                            <FileCheck2 className="w-4 h-4" />
                            <span>Valider &amp; BL</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Date de chargement souhaitée si renseignée */}
              {r.desiredLoadingDate && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded-xl font-medium">
                  <Calendar className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span>Date de chargement souhaitée : <strong className="text-white font-mono">{r.desiredLoadingDate}</strong></span>
                </div>
              )}

              {/* Rejection motif alert */}
              {isRejected && (
                <div className="bg-red-950/50 border border-red-800/70 rounded-xl p-3 text-xs text-red-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-red-300">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Demande Rejetée par le Sales Admin</span>
                  </div>
                  <p className="text-slate-300 pl-5">
                    <strong className="text-red-300">Motif du rejet : </strong>
                    {r.rejectionReason || (r.notes?.includes('[Motif Rejet:') ? r.notes.split('[Motif Rejet:')[1]?.replace(']', '')?.trim() : 'Non précisé par le Sales Admin')}
                  </p>
                </div>
              )}

              {/* Loaded alert */}
              {isLoaded && (
                <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Marchandise chargée :</strong> Le stock personnel du VRS a été augmenté (+{r.totalCartons} cartons disponibles).
                  </span>
                </div>
              )}

              {/* Validated alert */}
              {(isApproved || isPartial) && (
                <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-3 text-xs text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <span>
                        {isPartial ? 'Demande partiellement validée' : 'Demande validée'} par le Sales Admin. Prête pour le chargement physique au Dépôt.
                      </span>
                      <span className="block text-[11px] text-amber-300 font-semibold mt-0.5">
                        ⚠️ Règle : le stock du VRS n'augmente qu'au statut "Chargée".
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {r.notes && (
                <div className="text-xs text-slate-400 italic bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/50">
                  Note : {r.notes}
                </div>
              )}

              {/* Bon de Livraison (BL) Section & Photo / PDF Attachment */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    hasBL ? 'bg-emerald-950 border border-emerald-800/80 text-emerald-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <FileCheck2 className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">Bon de Livraison (BL) :</span>
                      {r.blNumber ? (
                        <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                          {r.blNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Non renseigné</span>
                      )}
                    </div>

                    {r.blAttachment ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate max-w-[200px]">
                          {isPdf ? <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" /> : <Camera className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                          <span className="truncate">{r.blFileName || (isPdf ? 'Document.pdf' : 'Photo-BL.jpg')}</span>
                        </span>

                        {!isPdf && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewImageModal({
                                url: r.blAttachment!,
                                title: `BL ${r.blNumber || r.requestNumber}`,
                              })
                            }
                            className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Voir photo
                          </button>
                        )}

                        {isPdf && (
                          <a
                            href={r.blAttachment}
                            download={r.blFileName || `BL-${r.requestNumber}.pdf`}
                            className="text-[11px] font-semibold text-red-400 hover:text-red-300 underline flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> Ouvrir PDF
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-0.5">Aucun document joint pour le moment</p>
                    )}
                  </div>
                </div>

                {/* Button to attach / edit BL document */}
                {canManageBL && (
                  <button
                    type="button"
                    onClick={() => openBlModal(r, false)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition active:scale-95 shrink-0 shadow-xs min-h-[38px]"
                  >
                    <Camera className="w-3.5 h-3.5 text-red-400" />
                    <span>{hasBL ? 'Modifier BL / Photo' : '+ Joindre BL / Photo'}</span>
                  </button>
                )}
              </div>

              {/* Workflow Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                {/* Status explanation */}
                <div className="text-xs">
                  {isPending && (
                    <span className={`font-medium inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                      isSaRequest
                        ? 'text-purple-400 bg-purple-950/40 border-purple-800/60'
                        : 'text-amber-400 bg-amber-950/40 border-amber-800/60'
                    }`}>
                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                      <span>
                        {isSaRequest
                          ? 'Transmise au Sales Admin National (SAN) pour validation'
                          : 'En attente de validation ou rejet par le Sales Admin'}
                      </span>
                    </span>
                  )}
                  {isApproved && (
                    <span className="text-blue-400 font-medium inline-flex items-center gap-1.5 bg-blue-950/40 border border-blue-800/60 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {isSaRequest
                          ? 'Validée par le Sales Admin National • Prête pour Réception 6C Distribution au Dépôt'
                          : 'Validée par le Sales Admin • Prête pour chargement'}
                      </span>
                    </span>
                  )}
                  {isPartial && (
                    <span className="text-purple-400 font-medium inline-flex items-center gap-1.5 bg-purple-950/40 border border-purple-800/60 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Partiellement validée par le Sales Admin • Prête pour chargement
                      </span>
                    </span>
                  )}
                  {isRejected && (
                    <div className="flex flex-col gap-1">
                      <span className="text-red-400 font-medium inline-flex items-center gap-1.5 bg-red-950/60 border border-red-800/80 px-2.5 py-1 rounded-lg">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Demande rejetée</span>
                      </span>
                      {(r.rejectionReason || r.notes?.includes('[Motif Rejet:')) && (
                        <span className="text-[11px] text-red-300 italic pl-1">
                          Motif : {r.rejectionReason || r.notes?.split('[Motif Rejet:')[1]?.replace(']', '')?.trim()}
                        </span>
                      )}
                    </div>
                  )}
                  {isLoaded && (
                    <span className="text-emerald-400 font-medium inline-flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
                      <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        {isSaRequest
                          ? 'Marchandise réceptionnée de 6C Distribution dans le stock du Dépôt'
                          : 'Marchandise chargée • Stock personnel du vendeur crédité'}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Validation & Rejection Buttons */}
                  {isPending && (
                    <>
                      {isSaRequest ? (
                        /* Case 1: SA request for Drop Point - ONLY SAN can validate or reject */
                        user?.role === 'SALES_ADMIN_NATIONAL' ? (
                          <>
                            <button
                              type="button"
                              disabled={processingId === r.id}
                              onClick={() => {
                                setRejectTargetRequest(r);
                                setRejectionReasonInput('');
                                setRejectModalOpen(true);
                              }}
                              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 font-semibold text-xs flex items-center justify-center gap-1 transition disabled:opacity-50 active:scale-95 min-h-[40px]"
                              title="Rejeter cette demande de réapprovisionnement Dépôt"
                            >
                              <XCircle className="w-3.5 h-3.5 text-red-400" />
                              <span>Rejeter (SAN)</span>
                            </button>

                            <button
                              type="button"
                              disabled={processingId === r.id}
                              onClick={() => handleDirectApprove(r)}
                              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow disabled:opacity-50 active:scale-95 min-h-[40px]"
                              title="Valider la demande de réapprovisionnement Dépôt"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Valider (SAN)</span>
                            </button>

                            <button
                              type="button"
                              disabled={processingId === r.id}
                              onClick={() => openBlModal(r, true)}
                              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow disabled:opacity-50 active:scale-95 min-h-[40px]"
                              title="Valider la demande et insérer le Bon de Livraison (BL)"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              <span>Valider &amp; BL (SAN)</span>
                            </button>
                          </>
                        ) : (
                          <div className="px-3 py-1.5 rounded-xl bg-purple-950/50 border border-purple-800/60 text-purple-300 text-xs flex items-center gap-1.5 font-medium">
                            <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span>Transmis au SAN • Pas d'auto-validation par le SA</span>
                          </div>
                        )
                      ) : (
                        /* Case 2: VRS request - SA of the Drop Point or SAN can validate or reject */
                        (user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL') && (
                          <>
                            <button
                              type="button"
                              disabled={processingId === r.id}
                              onClick={() => handleRejectWholeRequest(r)}
                              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 font-semibold text-xs flex items-center justify-center gap-1 transition disabled:opacity-50 active:scale-95 min-h-[44px] cursor-pointer"
                              title="Rejeter cette demande avec motif"
                            >
                              <XCircle className="w-3.5 h-3.5 text-red-400" />
                              <span>Rejeter l'ensemble</span>
                            </button>

                            <button
                              type="button"
                              disabled={processingId === r.id}
                              onClick={() => handleValidateWholeRequest(r, false)}
                              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow disabled:opacity-50 active:scale-95 min-h-[44px] cursor-pointer"
                              title="Valider l'ensemble des lignes de la demande"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Valider l'ensemble</span>
                            </button>

                            <button
                              type="button"
                              disabled={processingId === r.id}
                              onClick={() => handleValidateWholeRequest(r, true)}
                              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow disabled:opacity-50 active:scale-95 min-h-[44px] cursor-pointer"
                              title="Valider la demande et insérer le Bon de Livraison (BL)"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              <span>Valider &amp; BL</span>
                            </button>
                          </>
                        )
                      )}
                    </>
                  )}

                  {/* Bouton Modifier la demande (VRS & SA en cas d'erreur avant validation) */}
                  {isPending && (isRequester || isSA) && (
                    <button
                      type="button"
                      disabled={processingId === r.id}
                      onClick={() => handleOpenEditRequest(r)}
                      className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-amber-500/50 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 min-h-[40px] cursor-pointer"
                      title="Modifier les quantités ou informations en cas d'erreur de saisie"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Modifier</span>
                    </button>
                  )}

                  {/* Bouton Annuler la demande (VRS & SA en cas d'erreur) */}
                  {(isPending || (isReadyForReception && cleanStatus !== 'Chargée')) && (isRequester || isSA) && (
                    <button
                      type="button"
                      disabled={processingId === r.id}
                      onClick={() => handleOpenCancelRequest(r)}
                      className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 min-h-[40px] cursor-pointer"
                      title="Annuler cette demande de stock en cas d'erreur"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Annuler</span>
                    </button>
                  )}

                  {/* Final Reception / Chargement (Status: Chargée) */}
                  {isReadyForReception && (
                    (isSaRequest && (user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL')) ||
                    (!isSaRequest && (isRequester || user?.role === 'VRS' || isSA || user?.role === 'FSS'))
                  ) && (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      {!hasBL && (
                        <button
                          type="button"
                          onClick={() => openBlModal(r, false)}
                          className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition border border-amber-600/50 min-h-[42px] active:scale-95 shadow-sm"
                        >
                          <Camera className="w-4 h-4 text-amber-400" />
                          <span>Joindre le BL</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={processingId === r.id}
                        onClick={() => handleUpdateStatus(r.id, 'Chargée')}
                        className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg disabled:opacity-50 active:scale-95 min-h-[42px] ${
                          isSaRequest
                            ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-950/50'
                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                        }`}
                        title={isSaRequest ? "Confirmer la Réception 6C Distribution au Dépôt" : "Confirmer le chargement physique des cartons dans le véhicule du VRS"}
                      >
                        <PackageCheck className={`w-4 h-4 ${processingId === r.id ? 'animate-spin' : ''}`} />
                        <span>
                          {processingId === r.id
                            ? 'Mise à jour en cours...'
                            : isSaRequest
                            ? 'Confirmer Réception 6C Distribution (+Stock Dépôt)'
                            : user?.role === 'VRS'
                            ? 'Confirmer le Chargement (+Stock VRS)'
                            : 'Marquer comme Chargée (+Stock VRS)'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {requests.length === 0 && (
          <div className="py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
            Aucune demande de chargement en cours.
          </div>
        )}
      </div>

      {/* Attach / Edit BL Modal */}
      {blModalOpen && targetRequest && (
        <div
          onClick={closeBlModal}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[94vh] sm:max-h-[90vh] bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Drag handle for mobile */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    {isValidationFlow
                      ? `Valider la Demande #${targetRequest.requestNumber}`
                      : `Bon de Livraison • #${targetRequest.requestNumber}`}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    {targetRequest.vrsName} • {targetRequest.totalCartons} cartons
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeBlModal}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveBL} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="overflow-y-auto p-4 sm:p-5 space-y-4 flex-1">
                {isValidationFlow ? (
                  <div className="p-3 bg-blue-950/60 border border-blue-800 rounded-xl text-xs text-blue-200">
                    ℹ️ La validation de cette demande notifiera immédiatement le vendeur ({targetRequest.vrsName}) dans son compte. Vous pouvez insérer les informations du Bon de Livraison (BL) ci-dessous.
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-slate-300">
                    ℹ️ Renseignez le numéro du Bon de Livraison (BL) et joignez une photo prise directement ou un document justificatif (PDF / JPG).
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Numéro du Bon de Livraison (BL)
                  </label>
                  <input
                    type="text"
                    value={blNumberInput}
                    onChange={(e) => setBlNumberInput(e.target.value)}
                    placeholder="ex. BL-2026-0042 ou Réf. Dépôt"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono min-h-[42px]"
                  />
                </div>

                {/* Photo or Scan Picker */}
                <DocumentAttachmentPicker
                  label="Document BL (Photo prise en direct ou Scan PDF / JPG / PNG)"
                  helperText="Prenez une photo directe avec votre appareil ou parcourez un fichier PDF / Image"
                  value={blAttachmentInput}
                  fileName={blFileNameInput}
                  fileType={blFileTypeInput}
                  onChange={({ attachmentUrl, fileName, fileType }) => {
                    setBlAttachmentInput(attachmentUrl);
                    setBlFileNameInput(fileName);
                    setBlFileTypeInput(fileType);
                  }}
                  onClear={() => {
                    setBlAttachmentInput('');
                    setBlFileNameInput('');
                    setBlFileTypeInput('');
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-2.5 p-4 sm:px-5 sm:py-3.5 border-t border-slate-800 bg-slate-950/80">
                <button
                  type="button"
                  onClick={closeBlModal}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium min-h-[42px] flex items-center justify-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={blSaving}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-white text-xs font-bold transition shadow disabled:opacity-50 min-h-[42px] flex items-center justify-center ${
                    isValidationFlow
                      ? 'bg-blue-600 hover:bg-blue-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {blSaving
                    ? 'Enregistrement...'
                    : isValidationFlow
                    ? 'Valider & Notifier le Vendeur'
                    : 'Enregistrer le BL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview Modal */}
      {viewImageModal && (
        <div
          onClick={() => setViewImageModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white truncate">{viewImageModal.title}</span>
              <button
                type="button"
                onClick={() => setViewImageModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center max-h-[75vh]">
              <img
                src={viewImageModal.url}
                alt="Document BL"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal with Preset Motifs and Custom Explanation */}
      {rejectModalOpen && rejectTargetRequest && (
        <div
          onClick={() => {
            if (!rejectionSubmitting) {
              setRejectModalOpen(false);
              setRejectTargetRequest(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-slate-900 border-t sm:border border-red-900/60 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-red-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center text-red-400 shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Rejeter la Demande #{rejectTargetRequest.requestNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {rejectTargetRequest.vrsName} • {rejectTargetRequest.totalCartons} cartons
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={rejectionSubmitting}
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectTargetRequest(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-xs text-red-200">
                ⚠️ Cette action rejettera la demande. Le vendeur ({rejectTargetRequest.vrsName}) sera immédiatement notifié avec le motif indiqué.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Motifs fréquents de rejet (sélection rapide) :
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Stock insuffisant au dépôt',
                    'Quantité demandée trop élevée',
                    'Dépassement du plafond autorisé',
                    'Réajustement nécessaire avec le Sales Admin',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectionReasonInput(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                        rejectionReasonInput === preset
                          ? 'bg-red-900/60 border-red-500 text-white font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Motif ou explication pour le vendeur :
                </label>
                <textarea
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="Expliquez la raison du rejet..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={rejectionSubmitting}
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectTargetRequest(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={rejectionSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-950/50 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {rejectionSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Rejet en cours...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Confirmer le Rejet</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partial Validation Modal */}
      {partialModalOpen && partialTargetRequest && (
        <div
          onClick={() => {
            if (!partialSubmitting) {
              setPartialModalOpen(false);
              setPartialTargetRequest(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-slate-900 border-t sm:border border-purple-900/60 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-purple-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Validation Partielle #{partialTargetRequest.requestNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {partialTargetRequest.vrsName} • Ajustez les quantités par produit
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={partialSubmitting}
                onClick={() => {
                  setPartialModalOpen(false);
                  setPartialTargetRequest(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePartialSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div className="p-3 bg-purple-950/30 border border-purple-900/40 rounded-xl text-xs text-purple-200">
                Indiquez le nombre de cartons autorisés pour chaque référence. Le statut passera à <strong>Partiellement validée</strong> et le vendeur en sera notifié.
              </div>

              <div className="space-y-3">
                {partialItems.map((pi, idx) => (
                  <div key={pi.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-white">{pi.productName}</p>
                      <p className="text-[11px] text-slate-400">Demandé : <span className="font-mono text-amber-400 font-bold">{pi.quantityRequested}</span> ctn</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Validé :</span>
                      <input
                        type="number"
                        min="0"
                        max={pi.quantityRequested}
                        value={pi.quantityApproved}
                        onChange={(e) => {
                          const newItems = [...partialItems];
                          const val = parseInt(e.target.value, 10);
                          newItems[idx].quantityApproved = isNaN(val) ? 0 : Math.max(0, Math.min(pi.quantityRequested, val));
                          setPartialItems(newItems);
                        }}
                        className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center font-bold text-xs focus:outline-none focus:border-purple-500"
                      />
                      <span className="text-slate-400 text-xs">ctn</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={partialSubmitting}
                  onClick={() => {
                    setPartialModalOpen(false);
                    setPartialTargetRequest(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={partialSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {partialSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validation...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmer la Validation Partielle</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Modification de la Demande (Requirement 6: VRS & SA) */}
      {editModalOpen && editTargetRequest && (
        <div
          onClick={() => {
            if (!editSubmitting) {
              setEditModalOpen(false);
              setEditTargetRequest(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-800/80 flex items-center justify-center text-amber-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Modifier la demande de stock
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    N° {editTargetRequest.requestNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={editSubmitting}
                onClick={() => {
                  setEditModalOpen(false);
                  setEditTargetRequest(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditRequest} className="p-4 sm:p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Items Qty Edit */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Quantités par produit (Cartons)
                </label>
                <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
                  {editTargetRequest.items?.map((it: any) => {
                    const key = it.productId || it.id;
                    const val = editQuantities[key] != null ? editQuantities[key] : it.quantityRequested;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">
                            {it.productName || it.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Réf : {it.productCode || it.code || 'PRD'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setEditQuantities((prev) => ({
                                ...prev,
                                [key]: Math.max(0, val - 1),
                              }))
                            }
                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition active:scale-90"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            max="9999"
                            value={val}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10);
                              setEditQuantities((prev) => ({
                                ...prev,
                                [key]: isNaN(n) ? 0 : Math.max(0, n),
                              }));
                            }}
                            className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center font-bold text-xs focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEditQuantities((prev) => ({
                                ...prev,
                                [key]: val + 1,
                              }))
                            }
                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition active:scale-90"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs text-slate-400 font-mono w-6">ctn</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Desired Date */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Date de chargement souhaitée
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="date"
                    value={editDateInput}
                    onChange={(e) => setEditDateInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Commentaires / Justification de correction
                </label>
                <textarea
                  rows={2}
                  value={editNotesInput}
                  onChange={(e) => setEditNotesInput(e.target.value)}
                  placeholder="Ex: Rectification de commande suite à vérification de stock..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500 placeholder-slate-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={editSubmitting}
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditTargetRequest(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {editSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Enregistrer les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Annulation de la Demande (Requirement 6: VRS & SA) */}
      {cancelModalOpen && cancelTargetRequest && (
        <div
          onClick={() => {
            if (!cancelSubmitting) {
              setCancelModalOpen(false);
              setCancelTargetRequest(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Annuler la demande de stock
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  N° {cancelTargetRequest.requestNumber}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir annuler cette demande de réapprovisionnement ? Cette action remettra le statut à <strong className="text-rose-400">ANNULÉE</strong>.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Motif d'annulation (optionnel)
              </label>
              <input
                type="text"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="Ex: Erreur de saisie, commande passée en double..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500 placeholder-slate-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancelTargetRequest(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={handleConfirmCancelRequest}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {cancelSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Annulation...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmer l'annulation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
