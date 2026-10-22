import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { TourPlan, Visit } from '../../types/index.ts';
import {
  Compass,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Play,
  CheckCheck,
  Building2,
  Store,
  Send,
  XCircle,
  AlertCircle,
  X,
  Filter,
} from 'lucide-react';
import { NewTourModal } from './NewTourModal.tsx';
import { ProposeTourModal } from './ProposeTourModal.tsx';
import { RecordVisitModal } from './RecordVisitModal.tsx';
import { OfflineCacheBadge } from '../offline/OfflineCacheBadge.tsx';
import { formatDateTime } from '../../utils/date.ts';

interface TourPlansViewProps {
  onTriggerSaleForPos?: (posId: number) => void;
}

export const TourPlansView: React.FC<TourPlansViewProps> = ({ onTriggerSaleForPos }) => {
  const { user } = useAuth();
  const [tourPlans, setTourPlans] = useState<TourPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewTourOpen, setIsNewTourOpen] = useState(false);
  const [isProposeTourOpen, setIsProposeTourOpen] = useState(false);
  const [selectedVisitForCheckin, setSelectedVisitForCheckin] = useState<Visit | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EN_ATTENTE_APPROBATION' | 'ACTIF' | 'TERMINEE' | 'REJETEE'>('ALL');
  const [rejectingTourId, setRejectingTourId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const loadTours = async () => {
    setLoading(true);
    try {
      const res = await api.getTourPlans();
      setTourPlans(res.tourPlans);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTours();
  }, []);

  const handleUpdateStatus = async (tourId: number, status: string) => {
    try {
      const res = await api.updateTourPlanStatus(tourId, { status });
      setActionMsg(res.message);
      await loadTours();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erreur');
    }
  };

  const handleApproveProposal = async (tourId: number) => {
    setIsSubmittingApproval(true);
    try {
      const res = await api.approveTourPlan(tourId);
      setActionMsg(res.message || 'Tournée approuvée et activée avec succès !');
      await loadTours();
      setTimeout(() => setActionMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'approbation de la tournée.");
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleRejectProposal = async (tourId: number) => {
    setIsSubmittingApproval(true);
    try {
      const res = await api.rejectTourPlan(tourId, rejectReason.trim() || undefined);
      setActionMsg(res.message || 'Tournée rejetée. Le vendeur a été notifié.');
      setRejectingTourId(null);
      setRejectReason('');
      await loadTours();
      setTimeout(() => setActionMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || "Erreur lors du rejet de la tournée.");
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const pendingProposalsCount = tourPlans.filter(
    (t) => t.status === 'EN_ATTENTE_APPROBATION' || t.status === 'EN_ATTENTE'
  ).length;

  const rejectedProposalsCount = tourPlans.filter(
    (t) => t.status === 'REJETEE'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-500" />
              <h1 className="text-xl font-black text-white uppercase tracking-tight">
                Tournées & Visites Terrain
              </h1>
            </div>
            <OfflineCacheBadge moduleName="Tournées" />
            {pendingProposalsCount > 0 && (user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL') && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold font-mono animate-pulse">
                {pendingProposalsCount} proposition(s) en attente
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Planning des tournées commerciales, propositions VRS, pointages GPS et comptes-rendus
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* VRS proposal button */}
          {user?.role === 'VRS' && (
            <button
              type="button"
              onClick={() => setIsProposeTourOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#54a835] hover:bg-[#468e2c] text-white text-xs font-bold rounded-xl shadow-lg transition"
            >
              <Send className="w-4 h-4" />
              <span>Proposer une Tournée</span>
            </button>
          )}

          {/* Admin standard tour planning button */}
          {user?.role !== 'VRS' && (
            <button
              type="button"
              onClick={() => setIsNewTourOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Planifier une Tournée</span>
            </button>
          )}
        </div>
      </div>

      {user?.role === 'VRS' && (
        <div className="p-3.5 bg-cyan-950/40 border border-cyan-800/60 rounded-xl text-xs text-cyan-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="font-semibold">Tournées assignées & propositions de votre compte VRS</span>
            <p className="text-[11px] text-cyan-400/80 mt-0.5">
              Vous pouvez soumettre vos choix de secteurs et jours de visite. Les administrateurs recevront une alerte pour valider.
            </p>
          </div>
          <span className="text-[11px] text-cyan-400 font-mono shrink-0">
            {tourPlans.filter((t) => t.vrsId === user.id || t.assignedVrsId === user.id).length} tournée(s) liée(s)
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            statusFilter === 'ALL'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Toutes ({tourPlans.length})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('EN_ATTENTE_APPROBATION')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            statusFilter === 'EN_ATTENTE_APPROBATION'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-amber-300'
          }`}
        >
          <span>En attente d'approbation</span>
          {pendingProposalsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
              {pendingProposalsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('ACTIF')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            statusFilter === 'ACTIF'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
              : 'text-slate-400 hover:text-cyan-300'
          }`}
        >
          Actives / En cours
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('TERMINEE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            statusFilter === 'TERMINEE'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              : 'text-slate-400 hover:text-emerald-300'
          }`}
        >
          Terminées
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('REJETEE')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            statusFilter === 'REJETEE'
              ? 'bg-rose-950 text-rose-300 border border-rose-800'
              : 'text-slate-400 hover:text-rose-300'
          }`}
        >
          <span>Rejetées</span>
          {rejectedProposalsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-slate-950 text-[10px] font-bold">
              {rejectedProposalsCount}
            </span>
          )}
        </button>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Top Pending Proposals Section for Sales Admin National & Sales Admin */}
      {(user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL') && pendingProposalsCount > 0 && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 space-y-3 shadow-md shadow-amber-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-tight">
                    Propositions de Tournées à Valider
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold">
                    {pendingProposalsCount} en attente
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Propositions soumises par les vendeurs (VRS) avec validation immédiate.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {tourPlans
              .filter((t) => t.status === 'EN_ATTENTE_APPROBATION' || t.status === 'EN_ATTENTE')
              .sort((a, b) => a.id - b.id)
              .map((tour) => (
                <div
                  key={`top-pending-${tour.id}`}
                  className="p-3.5 bg-slate-950/80 border border-amber-500/30 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-amber-500 text-slate-950">
                        #{tour.id}
                      </span>
                      <h4 className="font-bold text-white text-sm">{tour.name}</h4>
                      <span className="text-slate-400 text-[11px]">
                        Vendeur : <strong className="text-white">{tour.assignedVrsName || tour.vrsName || 'VRS'}</strong>
                      </span>
                      {tour.dropPointCode && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                          {tour.dropPointCode}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-300">
                      <span>
                        Date : <strong className="text-cyan-300">{tour.dayOfWeek}</strong>
                      </span>
                      {tour.createdAt && (
                        <span className="text-amber-300/90 font-medium">
                          Soumise le : <strong>{formatDateTime(tour.createdAt)}</strong>
                        </span>
                      )}
                      {tour.sectorName && (
                        <span>
                          Secteur : <strong className="text-white">{tour.sectorName}</strong>
                        </span>
                      )}
                      {tour.neighborhood && <span>Quartier : {tour.neighborhood}</span>}
                      {tour.targetVisitsCount && (
                        <span className="text-slate-400">
                          Objectif : <strong className="text-white">{tour.targetVisitsCount} visites</strong>
                        </span>
                      )}
                    </div>
                    {tour.notes && (
                      <p className="text-[11px] text-slate-400 italic">
                        « {tour.notes} »
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                    <button
                      type="button"
                      disabled={isSubmittingApproval}
                      onClick={() => handleApproveProposal(tour.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#54a835] hover:bg-[#468e2c] text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                      title="Valider la tournée"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Valider</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingApproval}
                      onClick={() => {
                        setRejectingTourId(tour.id);
                        setRejectReason('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950 hover:bg-red-900/80 text-red-300 border border-red-800/80 font-semibold text-xs transition disabled:opacity-50"
                      title="Rejeter la proposition"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Rejeter</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tour plans list */}
      <div className="space-y-4">
        {tourPlans
          .filter((tour) => {
            if (user?.role === 'VRS') {
              const matchesUser = tour.vrsId === user.id || tour.assignedVrsId === user.id;
              if (!matchesUser) return false;
            }

            if (statusFilter === 'EN_ATTENTE_APPROBATION') {
              return tour.status === 'EN_ATTENTE_APPROBATION' || tour.status === 'EN_ATTENTE';
            }
            if (statusFilter === 'ACTIF') {
              return tour.status === 'ACTIF' || tour.status === 'PLANIFIEE' || tour.status === 'EN_COURS';
            }
            if (statusFilter === 'TERMINEE') {
              return tour.status === 'TERMINEE';
            }
            if (statusFilter === 'REJETEE') {
              return tour.status === 'REJETEE';
            }
            return true;
          })
          .sort((a, b) => {
            const aPending = a.status === 'EN_ATTENTE_APPROBATION' || a.status === 'EN_ATTENTE';
            const bPending = b.status === 'EN_ATTENTE_APPROBATION' || b.status === 'EN_ATTENTE';
            if (aPending && !bPending) return -1;
            if (!aPending && bPending) return 1;
            if (aPending && bPending) {
              return a.id - b.id; // Nouvelles propositions en haut
            }
            // Toutes les propositions validées ou rejetées apparaissent de manière récentes au haut et non en bas
            return b.id - a.id;
          })
          .map((tour) => {
          const isPendingApproval = tour.status === 'EN_ATTENTE_APPROBATION' || tour.status === 'EN_ATTENTE';
          const canApprove = user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL';
          const isOwnerOrAdmin = user?.id === (tour.assignedVrsId || tour.vrsId) || canApprove;

          return (
            <div
              key={tour.id}
              className={`bg-slate-900 rounded-2xl p-6 space-y-4 shadow-sm transition border ${
                isPendingApproval
                  ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                  : tour.status === 'REJETEE'
                  ? 'border-rose-900/60'
                  : 'border-slate-800'
              }`}
            >
              {/* Approval Alert Banner */}
              {isPendingApproval && (
                <div className="p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-300">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-bold text-amber-200">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Proposition de tournée soumise par {tour.assignedVrsName || tour.vrsName || 'le VRS'}</span>
                    </div>
                    <div className="text-[11px] text-amber-400/90 pl-6 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>Date d'intervention : <strong className="text-white">{tour.dayOfWeek}</strong></span>
                      {tour.createdAt && (
                        <span>• Soumise le : <strong className="text-amber-200">{formatDateTime(tour.createdAt)}</strong></span>
                      )}
                      <span>• Secteur : <strong className="text-white">{tour.sectorName || 'Non spécifié'}</strong>{tour.neighborhood && ` (${tour.neighborhood})`}</span>
                    </div>
                  </div>

                  {canApprove ? (
                    <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
                      <button
                        type="button"
                        disabled={isSubmittingApproval}
                        onClick={() => handleApproveProposal(tour.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#54a835] hover:bg-[#468e2c] text-white font-bold text-xs shadow transition disabled:opacity-50"
                        title="Valider la proposition de tournée"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Valider</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmittingApproval}
                        onClick={() => {
                          setRejectingTourId(tour.id);
                          setRejectReason('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950 hover:bg-red-900/80 text-red-300 border border-red-800/80 font-semibold text-xs transition disabled:opacity-50"
                        title="Rejeter la proposition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Rejeter</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-400/80 italic pl-6 sm:pl-0">
                      En attente de validation par vos administrateurs
                    </div>
                  )}
                </div>
              )}

              {/* Rejection Alert Banner */}
              {tour.status === 'REJETEE' && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-800/70 rounded-xl space-y-1 text-xs text-rose-300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-rose-200">
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Proposition non retenue (rejetée)</span>
                      {tour.reviewedAt && (
                        <span className="text-[11px] font-semibold text-rose-300">
                          le {formatDateTime(tour.reviewedAt)}
                        </span>
                      )}
                      {tour.reviewedByName && (
                        <span className="text-slate-400 font-normal">
                          par {tour.reviewedByName}
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded bg-rose-900/60 border border-rose-700/60 text-rose-200 font-mono text-[10px] font-bold">
                      REJETÉE
                    </span>
                  </div>
                  {tour.notes && (
                    <div className="text-[11px] text-rose-300/90 pl-6">
                      Motif : <span className="text-white font-medium">{tour.notes.replace(/^.*?Rejet:\s*/i, '') || tour.notes}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tour approval banner for validated proposals */}
              {tour.reviewedAt && tour.status !== 'REJETEE' && (
                <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/50 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-emerald-200">
                      Proposition validée le {formatDateTime(tour.reviewedAt)}
                    </span>
                    {tour.reviewedByName && (
                      <span className="text-slate-400 text-[11px]">
                        par <strong className="text-slate-300">{tour.reviewedByName}</strong>
                      </span>
                    )}
                  </div>
                  {tour.createdAt && (
                    <span className="text-slate-400 text-[11px]">
                      Soumise le {formatDateTime(tour.createdAt)}
                    </span>
                  )}
                </div>
              )}

              {/* Tour card header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-white">{tour.name}</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        tour.status === 'TERMINEE'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : tour.status === 'EN_COURS'
                          ? 'bg-blue-950 text-blue-300 border-blue-800 animate-pulse'
                          : isPendingApproval
                          ? 'bg-amber-950 text-amber-300 border-amber-700 animate-pulse'
                          : tour.status === 'REJETEE'
                          ? 'bg-red-950 text-red-300 border-red-800'
                          : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                      }`}
                    >
                      {tour.status === 'EN_ATTENTE_APPROBATION'
                        ? 'EN ATTENTE D\'APPROBATION'
                        : tour.status || 'PLANIFIÉE'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {tour.startDate
                        ? `${new Date(tour.startDate).toLocaleDateString('fr-FR')} → ${new Date(tour.endDate || tour.startDate).toLocaleDateString('fr-FR')}`
                        : tour.dayOfWeek || 'Planifiée'}
                    </span>
                    <span>Vendeur : <strong className="text-slate-200">{tour.assignedVrsName || tour.vrsName || 'Non assigné'}</strong></span>
                    {tour.sectorName && <span>Secteur : <strong className="text-cyan-400">{tour.sectorName}</strong></span>}
                    {tour.targetVisitsCount && (
                      <span className="text-slate-400">Objectif : <strong className="text-white">{tour.targetVisitsCount} visites</strong></span>
                    )}
                    {tour.status === 'REJETEE' && tour.reviewedAt && (
                      <span className="inline-flex items-center gap-1 text-rose-400 font-semibold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60 text-[11px]">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        Rejetée le {formatDateTime(tour.reviewedAt)}
                      </span>
                    )}
                    {tour.status !== 'REJETEE' && tour.reviewedAt && (
                      <span className="inline-flex items-center gap-1 text-white font-semibold bg-[#15803D] px-2 py-0.5 rounded text-[11px]">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                        Validée le {formatDateTime(tour.reviewedAt)}
                      </span>
                    )}
                    {tour.createdAt && !tour.reviewedAt && (
                      <span className="inline-flex items-center gap-1 text-amber-400/90 text-[11px]">
                        <Clock className="w-3 h-3 text-amber-400" />
                        Soumise le {formatDateTime(tour.createdAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tour state controls */}
                {isOwnerOrAdmin && !isPendingApproval && tour.status !== 'REJETEE' && (
                  <div className="flex items-center gap-2">
                    {(tour.status === 'PLANIFIEE' || tour.status === 'ACTIF') && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(tour.id, 'EN_COURS')}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Démarrer Tournée</span>
                      </button>
                    )}

                    {tour.status === 'EN_COURS' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(tour.id, 'TERMINEE')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Clôturer Tournée</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Notes / Comments */}
              {tour.notes && (
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 italic">
                  💡 Note : {tour.notes}
                </div>
              )}

              {/* Visits list */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-slate-500" />
                  Points de Vente Programmés ({tour.visits?.length || 0})
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tour.visits?.map((visit) => {
                    const isDone = visit.status === 'EFFECTUEE';
                    return (
                      <div
                        key={visit.id}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
                          isDone
                            ? 'bg-emerald-950/20 border-emerald-800/60'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-white text-xs truncate">
                              {visit.posName}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                isDone
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {visit.status}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                            <span className="truncate">{visit.posAddress}</span>
                          </div>

                          {visit.notes && (
                            <div className="mt-2 text-[10px] text-slate-400 italic bg-slate-900/80 p-1.5 rounded">
                              CR: {visit.notes}
                            </div>
                          )}
                        </div>

                        {!isDone && (
                          <button
                            type="button"
                            onClick={() => {
                              const visitPayload: Visit = {
                                id: visit.id,
                                vrsId: tour.vrsId || tour.assignedVrsId || user?.id || 1,
                                vrsName: tour.assignedVrsName || tour.vrsName || (user ? `${user.firstName} ${user.lastName}` : 'VRS'),
                                vrsPublicId: tour.vrsPublicId || '',
                                pointOfSaleId: visit.pointOfSaleId || visit.id,
                                posName: visit.posName,
                                posCode: (visit as any).posCode || `POS-${visit.id}`,
                                posOwner: (visit as any).posOwner || '',
                                posPhone: (visit as any).posPhone || '',
                                posAddress: visit.posAddress || '',
                                dropPointId: tour.dropPointId,
                                dropPointName: tour.dropPointName,
                                startedAt: new Date().toISOString(),
                                status: 'EN_COURS',
                              };
                              setSelectedVisitForCheckin(visitPayload);
                            }}
                            className="mt-2 w-full py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-600/40 hover:bg-cyan-600/30 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Pointer Visite GPS</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {tourPlans.length === 0 && (
          <div className="py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
            Aucune tournée trouvée pour ce filtre.
          </div>
        )}
      </div>

      {/* VRS Proposal Modal */}
      <ProposeTourModal
        isOpen={isProposeTourOpen}
        onClose={() => setIsProposeTourOpen(false)}
        onTourProposed={() => {
          setActionMsg('Votre proposition de tournée a été soumise avec succès aux administrateurs !');
          loadTours();
          setTimeout(() => setActionMsg(null), 5000);
        }}
      />

      {/* Admin Plan Tour Modal */}
      <NewTourModal
        isOpen={isNewTourOpen}
        onClose={() => setIsNewTourOpen(false)}
        onTourCreated={loadTours}
      />

      {/* Reject Proposal Dialog */}
      {rejectingTourId && (
        <div
          onClick={() => setRejectingTourId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-red-400 font-bold text-sm">
                <XCircle className="w-5 h-5" />
                <span>Rejeter la proposition de tournée</span>
              </div>
              <button
                type="button"
                onClick={() => setRejectingTourId(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Veuillez spécifier le motif du rejet. Le vendeur recevra ce motif par notification afin d'ajuster sa planification.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Conflit avec la tournée de réapprovisionnement, secteur prioritaire différent..."
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingTourId(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSubmittingApproval}
                onClick={() => handleRejectProposal(rejectingTourId)}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSubmittingApproval ? 'Rejet...' : 'Confirmer le Rejet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GPS Visit Recording Modal */}
      <RecordVisitModal
        visit={selectedVisitForCheckin}
        isOpen={!!selectedVisitForCheckin}
        onClose={() => setSelectedVisitForCheckin(null)}
        onVisitRecorded={loadTours}
        onTriggerSaleForPos={onTriggerSaleForPos}
      />
    </div>
  );
};
