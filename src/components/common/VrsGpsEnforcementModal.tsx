import React, { useState, useEffect } from 'react';
import { useGps } from '../../context/GpsContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Camera,
  Navigation,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  Smartphone,
  MapPin,
  Sparkles,
} from 'lucide-react';

export const VrsGpsEnforcementModal: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const {
    coords,
    status,
    requestRealGps,
    activateEmergencyFallback,
    simulateGpsToggle,
  } = useGps();

  // Never open automatically on startup (remains accessible via GPS badge if needed)
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const [isCameraGranted, setIsCameraGranted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('6c_camera_permission_granted') === 'true';
    } catch {
      return false;
    }
  });

  const [cameraStatus, setCameraStatus] = useState<'IDLE' | 'REQUESTING' | 'GRANTED' | 'DENIED'>('IDLE');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);
  const [isAllLoading, setIsAllLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isGpsActive = (status === 'ACTIVE' && coords !== null) || (coords?.latitude !== undefined && coords?.latitude !== 0);

  // Listen to custom open events from navigation / badges / creation modal
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-permissions-modal', handleOpen);
    return () => window.removeEventListener('open-permissions-modal', handleOpen);
  }, []);

  // Pre-check camera permission if supported by browser
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        navigator.permissions.query({ name: 'camera' as PermissionName }).then((p) => {
          if (p.state === 'granted') {
            setIsCameraGranted(true);
            setCameraStatus('GRANTED');
            try {
              localStorage.setItem('6c_camera_permission_granted', 'true');
            } catch {}
          }
        }).catch(() => {});
      } catch {}
    }
  }, []);

  if (!isOpen || !isAuthenticated) {
    return null;
  }

  const handleClose = () => {
    setIsOpen(false);
    try {
      sessionStorage.setItem('6c_startup_permissions_authorized', 'true');
    } catch {}
  };

  const handleRequestCamera = async (): Promise<boolean> => {
    setCameraStatus('REQUESTING');
    setCameraError(null);
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setIsCameraGranted(true);
        setCameraStatus('GRANTED');
        return true;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      setIsCameraGranted(true);
      setCameraStatus('GRANTED');
      try {
        localStorage.setItem('6c_camera_permission_granted', 'true');
      } catch {}
      return true;
    } catch (err: any) {
      console.warn('Accès caméra:', err?.message || err);
      setCameraStatus('DENIED');
      setCameraError("Veuillez autoriser l'accès à la caméra pour récupérer son flux en direct dans le formulaire de création de PDV.");
      return false;
    }
  };

  const handleRequestGps = async (): Promise<boolean> => {
    setIsGpsLoading(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 10000,
            });
          });
          try {
            localStorage.setItem('6c_gps_permission_granted', 'true');
          } catch {}
          setIsGpsLoading(false);
          return true;
        } catch (geoErr) {
          console.warn('Geolocation direct failed, trying fallback:', geoErr);
        }
      }

      const real = await requestRealGps();
      if (real) {
        setIsGpsLoading(false);
        return true;
      }
      await activateEmergencyFallback();
      setIsGpsLoading(false);
      return true;
    } catch {
      await activateEmergencyFallback();
      setIsGpsLoading(false);
      return true;
    }
  };

  const handleAuthorizeAll = async () => {
    setIsAllLoading(true);
    setSuccessMessage(null);
    try {
      const camOk = await handleRequestCamera();
      const gpsOk = await handleRequestGps();

      if (camOk && gpsOk) {
        setSuccessMessage("Caméra et GPS autorisés avec succès ! Le flux vidéo et les coordonnées sont prêts pour la création de PDV.");
        try {
          sessionStorage.setItem('6c_startup_permissions_authorized', 'true');
        } catch {}
        setTimeout(() => {
          handleClose();
        }, 1200);
      } else {
        // Even if one had an issue, keep state updated
        try {
          sessionStorage.setItem('6c_startup_permissions_authorized', 'true');
        } catch {}
      }
    } finally {
      setIsAllLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-modal-backdrop">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-modal-content">
        {/* Decorative Top Accent Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />
        <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-12 -mt-12" />

        {/* Modal Header */}
        <div className="relative flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center relative shadow-inner">
              <Camera className="w-5 h-5 text-amber-400" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#15803D] text-white flex items-center justify-center border-2 border-slate-900">
                <Navigation className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Autorisations Requises au Démarrage</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                  Caméra & GPS
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Activez l'accès pour récupérer le flux de la caméra et la position GPS dans la création de PDV.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Fermer cette fenêtre"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {successMessage && (
            <div className="p-3.5 bg-emerald-950 border border-emerald-600 rounded-xl text-xs text-emerald-200 flex items-start gap-2.5 shadow-lg animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold">{successMessage}</div>
            </div>
          )}

          {/* User Profile Badge */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-300 truncate font-medium">
                <strong className="text-white font-bold">{user?.firstName} {user?.lastName}</strong>
                <span className="text-slate-400 ml-1">({user?.publicId})</span>
              </span>
            </div>
            <span className="shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {user?.role || 'UTILISATEUR'}
            </span>
          </div>

          {/* Explanatory note */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-white">Pourquoi cette étape au démarrage ?</span>
            <p className="mt-1 text-slate-400 text-[11px]">
              L'autorisation préalable permet à l'application d'afficher directement le flux vidéo en direct dans le formulaire de création de point de vente et d'enregistrer immédiatement la boutique sur Google Maps sans blocage.
            </p>
          </div>

          {/* Cards: Camera & GPS */}
          <div className="grid grid-cols-1 gap-3">
            {/* Card 1: Camera */}
            <div className={`p-4 rounded-2xl border transition ${
              isCameraGranted
                ? 'bg-emerald-950/30 border-emerald-800/60'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCameraGranted ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50' : 'bg-amber-950/50 text-amber-400 border border-amber-800/50'
                  }`}>
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Flux Caméra en direct</span>
                      {isCameraGranted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Autorisé</span>
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Permet d'ouvrir le viseur caméra en direct dans le formulaire d'enrôlement PDV pour photographier la façade.
                    </p>
                  </div>
                </div>

                {!isCameraGranted && (
                  <button
                    type="button"
                    disabled={cameraStatus === 'REQUESTING'}
                    onClick={handleRequestCamera}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {cameraStatus === 'REQUESTING' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : (
                      <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Activer</span>
                  </button>
                )}
              </div>
              {cameraError && (
                <div className="mt-2 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg p-2">
                  {cameraError}
                </div>
              )}
            </div>

            {/* Card 2: GPS */}
            <div className={`p-4 rounded-2xl border transition ${
              isGpsActive
                ? 'bg-emerald-950/30 border-emerald-800/60'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isGpsActive ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50' : 'bg-red-950/50 text-red-400 border border-red-800/50'
                  }`}>
                    <Navigation className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Géolocalisation GPS</span>
                      {isGpsActive ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Actif (±{Math.round(coords?.accuracy || 15)}m)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-950/60 text-red-300 font-bold border border-red-800">
                          Requis
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Enregistre automatiquement la position sur la carte Google Maps lors de la création d'un point de vente.
                    </p>
                  </div>
                </div>

                {!isGpsActive && (
                  <button
                    type="button"
                    disabled={isGpsLoading}
                    onClick={handleRequestGps}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isGpsLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>Activer</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-950/80 space-y-2.5">
          {/* Main Button: Authorize Both */}
          <button
            type="button"
            disabled={isAllLoading}
            onClick={handleAuthorizeAll}
            className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-[#15803D] hover:bg-[#166534] text-white font-black text-sm shadow-xl flex items-center justify-center gap-2.5 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer border border-emerald-500/30"
          >
            {isAllLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-white" />
                <span>Autorisation Caméra & GPS en cours...</span>
              </>
            ) : isCameraGranted && isGpsActive ? (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
                <span>Caméra et GPS configurés • Continuer</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 text-white" />
                <span>Autoriser la Caméra et le GPS</span>
              </>
            )}
          </button>

          {/* Secondary fallback buttons */}
          <div className="flex items-center justify-between gap-2 pt-1 text-xs">
            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-200 transition py-1 px-2 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              Continuer vers l'application
            </button>

            <button
              type="button"
              onClick={() => {
                simulateGpsToggle(true);
                setIsCameraGranted(true);
                try {
                  localStorage.setItem('6c_camera_permission_granted', 'true');
                  localStorage.setItem('6c_gps_permission_granted', 'true');
                } catch {}
                handleClose();
              }}
              className="text-slate-500 hover:text-emerald-400 transition text-[11px] underline cursor-pointer"
              title="Valider automatiquement pour les tests"
            >
              Mode Test (Auto-valider)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
