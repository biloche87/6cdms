import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { ScratchCard, Semester, GiftTier, DeliveryStatus } from '../../types/index.ts';
import { GiftIllustration } from './GiftIllustration.tsx';
import {
  Gift,
  Calendar,
  MapPin,
  UserCheck,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Trophy,
  AlertCircle,
  X,
  Phone,
  Building2,
  ZoomIn,
  Image as ImageIcon,
} from 'lucide-react';

export const DeliveriesAndGiftsView: React.FC = () => {
  const { user, refreshNotifications } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [deliveries, setDeliveries] = useState<ScratchCard[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);

  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string; subtitle?: string } | null>(null);

  // Filters
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Delivery schedule modal state
  const [scheduleModalCard, setScheduleModalCard] = useState<ScratchCard | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliveryLocation, setDeliveryLocation] = useState<string>('');
  const [deliveredBy, setDeliveredBy] = useState<string>('');
  const [deliveryComment, setDeliveryComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isReadOnly = user?.role === 'FSS';
  const canManage = user?.role === 'SALES_ADMIN_NATIONAL' || user?.role === 'SALES_ADMIN';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [semRes, delivRes] = await Promise.all([
        api.getSemesters().catch(() => ({ semesters: [] })),
        api.getGiftDeliveries({
          semester_id: selectedSemesterId ? Number(selectedSemesterId) : undefined,
          tier: selectedTier || undefined,
          delivery_status: selectedStatus || undefined,
        }).catch(() => ({ deliveries: [] })),
      ]);

      setSemesters(semRes.semesters);
      setDeliveries(delivRes.deliveries);
    } catch (err: any) {
      console.error('Erreur chargement des remises:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSemesterId, selectedTier, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open schedule modal
  const openScheduleModal = (card: ScratchCard) => {
    setScheduleModalCard(card);
    setDeliveryDate(card.delivery_date ? card.delivery_date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setDeliveryLocation(card.delivery_location || (card.drop_point_name ? `Entrepôt ${card.drop_point_name}` : 'Entrepôt Drop Point'));
    setDeliveredBy(card.delivered_by || (user ? `${user.firstName} ${user.lastName}` : 'Sales Admin'));
    setDeliveryComment(card.delivery_comment || '');
  };

  // Submit delivery scheduling or rescheduling
  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleModalCard || isSubmitting) return;

    if (!deliveryDate || !deliveryLocation.trim() || !deliveredBy.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Veuillez renseigner la date, le lieu et le responsable de la remise.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.scheduleDelivery(scheduleModalCard.id, {
        delivery_date: deliveryDate,
        delivery_location: deliveryLocation.trim(),
        delivered_by: deliveredBy.trim(),
        delivery_comment: deliveryComment.trim(),
      });

      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Remise du cadeau "${scheduleModalCard.gift_name}" programmée pour ${scheduleModalCard.vrs_first_name} ${scheduleModalCard.vrs_last_name}. Notification envoyée.`,
        });
        setScheduleModalCard(null);
        refreshNotifications();
        loadData();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de la programmation de la remise.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm delivery done by SA / SAN
  const handleConfirmDeliveryDone = async (card: ScratchCard) => {
    if (!canManage) return;
    const confirm = window.confirm(
      `Confirmer que la remise du cadeau "${card.gift_name}" a bien été effectuée à ${card.vrs_first_name} ${card.vrs_last_name} ?`
    );
    if (!confirm) return;

    try {
      const res = await api.confirmDeliveryDone(card.id);
      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Remise effectuée pour ${card.vrs_first_name} ${card.vrs_last_name}. Le vendeur a été notifié pour confirmer sa réception.`,
        });
        refreshNotifications();
        loadData();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de la confirmation de la remise.' });
    }
  };

  // Filter deliveries by search term
  const filteredDeliveries = deliveries.filter((d) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (d.vrs_first_name && d.vrs_first_name.toLowerCase().includes(term)) ||
      (d.vrs_last_name && d.vrs_last_name.toLowerCase().includes(term)) ||
      (d.vrs_public_id && d.vrs_public_id.toLowerCase().includes(term)) ||
      (d.gift_name && d.gift_name.toLowerCase().includes(term)) ||
      (d.drop_point_name && d.drop_point_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto pb-24">
      {/* Title & Role Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase bg-[#92400E] text-white mb-1">
            <Gift className="w-3.5 h-3.5" />
            Suivi des Remises de Cadeaux
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Cadeaux & Remises</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {user?.role === 'SALES_ADMIN_NATIONAL'
              ? 'Pilotage national de toutes les cartes révélées et programmation des remises.'
              : user?.role === 'SALES_ADMIN'
              ? `Gestion des remises pour les vendeurs de votre Drop Point (${user.dropPointCode || ''}).`
              : 'Consultation en lecture seule des cadeaux révélés pour vos vendeurs supervisés.'}
          </p>
        </div>

        {isReadOnly && (
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
            Mode Consultation (FSS)
          </div>
        )}
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center justify-between ${
            feedbackMsg.type === 'success' ? 'bg-[#15803D] text-white' : 'bg-[#DC2626] text-white'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="text-white hover:opacity-80 p-1">
            ✕
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Semester Filter */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
            Semestre :
          </label>
          <select
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            className="w-full min-h-[48px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="">Tous les semestres</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tier Filter */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
            Palier :
          </label>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="w-full min-h-[48px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="">Tous les paliers</option>
            <option value="OR">Palier Or (15 à 20)</option>
            <option value="BRONZE">Palier Bronze (10 à 14,5)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
            Statut de Remise :
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full min-h-[48px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="">Tous les statuts</option>
            <option value="A_PROGRAMMER">À programmer</option>
            <option value="PROGRAMMEE">Programmée</option>
            <option value="REMISE_EFFECTUEE">Remise effectuée (en attente confirmation)</option>
            <option value="RECU">Reçu (validé par le VRS)</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
            Recherche vendeur / cadeau :
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Nom, identifiant, cadeau..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[48px] pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Deliveries List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl space-y-3">
          <Gift className="w-12 h-12 mx-auto text-slate-400" />
          <h3 className="text-base font-black text-slate-900 dark:text-white">Aucun cadeau révélé</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Dès qu'un vendeur gratte ou révèle sa carte cadeau après clôture du semestre, elle apparaîtra immédiatement ici pour programmation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDeliveries.map((item) => {
            const isOr = item.tier === 'OR';
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-400 transition-colors"
              >
                <div>
                  {/* Top Bar: Tier & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                        isOr ? 'bg-[#15803D] text-white' : 'bg-[#92400E] text-white'
                      }`}
                    >
                      Palier {item.tier}
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        item.delivery_status === 'RECU'
                          ? 'bg-[#15803D] text-white'
                          : item.delivery_status === 'REMISE_EFFECTUEE'
                          ? 'bg-[#DC2626] text-white'
                          : item.delivery_status === 'PROGRAMMEE'
                          ? 'bg-[#92400E] text-white'
                          : 'bg-[#E2E8F0] text-black dark:text-white'
                      }`}
                    >
                      {item.delivery_status === 'RECU'
                        ? 'Reçu'
                        : item.delivery_status === 'REMISE_EFFECTUEE'
                        ? 'Remis'
                        : item.delivery_status === 'PROGRAMMEE'
                        ? 'Programmé'
                        : 'À programmer'}
                    </span>
                  </div>

                  {/* Gift Info with real photo / SVG */}
                  <div className="flex items-center gap-3 mb-3 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <div
                      className="relative cursor-pointer group shrink-0"
                      onClick={() => {
                        const photo = item.gift_custom_photo || item.gift_photo_url;
                        if (photo) {
                          setLightboxImage({
                            src: photo,
                            title: item.gift_name,
                            subtitle: `Remise pour ${item.vrs_first_name} ${item.vrs_last_name} (${item.vrs_public_id}) • Palier ${item.gift_tier || item.tier}`,
                          });
                        }
                      }}
                    >
                      <GiftIllustration
                        svgKey={item.gift_svg_key}
                        name={item.gift_name}
                        tier={item.gift_tier}
                        customPhoto={item.gift_custom_photo}
                        photoUrl={item.gift_photo_url}
                        className="w-16 h-16 flex-shrink-0"
                        size={56}
                        showRealBadge={Boolean(item.gift_custom_photo || item.gift_photo_url)}
                      />
                      {(item.gift_custom_photo || item.gift_photo_url) && (
                        <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="overflow-hidden flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Cadeau Tiré
                        </span>
                        {(item.gift_custom_photo || item.gift_photo_url) && (
                          <span className="text-[9px] font-black text-[#15803D] uppercase flex items-center gap-0.5">
                            <ImageIcon className="w-2.5 h-2.5" /> Photo réelle
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                        {item.gift_name}
                      </h4>
                      <span className="text-xs font-bold text-[#15803D]">
                        Note : {item.final_score.toFixed(1)}/20
                      </span>
                    </div>
                  </div>

                  {/* VRS Details */}
                  <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between font-bold">
                      <span>Vendeur :</span>
                      <span className="text-slate-900 dark:text-white">
                        {item.vrs_first_name} {item.vrs_last_name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Identifiant :</span>
                      <span className="font-mono">{item.vrs_public_id}</span>
                    </div>
                    {item.vrs_phone && (
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Téléphone :</span>
                        <a href={`tel:${item.vrs_phone}`} className="text-[#15803D] hover:underline font-bold">
                          {item.vrs_phone}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Drop Point :</span>
                      <span>{item.drop_point_name || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Delivery Schedule Info if programmed */}
                  {item.delivery_status !== 'A_PROGRAMMER' && item.delivery_date && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-[#92400E]" />
                        <span>Date : {item.delivery_date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-[#15803D]" />
                        <span>Lieu : {item.delivery_location}</span>
                      </div>
                      {item.delivered_by && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Remis par : {item.delivered_by}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                {canManage && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                    {item.delivery_status === 'A_PROGRAMMER' && (
                      <button
                        type="button"
                        onClick={() => openScheduleModal(item)}
                        className="w-full min-h-[48px] px-3 py-2 bg-[#92400E] hover:bg-[#92400E]/90 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow active:scale-98 cursor-pointer"
                      >
                        <Calendar className="w-4 h-4" />
                        Programmer la remise
                      </button>
                    )}

                    {item.delivery_status === 'PROGRAMMEE' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openScheduleModal(item)}
                          className="min-h-[48px] px-2 py-2 bg-[#E2E8F0] hover:bg-slate-300 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow active:scale-98 cursor-pointer dark:bg-slate-800 dark:text-white"
                        >
                          Reprogrammer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmDeliveryDone(item)}
                          className="min-h-[48px] px-2 py-2 bg-[#15803D] hover:bg-[#15803D]/90 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow active:scale-98 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirmer remise
                        </button>
                      </div>
                    )}

                    {item.delivery_status === 'REMISE_EFFECTUEE' && (
                      <div className="p-2 text-center text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/80 rounded-xl">
                        En attente de confirmation de réception par le VRS
                      </div>
                    )}

                    {item.delivery_status === 'RECU' && (
                      <div className="p-2 text-center text-xs font-bold text-[#15803D] bg-[#15803D]/10 rounded-xl flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Remise terminée et validée
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Programming Modal: STRICTLY OPAQUE */}
      {scheduleModalCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-slate-500">
                  {scheduleModalCard.delivery_status === 'PROGRAMMEE' ? 'Reprogrammation' : 'Planification'}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#92400E]" />
                  Remise du cadeau : {scheduleModalCard.gift_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalCard(null)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitSchedule} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">
                  Bénéficiaire : {scheduleModalCard.vrs_first_name} {scheduleModalCard.vrs_last_name} ({scheduleModalCard.vrs_public_id})
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  Palier {scheduleModalCard.tier} • Note {scheduleModalCard.final_score.toFixed(1)}/20
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Date de remise prévue * :
                </label>
                <input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full min-h-[48px] px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Lieu de la remise * :
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Entrepôt Dakan, Hamdallaye ACI 2000"
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  className="w-full min-h-[48px] px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Remis par (Nom & Fonction) * :
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Fatoumata Diarra (Sales Admin DAKAN)"
                  value={deliveredBy}
                  onChange={(e) => setDeliveredBy(e.target.value)}
                  className="w-full min-h-[48px] px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Commentaire / Instructions pour le vendeur :
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex : Se munir de sa pièce d'identité et signer le bon de réception..."
                  value={deliveryComment}
                  onChange={(e) => setDeliveryComment(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleModalCard(null)}
                  className="min-h-[48px] px-4 py-2 rounded-xl text-xs font-bold bg-[#E2E8F0] text-black hover:bg-slate-300 cursor-pointer dark:bg-slate-800 dark:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[48px] px-5 py-2 rounded-xl text-xs font-bold bg-[#15803D] hover:bg-[#15803D]/90 text-white shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer la programmation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX: AGRANDISSEMENT PHOTO RÉELLE EN HAUTE RÉSOLUTION */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 border-2 border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-4 my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Fermer l'agrandissement"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative aspect-4/3 w-full bg-black rounded-2xl overflow-hidden flex items-center justify-center">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.title}
                className="w-full h-full object-contain"
              />
              <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-[#15803D]/95 text-white text-xs font-black uppercase shadow">
                Photo Réelle Certifiée
              </span>
            </div>

            <div className="mt-3 px-1 text-left">
              <h3 className="text-lg font-black text-white">{lightboxImage.title}</h3>
              {lightboxImage.subtitle && (
                <p className="text-xs text-slate-400 mt-0.5">{lightboxImage.subtitle}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
