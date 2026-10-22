import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useGps } from '../../context/GpsContext.tsx';
import { api } from '../../services/api.ts';
import { Sector, PointOfSale } from '../../types/index.ts';
import { InteractivePosMap } from './InteractivePosMap.tsx';
import { getPosDraft, savePosDraft, deletePosDraft, PosDraftData } from '../../utils/posDraftDb.ts';
import { compressImageFile } from '../../utils/imageCompressor.ts';
import {
  X,
  Store,
  MapPin,
  Compass,
  AlertCircle,
  CheckCircle2,
  Phone,
  User,
  Building,
  Loader2,
  Camera,
  RotateCw,
  ImageIcon,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface NewPosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPosCreated: (createdPos?: PointOfSale) => void;
}

// ============================================================================
// 1. COMPOSANTS DE CHAMPS INDÉPENDANTS (React.memo - Performance frappe clavier)
// ============================================================================

interface PosInputFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  onChange: (val: string) => void;
}

const PosInputFieldComponent: React.FC<PosInputFieldProps> = ({
  label,
  value,
  placeholder,
  type = 'text',
  required = false,
  icon: Icon,
  onChange,
}) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalVal(newVal);
    onChange(newVal);
  };

  return (
    <div className="w-full min-w-0 box-border">
      <label className="block text-[14px] font-semibold text-slate-300 mb-1.5 truncate">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative w-full min-w-0 box-border">
        {Icon && (
          <Icon className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
        )}
        <input
          type={type}
          required={required}
          value={localVal}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full max-w-full min-w-0 h-12 min-h-[48px] box-border ${
            Icon ? 'pl-11' : 'pl-3.5'
          } pr-3.5 bg-slate-950 border border-slate-700 rounded-xl text-[16px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors duration-150`}
        />
      </div>
    </div>
  );
};
const PosInputField = React.memo(PosInputFieldComponent);

interface PosSelectFieldProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  placeholder?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  onChange: (val: string) => void;
}

const PosSelectFieldComponent: React.FC<PosSelectFieldProps> = ({
  label,
  value,
  options,
  placeholder,
  required = false,
  icon: Icon,
  onChange,
}) => {
  return (
    <div className="w-full min-w-0 box-border">
      <label className="block text-[14px] font-semibold text-slate-300 mb-1.5 truncate">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative w-full min-w-0 box-border">
        {Icon && (
          <Icon className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
        )}
        <select
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full max-w-full min-w-0 h-12 min-h-[48px] box-border ${
            Icon ? 'pl-11' : 'pl-3.5'
          } pr-8 bg-slate-950 border border-slate-700 rounded-xl text-[16px] text-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors duration-150 appearance-none`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
};
const PosSelectField = React.memo(PosSelectFieldComponent);

// ============================================================================
// 2. FLUX CAMÉRA PLEIN ÉCRAN DIRECT (getUserMedia, sans rechargement, 64px bouton)
// ============================================================================

interface LiveCameraFullscreenProps {
  onCapture: (compressedDataUrl: string) => void;
  onClose: () => void;
}

const LiveCameraFullscreenComponent: React.FC<LiveCameraFullscreenProps> = ({
  onCapture,
  onClose,
}) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorInfo, setErrorInfo] = useState<{ name: string; message: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<any>(null);

  const stopTracks = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
        videoRef.current.pause();
      } catch {}
    }
  }, []);

  const startStream = useCallback(
    async (targetFacing: 'environment' | 'user') => {
      stopTracks();
      setIsLoading(true);
      setErrorInfo(null);

      // Délai maximal strict de 8s pour éviter tout chargement infini
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setErrorInfo({
          name: 'TimeoutError',
          message:
            "Le délai d'attente pour obtenir le flux vidéo a expiré (8 secondes). Autorisez l'accès à la caméra ou utilisez l'appareil photo du téléphone.",
        });
        stopTracks();
      }, 8000);

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException('API getUserMedia non supportée', 'NotFoundError');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.onloadedmetadata = () => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setIsLoading(false);
            videoRef.current?.play().catch(() => {});
          };
        }
      } catch (err: any) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsLoading(false);
        stopTracks();

        const name = err?.name || 'SecurityError';
        let message = "Impossible d'accéder au flux vidéo direct.";

        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          message =
            "L'accès à la caméra a été refusé ou n'est pas autorisé dans votre navigateur. Autorisez la caméra dans les paramètres pour afficher le flux direct.";
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          message = 'Aucune caméra compatible n’a été détectée sur cet appareil.';
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          message = 'La caméra est déjà utilisée par une autre application ou est inaccessible.';
        } else if (name === 'SecurityError') {
          message =
            "L'accès à la caméra est bloqué par la politique de sécurité du conteneur (iframe).";
        }

        setErrorInfo({ name, message });
      }
    },
    [stopTracks]
  );

  useEffect(() => {
    startStream(facingMode);

    // Arrêt si changement d'onglet ou mise en arrière-plan
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTracks();
        onClose();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopTracks();
    };
  }, [facingMode, startStream, stopTracks, onClose]);

  const handleToggleFacing = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || isLoading) return;

    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 720;
    const maxDim = 1024;

    if (width > height) {
      if (width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');

    if (ctx) {
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);
      // JPEG qualité 0.7 (150-300 Ko)
      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      stopTracks();
      onCapture(compressed);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col justify-between overflow-hidden box-border">
      {/* Barre supérieure */}
      <div className="fixed top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-black/60 box-border">
        <span className="text-white text-[14px] font-semibold bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700">
          {facingMode === 'environment' ? 'Caméra arrière' : 'Caméra avant'}
        </span>
        <button
          type="button"
          onClick={() => {
            stopTracks();
            onClose();
          }}
          className="p-2.5 rounded-full bg-slate-800 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer"
          title="Fermer la caméra"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Zone vidéo */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden box-border">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 text-white p-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-[15px] font-medium">Initialisation du flux caméra...</p>
            <p className="text-[12px] text-slate-400">Délai d'autorisation maximal 8s</p>
          </div>
        )}

        {errorInfo && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-950 text-white text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <span className="inline-block px-2.5 py-0.5 rounded font-mono text-xs font-bold bg-red-900/60 text-red-300 border border-red-700 mb-1">
                {errorInfo.name}
              </span>
              <p className="text-[14px] text-slate-200 leading-relaxed">{errorInfo.message}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => startStream(facingMode)}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Réessayer</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopTracks();
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Repères de cadrage discrets */}
        {!isLoading && !errorInfo && (
          <div className="pointer-events-none absolute inset-6 border-2 border-white/20 rounded-2xl flex items-center justify-center">
            <span className="bg-black/60 text-white px-3 py-1 rounded-full text-xs font-medium">
              Cadrez la devanture du PDV
            </span>
          </div>
        )}
      </div>

      {/* Barre inférieure FIXE (ne dépasse jamais, y compris en paysage) */}
      <div className="fixed bottom-0 inset-x-0 z-20 flex items-center justify-around px-6 py-4 pb-6 bg-black/80 border-t border-slate-800 box-border">
        {/* Bouton Changer de caméra */}
        <button
          type="button"
          onClick={handleToggleFacing}
          disabled={isLoading || Boolean(errorInfo)}
          className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center transition active:scale-95 disabled:opacity-40 cursor-pointer"
          title="Basculer caméra avant/arrière"
        >
          <RotateCw className="w-5 h-5 text-amber-400" />
        </button>

        {/* Bouton de capture central : cercle max 64px */}
        <button
          type="button"
          onClick={handleCapture}
          disabled={isLoading || Boolean(errorInfo)}
          className="w-16 h-16 max-w-[64px] max-h-[64px] rounded-full border-4 border-white bg-amber-500 hover:bg-amber-400 active:scale-90 flex items-center justify-center shadow-lg transition-transform disabled:opacity-40 cursor-pointer"
          title="Prendre la photo"
        >
          <div className="w-12 h-12 rounded-full bg-white/30" />
        </button>

        {/* Bouton Annuler */}
        <button
          type="button"
          onClick={() => {
            stopTracks();
            onClose();
          }}
          className="px-4 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[14px] font-semibold min-h-[44px] flex items-center justify-center transition active:scale-95 cursor-pointer"
        >
          Annuler
        </button>
      </div>
    </div>
  );
};
const LiveCameraFullscreen = React.memo(LiveCameraFullscreenComponent);

// ============================================================================
// 3. SECTION PHOTO (3 modes, taille raisonnable, miniature 96px)
// ============================================================================

interface PosPhotoSectionProps {
  photo: string | null;
  onChange: (photo: string | null) => void;
}

const PosPhotoSectionComponent: React.FC<PosPhotoSectionProps> = ({ photo, onChange }) => {
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const nativeInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file?: File) => {
    if (!file) return;
    try {
      // Redimensionnement max 1024px et JPEG 0.7
      const compressed = await compressImageFile(file, 1024, 0.7);
      if (compressed) {
        onChange(compressed);
        setFallbackNotice(null);
      }
    } catch {
      alert("Impossible de charger l'image.");
    }
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    processFile(f);
    e.target.value = '';
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    processFile(f);
    e.target.value = '';
  };

  return (
    <div className="w-full min-w-0 box-border p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
      {/* Hidden inputs pour repli appareil photo natif et galerie */}
      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleGalleryChange}
      />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-[14px] font-semibold text-slate-300 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Photo du point de vente</span>
        </label>
        {photo ? (
          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-700/60 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Photo prête</span>
          </span>
        ) : (
          <span className="text-[12px] text-slate-400">Recommandé</span>
        )}
      </div>

      {fallbackNotice && (
        <p className="text-xs text-amber-300 bg-amber-950/50 p-2.5 rounded-lg border border-amber-800/60 leading-relaxed">
          {fallbackNotice}
        </p>
      )}

      {/* Aperçu miniature 96px */}
      {photo ? (
        <div className="flex items-center gap-3 p-2 bg-slate-900 border border-slate-800 rounded-xl box-border">
          <img
            src={photo}
            alt="Miniature PDV"
            className="w-24 h-24 min-w-[96px] min-h-[96px] max-w-[96px] max-h-[96px] rounded-xl object-cover border border-slate-700 shrink-0"
          />
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setIsLiveOpen(true)}
              className="h-11 min-h-[44px] px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[14px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reprendre</span>
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="h-11 min-h-[44px] px-3 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800 text-[14px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Supprimer</span>
            </button>
          </div>
        </div>
      ) : (
        /* Boutons 3 modes : côte-à-côte sur mobile, 44px de haut, texte 15px, icône 20px */
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 w-full box-border">
            {/* Mode 1 : Flux direct (principal) */}
            <button
              type="button"
              onClick={() => setIsLiveOpen(true)}
              className="h-11 min-h-[44px] w-full px-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[15px] flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer box-border"
            >
              <Camera className="w-5 h-5 shrink-0" />
              <span className="truncate">Prendre photo</span>
            </button>

            {/* Mode 3 : Galerie */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="h-11 min-h-[44px] w-full px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-[15px] flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer box-border"
            >
              <ImageIcon className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="truncate">Galerie</span>
            </button>
          </div>

          {/* Mode 2 : Repli Appareil photo du téléphone (bouton dédié sous la grille) */}
          <button
            type="button"
            onClick={() => nativeInputRef.current?.click()}
            className="w-full text-center py-1.5 text-[13px] text-slate-400 hover:text-slate-200 transition underline cursor-pointer"
          >
            Utiliser l'appareil photo du téléphone
          </button>
        </div>
      )}

      {/* Overlay flux caméra plein écran */}
      {isLiveOpen && (
        <LiveCameraFullscreen
          onCapture={(compressed) => {
            onChange(compressed);
            setIsLiveOpen(false);
          }}
          onClose={() => setIsLiveOpen(false)}
        />
      )}
    </div>
  );
};
const PosPhotoSection = React.memo(PosPhotoSectionComponent);

// ============================================================================
// 4. SECTION POSITION GPS (Colonne verticale sans chevauchement, Leaflet/Google)
// ============================================================================

interface PosGpsSectionProps {
  latitude: number;
  longitude: number;
  posName: string;
  onCoordsChange: (lat: number, lng: number) => void;
}

// Distance haversine en mètres pour ignorer les micro-variations de moins de 5 mètres
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Rayon terre en mètres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const PosGpsSectionComponent: React.FC<PosGpsSectionProps> = ({
  latitude,
  longitude,
  onCoordsChange,
}) => {
  // Chargement différé : la carte et la géolocalisation ne s'activent qu'au clic sur la section
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [accuracy, setAccuracy] = useState<number>(20);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Références pour limiter watchPosition : max 1 maj / sec et ignorer < 5m
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ lat: number; lng: number }>({ lat: latitude, lng: longitude });

  // Bouton "Actualiser ma position" (48 px, texte court)
  const handleActualiserPosition = useCallback(() => {
    setIsLocating(true);
    setGpsError(null);

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;
          const newAcc = Math.round(pos.coords.accuracy || 20);

          lastCoordsRef.current = { lat: newLat, lng: newLng };
          lastUpdateRef.current = Date.now();
          setAccuracy(newAcc);
          onCoordsChange(newLat, newLng);
          setIsLocating(false);
        },
        (err) => {
          console.warn('[GPS] Actualisation impossible:', err.message);
          setIsLocating(false);
          setGpsError('Position GPS inaccessible. Ajustez le repère sur la carte.');
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 3000,
        }
      );
    } else {
      setIsLocating(false);
      setGpsError('Géolocalisation indisponible sur ce terminal.');
    }
  }, [onCoordsChange]);

  // watchPosition limité (ignorer moins de 5 m, max 1 maj d'affichage par seconde, arrêt à la fermeture)
  useEffect(() => {
    if (!isExpanded) {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const now = Date.now();
            const newLat = pos.coords.latitude;
            const newLng = pos.coords.longitude;
            const newAcc = Math.round(pos.coords.accuracy || 20);

            // 1. Limite : une mise à jour d'affichage par seconde
            if (now - lastUpdateRef.current < 1000) {
              return;
            }

            // 2. Limite : ignorer si déplacement de moins de 5 mètres
            const dist = calculateDistanceMeters(
              lastCoordsRef.current.lat,
              lastCoordsRef.current.lng,
              newLat,
              newLng
            );
            if (dist < 5 && lastUpdateRef.current > 0) {
              return;
            }

            lastUpdateRef.current = now;
            lastCoordsRef.current = { lat: newLat, lng: newLng };
            setAccuracy(newAcc);
            onCoordsChange(newLat, newLng);
          },
          (err) => {
            console.warn('[GPS watchPosition]:', err.message);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 2000,
            timeout: 10000,
          }
        );
        watchIdRef.current = id;
      } catch {}
    }

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isExpanded, onCoordsChange]);

  const handleToggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    // Première acquisition GPS uniquement à l'ouverture de la section
    if (next && (!latitude || latitude === 12.6392)) {
      handleActualiserPosition();
    }
  };

  return (
    <div className="w-full min-w-0 box-border p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
      {/* En-tête de la section Position (chargement différé) */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 text-left cursor-pointer min-h-[44px] flex-1 py-1"
        >
          <MapPin className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-[14px] font-semibold text-slate-300">
            Position géographique
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {!isExpanded && (
          <button
            type="button"
            onClick={handleToggle}
            className="text-xs text-amber-400 hover:underline cursor-pointer py-2 px-1"
          >
            Afficher la carte
          </button>
        )}
      </div>

      {/* Contenu affiché uniquement à l'ouverture de la section Position, en colonne verticale simple, sans chevauchement */}
      {isExpanded && (
        <div className="flex flex-col space-y-3 pt-2 border-t border-slate-800 box-border">
          {/* Notification erreur GPS temporaire (texte court) */}
          {gpsError && (
            <p className="text-xs text-amber-300 bg-amber-950/50 p-2.5 rounded-xl border border-amber-800/60 break-words">
              {gpsError}
            </p>
          )}

          {/* a) Bouton "Actualiser ma position" (48 px, texte court) */}
          <button
            type="button"
            onClick={handleActualiserPosition}
            disabled={isLocating}
            className="h-12 min-h-[48px] w-full px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[15px] flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer box-border"
          >
            <Compass className={`w-5 h-5 shrink-0 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Actualisation...' : 'Actualiser ma position'}</span>
          </button>

          {/* b) Carte interactive (Google Maps JS API si clé, sinon Leaflet + OSM sans clé)
                 Hauteur 320 px mobile, 400 px tablette, 440 px PC, largeur 100%, rayon 16 px */}
          <div className="w-full box-border">
            <InteractivePosMap
              latitude={latitude}
              longitude={longitude}
              onCoordsChange={onCoordsChange}
            />
          </div>

          {/* c) Sous la carte, bloc d'information en flux normal (pas superposé) :
                 "Coordonnées : 12.68871, -7.93841" et "Précision : ±20 m", sur deux lignes, texte qui peut passer à la ligne, jamais coupé */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1 text-slate-300 text-xs sm:text-[13px] leading-relaxed break-words box-border">
            <div className="break-words">
              <span className="text-slate-400">Coordonnées : </span>
              <span className="font-mono text-slate-100 font-medium">
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </span>
            </div>
            <div className="break-words">
              <span className="text-slate-400">Précision : </span>
              <span className="font-mono text-slate-100 font-medium">
                ±{accuracy ? Math.round(accuracy) : 20} m
              </span>
            </div>
          </div>

          {/* d) Texte d'aide court */}
          <p className="text-[12px] sm:text-[13px] text-slate-400 break-words">
            Touchez la carte pour placer le repère.
          </p>
        </div>
      )}
    </div>
  );
};
const PosGpsSection = React.memo(PosGpsSectionComponent);

// ============================================================================
// 5. COMPOSANT PRINCIPAL NewPosModal
// ============================================================================

export const NewPosModal: React.FC<NewPosModalProps> = ({ isOpen, onClose, onPosCreated }) => {
  const { user } = useAuth();

  // États du formulaire
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('+223 ');
  const [storeType, setStoreType] = useState('Épicerie / Boutique');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [sectors, setSectors] = useState<Sector[]>([]);

  const [latitude, setLatitude] = useState(12.6392);
  const [longitude, setLongitude] = useState(-8.0029);
  const [photo, setPhoto] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);

  // Debounce ref pour IndexedDB (500ms)
  const debounceTimerRef = useRef<any>(null);

  // 1. Restauration du brouillon depuis IndexedDB
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    getPosDraft().then((draft) => {
      if (!isMounted || !draft) return;

      const hasContent = Boolean(
        draft.name || draft.ownerName || (draft.phone && draft.phone !== '+223 ') || draft.address || draft.photo
      );

      if (hasContent) {
        if (draft.name) setName(draft.name);
        if (draft.ownerName) setOwnerName(draft.ownerName);
        if (draft.phone) setPhone(draft.phone);
        if (draft.storeType) setStoreType(draft.storeType);
        if (draft.address) setAddress(draft.address);
        if (draft.neighborhood) setNeighborhood(draft.neighborhood);
        if (draft.sectorId) setSectorId(draft.sectorId);
        if (draft.latitude) setLatitude(draft.latitude);
        if (draft.longitude) setLongitude(draft.longitude);
        if (draft.photo) setPhoto(draft.photo);

        setRestoredNotice('Brouillon restauré');
        setTimeout(() => setRestoredNotice(null), 4000);
      }
    });

    // Chargement des secteurs
    if (user?.dropPointId) {
      api
        .getSectors(user.dropPointId)
        .then((res) => {
          if (isMounted) {
            setSectors(res.sectors);
            if (res.sectors.length > 0 && !sectorId) {
              setSectorId(String(res.sectors[0].id));
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  // 2. Sauvegarde débauncée dans IndexedDB (500 ms)
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const payload: PosDraftData = {
        name,
        ownerName,
        phone,
        storeType,
        address,
        neighborhood,
        sectorId,
        latitude,
        longitude,
        photo,
      };
      savePosDraft(payload).catch(() => {});
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isOpen, name, ownerName, phone, storeType, address, neighborhood, sectorId, latitude, longitude, photo]);

  // Callbacks stables pour éviter les re-rendus
  const handleNameChange = useCallback((v: string) => setName(v), []);
  const handleOwnerChange = useCallback((v: string) => setOwnerName(v), []);
  const handlePhoneChange = useCallback((v: string) => setPhone(v), []);
  const handleStoreTypeChange = useCallback((v: string) => setStoreType(v), []);
  const handleAddressChange = useCallback((v: string) => setAddress(v), []);
  const handleNeighborhoodChange = useCallback((v: string) => setNeighborhood(v), []);
  const handleSectorChange = useCallback((v: string) => setSectorId(v), []);
  const handlePhotoChange = useCallback((v: string | null) => setPhoto(v), []);
  const handleCoordsChange = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  // Annulation avec confirmation si données saisies
  const handleCancel = () => {
    const hasData = Boolean(
      name.trim() || ownerName.trim() || (phone.trim() && phone !== '+223 ') || address.trim() || photo
    );

    if (hasData) {
      const ok = window.confirm(
        'Voulez-vous vraiment annuler ? Les informations saisies seront effacées de votre brouillon.'
      );
      if (!ok) return;
    }

    deletePosDraft();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !ownerName.trim() || !phone.trim() || !address.trim()) {
      setError('Veuillez remplir tous les champs obligatoires (Nom, Propriétaire, Téléphone, Adresse).');
      return;
    }

    setLoading(true);

    try {
      if (user?.role === 'VRS') {
        const reqRes = await api.createPosRequest({
          name: name.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          storeType: storeType.trim(),
          address: address.trim(),
          neighborhood: neighborhood.trim(),
          sectorId: sectorId ? parseInt(sectorId, 10) : undefined,
          latitude: latitude || 12.6392,
          longitude: longitude || -8.0029,
          photo: photo || null,
        });
        onPosCreated(reqRes.request);
      } else {
        const res = await api.createPointOfSale({
          name: name.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          neighborhood: neighborhood.trim(),
          sectorId: sectorId ? parseInt(sectorId, 10) : undefined,
          latitude: latitude || 12.6392,
          longitude: longitude || -8.0029,
          photo: photo || null,
          status: 'EN ATTENTE',
        });
        onPosCreated(res.pos);
      }

      // Suppression du brouillon après envoi réussi
      await deletePosDraft();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création du point de vente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const sectorOptions = sectors.map((s) => ({
    label: `${s.name} (${s.code})`,
    value: String(s.id),
  }));

  const storeTypeOptions = [
    { label: 'Épicerie / Boutique', value: 'Épicerie / Boutique' },
    { label: 'Alimentation Générale', value: 'Alimentation Générale' },
    { label: 'Supérette Moderne', value: 'Supérette Moderne' },
    { label: 'Demi-Grossiste', value: 'Demi-Grossiste' },
    { label: 'Kiosque de rue', value: 'Kiosque de rue' },
    { label: 'Autre commerce', value: 'Autre commerce' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 overflow-x-hidden overflow-y-auto box-border animate-modal-backdrop">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl h-auto max-h-[96vh] sm:max-h-[90vh] my-0 sm:my-auto bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-md overflow-x-hidden flex flex-col box-border animate-sheet-up sm:animate-modal-content"
      >
        {/* En-tête modal */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80 box-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] font-bold text-white">Nouveau PDV</h2>
              <p className="text-[12px] sm:text-[13px] text-slate-400 leading-snug line-clamp-2 break-words">
                Votre demande sera validée par le SAN
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors duration-150 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer shrink-0"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps du formulaire compact (1 col mobile, 2 col tablette, champs 48px, padding bas pour bouton fixe) */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-x-hidden min-h-0 box-border">
          <div className="overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-4 flex-1 pb-24 box-border">
            {restoredNotice && (
              <div className="p-3 bg-blue-950/70 border border-blue-800 rounded-xl text-xs text-blue-300 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{restoredNotice}</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Grille : 1 colonne sur mobile, 2 colonnes sur tablette, gap de 16px */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 box-border">
              <PosInputField
                label="Nom de la Boutique / Échoppe"
                value={name}
                required
                placeholder="ex. Alimentation Bon Samaritain"
                icon={Store}
                onChange={handleNameChange}
              />
              <PosInputField
                label="Nom du Propriétaire / Gérant"
                value={ownerName}
                required
                placeholder="ex. Mamadou Diarra"
                icon={User}
                onChange={handleOwnerChange}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 box-border">
              <PosInputField
                label="Numéro de Téléphone"
                value={phone}
                required
                type="tel"
                placeholder="+223 70 00 00 00"
                icon={Phone}
                onChange={handlePhoneChange}
              />
              <PosSelectField
                label="Type de commerce"
                value={storeType}
                required
                options={storeTypeOptions}
                icon={Store}
                onChange={handleStoreTypeChange}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 box-border">
              <PosSelectField
                label="Secteur / Zone Commerciale"
                value={sectorId}
                placeholder="Sélectionner un secteur (optionnel)"
                options={sectorOptions}
                icon={Building}
                onChange={handleSectorChange}
              />
              <PosInputField
                label="Quartier"
                value={neighborhood}
                placeholder="ex. Dakan Marché"
                onChange={handleNeighborhoodChange}
              />
            </div>

            <PosInputField
              label="Adresse exacte / Repère"
              value={address}
              required
              placeholder="ex. Face pharmacie, angle rue 12"
              icon={MapPin}
              onChange={handleAddressChange}
            />

            {/* Photo 3 modes (44px boutons, miniature 96px, 1024px JPEG 0.7) */}
            <PosPhotoSection photo={photo} onChange={handlePhotoChange} />

            {/* Position GPS avec chargement différé de la carte au clic */}
            <PosGpsSection
              latitude={latitude}
              longitude={longitude}
              posName={name}
              onCoordsChange={handleCoordsChange}
            />
          </div>

          {/* Bouton "Envoyer la demande" FIXE en bas de l'écran, pleine largeur, 48 px */}
          <div className="fixed bottom-0 inset-x-0 sm:absolute sm:bottom-0 sm:inset-x-0 p-3 sm:p-4 bg-slate-950 border-t border-slate-800 z-30 box-border flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="hidden sm:inline-flex px-4 h-12 min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[15px] font-semibold items-center justify-center transition-colors duration-150 cursor-pointer shrink-0"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 min-h-[48px] rounded-xl bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-white text-[16px] font-bold transition-colors duration-150 shadow-md disabled:opacity-50 flex items-center justify-center cursor-pointer box-border"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                'Envoyer la demande'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewPosModal;
