import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { DropPoint, Sector, User } from '../../types/index.ts';
import { GoogleMapView, MapMarker } from '../common/GoogleMapView.tsx';
import { ReassignSellerModal } from '../users/ReassignSellerModal.tsx';
import {
  Building2,
  PlusCircle,
  MapPin,
  Phone,
  Store,
  Users,
  Search,
  X,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Map,
  ArrowRightLeft,
} from 'lucide-react';

interface DropPointsViewProps {
  onlyMyDropPoint?: boolean;
  activeSection?: 'droppoints' | 'sectors';
}

export const DropPointsView: React.FC<DropPointsViewProps> = ({
  onlyMyDropPoint = false,
  activeSection = 'droppoints',
}) => {
  const { user } = useAuth();
  const [dropPoints, setDropPoints] = useState<DropPoint[]>([]);
  const [selectedDpId, setSelectedDpId] = useState<number | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [dpVrsList, setDpVrsList] = useState<User[]>([]);
  const [reassigningSeller, setReassigningSeller] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'sectors' | 'map' | 'vrs'>('sectors');
  const [isAddDpOpen, setIsAddDpOpen] = useState(false);
  const [isAddSectorOpen, setIsAddSectorOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // New Drop Point form
  const [newDp, setNewDp] = useState({
    name: '',
    code: '',
    city: 'Bamako',
    neighborhood: '',
    address: '',
    phone: '',
  });

  // New Sector form
  const [newSector, setNewSector] = useState({
    name: '',
    code: '',
    neighborhood: '',
  });

  const loadDropPoints = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDropPoints();
      let list = res.dropPoints;
      if (onlyMyDropPoint && user?.dropPointId) {
        list = list.filter((dp) => dp.id === user.dropPointId);
      }
      setDropPoints(list);

      const defaultDp = list[0]?.id || null;
      setSelectedDpId(defaultDp);
      if (defaultDp) {
        loadSectorsForDp(defaultDp);
        loadVrsForDp(defaultDp);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSectorsForDp = async (dpId: number) => {
    try {
      const res = await api.getSectors(dpId);
      setSectors(res.sectors);
    } catch (err) {
      console.error(err);
    }
  };

  const loadVrsForDp = async (dpId: number) => {
    try {
      const res = await api.getUsers({ dropPointId: dpId, role: 'VRS' });
      setDpVrsList(res.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDropPoints();
  }, [onlyMyDropPoint]);

  const handleSelectDp = (dpId: number) => {
    setSelectedDpId(dpId);
    loadSectorsForDp(dpId);
    loadVrsForDp(dpId);
  };

  const handleCreateDp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      await api.createDropPoint(newDp);
      setMessage(`Drop Point '${newDp.name}' créé avec succès.`);
      setIsAddDpOpen(false);
      setNewDp({ name: '', code: '', city: 'Bamako', neighborhood: '', address: '', phone: '' });
      loadDropPoints();
    } catch (err: any) {
      alert(err.message || 'Erreur création Drop Point');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDpId) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      await api.createSector(selectedDpId, newSector);
      setMessage(`Secteur '${newSector.name}' ajouté.`);
      setIsAddSectorOpen(false);
      setNewSector({ name: '', code: '', neighborhood: '' });
      loadSectorsForDp(selectedDpId);
    } catch (err: any) {
      alert(err.message || 'Erreur création Secteur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDropPoints = dropPoints.filter(
    (dp) =>
      dp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dp.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentDp = dropPoints.find((d) => d.id === selectedDpId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-red-500" />
            <span>
              {onlyMyDropPoint
                ? `Mon Dépôt & Secteurs (${user?.dropPointName || 'Drop Point'})`
                : activeSection === 'sectors'
                ? 'Secteurs'
                : 'Drop Points (Dépôts & Hubs Dépositaires)'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestion du maillage territorial, entrepôts régionaux et découpage en secteurs opérationnels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadDropPoints}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {user?.role === 'SALES_ADMIN_NATIONAL' && (
            <button
              type="button"
              onClick={() => setIsAddDpOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nouveau Drop Point</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {/* Main Grid: Drop Points on Left, Selected Drop Point Sectors on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drop Points List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrer les dépôts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            {filteredDropPoints.map((dp) => {
              const isSelected = dp.id === selectedDpId;
              return (
                <div
                  key={dp.id}
                  onClick={() => handleSelectDp(dp.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-slate-800/90 border-red-500/80 shadow-md ring-1 ring-red-500/40'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{dp.name}</span>
                        <span className="text-sm font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {dp.code}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {dp.city} • {dp.neighborhood}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                      {dp.status}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 text-slate-500" />
                      <strong>{dp.posCount || 0}</strong> PDVs
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <strong>{dp.vrsCount || 0}</strong> VRS
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel: Sectors & Configuration of Selected DP */}
        <div className="lg:col-span-2 space-y-4">
          {currentDp ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6">
              {/* DP Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                    Détail du Drop Point
                  </div>
                  <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                    <span>{currentDp.name}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800/50">
                      {currentDp.code}
                    </span>
                  </h2>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-4">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {currentDp.address}, {currentDp.neighborhood}, {currentDp.city}
                    </span>
                    {currentDp.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        {currentDp.phone}
                      </span>
                    )}
                  </div>
                </div>

                {user?.role === 'SALES_ADMIN_NATIONAL' && (
                  <button
                    type="button"
                    onClick={() => setIsAddSectorOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition shrink-0"
                  >
                    <PlusCircle className="w-4 h-4 text-emerald-400" />
                    <span>Ajouter un Secteur</span>
                  </button>
                )}
              </div>

              {/* Tabs: Sectors vs Google Map vs VRS */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('sectors')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
                    activeTab === 'sectors'
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                  <span>Secteurs & Quartiers ({sectors.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('vrs')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
                    activeTab === 'vrs'
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Vendeurs VRS ({dpVrsList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('map')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
                    activeTab === 'map'
                      ? 'bg-red-950/80 text-red-300 border border-red-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Map className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Carte Google Map</span>
                </button>
              </div>

              {/* Tab 1: Sectors */}
              {activeTab === 'sectors' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-400" />
                      <span>Secteurs & Quartiers Rattachés ({sectors.length})</span>
                    </h3>
                  </div>

                  {sectors.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800">
                      Aucun secteur créé pour ce Drop Point.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sectors.map((sec) => (
                        <div
                          key={sec.id}
                          className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-start justify-between"
                        >
                          <div>
                            <div className="font-semibold text-white text-sm flex items-center gap-2">
                              <span>{sec.name}</span>
                              <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {sec.code}
                              </span>
                            </div>
                            <div className="text-sm text-slate-400 mt-1">
                              Quartier : {sec.neighborhood}
                            </div>
                          </div>
                          <div className="text-right text-sm text-slate-400">
                            <div>
                              <strong className="text-slate-200">{sec.posCount || 0}</strong> PDVs
                            </div>
                            <div>
                              <strong className="text-slate-200">{sec.vrsCount || 0}</strong> VRS
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Google Maps View */}
              {activeTab === 'map' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Map className="w-4 h-4 text-emerald-400" />
                        <span>Position Google Map du Drop Point</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Emplacement réel certifié pour l'approvisionnement des stocks et les tournées VRS
                      </p>
                    </div>
                  </div>

                  <GoogleMapView
                    center={{
                      lat: currentDp.latitude || 12.6392,
                      lng: currentDp.longitude || -8.0029,
                    }}
                    zoom={15}
                    height="380px"
                    title={currentDp.name}
                    markers={dropPoints
                      .filter((dp) => dp.latitude && dp.longitude)
                      .map((dp) => ({
                        id: dp.id,
                        lat: dp.latitude!,
                        lng: dp.longitude!,
                        title: dp.name,
                        subtitle: `${dp.neighborhood}, ${dp.city}`,
                        badge: dp.code,
                        color: dp.id === currentDp.id ? 'red' : 'emerald',
                        onClick: () => setSelectedDpId(dp.id),
                      }))}
                  />
                </div>
              )}

              {/* Tab 3: VRS Sellers attached to this Drop Point */}
              {activeTab === 'vrs' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-400" />
                        <span>Vendeurs Terrain (VRS) rattachés ({dpVrsList.length})</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {user?.role === 'SALES_ADMIN_NATIONAL'
                          ? 'En tant que Sales Admin National, vous pouvez réaffecter n\'importe quel vendeur vers un autre Dépôt.'
                          : 'Liste des vendeurs rattachés à ce dépôt.'}
                      </p>
                    </div>
                  </div>

                  {dpVrsList.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800">
                      Aucun vendeur (VRS) rattaché à ce Drop Point actuellement.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {dpVrsList.map((seller) => (
                        <div
                          key={seller.id}
                          className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between gap-3 hover:border-slate-700 transition"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold text-white text-sm flex items-center gap-1.5">
                                <span>{seller.firstName} {seller.lastName}</span>
                                <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {seller.publicId}
                                </span>
                              </div>
                              <span
                                className={`px-2.5 py-0.5 rounded text-sm font-bold ${
                                  seller.status === 'ACTIF'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {seller.status}
                              </span>
                            </div>
                            <div className="text-sm text-slate-400 mt-1.5 space-y-0.5">
                              {seller.phone && <div>Tél : <span className="text-slate-300">{seller.phone}</span></div>}
                              <div>
                                Secteur : <span className="text-slate-300">{seller.sectorName || 'Non défini'}</span>
                              </div>
                            </div>
                          </div>

                          {user?.role === 'SALES_ADMIN_NATIONAL' && (
                            <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                              <button
                                type="button"
                                onClick={() => setReassigningSeller(seller)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition active:scale-95 shadow-xs"
                                title="Affecter ce vendeur à un autre Dépôt"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                                <span>Affecter à un autre Dépôt</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
              Sélectionnez un Drop Point pour afficher ses secteurs et indicateurs.
            </div>
          )}
        </div>
      </div>

      {/* Modal Créer Drop Point */}
      {isAddDpOpen && (
        <div
          onClick={() => setIsAddDpOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[94vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Drag handle */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

            <div className="flex-shrink-0 px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-red-500" />
                <span>Nouveau Drop Point (Dépôt)</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAddDpOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateDp} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
              <div className="overflow-y-auto p-4 sm:p-5 space-y-3 flex-1">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nom du Dépôt *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Drop Point Ségou"
                  value={newDp.name}
                  onChange={(e) => setNewDp({ ...newDp, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Code Trigrame (3-4 let.) *</label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="Ex: SEG"
                    value={newDp.code}
                    onChange={(e) => setNewDp({ ...newDp, code: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white uppercase font-mono min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Ville *</label>
                  <input
                    type="text"
                    required
                    value={newDp.city}
                    onChange={(e) => setNewDp({ ...newDp, city: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Quartier / Emplacement *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Quartier Administratif"
                  value={newDp.neighborhood}
                  onChange={(e) => setNewDp({ ...newDp, neighborhood: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Adresse Complète</label>
                <input
                  type="text"
                  placeholder="Ex: Rue 14, Porte 25"
                  value={newDp.address}
                  onChange={(e) => setNewDp({ ...newDp, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Téléphone de contact</label>
                <input
                  type="tel"
                  placeholder="Ex: +223 20 22 33 44"
                  value={newDp.phone}
                  onChange={(e) => setNewDp({ ...newDp, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                />
              </div>
              </div>

              <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-2.5 p-4 sm:px-5 sm:py-3.5 border-t border-slate-800 bg-slate-950/90">
                <button
                  type="button"
                  onClick={() => setIsAddDpOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition min-h-[44px] flex items-center justify-center font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition min-h-[44px] flex items-center justify-center disabled:opacity-50"
                >
                  {isSubmitting ? 'Création...' : 'Créer le Dépôt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajouter Secteur */}
      {isAddSectorOpen && user?.role === 'SALES_ADMIN_NATIONAL' && (
        <div
          onClick={() => setIsAddSectorOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[94vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Drag handle */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

            <div className="flex-shrink-0 px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <span>Nouveau Secteur ({currentDp?.name})</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAddSectorOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSector} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
              <div className="overflow-y-auto p-4 sm:p-5 space-y-3 flex-1">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nom du Secteur *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Secteur Grand Marché"
                  value={newSector.name}
                  onChange={(e) => setNewSector({ ...newSector, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Code Secteur *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: SEC-MAR"
                    value={newSector.code}
                    onChange={(e) => setNewSector({ ...newSector, code: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white uppercase font-mono min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Quartier *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Centre Ville"
                    value={newSector.neighborhood}
                    onChange={(e) => setNewSector({ ...newSector, neighborhood: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white min-h-[42px]"
                  />
                </div>
              </div>
              </div>

              <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-2.5 p-4 sm:px-5 sm:py-3.5 border-t border-slate-800 bg-slate-950/90">
                <button
                  type="button"
                  onClick={() => setIsAddSectorOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition min-h-[44px] flex items-center justify-center font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition min-h-[44px] flex items-center justify-center disabled:opacity-50"
                >
                  {isSubmitting ? 'Ajout...' : 'Ajouter le Secteur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Seller Modal */}
      {reassigningSeller && (
        <ReassignSellerModal
          isOpen={true}
          seller={reassigningSeller}
          onClose={() => setReassigningSeller(null)}
          onReassigned={() => {
            setReassigningSeller(null);
            if (selectedDpId) {
              loadVrsForDp(selectedDpId);
              loadSectorsForDp(selectedDpId);
            }
            loadDropPoints();
          }}
        />
      )}
    </div>
  );
};
