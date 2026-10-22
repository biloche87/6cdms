import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useGps } from '../../context/GpsContext.tsx';
import { api } from '../../services/api.ts';
import { Visit, PointOfSale } from '../../types/index.ts';
import { GoogleMapView, MapMarker } from '../common/GoogleMapView.tsx';
import {
  CalendarCheck,
  MapPin,
  Clock,
  Store,
  UserCheck,
  Search,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Navigation,
  PlusCircle,
  X,
  Compass,
} from 'lucide-react';

export const VisitsView: React.FC = () => {
  const { user } = useAuth();
  const { coords, requestGps } = useGps();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Quick Check-in form
  const [checkInPosId, setCheckInPosId] = useState<number | ''>('');
  const [checkInNotes, setCheckInNotes] = useState('');
  const [checkInStockNotes, setCheckInStockNotes] = useState('');
  const [geoLoc, setGeoLoc] = useState<{ lat?: number; lng?: number } | null>(null);
  const [isGettingGeo, setIsGettingGeo] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [visitsRes, posRes] = await Promise.allSettled([
        api.getVisits(),
        api.getPointsOfSale(),
      ]);

      if (visitsRes.status === 'fulfilled') {
        setVisits(visitsRes.value.visits || []);
      }

      if (posRes.status === 'fulfilled') {
        const pdvs = posRes.value.pointsOfSale || [];
        setPointsOfSale(pdvs);
        if (pdvs.length > 0 && !checkInPosId) {
          setCheckInPosId(pdvs[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCaptureLocation = async () => {
    setIsGettingGeo(true);
    try {
      const liveCoords = await requestGps();
      if (liveCoords) {
        setGeoLoc({ lat: liveCoords.latitude, lng: liveCoords.longitude });
      }
    } catch {
      console.warn('GPS capture error');
    } finally {
      setIsGettingGeo(false);
    }
  };

  const handleRecordCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInPosId) return;
    setIsSubmitting(true);
    setMessage(null);

    // Enforce GPS for VRS
    let visitLat = geoLoc?.lat ?? coords?.latitude;
    let visitLng = geoLoc?.lng ?? coords?.longitude;

    if (user?.role === 'VRS' && (!visitLat || !visitLng)) {
      const fresh = await requestGps();
      if (fresh) {
        visitLat = fresh.latitude;
        visitLng = fresh.longitude;
        setGeoLoc({ lat: visitLat, lng: visitLng });
      } else {
        setMessage('Erreur : Signal GPS obligatoire pour certifier la visite terrain.');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      // First start the visit
      const startRes = await api.startVisit({
        pointOfSaleId: Number(checkInPosId),
        latitude: visitLat,
        longitude: visitLng,
      });

      // Then record visit details
      await api.recordVisit(startRes.visitId, {
        latitude: visitLat,
        longitude: visitLng,
        notes: checkInNotes || 'Visite commerciale terrain effectuée.',
        stockCheckNotes: checkInStockNotes || 'Contrôle linéaire standard réalisé.',
        status: 'EFFECTUEE',
      });

      setMessage('Pointage de la visite terrain validé avec succès !');
      setIsCheckInOpen(false);
      setCheckInPosId('');
      setCheckInNotes('');
      setCheckInStockNotes('');
      setGeoLoc(null);
      loadData();
    } catch (err: any) {
      setMessage(err.message || 'Erreur lors du pointage de la visite');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVisits = visits.filter(
    (v) =>
      v.posName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.vrsName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CalendarCheck className="w-7 h-7 text-red-500" />
            <span>Visites</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Traçabilité des passages en boutique, relevés de linéaire et vérification de la présence effective.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsCheckInOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Navigation className="w-4 h-4" />
            <span>Pointer une Visite (Check-in)</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {/* Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par point de vente, vendeur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Visits List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-red-500" />
          <span className="text-xs">Chargement des visites...</span>
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
          Aucune visite enregistrée pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVisits.map((v) => (
            <div
              key={v.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-bold text-white text-sm truncate">
                      {v.posName}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      v.status === 'TERMINEE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                        : 'bg-blue-950 text-blue-300 border border-blue-800/40'
                    }`}
                  >
                    {v.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                      Vendeur
                    </span>
                    <strong className="text-white">{v.vrsName}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Date & Heure
                    </span>
                    <span className="font-mono text-[11px] text-slate-300">{v.startedAt}</span>
                  </div>

                  {v.latitude && v.longitude && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-500" />
                        Coordonnées GPS
                      </span>
                      <span className="font-mono text-[10px] text-amber-300">
                        {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                      </span>
                    </div>
                  )}

                  {v.notes && (
                    <div className="mt-2 p-2 bg-slate-950 rounded-lg text-[11px] text-slate-300 italic border border-slate-800/80">
                      "{v.notes}"
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Durée : {v.durationMinutes || 15} min</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conforme
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Check-in Modal with Google Maps and on-demand location capture */}
      {isCheckInOpen && (
        <div
          onClick={() => setIsCheckInOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] my-auto overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex-shrink-0 p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-red-500" />
                <span>Pointer une Visite Terrain (Check-in GPS & Google Maps)</span>
              </h2>
              <button type="button" onClick={() => setIsCheckInOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordCheckIn} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
              <div className="overflow-y-auto p-5 space-y-4 flex-1">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Point de Vente Visité ({pointsOfSale.length} boutiques disponibles) *
                </label>
                <select
                  required
                  value={checkInPosId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setCheckInPosId(id);
                    const found = pointsOfSale.find((p) => p.id === id);
                    if (found?.latitude && found?.longitude) {
                      setGeoLoc({ lat: found.latitude, lng: found.longitude });
                    }
                  }}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-red-500"
                >
                  <option value="">Sélectionner une boutique...</option>
                  {pointsOfSale.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code || p.publicId}) - {p.ownerName || 'Boutique'} [{p.neighborhood || 'Quartier'}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Real-time Google Map of the boutique & visit check-in */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    <span>Position Google Maps de la Visite</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureLocation}
                    disabled={isGettingGeo}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition shadow"
                  >
                    <Compass className={`w-3.5 h-3.5 ${isGettingGeo ? 'animate-spin' : ''}`} />
                    <span>{isGettingGeo ? 'Capture satellites...' : 'Enregistrer ma position Google Map'}</span>
                  </button>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                  <GoogleMapView
                    center={
                      geoLoc?.lat && geoLoc?.lng
                        ? { lat: geoLoc.lat, lng: geoLoc.lng }
                        : { lat: 12.6392, lng: -8.0029 }
                    }
                    zoom={15}
                    height="200px"
                    interactive={true}
                    onLocationSelect={(coords) => setGeoLoc({ lat: coords.lat, lng: coords.lng })}
                    markers={[
                      ...(geoLoc?.lat && geoLoc?.lng
                        ? [
                            {
                              id: 999999,
                              lat: geoLoc.lat,
                              lng: geoLoc.lng,
                              title: 'Pointage Visite Terrain',
                              subtitle: 'Position GPS validée',
                              color: 'emerald' as const,
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>

                <div className="p-2 bg-slate-950 rounded-lg text-[11px] text-slate-400 flex items-center justify-between font-mono">
                  <span>Coordonnées sélectionnées :</span>
                  <span className="text-emerald-400">
                    {geoLoc?.lat ? `${geoLoc.lat.toFixed(5)}, ${geoLoc.lng?.toFixed(5)}` : 'Cliquez sur la carte ou le bouton ci-dessus'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Relevé de Linéaire & Stock Boutique</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Stock NIDO sachet faible, réapprovisionnement conseillé."
                  value={checkInStockNotes}
                  onChange={(e) => setCheckInStockNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Commentaire / Remarques de la visite</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Boutique ouverte, gérant présent, commande validée."
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white resize-none"
                />
              </div>
              </div>

              <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckInOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !checkInPosId}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl disabled:opacity-50 shadow"
                >
                  {isSubmitting ? 'Validation...' : 'Valider le Pointage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
