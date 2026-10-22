import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RotateCw,
  X,
  AlertCircle,
  Loader2,
  Trash2,
  Upload,
  CheckCircle2,
  RefreshCw,
  ImageIcon,
  Maximize2,
  Minimize2,
  ShieldAlert,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { compressImageFile, compressDataUrl } from '../../utils/imageCompressor.ts';

export interface CameraCaptureProps {
  /** Valeur actuelle de la photo (data URL base64 ou URL distante) */
  value?: string | null;
  /** Callback déclenché à chaque modification de la photo (capture, sélection, suppression) */
  onChange?: (photoDataUrl: string | null) => void;
  /** Callback direct déclenché à la capture */
  onCapture?: (photoDataUrl: string) => void;
  /** Libellé affiché au-dessus du composant */
  label?: string;
  /** Texte explicatif d'aide */
  helperText?: string;
  /** Texte affiché dans le viseur de cadrage */
  framingHint?: string;
  /** Désactiver le composant */
  disabled?: boolean;
  /** Dimension maximale en pixels lors de la compression (défaut: 1280) */
  maxDimension?: number;
  /** Qualité de compression JPEG de 0 à 1 (défaut: 0.82) */
  compressionQuality?: number;
  /** Caméra par défaut: 'environment' (arrière) ou 'user' (avant) */
  defaultFacingMode?: 'environment' | 'user';
  /** Classe CSS additionnelle pour le conteneur */
  className?: string;
  /** Afficher le bouton de sélection depuis la galerie (défaut: true) */
  showGalleryOption?: boolean;
  /** Ratio d'aspect de la zone vidéo/aperçu */
  aspectRatio?: '4/3' | '16/9' | 'square';
  /** Callback optionnel lors de l'annulation ou fermeture de la caméra */
  onCancel?: () => void;
}

export type PermissionStateQuery = 'granted' | 'prompt' | 'denied' | 'unsupported';

export interface PreFlightDiagnostic {
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  permissionState: PermissionStateQuery;
  canAttemptStream: boolean;
  blockingReason?: 'INSECURE_CONTEXT' | 'UNSUPPORTED_BROWSER';
}

export interface CameraErrorInfo {
  type:
    | 'SECURE_CONTEXT'
    | 'UNSUPPORTED'
    | 'PERMISSION_BLOCKED'
    | 'IFRAME_RESTRICTED'
    | 'NOT_FOUND'
    | 'NOT_READABLE'
    | 'GENERIC';
  errorName: string;
  title: string;
  message: string;
  canRetry: boolean;
  showNativeFallback: boolean;
  showGalleryFallback: boolean;
}

/**
 * Appel getUserMedia protégé par un timeout strict (défaut 8s)
 * Empêche tout chargement infini si le navigateur ou conteneur ne répond pas
 */
const getUserMediaWithTimeout = (
  constraints: MediaStreamConstraints,
  timeoutMs = 8000
): Promise<MediaStream> => {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        const err = new Error("Le délai d'attente pour obtenir le flux caméra a expiré (8 secondes).");
        err.name = 'NotAllowedError';
        reject(err);
      }
    }, timeoutMs);

    if (!navigator.mediaDevices?.getUserMedia) {
      finished = true;
      clearTimeout(timer);
      const err = new Error("L'API getUserMedia n'est pas disponible.");
      err.name = 'NotFoundError';
      reject(err);
      return;
    }

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(stream);
        } else {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
        }
      })
      .catch((err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
};

const CameraCaptureComponent: React.FC<CameraCaptureProps> = ({
  value = null,
  onChange,
  onCapture,
  label = 'Photo du point de vente',
  helperText,
  framingHint = 'Cadrez la devanture du point de vente',
  disabled = false,
  maxDimension = 1280,
  compressionQuality = 0.82,
  defaultFacingMode = 'environment',
  className = '',
  showGalleryOption = true,
  aspectRatio = '4/3',
  onCancel,
}) => {
  // États du flux vidéo en direct
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(defaultFacingMode);
  const [canSwitchCamera, setCanSwitchCamera] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Diagnostic granulaire des erreurs
  const [cameraError, setCameraError] = useState<CameraErrorInfo | null>(null);

  // Retours utilisateur et état de traitement
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  // Références médias et inputs natifs
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  /**
   * Arrêt strict de toutes les pistes du flux média (MediaStreamTrack.stop)
   * et détachement de la source vidéo
   */
  const stopLiveStream = useCallback(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Erreur lors de l’arrêt de la piste caméra:', e);
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
        videoRef.current.pause();
      } catch {}
    }

    setIsLiveActive(false);
    setIsInitializing(false);
    setIsFullscreen(false);
  }, []);

  // Nettoyage impératif lors du démontage du composant
  useEffect(() => {
    return () => {
      stopLiveStream();
    };
  }, [stopLiveStream]);

  // Nettoyage en cas de masquage de l'onglet ou mise en arrière-plan
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isLiveActive) {
        stopLiveStream();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLiveActive, stopLiveStream]);

  /**
   * Callback ref pour attacher immédiatement le flux média dès que l'élément <video>
   * est monté dans le DOM
   */
  const setVideoRef = useCallback((videoElement: HTMLVideoElement | null) => {
    videoRef.current = videoElement;
    if (videoElement && streamRef.current) {
      videoElement.srcObject = streamRef.current;
      videoElement.muted = true;
      videoElement.defaultMuted = true;
      videoElement.playsInline = true;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement
        .play()
        .catch((err) => console.warn('Démarrage automatique vidéo différé:', err));
    }
  }, []);

  /**
   * Détection des caméras disponibles via enumerateDevices
   */
  const detectAvailableCameras = useCallback(async (): Promise<number> => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setCanSwitchCamera(videoDevices.length > 1);
        return videoDevices.length;
      } catch {
        setCanSwitchCamera(true);
        return 1;
      }
    }
    return 0;
  }, []);

  /**
   * ÉTAPE 1 : DIAGNOSTIC PRÉALABLE GRANULAIRE
   * Analyse window.isSecureContext, navigator.mediaDevices, getUserMedia et navigator.permissions.query
   * Isole formellement l'état 'prompt' pour ne jamais le considérer comme un refus.
   */
  const performPreFlightDiagnostic = async (): Promise<PreFlightDiagnostic> => {
    const isSecureContext = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false;
    const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices);
    const hasGetUserMedia =
      hasMediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

    let permissionState: PermissionStateQuery = 'unsupported';

    // Interrogation de navigator.permissions.query pour la caméra si supporté
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const permStatus = await navigator.permissions.query({ name: 'camera' as any });
        permissionState = permStatus.state as PermissionStateQuery;
      } catch {
        // Safari iOS et certains navigateurs mobiles ne supportent pas query('camera')
        permissionState = 'unsupported';
      }
    }

    let canAttemptStream = true;
    let blockingReason: 'INSECURE_CONTEXT' | 'UNSUPPORTED_BROWSER' | undefined;

    if (!isSecureContext) {
      canAttemptStream = false;
      blockingReason = 'INSECURE_CONTEXT';
    } else if (!hasGetUserMedia) {
      canAttemptStream = false;
      blockingReason = 'UNSUPPORTED_BROWSER';
    }

    return {
      isSecureContext,
      hasMediaDevices,
      hasGetUserMedia,
      permissionState,
      canAttemptStream,
      blockingReason,
    };
  };

  /**
   * ÉTAPE 2 : ACQUISITION EN CASCADE RÉSISTANTE AUX ERREURS DE CONTRAINTES VIDÉO
   * Tente successivement :
   * 1. facingMode: { ideal: targetFacing } (avec résolution idéale et timeout)
   * 2. facingMode: { ideal: targetFacing } (sans contrainte de résolution)
   * 3. video: true (repli universel pour ne jamais échouer si une seule caméra est présente)
   */
  const acquireStreamWithCascadingConstraints = async (
    targetFacing: 'environment' | 'user'
  ): Promise<MediaStream> => {
    let lastError: any = null;

    // Tentative 1 : Contrainte souple { ideal: targetFacing } avec dimensions idéales (timeout 7s)
    try {
      console.log(`[CameraCapture] Tentative 1 avec { ideal: "${targetFacing}" } et résolution idéale 1280x720`);
      return await getUserMediaWithTimeout({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      }, 7000);
    } catch (err1: any) {
      lastError = err1;
      console.warn('[CameraCapture] Tentative 1 échouée:', err1?.name, err1?.message);

      // Si erreur d'autorisation, restriction ou capteur introuvable, inutile d'insister avec d'autres contraintes
      if (
        err1?.name === 'NotAllowedError' ||
        err1?.name === 'PermissionDeniedError' ||
        err1?.name === 'SecurityError' ||
        err1?.name === 'NotFoundError' ||
        err1?.name === 'DevicesNotFoundError'
      ) {
        throw err1;
      }

      // Si erreur de contraintes (OverconstrainedError), on bascule sur la tentative 2 sans contrainte de taille
      const isConstraintErr =
        err1?.name === 'OverconstrainedError' ||
        err1?.name === 'ConstraintNotSatisfiedError';

      if (isConstraintErr) {
        try {
          console.log(`[CameraCapture] Tentative 2 avec { ideal: "${targetFacing}" } sans contrainte de taille`);
          return await getUserMediaWithTimeout({
            video: {
              facingMode: { ideal: targetFacing },
            },
            audio: false,
          }, 5000);
        } catch (err2: any) {
          lastError = err2;
          console.warn('[CameraCapture] Tentative 2 échouée:', err2?.name, err2?.message);
        }
      }
    }

    // Tentative 3 : Repli universel avec video: true
    try {
      console.log('[CameraCapture] Tentative 3 de repli avec { video: true }');
      return await getUserMediaWithTimeout({
        video: true,
        audio: false,
      }, 5000);
    } catch (err3: any) {
      console.warn('[CameraCapture] Tentative 3 échouée:', err3?.name, err3?.message);
      throw lastError || err3;
    }
  };

  /**
   * DÉMARRAGE DU FLUX CAMÉRA AVEC DIAGNOSTIC COMPLET
   * Déclenché UNIQUEMENT sur clic volontaire de l'utilisateur
   */
  const startCameraStream = async (targetFacing: 'environment' | 'user' = facingMode) => {
    // Réinitialisation préalable
    setCameraError(null);
    setFeedbackNotice(null);
    stopLiveStream();

    // 1. Exécution du pré-diagnostic granulaire
    const diag = await performPreFlightDiagnostic();

    console.group('📷 Camera diagnostic:');
    console.log(`isSecureContext: ${diag.isSecureContext}`);
    console.log(`mediaDevices: ${diag.hasMediaDevices ? 'available' : 'unavailable'}`);
    console.log(`getUserMedia: ${diag.hasGetUserMedia ? 'available' : 'unavailable'}`);
    console.log(`permission: ${diag.permissionState}`);
    console.groupEnd();

    // Vérification des blocages préalables
    if (!diag.canAttemptStream) {
      if (diag.blockingReason === 'INSECURE_CONTEXT') {
        setCameraError({
          type: 'SECURE_CONTEXT',
          errorName: 'SecurityError',
          title: 'Connexion sécurisée requise (HTTPS)',
          message:
            'L’accès direct à la caméra via le navigateur nécessite une connexion sécurisée (HTTPS ou localhost). Veuillez utiliser l’appareil photo natif ou choisir une image depuis votre appareil.',
          canRetry: false,
          showNativeFallback: true,
          showGalleryFallback: true,
        });
        return;
      }

      if (diag.blockingReason === 'UNSUPPORTED_BROWSER') {
        setCameraError({
          type: 'UNSUPPORTED',
          errorName: 'NotFoundError',
          title: 'Navigateur non compatible',
          message:
            'Votre navigateur ou conteneur ne prend pas en charge l’API getUserMedia. Vous pouvez utiliser l’appareil photo natif de votre terminal ou sélectionner un fichier.',
          canRetry: false,
          showNativeFallback: true,
          showGalleryFallback: true,
        });
        return;
      }
    }

    // Affichage immédiat de l'indicateur d'initialisation (avec timeout pour empêcher tout chargement infini)
    setIsInitializing(true);

    try {
      // 2. Acquisition du flux en cascade ({ ideal: targetFacing } -> video: true)
      const mediaStream = await acquireStreamWithCascadingConstraints(targetFacing);

      // 3. Succès : enregistrement du flux et affichage immédiat
      streamRef.current = mediaStream;
      setIsLiveActive(true);
      setIsInitializing(false);
      setCameraError(null);
      setFacingMode(targetFacing);

      // Connexion directe du flux à l'élément <video>
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.play().catch((e) => console.warn('Démarrage flux vidéo différé:', e));
      }

      const devicesCount = await detectAvailableCameras();
      console.log(`[CameraCapture] Flux vidéo démarré avec succès. Périphériques vidéo détectés: ${devicesCount}`);
    } catch (err: any) {
      stopLiveStream();
      setIsInitializing(false);

      const errName = err?.name || (err instanceof DOMException ? err.name : 'SecurityError');
      const errMsg = String(err?.message || '');

      console.group('❌ Camera error details:');
      console.log(`error.name: ${errName}`);
      console.log(`error.message: ${errMsg}`);
      console.groupEnd();

      // 4. DIAGNOSTIC PRÉCIS POST-EXÉCUTION AVEC NOMS EXACTS DE L'ERREUR
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        const lowerMsg = errMsg.toLowerCase();
        // Cas particulier : iframe sandbox ou permissions policy restreignant le conteneur
        if (
          lowerMsg.includes('platform in the current context') ||
          lowerMsg.includes('user agent or the platform') ||
          lowerMsg.includes('permissions policy')
        ) {
          setCameraError({
            type: 'IFRAME_RESTRICTED',
            errorName: 'NotAllowedError',
            title: 'Accès caméra restreint par l’environnement',
            message:
              'L’accès direct au flux vidéo est restreint par les permissions du conteneur (iframe). Vous pouvez utiliser directement l’appareil photo natif pour capturer la devanture du PDV.',
            canRetry: true,
            showNativeFallback: true,
            showGalleryFallback: true,
          });
        } else {
          // Refus réel par l'utilisateur ou le navigateur
          setCameraError({
            type: 'PERMISSION_BLOCKED',
            errorName: 'NotAllowedError',
            title: 'Accès caméra non autorisé',
            message:
              'L’accès à la caméra a été refusé ou n’a pas été autorisé dans le navigateur. Veuillez autoriser la caméra dans les paramètres de votre navigateur, puis réessayez.',
            canRetry: true,
            showNativeFallback: true,
            showGalleryFallback: true,
          });
        }
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError({
          type: 'NOT_FOUND',
          errorName: 'NotFoundError',
          title: 'Aucune caméra compatible',
          message: 'Aucune caméra vidéo compatible n’a été détectée sur votre appareil.',
          canRetry: false,
          showNativeFallback: false,
          showGalleryFallback: true,
        });
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setCameraError({
          type: 'NOT_READABLE',
          errorName: 'NotReadableError',
          title: 'Caméra déjà utilisée ou inaccessible',
          message:
            'La caméra est actuellement verrouillée ou utilisée par une autre application. Fermez cette application puis réessayez.',
          canRetry: true,
          showNativeFallback: true,
          showGalleryFallback: true,
        });
      } else if (errName === 'SecurityError') {
        setCameraError({
          type: 'IFRAME_RESTRICTED',
          errorName: 'SecurityError',
          title: 'Restriction de sécurité',
          message:
            'L’accès à la caméra est bloqué par la politique de sécurité du navigateur ou du conteneur (permissions requises).',
          canRetry: true,
          showNativeFallback: true,
          showGalleryFallback: true,
        });
      } else {
        setCameraError({
          type: 'GENERIC',
          errorName: errName || 'ErreurInconnue',
          title: 'Erreur d’accès caméra',
          message:
            errMsg ||
            'La tentative d’accès à la caméra a été interrompue. Veuillez réinitialiser ou utiliser le repli photo ci-dessous.',
          canRetry: true,
          showNativeFallback: true,
          showGalleryFallback: true,
        });
      }
    }
  };

  /**
   * Bascule entre caméra avant et arrière
   */
  const handleToggleFacingMode = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCameraStream(nextFacing);
  };

  /**
   * Capture de la photo depuis le flux vidéo
   */
  const handleCaptureFromStream = async () => {
    if (!videoRef.current || isCapturing) return;

    setIsCapturing(true);
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 250);

    try {
      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 2D context indisponible');
      }

      // Effet miroir si caméra avant
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, width, height);

      // Arrêt strict et immédiat de toutes les pistes matérielles
      stopLiveStream();

      // Compression optimisée pour enregistrement en base
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const optimized = await compressDataUrl(rawDataUrl, maxDimension, compressionQuality);
      const finalResult = optimized || rawDataUrl;

      if (onChange) onChange(finalResult);
      if (onCapture) onCapture(finalResult);

      setFeedbackNotice('Photo capturée avec succès ✓');
      setTimeout(() => setFeedbackNotice(null), 5000);
    } catch (err) {
      console.warn('Erreur lors de la capture canvas:', err);
      stopLiveStream();
      triggerNativeCameraFallback();
    } finally {
      setIsCapturing(false);
    }
  };

  /**
   * Fallback appareil photo natif (<input capture="environment">)
   */
  const triggerNativeCameraFallback = () => {
    stopLiveStream();
    if (nativeCameraInputRef.current) {
      nativeCameraInputRef.current.click();
    }
  };

  /**
   * Sélecteur de galerie (<input type="file">)
   */
  const triggerGalleryPicker = () => {
    stopLiveStream();
    if (galleryInputRef.current) {
      galleryInputRef.current.click();
    }
  };

  /**
   * Traitement d'un fichier sélectionné (appareil photo natif ou galerie)
   */
  const processSelectedFile = async (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide (JPEG, PNG, WebP).');
      return;
    }

    setIsProcessingFile(true);
    setCameraError(null);

    try {
      const compressed = await compressImageFile(file, maxDimension, compressionQuality);
      if (compressed) {
        if (onChange) onChange(compressed);
        if (onCapture) onCapture(compressed);
        setFeedbackNotice('Photo enregistrée dans le formulaire ✓');
        setTimeout(() => setFeedbackNotice(null), 5000);
      }
    } catch (err) {
      console.warn('Erreur lors de la compression de la photo importée:', err);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleNativeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processSelectedFile(file);
    e.target.value = '';
  };

  const handleGalleryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processSelectedFile(file);
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    if (onChange) onChange(null);
    setFeedbackNotice(null);
  };

  const handleCancelLive = () => {
    stopLiveStream();
    if (onCancel) onCancel();
  };

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === '16/9'
      ? 'aspect-16/9'
      : 'aspect-4/3 sm:aspect-16/10';

  return (
    <div className={`p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3 ${className}`}>
      {/* Inputs cachés pour Fallback Appareil Photo Natif et Galerie */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleGalleryFileChange}
      />

      {/* En-tête du composant */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-slate-200">{label}</span>
        </div>

        {value ? (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700 flex items-center gap-1 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Photo prête dans le formulaire ✓</span>
          </span>
        ) : isLiveActive ? (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-400 border border-amber-700 flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Flux caméra en direct</span>
          </span>
        ) : (
          <span className="text-[10px] text-amber-400 font-medium">Recommandé</span>
        )}
      </div>

      {helperText && <p className="text-[11px] text-slate-400 leading-relaxed">{helperText}</p>}

      {/* Notification de succès */}
      {feedbackNotice && (
        <div className="p-2.5 bg-emerald-950/80 border border-emerald-700 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* ÉTAT INITIAL D'ATTENTE OU INITIALISATION (L'état 'prompt' n'est JAMAIS un refus) */}
      {isInitializing && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/60 flex items-center gap-3 text-xs text-amber-200 animate-in fade-in duration-150">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
          <div className="space-y-0.5 flex-1">
            <p className="font-bold text-white">Initialisation de la caméra...</p>
            <p className="text-[11px] text-slate-300">
              Autorisez l’accès à la caméra lorsque votre navigateur vous le demande.
            </p>
          </div>
          <button
            type="button"
            onClick={stopLiveStream}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
          >
            Annuler
          </button>
        </div>
      )}

      {/* BANNIÈRE D'ERREUR GRANULAIRE AVEC ACTIONS ADAPTÉES */}
      {cameraError && !isInitializing && (
        <div className="p-4 bg-slate-900 border border-amber-600/70 rounded-2xl text-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            {cameraError.type === 'PERMISSION_BLOCKED' ? (
              <div className="w-8 h-8 rounded-xl bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
            ) : cameraError.type === 'NOT_FOUND' ? (
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                <Camera className="w-4 h-4" />
              </div>
            ) : cameraError.type === 'NOT_READABLE' ? (
              <div className="w-8 h-8 rounded-xl bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
            )}

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-white">{cameraError.title}</h4>
                {cameraError.errorName && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-red-950/80 text-red-300 border border-red-800">
                    {cameraError.errorName}
                  </span>
                )}
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">{cameraError.message}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
            {/* Bouton Réessayer si l'erreur le permet */}
            {cameraError.canRetry && (
              <button
                type="button"
                onClick={() => startCameraStream(facingMode)}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réessayer</span>
              </button>
            )}

            {/* Bouton Appareil photo natif */}
            {cameraError.showNativeFallback && (
              <button
                type="button"
                onClick={triggerNativeCameraFallback}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>Utiliser l’appareil photo</span>
              </button>
            )}

            {/* Bouton Choisir depuis la galerie */}
            {cameraError.showGalleryFallback && showGalleryOption && (
              <button
                type="button"
                onClick={triggerGalleryPicker}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-medium text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Choisir une photo</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Traitement d'image en cours */}
      {isProcessingFile && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-300">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span>Traitement et optimisation de l’image...</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. FLUX VIDÉO EN DIRECT                                                   */}
      {/* ========================================================================= */}
      {isLiveActive && (
        <div
          className={`relative w-full rounded-2xl overflow-hidden bg-black border-2 border-amber-500 shadow-2xl transition-all duration-200 ${
            isFullscreen
              ? 'fixed inset-0 z-50 rounded-none border-none p-3 bg-black/95 flex flex-col justify-center items-center'
              : ''
          }`}
        >
          {/* Flash visuel lors de la capture */}
          {isFlashActive && (
            <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200 pointer-events-none" />
          )}

          {/* Viseur vidéo */}
          <div
            className={`relative w-full ${
              isFullscreen ? 'max-w-2xl aspect-4/3' : aspectClass
            } bg-black overflow-hidden flex items-center justify-center rounded-xl`}
          >
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Repères graphiques de cadrage */}
            <div className="pointer-events-none absolute inset-4 border-2 border-white/20 rounded-2xl flex items-center justify-center">
              <div className="w-8 h-8 border-t-3 border-l-3 border-amber-400 absolute top-0 left-0 rounded-tl-lg" />
              <div className="w-8 h-8 border-t-3 border-r-3 border-amber-400 absolute top-0 right-0 rounded-tr-lg" />
              <div className="w-8 h-8 border-b-3 border-l-3 border-amber-400 absolute bottom-0 left-0 rounded-bl-lg" />
              <div className="w-8 h-8 border-b-3 border-r-3 border-amber-400 absolute bottom-0 right-0 rounded-br-lg" />
              <span className="px-3 py-1 rounded-full bg-slate-950/85 text-white text-[11px] font-semibold border border-slate-700 shadow-md">
                {framingHint}
              </span>
            </div>

            {/* Barre d'outils supérieure dans le viseur */}
            <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
              <div className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-xs text-white border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 shadow">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>
                  {facingMode === 'environment' ? 'Caméra arrière' : 'Caméra avant'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 backdrop-blur-xs transition cursor-pointer"
                  title={isFullscreen ? 'Réduire' : 'Plein écran'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleCancelLive}
                  className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 backdrop-blur-xs transition cursor-pointer"
                  title="Fermer la caméra"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Barre de commandes inférieure */}
          <div
            className={`p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 ${
              isFullscreen ? 'w-full max-w-2xl rounded-b-xl' : ''
            }`}
          >
            <button
              type="button"
              onClick={handleCancelLive}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
            >
              Annuler
            </button>

            <div className="flex items-center gap-2">
              {canSwitchCamera && (
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                  title="Changer de caméra (avant/arrière)"
                >
                  <RotateCw className="w-4 h-4 text-amber-400" />
                </button>
              )}

              <button
                type="button"
                disabled={isCapturing}
                onClick={handleCaptureFromStream}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg flex items-center gap-2 transition active:scale-95 cursor-pointer"
              >
                {isCapturing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Capture en cours...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-white" />
                    <span>Capturer la photo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. APERÇU DE LA PHOTO DANS LE FORMULAIRE                                  */}
      {/* ========================================================================= */}
      {!isLiveActive && value && (
        <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 shadow-md">
          <div className={`relative w-full ${aspectClass} bg-black flex items-center justify-center`}>
            <img src={value} alt="Façade point de vente" className="w-full h-full object-cover" />
            <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-600 text-xs font-bold flex items-center gap-1.5 shadow-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Photo prête</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={disabled}
                onClick={() => startCameraStream(facingMode)}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reprendre la photo</span>
              </button>

              {showGalleryOption && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={triggerGalleryPicker}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Choisir une autre</span>
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={handleRemovePhoto}
              className="px-3 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Supprimer la photo"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ÉTAT INITIAL (Pas de photo et caméra inactive)                         */}
      {/* ========================================================================= */}
      {!isLiveActive && !value && (
        <div className="p-5 rounded-2xl border-2 border-dashed border-amber-500/40 hover:border-amber-500/70 bg-slate-900/60 text-center space-y-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-800/60 mx-auto flex items-center justify-center text-amber-400 shadow-inner">
            <Camera className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Ajouter une photo du point de vente
            </h3>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
              Photographiez la façade du point de vente directement avec votre appareil ou choisissez une image depuis la galerie.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            {/* Bouton principal : Déclenche la demande uniquement au clic volontaire */}
            <button
              type="button"
              disabled={disabled || isInitializing}
              onClick={() => startCameraStream(defaultFacingMode)}
              className="w-full sm:w-auto px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-4 h-4 text-white" />
              <span>Prendre une photo</span>
            </button>

            {/* Bouton secondaire : Galerie */}
            {showGalleryOption && (
              <button
                type="button"
                disabled={disabled}
                onClick={triggerGalleryPicker}
                className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>Choisir depuis la galerie</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const CameraCapture = React.memo(CameraCaptureComponent);
export default CameraCapture;
