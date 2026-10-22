import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { PointOfSale, Sector, User as AppUser } from '../../types/index.ts';
import {
  X,
  Compass,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Store,
} from 'lucide-react';

interface NewTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTourCreated: () => void;
}

export const NewTourModal: React.FC<NewTourModalProps> = ({
  isOpen,
  onClose,
  onTourCreated,
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [sectorId, setSectorId] = useState<string>('');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [selectedPosIds, setSelectedPosIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(`Tournée Terrain - ${new Date().toLocaleDateString('fr-FR')}`);
      setError(null);
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [secRes, posRes] = await Promise.all([
        user?.dropPointId ? api.getSectors(user.dropPointId) : Promise.resolve({ sectors: [] }),
        api.getPointsOfSale(),
      ]);
      setSectors(secRes.sectors);
      if (secRes.sectors.length > 0) {
        setSectorId(String(secRes.sectors[0].id));
      }
      const activePos = posRes.pointsOfSale.filter(p => p.status === 'ACTIF' || p.status === 'VALIDE');
      setPointsOfSale(activePos);
      setSelectedPosIds(activePos.slice(0, 4).map(p => p.id));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const togglePosSelection = (id: number) => {
    if (selectedPosIds.includes(id)) {
      setSelectedPosIds(selectedPosIds.filter(item => item !== id));
    } else {
      setSelectedPosIds([...selectedPosIds, id]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedPosIds.length === 0) {
      setError('Veuillez sélectionner au moins un point de vente pour cette tournée.');
      return;
    }

    setLoading(true);
    try {
      await api.createTourPlan({
        name,
        startDate,
        endDate,
        sectorId: sectorId ? parseInt(sectorId, 10) : undefined,
        assignedVrsId: user?.role === 'VRS' ? user.id : undefined,
        pointOfSaleIds: selectedPosIds,
      });

      onTourCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la planification de la tournée.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl max-h-[94vh] sm:max-h-[90vh] bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-sheet-up sm:animate-modal-content"
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Planifier une Tournée Terrain
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Itinéraire et sélection des boutiques cibles
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nom / Libellé de la Tournée *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white min-h-[42px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Date de début *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white min-h-[42px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Date de fin *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white min-h-[42px]"
              />
            </div>
          </div>

          {sectors.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Secteur Assigné
              </label>
              <select
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white min-h-[42px]"
              >
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* POS multi-selection list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">
                Points de Vente à visiter
              </label>
              <span className="text-xs font-bold text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded-full">
                {selectedPosIds.length} sélectionné(s)
              </span>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1.5 p-2 bg-slate-950/70 border border-slate-800 rounded-xl">
              {pointsOfSale.length === 0 ? (
                <div className="py-6 px-4 text-center text-slate-400 text-xs bg-slate-950/40 border border-slate-800 rounded-lg">
                  <p className="font-semibold text-slate-300">Aucun point de vente actif dans ce secteur</p>
                  <p className="text-[11px] text-slate-500 mt-1">La création automatique est désactivée. Les points de vente doivent être enregistrés manuellement sur le terrain selon les besoins réels.</p>
                </div>
              ) : (
                pointsOfSale.map((pos) => {
                  const isSelected = selectedPosIds.includes(pos.id);
                  return (
                    <div
                      key={pos.id}
                      onClick={() => togglePosSelection(pos.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition min-h-[40px] active:scale-[0.99] ${
                        isSelected
                          ? 'bg-cyan-950/50 border-cyan-700 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 shrink-0"
                        />
                        <span className="font-semibold">{pos.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{pos.code}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 p-4 sm:px-6 sm:py-3.5 border-t border-slate-800 bg-slate-950/90">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium min-h-[44px] flex items-center justify-center transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow disabled:opacity-50 min-h-[44px] flex items-center justify-center"
            >
              {loading ? 'Création...' : 'Créer la Tournée'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
