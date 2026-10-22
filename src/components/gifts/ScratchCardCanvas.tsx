import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GiftIllustration } from './GiftIllustration.tsx';
import { ScratchCard } from '../../types/index.ts';
import {
  Sparkles,
  CheckCircle2,
  Trophy,
  Award,
  Eye,
  Hand,
  Check,
  RotateCw,
  AlertCircle,
  RefreshCw,
  Gift,
  X,
  PackageCheck,
  ChevronRight,
} from 'lucide-react';

interface ScratchCardCanvasProps {
  card: ScratchCard;
  vrsDisplayName?: string;
  onReveal: (method: 'SCRATCH' | 'BUTTON') => Promise<void>;
  onConfirmReceipt?: () => Promise<void>;
  isRevealing?: boolean;
}

interface SparkleParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
}

interface ConfettiParticle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

export const ScratchCardCanvas: React.FC<ScratchCardCanvasProps> = ({
  card,
  vrsDisplayName,
  onReveal,
  onConfirmReceipt,
  isRevealing = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scratchZoneRef = useRef<HTMLDivElement | null>(null);
  const deliverySectionRef = useRef<HTMLDivElement | null>(null);

  // Scratch & Reveal states
  const [isScratching, setIsScratching] = useState<boolean>(false);
  const [scratchProgress, setScratchProgress] = useState<number>(0);
  const [revealState, setRevealState] = useState<'IDLE' | 'PENDING' | 'ERROR' | 'SUCCESS'>(
    card.is_revealed === 1 ? 'SUCCESS' : 'IDLE'
  );
  const [revealError, setRevealError] = useState<string | null>(null);
  const [hasTriggeredAutoReveal, setHasTriggeredAutoReveal] = useState<boolean>(card.is_revealed === 1);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState<boolean>(false);

  // Staging / Celebration modal state
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // Sparkles state (max 30 particles during scratch, disabled if prefers-reduced-motion)
  const [sparkles, setSparkles] = useState<SparkleParticle[]>([]);
  const sparkleIdCounterRef = useRef<number>(0);
  const sparklesRef = useRef<SparkleParticle[]>([]);
  sparklesRef.current = sparkles;

  // Track pointer for interpolation without gaps
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastSampleTimeRef = useRef<number>(0);
  const lastVibrateTimeRef = useRef<number>(0);

  const isAlreadyRevealed = card.is_revealed === 1;
  const isOr = card.tier === 'OR';

  // Format VRS name & first name
  const vrsName =
    card.vrs_name ||
    vrsDisplayName ||
    (card.vrs_first_name && card.vrs_last_name ? `${card.vrs_first_name} ${card.vrs_last_name}` : 'Vendeur VRS');

  const vrsFirstName =
    card.vrs_first_name ||
    vrsName.split(' ')[0] ||
    'Vendeur';

  // Coin cursor SVG data URL for PC / desktop
  const coinCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%23F59E0B' stroke='%23B45309' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='11' fill='%23FBBF24' stroke='%23D97706' stroke-width='1'/%3E%3Ccircle cx='16' cy='16' r='8.5' fill='none' stroke='%23FEF08A' stroke-width='1.2' stroke-dasharray='2 2'/%3E%3Ctext x='16' y='20' font-family='sans-serif' font-size='10' font-weight='900' text-anchor='middle' fill='%2378350F'%3E6C%3C/text%3E%3C/svg%3E") 16 16, crosshair`;

  // Trigger short vibration helper (navigator.vibrate)
  const triggerVibration = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const now = Date.now();
      if (Array.isArray(pattern) || now - lastVibrateTimeRef.current >= 120) {
        try {
          navigator.vibrate(pattern);
          lastVibrateTimeRef.current = now;
        } catch {
          // Ignore vibration errors
        }
      }
    }
  }, []);

  // Check user preference for reduced motion
  const checkReducedMotion = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  // =========================================================================
  // CONFETTIS CANVAS: Exactly 60 particles, 2 seconds, disabled if prefers-reduced-motion
  // =========================================================================
  useEffect(() => {
    if (!showCelebration) return;
    if (checkReducedMotion()) return;

    const canvas = confettiCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Exactly 60 confetti particles per prompt requirement
    const CONFETTI_COUNT = 60;
    const colors = isOr
      ? ['#F59E0B', '#FBBF24', '#FDE047', '#FFFFFF', '#FEF08A', '#D97706']
      : ['#CD7F32', '#D97706', '#E2E8F0', '#FFFFFF', '#CBD5E1', '#94A3B8'];

    const particles: ConfettiParticle[] = [];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * (height * 0.3) - 20,
        width: 8 + Math.random() * 8,
        height: 6 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    const startTime = performance.now();
    const DURATION = 2000; // Exact 2 seconds duration
    let animId: number;

    const animateConfetti = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed >= DURATION) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      const fadeProgress = Math.max(0, 1 - (elapsed / DURATION) * 0.9);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity = fadeProgress;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      }

      animId = requestAnimationFrame(animateConfetti);
    };

    animId = requestAnimationFrame(animateConfetti);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (ctx) ctx.clearRect(0, 0, width, height);
    };
  }, [showCelebration, isOr]);

  // Spawn small sparkles near the scratch point (max 30 total)
  const spawnSparkles = useCallback((x: number, y: number, count = 2) => {
    if (checkReducedMotion()) return;

    const currentSparkles = sparklesRef.current;
    if (currentSparkles.length >= 30) return;

    const availableSlots = 30 - currentSparkles.length;
    const toSpawn = Math.min(count, availableSlots);
    if (toSpawn <= 0) return;

    const colors = isOr
      ? ['#F59E0B', '#FBBF24', '#FDE047', '#FFFFFF', '#FEF08A']
      : ['#CD7F32', '#D97706', '#E2E8F0', '#FFFFFF', '#CBD5E1'];

    const newParticles: SparkleParticle[] = [];
    for (let i = 0; i < toSpawn; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.8;
      sparkleIdCounterRef.current += 1;
      newParticles.push({
        id: sparkleIdCounterRef.current,
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        alpha: 1,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
      });
    }

    setSparkles((prev) => [...prev.slice(Math.max(0, prev.length - (30 - newParticles.length))), ...newParticles]);
  }, [isOr]);

  // Animate sparkles
  useEffect(() => {
    if (sparkles.length === 0) return;

    const interval = requestAnimationFrame(() => {
      setSparkles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            alpha: p.alpha - 0.05,
            rotation: p.rotation + p.rotationSpeed,
          }))
          .filter((p) => p.alpha > 0)
      );
    });

    return () => cancelAnimationFrame(interval);
  }, [sparkles]);

  // Initialize Canvas with metallic silver gradient, fine grain noise, diagonal highlights, and "GRATTEZ ICI" badge
  const setupCanvas = useCallback((preserveContent = false) => {
    const canvas = canvasRef.current;
    const zone = scratchZoneRef.current;
    if (!canvas || !zone || isAlreadyRevealed) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const rect = zone.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // If preserving content on resize/rotation, store previous state
    let tempCanvas: HTMLCanvasElement | null = null;
    if (preserveContent && canvas.width > 0 && canvas.height > 0) {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
      }
    }

    // Set canvas dimensions respecting DPR
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    if (tempCanvas) {
      // Re-draw preserved scratch content scaled to new dimensions
      ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // 1. Dégradé argenté métallique multi-angles
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#E2E8F0');
    grad.addColorStop(0.18, '#CBD5E1');
    grad.addColorStop(0.38, '#94A3B8');
    grad.addColorStop(0.52, '#F8FAFC');
    grad.addColorStop(0.68, '#CBD5E1');
    grad.addColorStop(0.84, '#94A3B8');
    grad.addColorStop(1, '#E2E8F0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Reflets diagonaux métalliques
    const sheen = ctx.createLinearGradient(0, h, w, 0);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
    sheen.addColorStop(0.48, 'rgba(255, 255, 255, 0.5)');
    sheen.addColorStop(0.55, 'rgba(255, 255, 255, 0.65)');
    sheen.addColorStop(0.68, 'rgba(255, 255, 255, 0.25)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);

    // 3. Grain fin métallique généré par canvas
    ctx.restore();
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const len = data.length;
    for (let i = 0; i < len; i += 16) {
      const noise = (Math.random() - 0.5) * 26;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.save();
    ctx.scale(dpr, dpr);

    // 4. Bordure gravée argentée intérieure
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, w - 10, h - 10);

    // 5. Cartouche central avec "GRATTEZ ICI" et icône
    const badgeW = Math.min(180, w - 30);
    const badgeH = 48;
    const badgeX = (w - badgeW) / 2;
    const badgeY = (h - badgeH) / 2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();

    ctx.strokeStyle = isOr ? '#F59E0B' : '#CD7F32';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Icône de main / doigt pointé
    const handX = w / 2 - 40;
    const handY = badgeY + 24;
    ctx.save();
    ctx.translate(handX, handY);
    ctx.strokeStyle = '#F8FAFC';
    ctx.fillStyle = isOr ? '#FBBF24' : '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, -6);
    ctx.arc(3, -6, 3, Math.PI, 0, false);
    ctx.lineTo(6, 4);
    ctx.lineTo(10, 4);
    ctx.lineTo(10, 10);
    ctx.lineTo(-4, 10);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Texte "GRATTEZ ICI"
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('GRATTEZ ICI', w / 2 - 18, badgeY + 19);

    ctx.fillStyle = isOr ? '#FBBF24' : '#CBD5E1';
    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
    ctx.fillText('Doigt ou souris', w / 2 - 18, badgeY + 33);

    ctx.restore();
  }, [isAlreadyRevealed, isOr]);

  // Handle screen rotation / resize recalculation with DPR
  useEffect(() => {
    if (isAlreadyRevealed) return;

    setupCanvas(false);

    let resizeTimer: any = null;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setupCanvas(true);
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [setupCanvas, isAlreadyRevealed]);

  // Core Reveal Executor: handles network request, coverage during request, and retry on failure
  const executeServerReveal = useCallback(
    async (method: 'SCRATCH' | 'BUTTON') => {
      if (isAlreadyRevealed || revealState === 'PENDING') return;

      setRevealState('PENDING');
      setRevealError(null);
      setHasTriggeredAutoReveal(true);
      triggerVibration([20, 30, 20]);

      try {
        // Calls server POST /api/cartes/:id/reveler which marks revealed and returns gift
        await onReveal(method);

        // Success: 300ms fade-out of remaining silver layer
        setIsFadingOut(true);
        setRevealState('SUCCESS');
        triggerVibration([30, 50, 40]);

        // Launch celebration staging modal
        setTimeout(() => {
          setShowCelebration(true);
        }, 300);
      } catch (err: any) {
        // On failure: the zone remains covered and scratchable with "Réessayer"
        setRevealState('ERROR');
        setRevealError(err?.message || 'Erreur lors de la communication avec le serveur.');
        setIsFadingOut(false);
        setHasTriggeredAutoReveal(false);
        triggerVibration([50, 50]);
      }
    },
    [isAlreadyRevealed, revealState, onReveal, triggerVibration]
  );

  // Recalculate scratched percentage with sampling every 150 ms
  const sampleScratchProgress = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isAlreadyRevealed || hasTriggeredAutoReveal || revealState === 'PENDING') return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      // Stride of 16 for high-speed sampling (< 1ms on mid-range phones)
      const step = 16;
      let transparentPixels = 0;
      let sampled = 0;

      for (let i = 3; i < data.length; i += 4 * step) {
        sampled++;
        // Pixel is transparent or scratched away
        if (data[i] < 40) {
          transparentPixels++;
        }
      }

      if (sampled === 0) return;
      const percent = Math.min(100, Math.round((transparentPixels / sampled) * 100));
      setScratchProgress(percent);

      // Requirement: À 55 % gratté, appelle le serveur (POST /cartes/:id/reveler)
      if (percent >= 55 && !hasTriggeredAutoReveal) {
        executeServerReveal('SCRATCH');
      }
    } catch {
      // Ignore reading error
    }
  }, [isAlreadyRevealed, hasTriggeredAutoReveal, revealState, executeServerReveal]);

  // Draw soft round brush stroke (28 to 36 px diameter = 14 to 18 px radius) with destination-out
  const drawSoftBrush = (ctx: CanvasRenderingContext2D, x: number, y: number, dpr: number) => {
    const radius = 16 * dpr; // 32 px diameter brush (within 28 to 36 px requirement)

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    // Soft-edged radial gradient for realistic scratching
    const grad = ctx.createRadialGradient(x * dpr, y * dpr, radius * 0.45, x * dpr, y * dpr, radius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x * dpr, y * dpr, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Scratch action with interpolation between previous and current point (no gaps)
  const performScratch = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      isAlreadyRevealed ||
      hasTriggeredAutoReveal ||
      revealState === 'PENDING' ||
      isFadingOut
    ) {
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;

    if (x < -20 || x > rect.width + 20 || y < -20 || y > rect.height + 20) {
      return;
    }

    const last = lastPointRef.current;
    if (last) {
      // Interpolate along the path between points to ensure no holes
      const dist = Math.hypot(x - last.x, y - last.y);
      const step = 4; // 4px interpolation step
      const steps = Math.max(1, Math.ceil(dist / step));

      for (let i = 1; i <= steps; i++) {
        const interX = last.x + (x - last.x) * (i / steps);
        const interY = last.y + (y - last.y) * (i / steps);
        drawSoftBrush(ctx, interX, interY, dpr);
      }
    } else {
      drawSoftBrush(ctx, x, y, dpr);
    }

    lastPointRef.current = { x, y };

    // Spawn tiny sparkles
    spawnSparkles(x, y, 2);

    // Short haptic vibration
    triggerVibration(15);

    // Measure scratch percentage sampled every 150 ms
    const now = Date.now();
    if (now - lastSampleTimeRef.current >= 150) {
      lastSampleTimeRef.current = now;
      sampleScratchProgress();
    }
  };

  // Pointer Events handling (pointerdown, pointermove, pointerup, setPointerCapture)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isAlreadyRevealed || hasTriggeredAutoReveal || revealState === 'PENDING') return;

    // Disappear indicator on first contact
    if (!hasInteracted) {
      setHasInteracted(true);
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointerIdRef.current = e.pointerId;
    } catch {
      // Ignore if setPointerCapture fails
    }

    setIsScratching(true);
    lastPointRef.current = null;
    performScratch(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScratching) return;
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    performScratch(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isScratching) {
      setIsScratching(false);
      lastPointRef.current = null;
      activePointerIdRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      sampleScratchProgress();
    }
  };

  // Alternative button reveal action
  const handleButtonReveal = () => {
    if (isAlreadyRevealed || isRevealing || revealState === 'PENDING') return;
    executeServerReveal('BUTTON');
  };

  // Keyboard accessibility: Enter or Space triggers reveal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isAlreadyRevealed && !isRevealing && revealState !== 'PENDING') {
      e.preventDefault();
      handleButtonReveal();
    }
  };

  const handleVrsConfirmReceipt = async () => {
    if (!onConfirmReceipt || confirmingReceipt) return;
    try {
      setConfirmingReceipt(true);
      await onConfirmReceipt();
    } finally {
      setConfirmingReceipt(false);
    }
  };

  // Action for "Voir ma remise" button
  const handleViewDelivery = () => {
    setShowCelebration(false);
    setTimeout(() => {
      deliverySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  // Large photo source for staging (photo réelle en grand)
  const realPhotoSrc = card.gift_custom_photo || card.gift_photo_url || null;

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      {/* ========================================================================= */}
      {/* CANVAS DES CONFETTIS EN PLEIN ÉCRAN (60 PARTICULES, 2 SECONDES)           */}
      {/* ========================================================================= */}
      {showCelebration && (
        <canvas
          ref={confettiCanvasRef}
          className="fixed inset-0 pointer-events-none z-[60] w-full h-full"
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL DE MISE EN SCÈNE DE RÉVÉLATION DU CADEAU                           */}
      {/* Photo réelle en grand (cover, rayon 16px), nom gras, palier, valeur,     */}
      {/* "Félicitations [Prénom] !", boutons "Voir ma remise" et "Fermer"         */}
      {/* ========================================================================= */}
      {showCelebration && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500/70 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden my-auto animate-in zoom-in-95 duration-200 text-center">
            {/* Bouton de fermeture en haut à droite */}
            <button
              type="button"
              onClick={() => setShowCelebration(false)}
              className="absolute top-3 right-3 w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
              aria-label="Fermer la révélation"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Badge décoratif Palier */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 border shadow-sm ${
              isOr
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400'
                : 'bg-amber-900/20 text-amber-900 dark:text-amber-300 border-[#CD7F32]'
            }">
              <Trophy className="w-3.5 h-3.5" />
              <span>Dotation Palier {card.tier}</span>
            </div>

            {/* Titre "Félicitations [Prénom] !" */}
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Félicitations {vrsFirstName} !
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              Votre note de <strong>{card.final_score.toFixed(1)}/20</strong> au semestre {card.semester_name || ''} vous fait remporter ce cadeau certifié !
            </p>

            {/* Photo réelle en grand (cover, rayon 16 px) */}
            <div className="my-4 relative">
              <div className="w-56 h-56 sm:w-64 sm:h-64 mx-auto rounded-[16px] overflow-hidden border-4 border-amber-400 shadow-2xl bg-slate-900 flex items-center justify-center relative group">
                {realPhotoSrc ? (
                  <img
                    src={realPhotoSrc}
                    alt={card.gift_name || 'Cadeau'}
                    className="w-full h-full object-cover rounded-[16px]"
                  />
                ) : (
                  <div className="w-full h-full p-4 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 rounded-[16px]">
                    <GiftIllustration
                      svgKey={card.gift_svg_key || 'gift'}
                      name={card.gift_name || 'Cadeau'}
                      tier={card.tier}
                      className="w-full h-full"
                      size={140}
                    />
                  </div>
                )}

                {/* Badge visuel photo ou illustration */}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold">
                  {realPhotoSrc ? 'Photo certifiée' : 'Illustration 6C'}
                </div>
              </div>
            </div>

            {/* Nom en gras */}
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {card.gift_name}
            </h3>

            {/* Description du cadeau si disponible */}
            {card.gift_description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 px-2">
                {card.gift_description}
              </p>
            )}

            {/* Détails Palier & Valeur estimée */}
            <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Palier atteint</span>
                <span
                  className={`text-xs font-black uppercase px-2 py-0.5 rounded inline-block mt-0.5 ${
                    isOr ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  Palier {card.tier}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Valeur estimée</span>
                <span className="text-xs sm:text-sm font-black text-[#15803D] block mt-0.5">
                  {(card.gift_estimated_value || 0).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            {/* Boutons "Voir ma remise" et "Fermer" (48 px) */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleViewDelivery}
                className="w-full min-h-[48px] h-12 px-4 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-xs sm:text-sm font-black shadow-md transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Voir ma remise</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCelebration(false)}
                className="w-full min-h-[48px] h-12 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-bold border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Fermer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MESSAGE D'ERREUR AVEC BOUTON "RÉESSAYER" EN CAS D'ÉCHEC DE REQUÊTE        */}
      {/* ========================================================================= */}
      {revealState === 'ERROR' && revealError && (
        <div
          role="alert"
          className="w-full max-w-[420px] mx-auto p-4 rounded-2xl bg-red-50 dark:bg-red-950/80 border-2 border-red-500 text-red-900 dark:text-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold leading-snug">{revealError}</p>
              <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
                La carte reste intacte et disponible au grattage.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => executeServerReveal('BUTTON')}
            className="min-h-[48px] h-12 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Réessayer</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CARTE VISUELLE 3:2 (LARGEUR MAX 420px, COINS 20px, OMBRE DOUCE, BORDURE)  */}
      {/* Exception : Dégradés autorisés sur cette carte seulement                   */}
      {/* ========================================================================= */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={`w-full max-w-[420px] mx-auto aspect-[3/2] rounded-[20px] p-4 sm:p-5 relative select-none overflow-hidden flex flex-col justify-between transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-amber-400/50 ${
          isOr
            ? 'border-4 border-amber-400 bg-gradient-to-br from-[#271904] via-[#0F172A] to-[#362203] shadow-[0_12px_36px_-6px_rgba(245,158,11,0.35)]'
            : 'border-4 border-[#CD7F32] bg-gradient-to-br from-[#241508] via-[#0F172A] to-[#2B180A] shadow-[0_12px_36px_-6px_rgba(184,115,51,0.35)]'
        }`}
      >
        {/* Motifs décoratifs étoiles scintillantes en arrière-plan */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Étoile haut gauche */}
          <svg className="absolute top-2 left-3 w-5 h-5 text-amber-400/40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6Z" />
          </svg>
          {/* Étoile haut droite */}
          <svg className="absolute top-3 right-4 w-4 h-4 text-amber-300/50" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6Z" />
          </svg>
          {/* Étoile bas gauche */}
          <svg className="absolute bottom-3 left-4 w-4 h-4 text-amber-400/40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6Z" />
          </svg>
          {/* Étoile bas droite */}
          <svg className="absolute bottom-2 right-3 w-6 h-6 text-yellow-400/30" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6Z" />
          </svg>
          {/* Poussières d'étoiles */}
          <div className="absolute top-1/4 right-8 w-1.5 h-1.5 rounded-full bg-amber-300/60" />
          <div className="absolute bottom-1/3 left-7 w-1.5 h-1.5 rounded-full bg-yellow-200/50" />
        </div>

        {/* ===================================================================== */}
        {/* HAUT DE CARTE : TITRE "Carte cadeau 6C", SEMESTRE, NOTE, PALIER       */}
        {/* ===================================================================== */}
        <div className="relative z-10 flex items-start justify-between gap-2 border-b border-white/10 pb-2">
          <div>
            <div className="flex items-center gap-1.5">
              <Trophy className={`w-4 h-4 ${isOr ? 'text-amber-400' : 'text-[#CD7F32]'}`} />
              <h3 className="text-sm sm:text-base font-black tracking-wide uppercase text-white drop-shadow-sm">
                Carte cadeau 6C
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-300 block">
              {card.semester_name || 'Semestre 6C Distribution'}
            </span>
          </div>

          <div className="flex flex-col items-end shrink-0">
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border shadow-sm ${
                isOr
                  ? 'bg-amber-500/30 text-amber-300 border-amber-400/60'
                  : 'bg-amber-900/40 text-amber-200 border-[#CD7F32]/60'
              }`}
            >
              Palier {card.tier}
            </span>
            <span className="text-[11px] font-black font-mono text-white mt-0.5">
              Note : {card.final_score.toFixed(1)} / 20
            </span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* MILIEU DE CARTE : ZONE CADEAU COUVERTE D'UNE COUCHE ARGENTÉE         */}
        {/* Le cadeau est totalement MASQUÉ avant révélation (aucun texte/photo) */}
        {/* ===================================================================== */}
        <div className="relative z-10 flex-1 my-2 flex items-center justify-center">
          <div
            ref={scratchZoneRef}
            onClick={() => {
              if (isAlreadyRevealed) setShowCelebration(true);
            }}
            className={`relative w-full max-w-[290px] h-[105px] sm:h-[115px] rounded-xl overflow-hidden border-2 border-white/20 shadow-inner bg-slate-900/90 flex items-center justify-center ${
              isAlreadyRevealed ? 'cursor-pointer' : ''
            }`}
          >
            {/* Contenu sous-jacent : UNIQUEMENT rendu quand isAlreadyRevealed est vrai */}
            {isAlreadyRevealed ? (
              <div className="w-full h-full p-2 flex items-center justify-center gap-3 animate-in fade-in duration-300">
                {/* Visuel du cadeau révélé (Photo réelle ou illustration SVG) */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0 border border-white/20 bg-black/40 flex items-center justify-center">
                  <GiftIllustration
                    svgKey={card.gift_svg_key || 'gift'}
                    name={card.gift_name || 'Cadeau'}
                    tier={card.tier}
                    customPhoto={card.gift_custom_photo}
                    photoUrl={card.gift_photo_url}
                    className="w-full h-full"
                    size={70}
                    showRealBadge={Boolean(card.gift_custom_photo || card.gift_photo_url)}
                  />
                </div>

                <div className="text-left flex-1 min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 block">
                    Cadeau tiré au sort
                  </span>
                  <h4 className="text-sm sm:text-base font-black text-white truncate">
                    {card.gift_name}
                  </h4>
                  <p className="text-[10px] text-slate-300 line-clamp-2 mt-0.5">
                    {card.gift_description || 'Félicitations pour votre performance !'}
                  </p>
                </div>
              </div>
            ) : (
              /* AVANT RÉVÉLATION : Le cadeau est totalement MASQUÉ */
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-2">
                <Sparkles className="w-6 h-6 text-slate-600 animate-pulse mb-1" />
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  Dotation Mystère
                </span>
                <span className="text-[9px] text-slate-600">
                  Tirage serveur certifié
                </span>
              </div>
            )}

            {/* Indicateur de chargement / zone couverte pendant la requête */}
            {revealState === 'PENDING' && (
              <div className="absolute inset-0 z-30 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-3 animate-in fade-in duration-150">
                <RotateCw className="w-7 h-7 text-amber-400 animate-spin mb-1.5" />
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Révélation en cours...
                </span>
                <span className="text-[10px] text-slate-300 mt-0.5">
                  Certification du tirage par le serveur
                </span>
              </div>
            )}

            {/* Couche argentée métallique à gratter (Canvas avec Pointer Events et curseur pièce) */}
            {!isAlreadyRevealed && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full z-20 transition-opacity duration-300"
                style={{
                  touchAction: 'none',
                  cursor: coinCursor,
                  opacity: isFadingOut ? 0 : 1,
                  pointerEvents: revealState === 'PENDING' ? 'none' : 'auto',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                aria-label="Zone argentée à gratter avec le doigt ou la souris"
              />
            )}

            {/* Paillettes légères au grattage (max 30, désactivées si prefers-reduced-motion) */}
            {!isAlreadyRevealed && sparkles.length > 0 && (
              <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                {sparkles.map((sp) => (
                  <div
                    key={sp.id}
                    className="absolute rounded-full"
                    style={{
                      left: `${sp.x}px`,
                      top: `${sp.y}px`,
                      width: `${sp.size}px`,
                      height: `${sp.size}px`,
                      backgroundColor: sp.color,
                      opacity: sp.alpha,
                      transform: `rotate(${sp.rotation}deg)`,
                      boxShadow: `0 0 6px ${sp.color}`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Indicateur "Passez le doigt pour gratter" qui disparaît au premier contact */}
            {!isAlreadyRevealed && !hasInteracted && !isFadingOut && revealState !== 'PENDING' && (
              <div className="absolute top-2 inset-x-0 mx-auto w-fit z-30 pointer-events-none animate-bounce">
                <div className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-amber-400 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
                  <Hand className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>Passez le doigt pour gratter</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* BAS DE CARTE : NOM DU VRS, CODE, STATUT DE RÉVÉLATION                */}
        {/* ===================================================================== */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px]">
          <div className="flex items-center gap-1.5 text-slate-200 truncate max-w-[200px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="font-bold truncate">{vrsName}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAlreadyRevealed ? (
              <button
                type="button"
                onClick={() => setShowCelebration(true)}
                className="font-bold text-emerald-400 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Révélé (Revoir)</span>
              </button>
            ) : (
              <span className="font-bold text-amber-300 flex items-center gap-1">
                <Hand className="w-3.5 h-3.5" />
                <span>À gratter</span>
              </span>
            )}
            <span className="text-slate-400 font-mono text-[9px]">{card.code}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTRÔLES SOUS LA CARTE (PROGRESSION, BOUTON RÉVÉLER 48px, CONFIRMATION)  */}
      {/* ========================================================================= */}
      <div className="w-full max-w-[420px] mx-auto space-y-3">
        {!isAlreadyRevealed ? (
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Zone argentée grattée : {scratchProgress}%</span>
              </span>
              <span className="text-[11px] text-slate-500">Révélation automatique : 55%</span>
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#15803D] h-full transition-all duration-150 rounded-full"
                style={{ width: `${Math.min(100, scratchProgress)}%` }}
              />
            </div>

            {/* Bouton d'accessibilité / révélation alternative (48 px) */}
            <button
              type="button"
              onClick={handleButtonReveal}
              disabled={isRevealing || hasTriggeredAutoReveal || revealState === 'PENDING'}
              className="w-full min-h-[48px] h-12 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-xs sm:text-sm font-black shadow-md transition cursor-pointer disabled:opacity-50 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-emerald-500/40"
              aria-label="Révéler immédiatement le cadeau sans gratter"
            >
              {revealState === 'PENDING' || isRevealing ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Révélation en cours...</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Révéler le cadeau (Touche Entrée ou Espace)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Carte déjà révélée : Bouton pour revoir la célébration & Suivi de remise */
          <div
            ref={deliverySectionRef}
            id="delivery-tracking-section"
            className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCelebration(true)}
                className="inline-flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                <Gift className="w-4 h-4" />
                <span>Revoir la mise en scène du cadeau</span>
              </button>

              <span className="text-[10px] text-slate-400 font-mono">
                Révélée le {card.revealed_at ? new Date(card.revealed_at).toLocaleDateString('fr-FR') : 'Semestre en cours'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Suivi de remise physique :
              </span>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                  card.delivery_status === 'RECU'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-400'
                    : card.delivery_status === 'REMISE_EFFECTUEE'
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-400'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-400'
                }`}
              >
                {card.delivery_status === 'RECU'
                  ? 'Reçu en main propre'
                  : card.delivery_status === 'REMISE_EFFECTUEE'
                  ? 'Remise effectuée par SA'
                  : card.delivery_status === 'PROGRAMMEE'
                  ? 'Remise programmée'
                  : 'À programmer par SA'}
              </span>
            </div>

            {card.delivery_status === 'REMISE_EFFECTUEE' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-300 dark:border-blue-800 space-y-2">
                <p className="text-xs text-blue-900 dark:text-blue-200 font-bold">
                  Votre Sales Admin indique vous avoir remis votre cadeau. Merci de valider la réception.
                </p>
                <button
                  type="button"
                  onClick={handleVrsConfirmReceipt}
                  disabled={confirmingReceipt}
                  className="w-full min-h-[48px] h-12 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-xs font-black shadow transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{confirmingReceipt ? 'Confirmation...' : 'Confirmer la réception en main propre'}</span>
                </button>
              </div>
            )}

            {card.delivery_status === 'RECU' && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Réception validée le {new Date(card.vrs_confirmed_at || Date.now()).toLocaleDateString('fr-FR')}.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScratchCardCanvas;
