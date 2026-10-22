import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { User, DropPoint, Sector } from '../../types/index.ts';
import {
  X,
  ArrowRightLeft,
  Building2,
  MapPin,
  Shield,
  AlertCircle,
  CheckCircle2,
  Loader2,
  UserCheck,
} from 'lucide-react';

interface ReassignSellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: User | null;
  onSuccess?: () => void;
  onReassigned?: () => void;
}

export const ReassignSellerModal: React.FC<ReassignSellerModalProps> = ({
  isOpen,
  onClose,
  seller,
  onSuccess,
  onReassigned,
}) => {
  const { user: currentUser } = useAuth();
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [targetDropPointId, setTargetDropPointId] = useState<string>('');
  const [targetSectorId, setTargetSectorId] = useState<string>('');
  const [targetFssId, setTargetFssId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && seller) {
      setError(null);
      setTargetDropPointId(seller.dropPointId ? String(seller.dropPointId) : '');
      setTargetSectorId(seller.sectorId ? String(seller.sectorId) : '');
      setTargetFssId(seller.fssId ? String(seller.fssId) : '');
      loadInitialData();
    }
  }, [isOpen, seller]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const dpRes = await api.getDropPoints();
      setDropPoints(dpRes.dropPoints);

      if (seller?.dropPointId) {
        await loadDropPointDetails(seller.dropPointId);
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de charger les dépôts.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDropPointDetails = async (dpId: number) => {
    try {
      const [secRes, usersRes] = await Promise.all([
        api.getSectors(dpId),
        api.getUsers({ role: 'FSS', dropPointId: dpId }),
      ]);
      setSectors(secRes.sectors);
      setSupervisors(usersRes.users);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDropPointChange = async (newDpId: string) => {
    setTargetDropPointId(newDpId);
    setTargetSectorId('');
    setTargetFssId('');
    if (newDpId) {
      await loadDropPointDetails(parseInt(newDpId, 10));
    } else {
      setSectors([]);
      setSupervisors([]);
    }
  };

  if (!isOpen || !seller || currentUser?.role !== 'SALES_ADMIN_NATIONAL') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDropPointId) {
      setError('Veuillez sélectionner un Dépôt / Drop Point de destination.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.updateUser(seller.id, {
        dropPointId: parseInt(targetDropPointId, 10),
        sectorId: targetSectorId ? parseInt(targetSectorId, 10) : null,
        fssId: targetFssId ? parseInt(targetFssId, 10) : null,
      });

      onSuccess?.();
      onReassigned?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la réaffectation du vendeur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDp = dropPoints.find((dp) => dp.id === seller.dropPointId);
  const targetDp = dropPoints.find((dp) => String(dp.id) === targetDropPointId);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-sheet-up sm:animate-modal-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Affectation du Vendeur (Drop Point)
              </h2>
              <p className="text-xs text-slate-400">
                Action réservée au Sales Admin National
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Seller Card */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-white shrink-0">
              {seller.firstName[0]}
              {seller.lastName[0]}
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {seller.firstName} {seller.lastName}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                ID: {seller.publicId} • Téléphone: {seller.phone || 'Non renseigné'}
              </div>
              <div className="text-[11px] text-amber-400/90 mt-0.5">
                Dépôt Actuel: <strong>{currentDp ? `${currentDp.name} (${currentDp.code})` : seller.dropPointName || 'Non assigné'}</strong>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs text-amber-300">
            Cette action mettra immédiatement à jour le rattachement territorial du vendeur. Le vendeur ainsi que le Sales Admin du nouveau dépôt recevront automatiquement une notification officielle.
          </div>

          {/* Target Drop Point */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Nouveau Dépôt / Drop Point d'affectation *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <select
                required
                value={targetDropPointId}
                onChange={(e) => handleDropPointChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Sélectionner le dépôt cible...</option>
                {dropPoints.map((dp) => (
                  <option key={dp.id} value={dp.id}>
                    {dp.name} ({dp.code}) - {dp.city || dp.neighborhood}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Sector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Secteur géographique dans le dépôt
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <select
                value={targetSectorId}
                onChange={(e) => setTargetSectorId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Sélectionner un secteur (facultatif)...</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) {s.neighborhood ? `- ${s.neighborhood}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {targetDropPointId && sectors.length === 0 && (
              <p className="text-[11px] text-slate-500 italic pl-1">
                Aucun secteur créé dans ce dépôt pour le moment.
              </p>
            )}
          </div>

          {/* Supervisor FSS */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Superviseur FSS référent
            </label>
            <div className="relative">
              <Shield className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <select
                value={targetFssId}
                onChange={(e) => setTargetFssId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Sélectionner un superviseur FSS (facultatif)...</option>
                {supervisors.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.firstName} {sup.lastName} ({sup.publicId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetDropPointId}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#54a835] hover:bg-[#468e2c] text-white rounded-xl text-xs font-bold shadow-lg transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
              <span>{isSubmitting ? 'Affectation en cours...' : 'Valider la Réaffectation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
