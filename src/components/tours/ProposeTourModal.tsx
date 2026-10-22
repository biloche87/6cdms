import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Sector } from '../../types/index.ts';
import {
  X,
  Compass,
  Calendar,
  MapPin,
  Send,
  AlertCircle,
  CheckCircle2,
  FileText,
  Target,
} from 'lucide-react';

interface ProposeTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTourProposed: () => void;
}

export const ProposeTourModal: React.FC<ProposeTourModalProps> = ({
  isOpen,
  onClose,
  onTourProposed,
}) => {
  const { user } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorId, setSectorId] = useState<string>('');
  
  // Tomorrow as default planned date
  const defaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const [plannedDate, setPlannedDate] = useState<string>(defaultDate());
  const [timeSlot, setTimeSlot] = useState<string>('JOURNEE');
  const [name, setName] = useState<string>('');
  const [neighborhood, setNeighborhood] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [targetVisitsCount, setTargetVisitsCount] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeSlots = [
    { value: 'JOURNEE', label: 'Journée entière' },
    { value: 'MATIN', label: 'Matinée (08h00 - 13h00)' },
    { value: 'APRES_MIDI', label: 'Après-midi (14h00 - 18h00)' },
  ];

  useEffect(() => {
    if (isOpen) {
      setError(null);
      const formattedInitialDate = new Date(plannedDate + 'T00:00:00').toLocaleDateString('fr-FR');
      setName(`Proposition Tournée - ${user?.firstName || 'VRS'} - ${formattedInitialDate}`);
      loadSectors();
    }
  }, [isOpen]);

  const loadSectors = async () => {
    try {
      const dropPointId = user?.dropPointId;
      const res = await api.getSectors(dropPointId || undefined);
      setSectors(res.sectors);
      if (res.sectors.length > 0 && !sectorId) {
        setSectorId(String(res.sectors[0].id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectorId) {
      setError('Veuillez sélectionner un secteur pour votre tournée.');
      return;
    }
    if (!plannedDate) {
      setError('Veuillez sélectionner une date d\'intervention pour votre tournée.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const dateObj = new Date(plannedDate + 'T00:00:00');
      const dateFormatted = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
        : plannedDate;
      const slotLabel = timeSlots.find(s => s.value === timeSlot)?.label || '';
      const displayDateStr = timeSlot === 'JOURNEE' ? dateFormatted : `${dateFormatted} (${slotLabel})`;

      await api.proposeTourPlan({
        sectorId: parseInt(sectorId, 10),
        dayOfWeek: displayDateStr,
        plannedDate,
        name: name.trim() || undefined,
        neighborhood: neighborhood.trim() || undefined,
        notes: notes.trim() || undefined,
        targetVisitsCount: Number(targetVisitsCount) || 10,
      });

      onTourProposed();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la soumission de la proposition.');
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
        className="relative w-full max-w-lg bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-sheet-up sm:animate-modal-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Proposer une Tournée Commerciale
              </h2>
              <p className="text-xs text-slate-400">
                Soumission au Sales Admin et Sales Admin National
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

          <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-xs text-cyan-300">
            En tant que VRS, choisissez une <strong>date d'intervention</strong> et votre secteur cible pour planifier votre tournée commerciale. Votre proposition sera transmise instantanément au <strong>Sales Admin</strong> de votre dépôt et au <strong>Sales Admin National</strong> pour validation.
          </div>

          {/* Intitulé */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Intitulé de la proposition
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Tournée Secteur DAKAN Est"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Grid: Date & Sector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Date d'intervention prévue
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  value={plannedDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setPlannedDate(e.target.value);
                    if (e.target.value) {
                      const dObj = new Date(e.target.value + 'T00:00:00');
                      const dStr = !isNaN(dObj.getTime()) ? dObj.toLocaleDateString('fr-FR') : e.target.value;
                      setName(`Proposition Tournée - ${user?.firstName || 'VRS'} - ${dStr}`);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Créneau d'exécution
              </label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {timeSlots.map((ts) => (
                  <option key={ts.value} value={ts.value}>
                    {ts.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Secteur à couvrir
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <select
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target visits & neighborhoods */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Objectif de visites prévues
              </label>
              <div className="relative">
                <Target className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={targetVisitsCount}
                  onChange={(e) => setTargetVisitsCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Quartiers / Axes ciblés
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex: Route des Almadies, Rond-point"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Notes / Motivation */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Justification commerciale / Besoins particuliers
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Demande forte de réassort chips et biscuits exprimée par les gérants ce weekend..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
            />
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
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#54a835] hover:bg-[#468e2c] text-white rounded-xl text-xs font-bold shadow-lg transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Envoi en cours...' : 'Soumettre pour Approbation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
