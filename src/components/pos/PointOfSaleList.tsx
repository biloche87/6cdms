import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { PointOfSale } from '../../types/index.ts';
import {
  Store,
  Search,
  CheckCircle2,
  XCircle,
  Plus,
  MapPin,
  Phone,
  Calendar,
  DollarSign,
  AlertTriangle,
  User,
  ShieldCheck,
  ShieldAlert,
  Clock,
  FileSpreadsheet,
  Map,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Navigation,
  Eye,
  Camera,
  Trash2,
  ShoppingCart,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import { PosDetailModal } from './PosDetailModal.tsx';
import { exportPosToCsv } from '../../utils/exportCsv.ts';
import { ThumbnailImage } from '../common/ThumbnailImage.tsx';

interface PointOfSaleListProps {
  onOpenNewPos: () => void;
  onOpenNewSaleForPos?: (posId: number) => void;
  selectedPosId?: number | null;
  onSelectPos?: (posId: number | null) => void;
  lastUpdatedPos?: PointOfSale | null;
  initialSuccessMessage?: string | null;
}

export const PointOfSaleList: React.FC<PointOfSaleListProps> = ({
  onOpenNewPos,
  onOpenNewSaleForPos,
  selectedPosId,
  onSelectPos,
  lastUpdatedPos,
  initialSuccessMessage,
}) => {
  const { user } = useAuth();
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deletionFilter, setDeletionFilter] = useState('');
  const [pendingDeletionCount, setPendingDeletionCount] = useState<number>(0);
  const [actionMsg, setActionMsg] = useState<string | null>(initialSuccessMessage || null);
  const [expandedMapPosIds, setExpandedMapPosIds] = useState<Record<number, boolean>>({});
  const [showAllMaps, setShowAllMaps] = useState(false);
  const [internalSelectedPosId, setInternalSelectedPosId] = useState<number | null>(null);

  useEffect(() => {
    if (initialSuccessMessage) {
      setActionMsg(initialSuccessMessage);
      const timer = setTimeout(() => setActionMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [initialSuccessMessage]);

  // Sync latest updated POS immediately into the list
  useEffect(() => {
    if (lastUpdatedPos?.id) {
      setPointsOfSale((prev) =>
        prev.map((p) => (p.id === lastUpdatedPos.id ? { ...p, ...lastUpdatedPos } : p))
      );
    }
  }, [lastUpdatedPos]);

  // Keep internal state aligned if parent clears selectedPosId
  useEffect(() => {
    if (selectedPosId === null) {
      setInternalSelectedPosId(null);
    }
  }, [selectedPosId]);

  const activeDetailPosId = selectedPosId !== undefined ? selectedPosId : internalSelectedPosId;
  const setActiveDetailPosId = (id: number | null) => {
    setInternalSelectedPosId(id);
    if (onSelectPos) {
      onSelectPos(id);
    }
  };

  const toggleMap = (posId: number) => {
    setExpandedMapPosIds((prev) => ({
      ...prev,
      [posId]: !prev[posId],
    }));
  };

  const loadPos = async () => {
    setLoading(true);
    try {
      const res = await api.getPointsOfSale({
        status: statusFilter || undefined,
        search: search || undefined,
        deletionStatus: deletionFilter || undefined,
      });
      setPointsOfSale(res.pointsOfSale);
      if (res.pendingDeletionCount !== undefined) {
        setPendingDeletionCount(res.pendingDeletionCount);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPos();
  }, [statusFilter, deletionFilter]);

  const handleUpdateStatus = async (pos: PointOfSale, newStatus: string) => {
    try {
      const res = await api.updatePointOfSaleStatus(pos.id, { newStatus });
      setActionMsg(res.message);
      await loadPos();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour du statut.');
    }
  };

  const pendingCount = pointsOfSale.filter((p) => p.status === 'EN ATTENTE').length;

  // Pagination par blocs de 20 éléments
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, deletionFilter, search]);

  const totalItems = pointsOfSale.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const displayedPointsOfSale = totalItems > ITEMS_PER_PAGE
    ? pointsOfSale.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    : pointsOfSale;

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 overflow-x-hidden box-border">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 w-full max-w-full min-w-0 box-border">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Store className="w-5 h-5 text-amber-500 shrink-0" />
            <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight truncate">
              Points de Vente (PDV)
            </h1>
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter((prev) => (prev === 'EN ATTENTE' ? '' : 'EN ATTENTE'))}
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'EN ATTENTE'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                }`}
                title="Filtrer les PDV en attente de validation obligatoire par le Sales Admin"
              >
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{pendingCount} en attente de validation</span>
              </button>
            )}
            {pendingDeletionCount > 0 && (
              <button
                type="button"
                onClick={() => setDeletionFilter((prev) => (prev ? '' : 'EN_ATTENTE_APPROBATION'))}
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono shrink-0 transition flex items-center gap-1.5 ${
                  deletionFilter === 'EN_ATTENTE_APPROBATION'
                    ? 'bg-red-600 text-white border border-red-500 shadow'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                }`}
                title="Filtrer les demandes de suppression en attente de validation SAN"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
                <span>{pendingDeletionCount} suppression{pendingDeletionCount > 1 ? 's' : ''} à valider</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 sm:line-clamp-none">
            Boutiques, épiceries et kiosques référencés avec géolocalisation et attribution commerciale
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
          {/* Nouveau PDV Button - strictly hidden for SAN (SAN does not create PDVs directly) */}
          {user?.role !== 'SALES_ADMIN_NATIONAL' && (
            <button
              type="button"
              id="pos-new-btn"
              onClick={onOpenNewPos}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] text-xs font-bold rounded-xl shadow transition active:scale-95 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Nouveau PDV</span>
            </button>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowAllMaps((prev) => !prev)}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 text-xs font-semibold rounded-xl border transition ${
                showAllMaps
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Afficher ou masquer la carte Google Map sur toutes les fiches"
            >
              <Map className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">{showAllMaps ? 'Masquer les cartes' : 'Afficher toutes les cartes'}</span>
              <span className="sm:hidden">{showAllMaps ? 'Masquer' : 'Cartes'}</span>
            </button>

            <button
              type="button"
              onClick={() => exportPosToCsv(pointsOfSale)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
              title="Télécharger la liste complète des points de vente en fichier Excel CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Informative Banner: Strict manual creation on-demand */}
      <div className="p-3.5 bg-slate-900/90 border border-amber-900/30 rounded-xl flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-300">
          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span>
            <strong className="text-white">Création manuelle uniquement :</strong> Aucun point de vente n'est généré automatiquement. L'enrôlement d'un PDV s'effectue manuellement et exclusivement selon le besoin réel sur le terrain.
          </span>
        </div>
      </div>

      {/* Filter and search */}
      <div className="flex flex-col lg:flex-row gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3 w-full max-w-full min-w-0 box-border">
        {/* Champ de filtre : width 100%, max-width 100%, sur sa propre ligne sur mobile */}
        <div className="relative w-full max-w-full min-w-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher par nom, code, propriétaire, quartier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadPos()}
            className="w-full max-w-full min-w-0 pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 box-border min-h-[38px]"
          />
        </div>

        {/* Barre d'outils en flex-wrap avec gap de 8 px (gap-2) */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto min-w-0 box-border">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-initial px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none min-h-[38px] box-border"
          >
            <option value="">Tous les statuts</option>
            <option value="EN ATTENTE">En Attente de validation</option>
            <option value="ACTIF">Actifs</option>
            <option value="SUSPENDU">Suspendus</option>
            <option value="REJETE">Rejetés</option>
          </select>

          <button
            type="button"
            onClick={() => setDeletionFilter((prev) => (prev ? '' : 'EN_ATTENTE_APPROBATION'))}
            className={`px-3 py-2 rounded-lg text-xs font-semibold min-h-[38px] transition shrink-0 flex items-center gap-1.5 box-border ${
              deletionFilter === 'EN_ATTENTE_APPROBATION'
                ? 'bg-red-600 text-white border border-red-500 shadow'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Afficher uniquement les demandes de suppression en attente d'approbation"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Suppression</span>
            {pendingDeletionCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500/30 text-red-300 text-[10px] font-bold">
                {pendingDeletionCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={loadPos}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium min-h-[38px] active:scale-95 transition shrink-0 box-border"
          >
            Filtrer
          </button>
        </div>
      </div>

      {/* Grid of POS cards */}
      {(() => {
        return (
          <div className="space-y-4 w-full max-w-full min-w-0 box-border">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-full min-w-0 box-border">
              {displayedPointsOfSale.map((pos) => {
              const isPending = pos.status === 'EN ATTENTE';
              const isPendingDeletion = pos.deletionStatus === 'EN_ATTENTE_APPROBATION';
              const canValidate = user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL';
              const isSAN = user?.role === 'SALES_ADMIN_NATIONAL';
              const salesCount = pos.totalSalesCount || 0;
              const salesText = `${salesCount} ${salesCount === 1 ? 'vente' : 'ventes'}`;

              return (
                <div
                  key={pos.id}
                  className={`rounded-[16px] border p-[20px] transition flex flex-col justify-between min-w-0 overflow-hidden ${
                    isPendingDeletion
                      ? 'bg-red-950/20 border-red-800/90 shadow-md ring-1 ring-red-900/40'
                      : isPending
                      ? 'bg-amber-950/20 border-amber-800/80 shadow-md'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-[12px]">
                    {/* Deletion Warning Banner if Pending Deletion */}
                    {isPendingDeletion && (
                      <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-200 space-y-1.5 shadow">
                        <div className="flex items-center gap-1.5 font-bold text-red-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>Demande de suppression (Avis SAN)</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          <strong>Motif :</strong> {pos.deletionReason || 'Non spécifié'}
                        </p>
                        {isSAN ? (
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Approuver la suppression définitive du PDV '${pos.name}' ?`)) {
                                  await api.approvePointOfSaleDeletion(pos.id, { approved: true });
                                  loadPos();
                                }
                              }}
                              className="flex-1 py-1 px-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Approuver</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const note = prompt('Motif du rejet (facultatif) :');
                                if (note !== null) {
                                  await api.approvePointOfSaleDeletion(pos.id, { approved: false, note });
                                  loadPos();
                                }
                              }}
                              className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition"
                            >
                              Rejeter
                            </button>
                          </div>
                        ) : (
                          <div className="text-[10px] text-amber-300/80 font-medium">
                            Transmise au SAN pour décision
                          </div>
                        )}
                      </div>
                    )}

                    {/* Image ou En-tête du point de vente */}
                    {pos.photo ? (
                      <div
                        onClick={() => setActiveDetailPosId(pos.id)}
                        className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 cursor-pointer group"
                        title="Cliquer pour voir la fiche détaillée"
                      >
                        <ThumbnailImage
                          src={pos.photo}
                          alt={pos.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                          <Store className="w-4 h-4 text-amber-400" />
                          <span>Voir la fiche</span>
                        </div>
                        <div className="absolute top-2 right-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[14px] font-bold backdrop-blur-md shadow-md ${
                              pos.status === 'ACTIF' || pos.status === 'VALIDE'
                                ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800'
                                : pos.status === 'EN ATTENTE'
                                ? 'bg-amber-950/90 text-amber-300 border border-amber-700 animate-pulse'
                                : 'bg-red-950/90 text-red-300 border border-red-800'
                            }`}
                          >
                            {pos.status}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => setActiveDetailPosId(pos.id)}
                        className="w-full py-2.5 px-3.5 rounded-xl border border-dashed border-amber-700/60 hover:border-amber-500 bg-amber-950/20 hover:bg-amber-950/35 flex items-center justify-between text-slate-300 cursor-pointer transition group"
                        title="Cliquer pour prendre la photo et enregistrer sur la carte Google Maps"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
                            <Camera className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-white group-hover:text-amber-300 transition">
                              Prendre la photo (GPS)
                            </div>
                            <div className="text-[10px] text-amber-400/80">
                              Enregistre photo & carte Google Maps
                            </div>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[14px] font-bold ${
                            pos.status === 'ACTIF' || pos.status === 'VALIDE'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : pos.status === 'EN ATTENTE'
                              ? 'bg-amber-950 text-amber-300 border border-amber-700 animate-pulse'
                              : 'bg-red-950 text-red-300 border border-red-800'
                          }`}
                        >
                          {pos.status}
                        </span>
                      </div>
                    )}

                    {/* EN-TÊTE DE CARTE :
                        Ligne 1 = Code PDV à gauche + pastille de ventes unique à droite */}
                    <div className="flex items-center justify-between gap-2 min-w-0 w-full">
                      <span className="font-mono text-xs sm:text-sm px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 font-semibold truncate min-w-0">
                        {pos.code}
                      </span>
                      <div
                        className="h-[32px] px-[12px] rounded-full flex items-center justify-center font-mono text-[14px] font-semibold whitespace-nowrap shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        title={`${salesCount} vente(s) enregistrée(s)`}
                      >
                        {salesText}
                      </div>
                    </div>

                    {/* Ligne 2 = Nom du PDV (20 px, peut passer sur 2 lignes) */}
                    <h3
                      className="text-[20px] font-bold text-white leading-tight break-words"
                      title={pos.name}
                    >
                      {pos.name}
                    </h3>

                    {/* Ligne 3 = Propriétaire avec icône */}
                    <div className="text-xs sm:text-sm text-slate-300 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium truncate">{pos.ownerName}</span>
                    </div>

                    {/* Séparateur fin, puis téléphone et adresse (l'adresse passe à la ligne, jamais coupée) */}
                    <div className="pt-[12px] border-t border-slate-800/80 space-y-[12px] text-xs sm:text-sm text-slate-300">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-mono font-medium">{pos.phone}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed break-words whitespace-normal flex-1">
                          {pos.address} {pos.neighborhood ? `(${pos.neighborhood})` : ''}
                        </span>
                      </div>
                      {pos.sectorName && (
                        <div className="text-[12px] text-amber-400 font-medium pl-6">
                          Secteur : {pos.sectorName}
                        </div>
                      )}
                    </div>

                    {/* Google Map Géolocalisée */}
                    {(() => {
                      const hasCoords = pos.latitude != null && pos.longitude != null && !isNaN(Number(pos.latitude)) && !isNaN(Number(pos.longitude));
                      const lat = hasCoords ? Number(pos.latitude) : 12.6392;
                      const lng = hasCoords ? Number(pos.longitude) : -8.0029;
                      const isMapVisible = showAllMaps || !!expandedMapPosIds[pos.id];
                      const embedMapUrl = hasCoords
                        ? `https://maps.google.com/maps?q=${lat},${lng}&hl=fr&z=15&output=embed`
                        : `https://maps.google.com/maps?q=${encodeURIComponent(`${pos.name}, ${pos.address || ''}, ${pos.neighborhood || ''}, Bamako, Mali`)}&hl=fr&z=14&output=embed`;
                      const externalGoogleMapsUrl = hasCoords
                        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pos.name}, ${pos.address || ''}, ${pos.neighborhood || ''}, Bamako`)}`;

                      return (
                        <div className="pt-2 border-t border-slate-800/60 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                              <Map className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Carte Google Map</span>
                              {hasCoords ? (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                                  GPS OK
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60">
                                  Recherche Nom
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <a
                                href={externalGoogleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium transition"
                                title="Ouvrir dans Google Maps en grand"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>GPS</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => toggleMap(pos.id)}
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition"
                              >
                                <span>{isMapVisible ? 'Masquer' : 'Voir carte'}</span>
                                {isMapVisible ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>

                          {/* Coordinates info */}
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>
                              {hasCoords
                                ? `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° W`
                                : `${pos.neighborhood || 'Quartier non spécifié'}, Dakar`}
                            </span>
                            {pos.sectorName && (
                              <span className="text-amber-400/90">{pos.sectorName}</span>
                            )}
                          </div>

                          {/* Map iframe */}
                          {isMapVisible && (
                            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 relative shadow-inner">
                              <iframe
                                title={`Google Map - ${pos.name}`}
                                src={embedMapUrl}
                                className="w-full h-36 border-0"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Boutons d'action */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveDetailPosId(pos.id)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 hover:border-amber-600/50 border border-slate-700/60 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>Fiche profil & Ventes</span>
                    </button>

                    {isPending ? (
                      <span
                        className="py-2 px-3 rounded-xl bg-amber-950/60 border border-amber-800/70 text-amber-300 text-[11px] font-semibold flex items-center justify-center gap-1.5"
                        title="Point de vente non actif • En attente de validation obligatoire par le Sales Admin"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Non activé</span>
                      </span>
                    ) : onOpenNewSaleForPos && (pos.status === 'ACTIF' || pos.status === 'VALIDE') && (
                      <button
                        type="button"
                        onClick={() => onOpenNewSaleForPos(pos.id)}
                        className="py-2 px-3 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/70 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                        title="Enregistrer une vente auprès de ce PDV"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Vente</span>
                      </button>
                    )}
                  </div>

                  {/* Action Buttons for Validation (Sales Admin / SAN) */}
                  {isPending && (
                    canValidate ? (
                      <div className="mt-2.5 pt-2.5 border-t border-amber-800/50 bg-amber-950/30 -mx-[20px] -mb-[20px] p-3 rounded-b-[16px] space-y-2">
                        <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>Validation obligatoire requise</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(pos, 'ACTIF')}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow active:scale-95 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Valider & Activer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(pos, 'REJETE')}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-300 font-medium text-xs transition cursor-pointer"
                          >
                            Rejeter
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5 pt-2 text-[11px] text-amber-300/90 flex items-center gap-1.5 bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-800/40">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>En attente de validation obligatoire par le Sales Admin</span>
                      </div>
                    )
                  )}
                </div>
              );
            })}

        {pointsOfSale.length === 0 && (
          <div className="col-span-full py-14 px-6 text-center bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-950/50 border border-amber-800/60 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
              <Store className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Aucun Point de Vente enregistré
            </h3>
            <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
              La création automatique est désactivée. Les points de vente doivent être enregistrés sur le terrain par les VRS avec leurs coordonnées GPS puis validés par la Direction Nationale.
            </p>
            {user?.role !== 'SALES_ADMIN_NATIONAL' && (
              <button
                type="button"
                onClick={onOpenNewPos}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] text-xs font-bold rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau PDV</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination au-delà de 30 éléments */}
      {totalItems > ITEMS_PER_PAGE && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 box-border w-full">
          <span>
            Affichage de {((currentPage - 1) * ITEMS_PER_PAGE) + 1} à {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} sur {totalItems} points de vente
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold cursor-pointer disabled:cursor-not-allowed transition"
            >
              Précédent
            </button>
            <span className="font-mono px-2 text-white font-bold">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold cursor-pointer disabled:cursor-not-allowed transition"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
    );
  })()}

      {/* Pos Detail & Photo Modal (only rendered locally if not managed by parent App) */}
      {selectedPosId === undefined && (
        <PosDetailModal
          posId={internalSelectedPosId}
          isOpen={internalSelectedPosId !== null}
          onClose={() => setInternalSelectedPosId(null)}
          onStartSale={onOpenNewSaleForPos}
          onPosUpdated={(updatedPos) => {
            if (updatedPos.isDeleted || updatedPos.status === 'SUPPRIME') {
              setPointsOfSale((prev) => prev.filter((p) => p.id !== updatedPos.id));
              loadPos();
            } else {
              setPointsOfSale((prev) =>
                prev.map((p) => (p.id === updatedPos.id ? { ...p, ...updatedPos } : p))
              );
              loadPos();
            }
          }}
        />
      )}
    </div>
  );
};
