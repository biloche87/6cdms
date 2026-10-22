import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { PosCreationRequest, DropPoint } from '../../types/index.ts';
import { formatDateTime } from '../../utils/date.ts';
import {
  Store,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  MapPin,
  Phone,
  User,
  MessageSquare,
  AlertCircle,
  ExternalLink,
  Loader2,
  X,
  FileCheck2,
  Camera,
  ShieldCheck,
} from 'lucide-react';
import { ThumbnailImage } from '../common/ThumbnailImage.tsx';

interface PosRequestsViewProps {
  onOpenNewPos?: () => void;
}

export const PosRequestsView: React.FC<PosRequestsViewProps> = ({ onOpenNewPos }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PosCreationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [dropPointFilter, setDropPointFilter] = useState('');

  // Review modal state (SAN)
  const [selectedRequest, setSelectedRequest] = useState<PosCreationRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'VALIDEE' | 'REFUSEE' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // FSS note modal state
  const [fssNoteRequest, setFssNoteRequest] = useState<PosCreationRequest | null>(null);
  const [fssNoteInput, setFssNoteInput] = useState('');
  const [submittingFssNote, setSubmittingFssNote] = useState(false);
  const [fssNoteError, setFssNoteError] = useState<string | null>(null);

  // Photo viewer modal
  const [photoPreview, setPhotoPreview] = useState<{ url: string; name: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getPosRequests({
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

  const handleOpenReview = (req: PosCreationRequest, decision: 'VALIDEE' | 'REFUSEE') => {
    setSelectedRequest(req);
    setReviewDecision(decision);
    setRejectionReason('');
    setReviewError(null);
  };

  const handleSubmitReview = async () => {
    if (!selectedRequest || !reviewDecision) return;
    setReviewError(null);

    if (reviewDecision === 'REFUSEE' && !rejectionReason.trim()) {
      setReviewError('Le motif obligatoire de refus doit être renseigné.');
      return;
    }

    setSubmittingReview(true);
    try {
      await api.reviewPosRequest(selectedRequest.id, {
        decision: reviewDecision,
        rejectionReason: rejectionReason.trim() || undefined,
      });

      setSelectedRequest(null);
      setReviewDecision(null);
      loadData();
    } catch (err: any) {
      setReviewError(err?.message || 'Erreur lors de la prise de décision.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleOpenFssNote = (req: PosCreationRequest) => {
    setFssNoteRequest(req);
    setFssNoteInput(req.fss_note || '');
    setFssNoteError(null);
  };

  const handleSubmitFssNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fssNoteRequest) return;
    setFssNoteError(null);

    if (!fssNoteInput.trim()) {
      setFssNoteError("L'avis terrain ne peut pas être vide.");
      return;
    }

    setSubmittingFssNote(true);
    try {
      await api.addPosRequestFssNote(fssNoteRequest.id, { fssNote: fssNoteInput.trim() });
      setFssNoteRequest(null);
      loadData();
    } catch (err: any) {
      setFssNoteError(err?.message || "Erreur lors de l'enregistrement de l'avis FSS.");
    } finally {
      setSubmittingFssNote(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white">
              {user?.role === 'VRS' ? 'Mes demandes PDV' : 'Demandes PDV'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
              {requests.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Flux de création de points de vente initié sur le terrain par le VRS, avec avis FSS et validation/refus exclusif du SAN.
          </p>
        </div>

        {/* Action VRS: Nouveau PDV */}
        {user?.role === 'VRS' && onOpenNewPos && (
          <button
            type="button"
            onClick={onOpenNewPos}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] text-xs font-bold shadow-md transition self-start sm:self-auto cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>Nouveau PDV</span>
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
            onClick={() => setStatusFilter('EN_ATTENTE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'EN_ATTENTE'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>En attente</span>
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
              className="p-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
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

      {/* Requests List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
          <span className="text-xs">Chargement des demandes de PDV...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <Store className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">Aucune demande de PDV</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Le Sales Admin National ne crée pas de PDV directement. Les demandes sont soumises par les vendeurs terrain (VRS).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isPending = req.status === 'EN_ATTENTE';
            const isValidated = req.status === 'VALIDEE';
            const isRefused = req.status === 'REFUSEE';

            return (
              <div
                key={req.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition shadow-sm flex flex-col md:flex-row md:items-start md:justify-between gap-4"
              >
                {/* Photo Thumbnail if exists */}
                {req.photo && (
                  <div
                    onClick={() => setPhotoPreview({ url: req.photo!, name: req.name })}
                    className="w-16 h-16 rounded-xl overflow-hidden border border-slate-800 shrink-0 cursor-pointer hover:opacity-80 transition relative group"
                  >
                    <ThumbnailImage src={req.photo} alt={req.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                      <Camera className="w-4 h-4" />
                    </div>
                  </div>
                )}

                {/* Left Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-white tracking-wide">
                      {req.request_number}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 font-bold">
                      {req.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-medium">
                      {req.store_type || 'Commerce'}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-tight ${
                        isPending
                          ? 'bg-amber-950/80 text-amber-300 border-amber-800/80 animate-pulse'
                          : isValidated
                          ? 'bg-[#15803D] text-white border-none'
                          : 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                      }`}
                    >
                      {isPending && <Clock className="w-3 h-3" />}
                      {isValidated && <CheckCircle2 className="w-3 h-3 text-white" />}
                      {isRefused && <XCircle className="w-3 h-3" />}
                      <span>
                        {isPending ? 'En attente' : isValidated ? 'Validée (Actif)' : 'Refusée'}
                      </span>
                    </span>

                    {isValidated && req.posCode && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[#15803D] text-white font-bold">
                        PDV Actif : {req.posCode}
                      </span>
                    )}
                  </div>

                  {/* Metadata line */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>
                      Propriétaire : <strong className="text-slate-200">{req.owner_name}</strong>
                    </span>
                    <span>
                      Tél : <strong className="text-white font-mono">{req.phone}</strong>
                    </span>
                    <span>
                      VRS demandeur : <strong className="text-amber-400">{req.vrsName}</strong> ({req.vrsPublicId})
                    </span>
                    <span>
                      Drop Point : <strong className="text-slate-200">{req.dropPointName}</strong>
                    </span>
                    {req.neighborhood && <span>Quartier : {req.neighborhood}</span>}
                    {req.sectorName && <span className="text-blue-300">Secteur : {req.sectorName}</span>}
                    <span>Soumise le : {formatDateTime(req.created_at)}</span>
                  </div>

                  {req.address && (
                    <div className="text-xs text-slate-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{req.address}</span>
                      {req.latitude && req.longitude && (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/60">
                          GPS: {req.latitude.toFixed(4)}, {req.longitude.toFixed(4)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* FSS Advice note */}
                  {req.fss_note ? (
                    <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/60 text-xs text-blue-200 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-blue-300">
                          Avis FSS ({req.fssReviewerName || 'Superviseur'}) :
                        </strong>{' '}
                        {req.fss_note}
                      </div>
                    </div>
                  ) : (
                    (user?.role === 'FSS' || user?.role === 'SALES_ADMIN') && isPending && (
                      <button
                        type="button"
                        onClick={() => handleOpenFssNote(req)}
                        className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-medium transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Ajouter un avis superviseur terrain sur cette demande</span>
                      </button>
                    )
                  )}

                  {/* Refusal Reason */}
                  {isRefused && req.rejection_reason && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-rose-300">Motif obligatoire du refus :</strong>{' '}
                        {req.rejection_reason}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {/* SAN Actions */}
                  {user?.role === 'SALES_ADMIN_NATIONAL' && isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenReview(req, 'VALIDEE')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Valider le PDV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReview(req, 'REFUSEE')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 font-semibold text-xs transition"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Refuser</span>
                      </button>
                    </>
                  )}

                  {/* FSS Advice button */}
                  {(user?.role === 'FSS' || user?.role === 'SALES_ADMIN') && req.fss_note && (
                    <button
                      type="button"
                      onClick={() => handleOpenFssNote(req)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Modifier avis</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal (SAN Valider / Refuser) */}
      {selectedRequest && reviewDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    reviewDecision === 'VALIDEE'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {reviewDecision === 'VALIDEE' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {reviewDecision === 'VALIDEE' ? 'Valider la création du PDV' : 'Refuser la création du PDV'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Demande {selectedRequest.request_number} — {selectedRequest.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRequest(null);
                  setReviewDecision(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {reviewError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{reviewError}</span>
                </div>
              )}

              {reviewDecision === 'VALIDEE' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-200 space-y-1">
                    <p className="font-semibold">À la validation par le SAN :</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                      <li>Le PDV sera immédiatement créé et actif dans le réseau.</li>
                      <li>Il sera rattaché au VRS <strong>{selectedRequest.vrsName}</strong> et au Drop Point <strong>{selectedRequest.dropPointName}</strong>.</li>
                      <li>Le VRS sera automatiquement notifié de l'approbation.</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-200">
                    Le motif de refus est <strong>obligatoire</strong>. Il sera transmis au vendeur terrain pour justification.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Motif obligatoire du refus *
                    </label>
                    <textarea
                      rows={4}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Ex: Doublon géographique avec un PDV existant, quartier non autorisé, ou critères d'éligibilité non remplis..."
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRequest(null);
                    setReviewDecision(null);
                  }}
                  disabled={submittingReview}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReview}
                  disabled={submittingReview || (reviewDecision === 'REFUSEE' && !rejectionReason.trim())}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 ${
                    reviewDecision === 'VALIDEE'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20'
                  }`}
                >
                  {submittingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Traitement...</span>
                    </>
                  ) : reviewDecision === 'VALIDEE' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmer et créer le PDV actif</span>
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
        </div>
      )}

      {/* FSS Advice Modal */}
      {fssNoteRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-950 text-blue-400 border border-blue-800 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Avis Superviseur Terrain (FSS)</h3>
                  <p className="text-xs text-slate-400">
                    Demande #{fssNoteRequest.request_number} — {fssNoteRequest.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFssNoteRequest(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitFssNote} className="p-6 space-y-4">
              {fssNoteError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{fssNoteError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Votre recommandation / avis terrain pour le SAN *
                </label>
                <textarea
                  rows={4}
                  value={fssNoteInput}
                  onChange={(e) => setFssNoteInput(e.target.value)}
                  placeholder="Ex: Emplacement visité, solvabilité vérifiée, bonne densité de passage, recommandé..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFssNoteRequest(null)}
                  disabled={submittingFssNote}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingFssNote}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50"
                >
                  {submittingFssNote ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Enregistrer l'avis</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {photoPreview && (
        <div
          onClick={() => setPhotoPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2">
            <img src={photoPreview.url} alt={photoPreview.name} className="max-w-full max-h-[80vh] rounded-xl object-contain" />
            <div className="p-3 text-center text-xs font-semibold text-white">{photoPreview.name}</div>
          </div>
        </div>
      )}
    </div>
  );
};
