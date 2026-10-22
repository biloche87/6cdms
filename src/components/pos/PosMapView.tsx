import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { PointOfSale, VrsLiveLocation, VrsTrajectoryResponse, VrsTrajectoryPoint } from '../../types/index.ts';
import { GoogleMapView, MapMarker, PathCoordinate } from '../common/GoogleMapView.tsx';
import {
  Map,
  Store,
  MapPin,
  Phone,
  Filter,
  User,
  ExternalLink,
  DollarSign,
  Compass,
  Radio,
  RefreshCw,
  ShieldCheck,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Users,
  Clock,
  Layers,
  Play,
  Pause,
  FastForward,
  Calendar,
  History,
  Route,
  Activity,
  ChevronRight,
  Sparkles,
  Gauge,
  TrendingUp,
  MapPinOff,
} from 'lucide-react';

export const PosMapView: React.FC = () => {
  const { user } = useAuth();

  // Mode: 'LIVE' (Tous les VRS en temps réel + simulation) or 'TRAJECTORY' (Historique des trajets par date/heure)
  const [viewMode, setViewMode] = useState<'LIVE' | 'TRAJECTORY'>('LIVE');

  // Live Mode States
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [vrsList, setVrsList] = useState<VrsLiveLocation[]>([]);
  const [selectedPos, setSelectedPos] = useState<PointOfSale | null>(null);
  const [selectedVrs, setSelectedVrs] = useState<VrsLiveLocation | null>(null);
  const [activeLayer, setActiveLayer] = useState<'ALL' | 'VRS' | 'POS'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isLiveRefreshing, setIsLiveRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Real-time Simulation States
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 5>(1);
  const [simStepNotice, setSimStepNotice] = useState<string | null>(null);
  const [simStepCount, setSimStepCount] = useState(0);

  // Trajectory History States (SAN, SA, FSS, VRS)
  const [selectedVrsForHistory, setSelectedVrsForHistory] = useState<number | null>(null);
  const [historyDate, setHistoryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [trajectoryData, setTrajectoryData] = useState<VrsTrajectoryResponse | null>(null);
  const [loadingTrajectory, setLoadingTrajectory] = useState(false);
  const [trajectoryError, setTrajectoryError] = useState<string | null>(null);
  const [activeWaypoint, setActiveWaypoint] = useState<VrsTrajectoryPoint | null>(null);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const simulationRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load
  useEffect(() => {
    loadMapData(true);

    // Setup polling every 60 seconds for live VRS locations when tab is visible
    pollingRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshVrsPositions();
      }
    }, 60000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (simulationRef.current) clearInterval(simulationRef.current);
    };
  }, [statusFilter]);

  // Handle Simulation Loop
  useEffect(() => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }

    if (isSimulating) {
      const intervalMs = Math.round(4000 / simSpeed);
      simulationRef.current = setInterval(() => {
        executeSimulationStep();
      }, intervalMs);
    }

    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
    };
  }, [isSimulating, simSpeed]);

  // When switching to Trajectory mode, ensure a VRS is selected
  useEffect(() => {
    if (viewMode === 'TRAJECTORY') {
      if (!selectedVrsForHistory && vrsList.length > 0) {
        setSelectedVrsForHistory(vrsList[0].id);
      }
    }
  }, [viewMode, vrsList]);

  // Load Trajectory whenever selectedVrsForHistory or historyDate changes
  useEffect(() => {
    if (viewMode === 'TRAJECTORY' && selectedVrsForHistory) {
      fetchTrajectory(selectedVrsForHistory, historyDate);
    }
  }, [selectedVrsForHistory, historyDate, viewMode]);

  const loadMapData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [posRes, vrsRes] = await Promise.all([
        api.getPointsOfSale({ status: statusFilter || undefined }),
        api.getVrsLocations(),
      ]);

      setPointsOfSale(posRes.pointsOfSale);
      setVrsList(vrsRes.vrs);
      setLastRefreshedAt(new Date());

      // Auto-select first active VRS or POS if nothing selected
      if (!selectedVrs && !selectedPos) {
        const firstActiveVrs = vrsRes.vrs.find((v) => v.lastLatitude && v.lastLongitude);
        if (firstActiveVrs) {
          setSelectedVrs(firstActiveVrs);
          setSelectedVrsForHistory(firstActiveVrs.id);
        } else if (posRes.pointsOfSale.length > 0) {
          setSelectedPos(posRes.pointsOfSale[0]);
        }
      }
    } catch (err) {
      console.error('Error loading map data:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const refreshVrsPositions = async () => {
    setIsLiveRefreshing(true);
    try {
      const vrsRes = await api.getVrsLocations();
      setVrsList(vrsRes.vrs);
      setLastRefreshedAt(new Date());

      if (selectedVrs) {
        const updated = vrsRes.vrs.find((v) => v.id === selectedVrs.id);
        if (updated) setSelectedVrs(updated);
      }
    } catch (err) {
      console.warn('Live VRS refresh warning:', err);
    } finally {
      setIsLiveRefreshing(false);
    }
  };

  const executeSimulationStep = async () => {
    try {
      const res = await api.simulateVrsStep();
      if (res.vrs) {
        setVrsList(res.vrs);
        setSimStepCount((prev) => prev + 1);
        setSimStepNotice(`Déplacement simulé en temps réel (${res.vrs.length} VRS actifs)`);
        setLastRefreshedAt(new Date());

        // Update selected VRS if in live view
        if (selectedVrs) {
          const updated = res.vrs.find((v) => v.id === selectedVrs.id);
          if (updated) setSelectedVrs(updated);
        }
      }
    } catch (err) {
      console.warn('Simulation step error:', err);
    }
  };

  const fetchTrajectory = async (vrsId: number, date: string) => {
    setLoadingTrajectory(true);
    setTrajectoryError(null);
    try {
      const res = await api.getVrsTrajectory(vrsId, date);
      setTrajectoryData(res);
      if (res.trajectory && res.trajectory.length > 0) {
        setActiveWaypoint(res.trajectory[res.trajectory.length - 1]);
        setPlaybackIndex(res.trajectory.length - 1);
      } else {
        setActiveWaypoint(null);
      }
    } catch (err: any) {
      console.error('Error fetching trajectory:', err);
      setTrajectoryError(err.message || 'Impossible de récupérer le trajet pour cette date.');
      setTrajectoryData(null);
    } finally {
      setLoadingTrajectory(false);
    }
  };

  // Quick dates helpers
  const setQuickDate = (type: 'today' | 'yesterday') => {
    const d = new Date();
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    setHistoryDate(d.toISOString().split('T')[0]);
  };

  // Build Markers for LIVE mode
  const liveMarkers: MapMarker[] = [];
  if (activeLayer === 'ALL' || activeLayer === 'VRS') {
    vrsList.forEach((vrs) => {
      if (!vrs.lastLatitude || !vrs.lastLongitude) return;

      const isLive = vrs.liveStatus === 'LIVE';
      const isRecent = vrs.liveStatus === 'RECENT';

      liveMarkers.push({
        id: `vrs-${vrs.id}`,
        lat: vrs.lastLatitude,
        lng: vrs.lastLongitude,
        title: `VRS: ${vrs.firstName} ${vrs.lastName}`,
        subtitle: `${vrs.publicId} • ${vrs.dropPointName || 'Dépôt'} ${vrs.sectorName ? `(${vrs.sectorName})` : ''} | Vit: ${vrs.lastLocationSpeed || 0} km/h`,
        badge: isLive ? '🟢 EN DIRECT' : isRecent ? '🟡 RÉCENT' : '⚪ HORS LIGNE',
        color: isLive ? 'blue' : isRecent ? 'cyan' : 'purple',
        iconType: 'vrs',
        onClick: () => {
          setSelectedVrs(vrs);
          setSelectedPos(null);
        },
      });
    });
  }

  if (activeLayer === 'ALL' || activeLayer === 'POS') {
    pointsOfSale.forEach((pos) => {
      if (!pos.latitude || !pos.longitude) return;

      liveMarkers.push({
        id: `pos-${pos.id}`,
        lat: pos.latitude,
        lng: pos.longitude,
        title: pos.name,
        subtitle: `${pos.ownerName} • ${pos.neighborhood}`,
        badge: pos.status,
        color: pos.status === 'ACTIF' || pos.status === 'VALIDE' ? 'emerald' : 'amber',
        iconType: 'pos',
        onClick: () => {
          setSelectedPos(pos);
          setSelectedVrs(null);
        },
      });
    });
  }

  // Build Markers & Path for TRAJECTORY mode
  const trajectoryMarkers: MapMarker[] = [];
  const trajectoryPathCoords: PathCoordinate[] = [];

  if (trajectoryData && trajectoryData.trajectory.length > 0) {
    trajectoryData.trajectory.forEach((pt, idx) => {
      trajectoryPathCoords.push({
        lat: pt.latitude,
        lng: pt.longitude,
        label: pt.actionContext,
        time: pt.formattedTime,
      });

      const isFirst = idx === 0;
      const isLast = idx === trajectoryData.trajectory.length - 1;
      const isSelected = activeWaypoint?.id === pt.id;

      // Add prominent markers for key waypoints (Start, End, or Selected)
      if (isFirst || isLast || isSelected || pt.speed === 0 || idx % 2 === 0) {
        trajectoryMarkers.push({
          id: `traj-${pt.id}`,
          lat: pt.latitude,
          lng: pt.longitude,
          title: `#${idx + 1} - ${pt.formattedTime}`,
          subtitle: `${pt.actionContext} (${pt.speed != null ? `${pt.speed} km/h` : '0 km/h'} • ±${pt.accuracy || 5}m)`,
          badge: isFirst ? 'DÉPART' : isLast ? 'DERNIER POINT' : pt.speed === 0 ? 'ARRÊT' : 'TRANSIT',
          color: isFirst ? 'emerald' : isLast ? 'blue' : pt.speed === 0 ? 'amber' : 'cyan',
          iconType: 'vrs',
          onClick: () => {
            setActiveWaypoint(pt);
            setPlaybackIndex(idx);
          },
        });
      }
    });

    // Add markers for sales made along the trajectory
    if (trajectoryData.associatedEvents.sales) {
      trajectoryData.associatedEvents.sales.forEach((s) => {
        if (s.latitude && s.longitude) {
          trajectoryMarkers.push({
            id: `sale-${s.id}`,
            lat: s.latitude,
            lng: s.longitude,
            title: `💰 Vente: ${s.saleNumber}`,
            subtitle: `${s.totalAmount.toLocaleString()} FCFA à ${s.formattedTime} (${s.posName || 'Client'})`,
            badge: `${s.totalAmount.toLocaleString()} FCFA`,
            color: 'emerald',
            iconType: 'pos',
          });
        }
      });
    }
  }

  // Determine current map center
  let currentCenter = { lat: 12.6392, lng: -8.0029 }; // Bamako default

  if (viewMode === 'TRAJECTORY') {
    if (activeWaypoint) {
      currentCenter = { lat: activeWaypoint.latitude, lng: activeWaypoint.longitude };
    } else if (trajectoryData && trajectoryData.trajectory.length > 0) {
      const first = trajectoryData.trajectory[0];
      currentCenter = { lat: first.latitude, lng: first.longitude };
    }
  } else {
    if (selectedVrs && selectedVrs.lastLatitude && selectedVrs.lastLongitude) {
      currentCenter = { lat: selectedVrs.lastLatitude, lng: selectedVrs.lastLongitude };
    } else if (selectedPos && selectedPos.latitude && selectedPos.longitude) {
      currentCenter = { lat: selectedPos.latitude, lng: selectedPos.longitude };
    } else {
      const vrsWithCoords = vrsList.find((v) => v.lastLatitude && v.lastLongitude);
      if (vrsWithCoords && vrsWithCoords.lastLatitude && vrsWithCoords.lastLongitude) {
        currentCenter = { lat: vrsWithCoords.lastLatitude, lng: vrsWithCoords.lastLongitude };
      }
    }
  }

  const liveVrsCount = vrsList.filter((v) => v.liveStatus === 'LIVE').length;
  const isSupervisorOrAdmin = user?.role === 'SALES_ADMIN_NATIONAL' || user?.role === 'SALES_ADMIN' || user?.role === 'FSS';

  return (
    <div className="space-y-6">
      {/* Header & Main Mode Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
              <Map className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Carte
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  GPS Certifié
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Surveillance en temps réel de tous les VRS et vérification détaillée de l'historique des trajets
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('LIVE')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'LIVE'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Tous les VRS en direct ({liveVrsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('TRAJECTORY')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'TRAJECTORY'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historique des trajets (Date/Heure)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: TOUS LES VRS EN DIRECT + SIMULATION TEMPS RÉEL                     */}
      {/* ========================================================================= */}
      {viewMode === 'LIVE' && (
        <>
          {/* Live Simulation Control Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  <Sparkles className="w-5 h-5 animate-pulse text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Simulation en Direct des VRS</span>
                    {isSimulating ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center gap-1.5 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        SIMULATION ACTIVE ({simSpeed}x)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 border border-slate-700 text-slate-400">
                        En pause
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Animez les déplacements réels de tous les vendeurs sur leurs corridors commerciaux de Bamako (Hamdallaye, Badalabougou, Sabalibougou).
                  </p>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                {/* Play / Pause simulation */}
                <button
                  type="button"
                  onClick={() => setIsSimulating(!isSimulating)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                    isSimulating
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isSimulating ? 'Pause Simulation' : 'Lancer Simulation en Direct'}</span>
                </button>

                {/* Single step advance */}
                <button
                  type="button"
                  onClick={executeSimulationStep}
                  title="Faire avancer les VRS d'une étape"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                >
                  <FastForward className="w-3.5 h-3.5 text-blue-400" />
                  <span>Avancer 1 étape</span>
                </button>

                {/* Speed Multiplier */}
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-0.5">
                  {([1, 2, 5] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSimSpeed(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        simSpeed === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {simStepNotice && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2 text-cyan-300">
                  <Activity className="w-3.5 h-3.5" />
                  <span>{simStepNotice}</span>
                  <span className="text-slate-500">• {simStepCount} mouvements enregistrés</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Dernier ping: {lastRefreshedAt.toLocaleTimeString('fr-FR')}
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 font-medium">VRS Visibles en direct</div>
              <div className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                <span className="text-blue-400">{liveVrsCount}</span>
                <span className="text-xs text-slate-500 font-normal">/ {vrsList.length} VRS</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 font-medium">Points de Vente Actifs</div>
              <div className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                <span className="text-emerald-400">{pointsOfSale.length}</span>
                <span className="text-xs text-slate-500 font-normal">sur le terrain</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 font-medium">Ventes Réalisées (Total)</div>
              <div className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                <span className="text-indigo-400">
                  {vrsList.reduce((acc, v) => acc + (v.completedSalesCount || 0), 0)}
                </span>
                <span className="text-xs text-slate-500 font-normal">ventes certifiées</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 font-medium">Synchronisation GPS</div>
              <div className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Toutes les 15s</span>
              </div>
            </div>
          </div>

          {/* Main Map & Live VRS Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Map Area */}
            <div className="lg:col-span-3 space-y-4">
              {/* Map Layer Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveLayer('ALL')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeLayer === 'ALL'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tous ({vrsList.length + pointsOfSale.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLayer('VRS')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeLayer === 'VRS'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    VRS en direct ({vrsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLayer('POS')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeLayer === 'POS'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Points de vente ({pointsOfSale.length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshVrsPositions}
                    disabled={isLiveRefreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLiveRefreshing ? 'animate-spin text-blue-400' : ''}`} />
                    <span>Actualiser GPS</span>
                  </button>
                </div>
              </div>

              {/* Google Map Container */}
              <GoogleMapView
                center={currentCenter}
                zoom={14}
                markers={liveMarkers}
                selectedMarkerId={selectedVrs ? `vrs-${selectedVrs.id}` : selectedPos ? `pos-${selectedPos.id}` : null}
                height="540px"
                title={
                  selectedVrs
                    ? `VRS en direct: ${selectedVrs.firstName} ${selectedVrs.lastName} (${selectedVrs.publicId})`
                    : selectedPos
                    ? `PDV: ${selectedPos.name}`
                    : 'Carte Opérationnelle Multi-VRS'
                }
              />
            </div>

            {/* Live VRS & Selection Details Sidebar */}
            <div className="space-y-4">
              {/* Selected VRS or POS Detailed Card */}
              {selectedVrs ? (
                <div className="bg-slate-900 border border-blue-800/80 rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                  
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-950 border border-blue-800 text-blue-300 uppercase">
                        VRS Sélectionné
                      </span>
                      <h3 className="text-base font-bold text-white mt-1">
                        {selectedVrs.firstName} {selectedVrs.lastName}
                      </h3>
                      <p className="text-xs text-slate-400">{selectedVrs.publicId}</p>
                    </div>

                    <div className="flex flex-col items-end">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          selectedVrs.liveStatus === 'LIVE'
                            ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                            : 'bg-amber-950 border border-amber-800 text-amber-300'
                        }`}
                      >
                        {selectedVrs.liveStatus === 'LIVE' ? '🟢 EN DIRECT' : '🟡 RÉCENT'}
                      </span>
                      {selectedVrs.minutesAgo != null && (
                        <span className="text-[10px] text-slate-500 mt-1">
                          il y a {selectedVrs.minutesAgo} min
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800 relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-blue-400" />
                        Vitesse instantanée:
                      </span>
                      <span className="font-semibold text-white">
                        {selectedVrs.lastLocationSpeed || 0} km/h
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                        Précision GPS:
                      </span>
                      <span className="font-semibold text-white">
                        ±{selectedVrs.lastLocationAccuracy || 5} m
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-amber-400" />
                        Dépôt & Secteur:
                      </span>
                      <span className="font-medium text-slate-200">
                        {selectedVrs.dropPointName || 'DAKAN'} • {selectedVrs.sectorName || 'Secteur 01'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        Ventes du jour:
                      </span>
                      <span className="font-bold text-emerald-400">
                        {selectedVrs.completedSalesCount} ventes ({selectedVrs.totalSalesAmount?.toLocaleString()} F)
                      </span>
                    </div>
                  </div>

                  {/* Actions for this VRS */}
                  <div className="pt-3 border-t border-slate-800 flex flex-col gap-2 relative z-10">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVrsForHistory(selectedVrs.id);
                        setViewMode('TRAJECTORY');
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Consulter l'historique du trajet</span>
                    </button>

                    {selectedVrs.lastLatitude && selectedVrs.lastLongitude && (
                      <a
                        href={`https://www.google.com/maps?q=${selectedVrs.lastLatitude},${selectedVrs.lastLongitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Ouvrir sur Google Maps</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : selectedPos ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-300 uppercase">
                      Point de Vente
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">{selectedPos.name}</h3>
                    <p className="text-xs text-slate-400">{selectedPos.publicId} • {selectedPos.neighborhood}</p>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Propriétaire:</span>
                      <span className="font-semibold text-white">{selectedPos.ownerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Téléphone:</span>
                      <span className="font-semibold text-white">{selectedPos.phone || 'Non renseigné'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Statut:</span>
                      <span className="font-semibold text-emerald-400">{selectedPos.status}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* List of All VRS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>Tous les VRS ({vrsList.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">{liveVrsCount} en direct</span>
                </div>

                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {vrsList.map((v) => {
                    const isSelected = selectedVrs?.id === v.id;
                    const hasCoords = Boolean(v.lastLatitude && v.lastLongitude);

                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVrs(v);
                          setSelectedPos(null);
                        }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-950/60 border-blue-600 text-white shadow-md'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white truncate max-w-[140px]">
                            {v.firstName} {v.lastName}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                              v.liveStatus === 'LIVE'
                                ? 'bg-emerald-950 text-emerald-300'
                                : hasCoords
                                ? 'bg-amber-950 text-amber-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {v.liveStatus === 'LIVE' ? 'LIVE' : hasCoords ? 'ACTIF' : 'NO GPS'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                          <span>{v.publicId}</span>
                          <span>{v.lastLocationSpeed || 0} km/h</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: HISTORIQUE DES TRAJETS (DATE & HEURE) - POUR SAN, SA, FSS        */}
      {/* ========================================================================= */}
      {viewMode === 'TRAJECTORY' && (
        <div className="space-y-6">
          {/* Controls Bar: VRS Selector, Date Picker & Quick Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 shrink-0">
                  <Route className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Vérification d'Itinéraire & Audit des Déplacements
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sélectionnez un vendeur et une date pour tracer son parcours complet, ses arrêts et ses ventes sur la carte.
                  </p>
                </div>
              </div>

              {/* Selector Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* VRS Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5">
                  <User className="w-4 h-4 text-indigo-400 shrink-0" />
                  <select
                    value={selectedVrsForHistory || ''}
                    onChange={(e) => setSelectedVrsForHistory(Number(e.target.value))}
                    className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                  >
                    {vrsList.map((v) => (
                      <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                        {v.firstName} {v.lastName} ({v.publicId})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Picker */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5">
                  <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                  <input
                    type="date"
                    value={historyDate}
                    onChange={(e) => setHistoryDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                  />
                </div>

                {/* Quick Date buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQuickDate('today')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      historyDate === new Date().toISOString().split('T')[0]
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Aujourd'hui
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate('yesterday')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
                  >
                    Hier
                  </button>
                </div>
              </div>
            </div>

            {/* Trajectory Summary Cards (when data loaded) */}
            {trajectoryData && trajectoryData.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-800/80">
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400 font-medium">Distance Parcourue</div>
                  <div className="text-base font-bold text-blue-400 mt-0.5">
                    {trajectoryData.summary.totalDistanceKm} km
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400 font-medium">Amplitude Horaire</div>
                  <div className="text-base font-bold text-indigo-400 mt-0.5">
                    {trajectoryData.summary.startTime || '--:--'} → {trajectoryData.summary.endTime || '--:--'}
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400 font-medium">Durée sur le Terrain</div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {Math.floor(trajectoryData.summary.totalDurationMinutes / 60)}h{' '}
                    {trajectoryData.summary.totalDurationMinutes % 60}m
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400 font-medium">Vitesse Moyenne</div>
                  <div className="text-base font-bold text-cyan-400 mt-0.5">
                    {trajectoryData.summary.averageSpeedKmh} km/h
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400 font-medium">Arrêts Enregistrés</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5">
                    {trajectoryData.summary.stopsCount} arrêts
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400 font-medium">Ventes Conclues</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">
                    {trajectoryData.associatedEvents.sales.length} ventes
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Map & Timeline Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trajectory Map */}
            <div className="lg:col-span-2 space-y-4">
              {loadingTrajectory ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl h-[520px] flex items-center justify-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="text-sm font-semibold">Chargement du trajet...</span>
                  </div>
                </div>
              ) : trajectoryData && trajectoryData.trajectory.length > 0 ? (
                <div className="space-y-3">
                  <GoogleMapView
                    center={currentCenter}
                    zoom={14}
                    markers={trajectoryMarkers}
                    pathCoordinates={trajectoryPathCoords}
                    pathColor="#4f46e5"
                    height="500px"
                    title={`Tracé GPS de ${trajectoryData.user.firstName} ${trajectoryData.user.lastName} (${historyDate})`}
                  />

                  {/* Interactive Playback Scrubber Slider */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span>Curseur Temporel (Défilement minute par minute)</span>
                      </span>
                      {activeWaypoint && (
                        <span className="text-indigo-400 font-mono font-bold">
                          Étape {playbackIndex + 1} / {trajectoryData.trajectory.length} • Heure:{' '}
                          {activeWaypoint.formattedTime}
                        </span>
                      )}
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={trajectoryData.trajectory.length - 1}
                      value={playbackIndex}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setPlaybackIndex(idx);
                        setActiveWaypoint(trajectoryData.trajectory[idx]);
                      }}
                      className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
                    />

                    {activeWaypoint && (
                      <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                        <span className="text-slate-300 font-medium">
                          📍 {activeWaypoint.actionContext}
                        </span>
                        <span>
                          Vitesse: <strong className="text-white">{activeWaypoint.speed || 0} km/h</strong> • Précision:{' '}
                          <strong className="text-white">±{activeWaypoint.accuracy || 5}m</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl h-[450px] flex items-center justify-center p-6 text-center">
                  <div className="max-w-md space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                      <MapPinOff className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-white">Aucun trajet pour cette date</h4>
                    <p className="text-xs text-slate-400">
                      Aucun point GPS enregistré pour ce vendeur le {historyDate}. Cliquez sur "Aujourd'hui" ou sélectionnez un autre vendeur.
                    </p>
                    <button
                      type="button"
                      onClick={() => setQuickDate('today')}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-all"
                    >
                      Voir le trajet d'aujourd'hui
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Chronological Timeline Details */}
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <span>Chronologie des Points ({trajectoryData?.trajectory.length || 0})</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Historique horodaté certifié par satellite
                    </p>
                  </div>
                </div>

                {trajectoryData && trajectoryData.trajectory.length > 0 ? (
                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {trajectoryData.trajectory.map((point, index) => {
                      const isSelected = activeWaypoint?.id === point.id;
                      const isStop = point.speed === 0;

                      return (
                        <div
                          key={point.id}
                          onClick={() => {
                            setActiveWaypoint(point);
                            setPlaybackIndex(index);
                          }}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-md'
                              : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  index === 0
                                    ? 'bg-emerald-600 text-white'
                                    : index === trajectoryData.trajectory.length - 1
                                    ? 'bg-blue-600 text-white'
                                    : isStop
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {index + 1}
                              </span>
                              <span className="font-mono font-bold text-white">{point.formattedTime}</span>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isStop
                                  ? 'bg-amber-950 text-amber-300'
                                  : 'bg-blue-950 text-blue-300'
                              }`}
                            >
                              {isStop ? 'ARRÊT' : `${point.speed || 0} km/h`}
                            </span>
                          </div>

                          <div className="mt-2 text-slate-300 font-medium">
                            {point.actionContext}
                          </div>

                          <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 font-mono">
                            <span>
                              {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                            </span>
                            <span>±{point.accuracy || 5}m</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Aucune chronologie disponible
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
