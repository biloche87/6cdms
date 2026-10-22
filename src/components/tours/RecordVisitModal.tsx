import React, { useState } from 'react';
import { api } from '../../services/api.ts';
import { Visit } from '../../types/index.ts';
import { GoogleMapView } from '../common/GoogleMapView.tsx';
import { isMobileOrTablet } from '../../utils/device.ts';
import {
  X,
  MapPin,
  Compass,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
} from 'lucide-react';

interface RecordVisitModalProps {
  visit: Visit | null;
  isOpen: boolean;
  onClose: () => void;
  onVisitRecorded: () => void;
  onTriggerSaleForPos?: (posId: number) => void;
}

export const RecordVisitModal: React.FC<RecordVisitModalProps> = ({
  visit,
  isOpen,
  onClose,
  onVisitRecorded,
  onTriggerSaleForPos,
}) => {
  const [notes, setNotes] = useState('');
  const [stockCheckNotes, setStockCheckNotes] = useState('');
  const [latitude, setLatitude] = useState(12.6392);
  const [longitude, setLongitude] = useState(-8.0029);
  const [isLocating, setIsLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !visit) return null;

  const handleCaptureGps = () => {
    setIsLocating(true);
    if (isMobileOrTablet() && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setIsLocating(false);
        },
        () => {
          setLatitude(12.6392 + (Math.random() - 0.5) * 0.005);
          setLongitude(-8.0029 + (Math.random() - 0.5) * 0.005);
          setIsLocating(false);
        },
        { timeout: 6000 }
      );
    } else {
      setLatitude(12.6392 + (Math.random() - 0.5) * 0.005);
      setLongitude(-8.0029 + (Math.random() - 0.5) * 0.005);
      setIsLocating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.recordVisit(visit.id, {
        latitude,
        longitude,
        notes,
        stockCheckNotes,
        status: 'EFFECTUEE',
      });

      onVisitRecorded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement de la visite.');
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
        className="relative w-full max-w-lg max-h-[94vh] sm:max-h-[90vh] bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-sheet-up sm:animate-modal-content"
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Pointer la Visite (Check-in GPS)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {visit.posName} • {visit.posCode}
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

          {/* GPS acquisition box & Google Map */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                Position Google Maps du pointage
              </span>
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={isLocating}
                className="w-full sm:w-auto px-3 py-1.5 bg-cyan-950/80 border border-cyan-800/80 rounded-lg text-xs text-cyan-300 hover:text-white font-semibold flex items-center justify-center gap-1 min-h-[38px] transition active:scale-95"
              >
                <Compass className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Acquisition en cours...' : 'Acquérir position GPS'}</span>
              </button>
            </div>
            
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <GoogleMapView
                center={{ lat: latitude, lng: longitude }}
                zoom={15}
                height="160px"
                interactive={true}
                onLocationSelect={(coords) => {
                  setLatitude(coords.lat);
                  setLongitude(coords.lng);
                }}
                markers={[
                  {
                    id: 1,
                    lat: latitude,
                    lng: longitude,
                    title: visit.posName,
                    subtitle: 'Pointage de visite',
                    color: 'emerald',
                  },
                ]}
              />
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              Coordonnées : Lat {latitude.toFixed(5)}, Lng {longitude.toFixed(5)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Contrôle du Stock en Rayon / Linéaire
            </label>
            <textarea
              rows={2}
              value={stockCheckNotes}
              onChange={(e) => setStockCheckNotes(e.target.value)}
              placeholder="ex. 12 boîtes en rayon, bien exposé en tête de gondole"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observations & Compte-rendu d'échange
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex. Propriétaire intéressé par une commande groupée le mardi prochain"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>

          {/* Quick Sale button */}
          {onTriggerSaleForPos && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerSaleForPos(visit.pointOfSaleId);
                }}
                className="w-full py-3 px-4 rounded-xl bg-red-600/20 border border-red-600/40 hover:bg-red-600/30 text-red-300 text-xs font-bold flex items-center justify-center gap-2 transition min-h-[44px] active:scale-95"
              >
                <ShoppingCart className="w-4 h-4 text-red-400" />
                <span>Le client commande ? Passer directement la Vente</span>
              </button>
            </div>
          )}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 p-4 sm:px-6 sm:py-3.5 border-t border-slate-800 bg-slate-950/90">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium min-h-[44px] flex items-center justify-center transition"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow disabled:opacity-50 min-h-[44px] flex items-center justify-center"
            >
              {loading ? 'Validation...' : 'Valider la Visite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
