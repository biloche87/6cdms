import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { ScratchCard, VrsSemesterScore, Semester } from '../../types/index.ts';
import { ScratchCardCanvas } from './ScratchCardCanvas.tsx';
import {
  Gift,
  Award,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle,
  Clock,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react';

export const VrsGiftsView: React.FC = () => {
  const { user, refreshNotifications } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [currentSemester, setCurrentSemester] = useState<Semester | null>(null);
  const [score, setScore] = useState<VrsSemesterScore | null>(null);
  const [card, setCard] = useState<ScratchCard | null>(null);
  const [eligible, setEligible] = useState<boolean>(false);
  const [missingPoints, setMissingPoints] = useState<number>(0);
  const [isRevealing, setIsRevealing] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load semesters & card data
  const loadData = useCallback(async (semId?: number) => {
    try {
      setLoading(true);
      const [semRes, cardRes] = await Promise.all([
        api.getSemesters().catch(() => ({ semesters: [] })),
        api.getMyScratchCard(semId).catch(() => ({
          semester: null,
          score: null,
          card: null,
          eligible: false,
          missing_points: 0,
        })),
      ]);

      setSemesters(semRes.semesters);
      if (cardRes.semester) {
        setCurrentSemester(cardRes.semester);
        if (!selectedSemesterId) {
          setSelectedSemesterId(cardRes.semester.id);
        }
      }
      setScore(cardRes.score);
      setCard(cardRes.card);
      setEligible(cardRes.eligible);
      setMissingPoints(cardRes.missing_points);
    } catch (err: any) {
      console.error('Erreur chargement cadeaux VRS:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSemesterId]);

  useEffect(() => {
    loadData(selectedSemesterId || undefined);
  }, [selectedSemesterId, loadData]);

  // Handle reveal action
  const handleReveal = async (method: 'SCRATCH' | 'BUTTON') => {
    if (!card || isRevealing) return;
    try {
      setIsRevealing(true);
      const res = await api.revealScratchCard(card.id, method);
      if (res.success && res.card) {
        setCard(res.card);
        setFeedbackMsg({
          type: 'success',
          text: `Félicitations ! Vous avez révélé votre cadeau : "${res.card.gift_name}". La remise est transmise à votre Sales Admin.`,
        });
        refreshNotifications();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de la révélation du cadeau.' });
      throw err;
    } finally {
      setIsRevealing(false);
    }
  };

  // Handle confirm receipt by VRS
  const handleConfirmReceipt = async () => {
    if (!card) return;
    try {
      const res = await api.confirmReceiptByVrs(card.id);
      if (res.success) {
        setCard({
          ...card,
          delivery_status: 'RECU',
          vrs_confirmed_at: new Date().toISOString(),
        });
        setFeedbackMsg({
          type: 'success',
          text: 'Réception confirmée en main propre avec succès. Merci !',
        });
        refreshNotifications();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de la confirmation de réception.' });
    }
  };

  if (loading && !score && !card) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-64 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const isClosed = currentSemester?.status === 'CLOTURE';
  const finalScore = score ? score.total_score : 0;
  const isEligibleForGift = finalScore >= 10.0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto pb-24">
      {/* Page Title & Semester Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase bg-[#15803D] text-white mb-1">
            <Gift className="w-3.5 h-3.5" />
            Module Cadeaux & Notation
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Mes Cadeaux & Notation Semestrielle</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Suivi de votre note sur 20 calculée par le serveur et révélation de votre carte à gratter.
          </p>
        </div>

        {/* Semester Selector */}
        {semesters.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="semester-select" className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Semestre :
            </label>
            <select
              id="semester-select"
              value={selectedSemesterId || ''}
              onChange={(e) => setSelectedSemesterId(Number(e.target.value))}
              className="min-h-[48px] px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status === 'CLOTURE' ? 'Clôturé' : 'En cours'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-[#15803D] text-white'
              : 'bg-[#DC2626] text-white'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-white hover:opacity-80 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Score Summary Card */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {currentSemester?.name || 'Semestre en cours'}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-slate-900 dark:text-white">
                {score ? score.total_score.toFixed(1) : '0.0'}
              </span>
              <span className="text-lg font-bold text-slate-400">/ 20</span>
              {score && score.progression != null && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-black px-2 py-0.5 rounded-full ${
                    score.progression >= 0
                      ? 'bg-[#15803D] text-white'
                      : 'bg-[#DC2626] text-white'
                  }`}
                >
                  {score.progression >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {score.progression > 0 ? `+${score.progression.toFixed(1)}` : score.progression.toFixed(1)} pts
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase ${
                finalScore >= 15.0
                  ? 'bg-[#15803D] text-white'
                  : finalScore >= 10.0
                  ? 'bg-[#92400E] text-white'
                  : 'bg-[#E2E8F0] text-black dark:text-white'
              }`}
            >
              Palier : {finalScore >= 15.0 ? 'Or (15 à 20)' : finalScore >= 10.0 ? 'Bronze (10 à 14,5)' : 'Aucun (< 10)'}
            </span>

            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                isClosed
                  ? 'bg-slate-800 text-white'
                  : 'bg-[#E2E8F0] text-slate-900 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {isClosed ? 'Note figée (Semestre clôturé)' : 'Calcul en cours (Provisoire)'}
            </span>
          </div>
        </div>

        {/* 5 Criteria Breakdown Bar Grid */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
            Détail des 5 critères d'évaluation :
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. CA */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">1. Chiffre d'Affaires</span>
                <span className="text-xs font-black text-[#15803D]">
                  {score ? score.turnover_score.toFixed(1) : '0'}/8
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#15803D] h-full"
                  style={{ width: `${Math.min(100, ((score?.turnover_score || 0) / 8) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {score ? `${(score.actual_turnover / 1000000).toFixed(1)}M / ${(score.target_turnover / 1000000).toFixed(1)}M FCFA` : ''}
              </span>
            </div>

            {/* 2. Regularite */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">2. Régularité</span>
                <span className="text-xs font-black text-[#15803D]">
                  {score ? score.regularity_score.toFixed(1) : '0'}/4
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#15803D] h-full"
                  style={{ width: `${Math.min(100, ((score?.regularity_score || 0) / 4) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {score ? `${score.active_sales_days} j avec vente / ${score.working_days} j ouvrés` : ''}
              </span>
            </div>

            {/* 3. Paiements */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">3. Paiements Délais</span>
                <span className="text-xs font-black text-[#15803D]">
                  {score ? score.payments_score.toFixed(1) : '0'}/4
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#15803D] h-full"
                  style={{ width: `${Math.min(100, ((score?.payments_score || 0) / 4) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {score ? `${score.overdue_payments_count} retard, solde sous plafond` : ''}
              </span>
            </div>

            {/* 4. Nouveaux PDV */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">4. Nouveaux PDV</span>
                <span className="text-xs font-black text-[#15803D]">
                  {score ? score.new_pos_score.toFixed(1) : '0'}/2
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#15803D] h-full"
                  style={{ width: `${Math.min(100, ((score?.new_pos_score || 0) / 2) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {score ? `${score.new_pos_validated_count} validés par SAN` : ''}
              </span>
            </div>

            {/* 5. Rigueur */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">5. Rigueur</span>
                <span className="text-xs font-black text-[#15803D]">
                  {score ? score.rigor_score.toFixed(1) : '0'}/2
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#15803D] h-full"
                  style={{ width: `${Math.min(100, ((score?.rigor_score || 0) / 2) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {score ? `0 écart, ${score.rejected_requests_count} rejets` : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Action Section: Scratch Card or Pas de carte ce semestre */}
      {isClosed && isEligibleForGift && card ? (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Votre Carte Cadeau à Gratter</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {card.is_revealed === 1
                ? 'Cette carte a été révélée. Votre cadeau tiré au sort est figé et enregistré.'
                : 'Grattez la zone argentée avec votre doigt ou cliquez sur "Révéler le cadeau" pour découvrir votre récompense !'}
            </p>
          </div>

          {/* Interactive Canvas Card */}
          <ScratchCardCanvas
            card={card}
            vrsDisplayName={user ? `${user.firstName} ${user.lastName}` : undefined}
            onReveal={handleReveal}
            onConfirmReceipt={handleConfirmReceipt}
            isRevealing={isRevealing}
          />
        </div>
      ) : (
        /* Message if note is below 10 or semester not closed */
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-6 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-amber-600">
            <Award className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Pas de carte ce semestre
            </h3>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1 max-w-md mx-auto">
              {isClosed ? (
                <>
                  Votre note finale est de <strong>{finalScore.toFixed(1)}/20</strong>. La carte cadeau n'apparaît que si le semestre est clôturé et la note atteint au moins <strong>10/20</strong>.
                </>
              ) : (
                <>
                  Le semestre est actuellement en cours. La carte cadeau n'apparaîtra qu'une fois le semestre clôturé et si votre note atteint au moins <strong>10/20</strong>. Note actuelle : <strong>{finalScore.toFixed(1)}/20</strong>.
                </>
              )}
            </p>
          </div>

          {/* Missing points explanation */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left max-w-md mx-auto space-y-2">
            <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-400 block">
              Points manquants pour atteindre le palier cadeau (10/20) :
            </span>
            <div className="flex items-baseline gap-2 pb-1 border-b border-slate-200 dark:border-slate-700">
              <span className="text-2xl font-black text-red-600 dark:text-red-400">
                {missingPoints > 0 ? missingPoints.toFixed(1) : Math.max(0, 10.0 - finalScore).toFixed(1)}
              </span>
              <span className="text-xs font-bold text-slate-500">points manquants</span>
            </div>

            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc pl-4 pt-1">
              {score && score.turnover_score < 6 && (
                <li>
                  Chiffre d'affaires : {score.turnover_score.toFixed(1)}/8 (potentiel d'amélioration de {(8 - score.turnover_score).toFixed(1)} pts)
                </li>
              )}
              {score && score.regularity_score < 3 && (
                <li>
                  Régularité des ventes : {score.regularity_score.toFixed(1)}/4 (potentiel d'amélioration de {(4 - score.regularity_score).toFixed(1)} pts)
                </li>
              )}
              {score && score.payments_score < 3 && (
                <li>
                  Paiements dans les délais : {score.payments_score.toFixed(1)}/4 (veillez à régulariser vos créances sans retard)
                </li>
              )}
              {score && score.new_pos_score < 2 && (
                <li>
                  Nouveaux points de vente : {score.new_pos_score.toFixed(1)}/2 (validez au moins 5 nouveaux PDV)
                </li>
              )}
              {score && score.rigor_score < 2 && (
                <li>
                  Rigueur de gestion : {score.rigor_score.toFixed(1)}/2 (veillez à zéro écart de stock)
                </li>
              )}
            </ul>
            <p className="text-[11px] text-slate-500 italic pt-1">
              Poursuivez vos efforts sur le terrain pour valider l'objectif de 10/20 et remporter votre dotation !
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
