import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useGps } from '../../context/GpsContext.tsx';
import { api } from '../../services/api.ts';
import { PointOfSale, Sale, Visit, PosMonthlySalesData } from '../../types/index.ts';
import { GoogleMapView } from '../common/GoogleMapView.tsx';
import { PosSalesEvolutionChart } from './PosSalesEvolutionChart.tsx';
import { CameraCapture } from '../common/CameraCapture.tsx';
import { exportPosToPdf } from '../../utils/posPdfExporter.ts';
import { isMobileOrTablet } from '../../utils/device.ts';
import {
  Store,
  X,
  Camera,
  Video,
  Upload,
  MapPin,
  Compass,
  Phone,
  User,
  CheckCircle2,
  Check,
  AlertCircle,
  Clock,
  ShoppingCart,
  CalendarCheck,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Eye,
  Trash2,
  AlertTriangle,
  Loader2,
  FileDown,
  Smartphone,
} from 'lucide-react';

interface PosDetailModalProps {
  posId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onPosUpdated?: (updatedPos: PointOfSale) => void;
  onStartSale?: (posId: number) => void;
  initialSuccessMessage?: string | null;
}

// Client-side image compressor: scales down to max 1280px and 0.85 quality
const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier image.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Impossible de charger l'image."));
      img.onload = () => {
        const MAX_DIM = 1280;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// Fallback to build rolling 6 months if API returns empty array
const buildMonthlySalesFallback = (sales: Sale[]): PosMonthlySalesData[] => {
  const monthsFrenchShort: Record<string, string> = {
    '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr',
    '05': 'Mai', '06': 'Juin', '07': 'Juil', '08': 'Août',
    '09': 'Sept', '10': 'Oct', '11': 'Nov', '12': 'Déc'
  };
  const monthsFrenchFull: Record<string, string> = {
    '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
    '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
    '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre'
  };

  const map = new Map<string, { totalAmount: number; salesCount: number; cartonsSold: number }>();
  sales.forEach((s: any) => {
    if (s.status === 'COMPLETED' || !s.status) {
      const dateStr = s.createdAt || s.created_at;
      if (dateStr) {
        const key = dateStr.substring(0, 7);
        const curr = map.get(key) || { totalAmount: 0, salesCount: 0, cartonsSold: 0 };
        curr.totalAmount += Number(s.totalAmount || s.total_amount || 0);
        curr.salesCount += 1;
        curr.cartonsSold += Number(s.totalCartons || 0);
        map.set(key, curr);
      }
    }
  });

  const now = new Date();
  const targetYear = now.getFullYear();
  const targetMonth = now.getMonth();
  const result: PosMonthlySalesData[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(targetYear, targetMonth - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const key = `${yyyy}-${mm}`;
    const raw = map.get(key) || { totalAmount: 0, salesCount: 0, cartonsSold: 0 };
    result.push({
      month: key,
      monthLabel: `${monthsFrenchFull[mm] || mm} ${yyyy}`,
      shortLabel: monthsFrenchShort[mm] || mm,
      totalAmount: raw.totalAmount,
      salesCount: raw.salesCount,
      cartonsSold: raw.cartonsSold,
    });
  }

  for (let i = 0; i < result.length; i++) {
    if (i > 0 && result[i - 1].totalAmount > 0) {
      const prev = result[i - 1].totalAmount;
      const curr = result[i].totalAmount;
      result[i].growthRate = Math.round(((curr - prev) / prev) * 100);
    } else {
      result[i].growthRate = 0;
    }
  }

  return result;
};

export const PosDetailModal: React.FC<PosDetailModalProps> = ({
  posId,
  isOpen,
  onClose,
  onPosUpdated,
  onStartSale,
  initialSuccessMessage,
}) => {
  const { user } = useAuth();
  const { coords } = useGps();

  const [pos, setPos] = useState<PointOfSale | null>(null);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [visitsHistory, setVisitsHistory] = useState<Visit[]>([]);
  const [monthlySales, setMonthlySales] = useState<PosMonthlySalesData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(initialSuccessMessage || null);

  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);

  // Photo capture and GPS sync state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [photoSuccessNotice, setPhotoSuccessNotice] = useState<string | null>(null);
  const [photoErrorNotice, setPhotoErrorNotice] = useState<string | null>(null);
  const [localClosed, setLocalClosed] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Deletion workflow state
  const [isRequestDeletionOpen, setIsRequestDeletionOpen] = useState(false);
  const [deletionReasonInput, setDeletionReasonInput] = useState('');
  const [isSubmittingDeletion, setIsSubmittingDeletion] = useState(false);
  const [isConfirmingDirectDelete, setIsConfirmingDirectDelete] = useState(false);
  const [isApprovingDeletion, setIsApprovingDeletion] = useState(false);
  const [isRejectingModalOpen, setIsRejectingModalOpen] = useState(false);
  const [rejectionNoteInput, setRejectionNoteInput] = useState('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const submitPhotoDataUrl = async (dataUrl: string) => {
    if (!pos) return;

    setIsUploadingPhoto(true);
    setPhotoErrorNotice(null);
    setPhotoSuccessNotice(null);

    try {
      // 1. Automatically capture real-time GPS coordinates with high accuracy
      let currentLat = newLat ?? (pos.latitude ? Number(pos.latitude) : 12.6392);
      let currentLng = newLng ?? (pos.longitude ? Number(pos.longitude) : -8.0029);
      let accuracyInfo = '';

      if (coords?.latitude && coords?.longitude) {
        currentLat = coords.latitude;
        currentLng = coords.longitude;
        if (coords.accuracy) {
          accuracyInfo = ` (Précision ±${Math.round(coords.accuracy)}m)`;
        }
      }

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 10000,
            });
          });
          currentLat = position.coords.latitude;
          currentLng = position.coords.longitude;
          accuracyInfo = ` (Précision ±${Math.round(position.coords.accuracy)}m)`;
        } catch (geoErr) {
          console.warn('Géolocalisation automatique non disponible:', geoErr);
        }
      }

      // 2. Persist new photo and GPS position to backend
      const res = await api.updatePointOfSalePhoto(pos.id, {
        photo: dataUrl,
        latitude: currentLat,
        longitude: currentLng,
      });

      // 3. Update local state
      setPos(res.pos);
      setNewLat(currentLat);
      setNewLng(currentLng);
      setPendingPhotoPreview(null);

      // 4. Success confirmation banner
      const confirmText = `Photo et position GPS (${currentLat.toFixed(5)}°, ${currentLng.toFixed(5)}°) enregistrées avec succès sur la carte Google Maps${accuracyInfo} !`;
      setPhotoSuccessNotice(confirmText);
      setSuccessMsg(confirmText);

      // 5. Update parent POS list without closing modal or navigating away
      if (onPosUpdated) {
        onPosUpdated(res.pos);
      }

      try {
        localStorage.setItem('6c_selected_pos_id', String(pos.id));
        localStorage.setItem('6c_active_tab', 'pos');
        if (typeof window !== 'undefined') {
          const targetHash = `#/pos/${pos.id}`;
          if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
          }
        }
      } catch {}
    } catch (err: any) {
      console.warn('Erreur enregistrement photo PDV:', err);
      setPhotoErrorNotice(err?.message || "Erreur lors de l'enregistrement de la photo. Vous pouvez réessayer.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pos) return;

    try {
      const compressedDataUrl = await compressImageFile(file);
      setPendingPhotoPreview(compressedDataUrl);
      setPhotoSuccessNotice(null);
      setPhotoErrorNotice(null);
    } catch (err: any) {
      setPhotoErrorNotice(err?.message || "Erreur lors de la lecture du fichier image.");
    } finally {
      e.target.value = '';
    }
  };

  const fetchPosDetails = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPointOfSale(id);
      setPos(res.pos);
      setSalesHistory(res.salesHistory || []);
      setVisitsHistory(res.visitsHistory || []);
      if (res.monthlySales && res.monthlySales.length > 0) {
        setMonthlySales(res.monthlySales);
      } else {
        setMonthlySales(buildMonthlySalesFallback(res.salesHistory || []));
      }
      if (res.pos.latitude) setNewLat(Number(res.pos.latitude));
      if (res.pos.longitude) setNewLng(Number(res.pos.longitude));
    } catch (err: any) {
      console.error('Erreur chargement PDV:', err);
      setError(err.message || 'Impossible de charger les détails du point de vente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLocalClosed(false);
    }
  }, [isOpen, posId]);

  useEffect(() => {
    if (isOpen && posId) {
      fetchPosDetails(posId);
      setSuccessMsg(initialSuccessMessage || null);
      try {
        localStorage.setItem('6c_active_tab', 'pos');
        localStorage.setItem('6c_selected_pos_id', String(posId));
        if (typeof window !== 'undefined') {
          window.location.hash = `#/pos/${posId}`;
        }
      } catch {}
    }

    const handleSaleRecorded = () => {
      if (isOpen && posId) {
        fetchPosDetails(posId);
      }
    };

    window.addEventListener('6c:sale-recorded', handleSaleRecorded);
    return () => {
      window.removeEventListener('6c:sale-recorded', handleSaleRecorded);
    };
  }, [isOpen, posId, initialSuccessMessage]);

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setLocalClosed(true);
    try {
      localStorage.removeItem('6c_selected_pos_id');
      localStorage.setItem('6c_active_tab', 'pos');
      if (typeof window !== 'undefined') {
        window.location.hash = '#/pos';
      }
    } catch {}
    onClose();
  };

  const handleExportPdf = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!pos) return;
    setIsExportingPdf(true);
    setError(null);
    try {
      const ok = await exportPosToPdf({
        pos,
        salesHistory,
        visitsHistory,
        currentUser: user,
      });
      if (ok) {
        setSuccessMsg(`Fiche récapitulative PDF de "${pos.name}" téléchargée avec succès !`);
      } else {
        setError('Impossible de générer le fichier PDF. Veuillez réessayer.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création du document PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen || localClosed) return null;

  const handleUpdateStatus = async (newStatus: string) => {
    if (!pos) return;
    try {
      const res = await api.updatePointOfSaleStatus(pos.id, { newStatus });
      setPos(res.pos);
      setSuccessMsg(res.message);
      if (onPosUpdated) {
        onPosUpdated(res.pos);
      }
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la validation.');
    }
  };

  const isSAN = user?.role === 'SALES_ADMIN_NATIONAL';

  const handleDirectDeleteSAN = async () => {
    if (!pos) return;
    setIsSubmittingDeletion(true);
    setError(null);
    try {
      const res = await api.deletePointOfSale(pos.id);
      setSuccessMsg(res.message);
      if (onPosUpdated) {
        onPosUpdated({ ...pos, isDeleted: 1, status: 'SUPPRIME' });
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression.');
    } finally {
      setIsSubmittingDeletion(false);
      setIsConfirmingDirectDelete(false);
    }
  };

  const handleRequestDeletionVRS = async () => {
    if (!pos || !deletionReasonInput.trim()) {
      setError('Le motif de la demande de suppression est obligatoire.');
      return;
    }
    setIsSubmittingDeletion(true);
    setError(null);
    try {
      const res = await api.requestPointOfSaleDeletion(pos.id, { reason: deletionReasonInput.trim() });
      setPos(res.pos);
      setSuccessMsg(res.message);
      setIsRequestDeletionOpen(false);
      setDeletionReasonInput('');
      if (onPosUpdated) {
        onPosUpdated(res.pos);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la soumission de la demande de suppression.');
    } finally {
      setIsSubmittingDeletion(false);
    }
  };

  const handleApproveDeletionSAN = async (approved: boolean, note?: string) => {
    if (!pos) return;
    setIsApprovingDeletion(true);
    setError(null);
    try {
      const res = await api.approvePointOfSaleDeletion(pos.id, { approved, note });
      setSuccessMsg(res.message);
      if (approved) {
        if (onPosUpdated) {
          onPosUpdated({ ...pos, isDeleted: 1, status: 'SUPPRIME', deletionStatus: 'APPROUVEE' });
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        if (res.pos) {
          setPos(res.pos);
          if (onPosUpdated) onPosUpdated(res.pos);
        }
        setIsRejectingModalOpen(false);
        setRejectionNoteInput('');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du traitement de la demande de suppression.');
    } finally {
      setIsApprovingDeletion(false);
    }
  };

  const canValidate = user?.role === 'SALES_ADMIN' || user?.role === 'SALES_ADMIN_NATIONAL';
  const displayLat = newLat ?? (pos?.latitude ? Number(pos.latitude) : 12.6392);
  const displayLng = newLng ?? (pos?.longitude ? Number(pos.longitude) : -8.0029);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl h-[95vh] sm:h-auto sm:max-h-[92vh] my-0 sm:my-auto bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-sheet-up sm:animate-modal-content"
      >
        {/* Hidden inputs strictly triggered programmatically without navigation */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoCapture}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoCapture}
          className="hidden"
        />

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/90 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {pos ? pos.name : 'Détail du Point de Vente'}
                </h2>
                {pos && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono flex items-center gap-1 ${
                      pos.status === 'ACTIF' || pos.status === 'VALIDE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : pos.status === 'EN ATTENTE'
                        ? 'bg-amber-950 text-amber-300 border border-amber-700 animate-pulse'
                        : 'bg-red-950 text-red-300 border border-red-800'
                    }`}
                  >
                    {pos.status === 'EN ATTENTE' ? (
                      <>
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>EN ATTENTE DE VALIDATION</span>
                      </>
                    ) : (
                      pos.status
                    )}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {pos ? `Code : ${pos.code} • ${pos.ownerName}` : 'Chargement des données...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pos && (
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-xs font-semibold rounded-xl border border-slate-700 hover:border-amber-500/50 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Télécharger la fiche récapitulative du point de vente en format PDF"
                aria-label="Exporter en PDF"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <FileDown className="w-4 h-4 text-amber-400" />
                )}
                <span className="hidden sm:inline">Exporter en PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
              title="Fermer la fiche du PDV"
              aria-label="Fermer la fiche du PDV"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 min-h-0">
          {error && (
            <div className="p-3.5 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-950/80 border border-emerald-700 rounded-xl text-xs text-emerald-300 font-medium flex items-start gap-2 shadow-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-emerald-400 hover:text-emerald-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* BANNER: DEMANDE DE SUPPRESSION EN COURS D'APPROBATION SAN */}
          {pos?.deletionStatus === 'EN_ATTENTE_APPROBATION' && (
            <div className="p-4 bg-amber-950/40 border border-amber-600/80 rounded-2xl space-y-3 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-bold text-amber-200">
                      Demande de suppression en attente d'approbation SAN
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                      Approbation Requise
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    <strong className="text-white">Motif :</strong> {pos.deletionReason || 'Non spécifié'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Demandé par : <span className="text-amber-300 font-medium">{pos.deletionRequesterName || 'VRS'}</span>
                    {pos.deletionRequestedAt ? ` le ${new Date(pos.deletionRequestedAt).toLocaleString('fr-FR')}` : ''}
                  </p>
                </div>
              </div>

              {/* Action buttons if SAN */}
              {isSAN ? (
                <div className="pt-2 border-t border-amber-800/50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    disabled={isApprovingDeletion}
                    onClick={() => handleApproveDeletionSAN(true)}
                    className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isApprovingDeletion ? 'Validation...' : 'Approuver la suppression (Supprimer définitivement)'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isApprovingDeletion}
                    onClick={() => setIsRejectingModalOpen(true)}
                    className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition disabled:opacity-50"
                  >
                    Rejeter la demande
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-amber-800/50 text-[11px] text-amber-300/90 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Cette demande a été transmise au Sales Admin National (SAN). La suppression n'aura lieu qu'après son approbation.</span>
                </div>
              )}
            </div>
          )}

          {loading && !pos && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              <span className="text-xs">Chargement de la fiche du point de vente...</span>
            </div>
          )}

          {pos && (
            <>
              {/* BANDEAU INFORMATION: ENRÔLEMENT SANS VENTE */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300">
                <Store className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-[11px] leading-relaxed">
                  <span className="font-semibold text-white">Enregistrement autonome :</span> Le vendeur peut enregistrer un nouveau point de vente sans réaliser de vente avec ce dernier. Ce point de vente est opérationnel dans le réseau.
                </div>
              </div>

              {/* SECTION: PHOTO DU POINT DE VENTE & SOUMISSION PHOTO / GPS */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Store className="w-4 h-4 text-amber-400" />
                    <span>Façade & Point de Vente</span>
                  </div>
                  {pos.photo ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Photo certifiée & géolocalisée</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 text-[10px] font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-400" />
                      <span>Photo requise</span>
                    </span>
                  )}
                </div>

                {/* Notification de confirmation après soumission de photo */}
                {photoSuccessNotice && (
                  <div className="p-3.5 bg-emerald-950 border border-emerald-500 rounded-xl text-xs text-emerald-200 flex items-start gap-3 shadow-lg animate-fadeIn">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm">Photo & Coordonnées GPS enregistrées avec succès !</div>
                      <div className="text-xs text-emerald-300 mt-1 leading-relaxed">{photoSuccessNotice}</div>
                      <div className="text-[11px] text-emerald-400 font-semibold mt-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Position automatiquement synchronisée sur la carte Google Maps ci-dessous. Vous restez sur cette fiche PDV.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhotoSuccessNotice(null)}
                      className="text-emerald-400 hover:text-emerald-200 p-1 cursor-pointer shrink-0"
                      title="Fermer ce message"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Message d'erreur éventuel */}
                {photoErrorNotice && (
                  <div className="p-3 bg-red-950/90 border border-red-700 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-white">Erreur lors de l'enregistrement</div>
                      <div className="text-[11px] text-red-300 mt-0.5">{photoErrorNotice}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhotoErrorNotice(null)}
                      className="text-red-400 hover:text-red-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Photo Preview Before Submit OR Photo Display */}
                {pendingPhotoPreview ? (
                  <div className="rounded-2xl border-2 border-emerald-500/80 bg-slate-950 p-3.5 sm:p-4 space-y-3 shadow-xl animate-fadeIn">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>Aperçu de la nouvelle photo</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">
                        Prête à l'enregistrement
                      </span>
                    </div>

                    <div className="relative w-full h-56 sm:h-64 rounded-xl overflow-hidden bg-black border border-slate-800">
                      <img
                        src={pendingPhotoPreview}
                        alt="Aperçu photo PDV"
                        className="w-full h-full object-cover"
                      />
                      {isUploadingPhoto && (
                        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2 p-4 text-center z-10">
                          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                          <span className="text-xs font-bold text-white">Enregistrement et géolocalisation en cours...</span>
                          <span className="text-[11px] text-slate-300">Synchronisation sur la carte Google Maps</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-300 flex items-center gap-1.5 leading-relaxed">
                      <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        En cliquant sur <strong>Confirmer et enregistrer</strong>, la photo et votre position GPS seront immédiatement mises à jour pour ce point de vente.
                      </span>
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isUploadingPhoto}
                        onClick={() => submitPhotoDataUrl(pendingPhotoPreview)}
                        className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
                      >
                        {isUploadingPhoto ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Enregistrement & Géolocalisation...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 text-white" />
                            <span>Confirmer et enregistrer la photo</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isUploadingPhoto}
                        onClick={() => setPendingPhotoPreview(null)}
                        className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Annuler / Reprendre</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Photo Display avec overlay de chargement */}
                    <div className="relative w-full h-52 sm:h-60 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                      <img
                        src={pos.photo || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=600'}
                        alt={pos.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {/* Overlay pendant le chargement / compression / envoi */}
                      {isUploadingPhoto && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 p-4 text-center z-10">
                          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                          <span className="text-xs font-bold text-white">Traitement de la photo et synchronisation GPS...</span>
                          <span className="text-[11px] text-slate-300">Enregistrement automatique sur la carte Google Maps</span>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 right-2 px-3 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-xs border border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between">
                        <span className="font-semibold text-white truncate max-w-[200px]">{pos.name}</span>
                        <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-400" />
                          {displayLat.toFixed(5)}°, {displayLng.toFixed(5)}°
                        </span>
                      </div>
                    </div>

                    {/* Boutons d'action pour prise et soumission de photo */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isUploadingPhoto}
                        onClick={() => setIsCameraModalOpen(true)}
                        className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
                        title="Prendre une photo avec la caméra"
                      >
                        <Camera className="w-4 h-4 text-white" />
                        <span>Prendre une photo</span>
                      </button>

                      <button
                        type="button"
                        disabled={isUploadingPhoto}
                        onClick={() => galleryInputRef.current?.click()}
                        className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                        title="Importer une photo depuis votre appareil"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>Importer une photo</span>
                      </button>
                    </div>
                  </>
                )}

                <p className="text-[10px] text-slate-400 flex items-center gap-1.5 leading-relaxed">
                  <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    La soumission de la photo capture automatiquement votre position GPS précise et l'enregistre sur la carte Google Maps. Vous restez sur cette fiche sans redirection.
                  </span>
                </p>
              </div>

              {/* SECTION: INFORMATIONS PRINCIPALES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Propriétaire & Contact
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-200">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold">{pos.ownerName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-200">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <a
                      href={`tel:${pos.phone}`}
                      className="font-mono text-amber-400 hover:underline"
                    >
                      {pos.phone}
                    </a>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Localisation & Secteur
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-200">
                    <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      {pos.address} {pos.neighborhood ? `(${pos.neighborhood})` : ''}
                    </span>
                  </div>
                  {pos.sectorName && (
                    <div className="text-[11px] text-amber-400 font-medium pl-6">
                      Secteur : {pos.sectorName}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION: GOOGLE MAP & COORDONNÉES GPS */}
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <MapPin className="w-4 h-4 text-red-400" />
                    <span>Emplacement Google Maps</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {displayLat.toFixed(5)}° N, {displayLng.toFixed(5)}° W
                    </span>
                  </div>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${displayLat},${displayLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ouvrir Google Maps</span>
                  </a>
                </div>

                <div className="rounded-xl overflow-hidden border border-slate-800">
                  <GoogleMapView
                    center={{ lat: displayLat, lng: displayLng }}
                    zoom={16}
                    interactive={false}
                    height="200px"
                    title={`Google Maps - ${pos.name}`}
                    markers={[
                      {
                        id: pos.id,
                        lat: displayLat,
                        lng: displayLng,
                        title: pos.name,
                        subtitle: `${pos.address} (${pos.neighborhood || 'PDV'})`,
                        color: 'emerald',
                        badge: 'PDV',
                        iconType: 'pos',
                      },
                    ]}
                  />
                </div>
              </div>

              {/* SECTION: CHIFFRES D'AFFAIRES, NOMBRE DE VENTES ET DERNIÈRE ACTIVITÉ */}
              {(() => {
                const isVrs = user?.role === 'VRS';
                const effectiveSales = isVrs && user?.id
                  ? salesHistory.filter((s: any) => Number(s.vrsId ?? s.vrs_id) === Number(user.id))
                  : salesHistory;
                const salesCount = typeof pos.totalSalesCount === 'number' && pos.totalSalesCount > 0
                  ? pos.totalSalesCount
                  : (effectiveSales.length > 0 ? effectiveSales.length : salesHistory.length);
                const totalRevenue = typeof pos.totalSalesAmount === 'number' && pos.totalSalesAmount > 0
                  ? pos.totalSalesAmount
                  : salesHistory.reduce((acc, s) => acc + (s.totalAmount ?? (s as any).total_amount ?? 0), 0);

                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Stat: Nombre de ventes */}
                      <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                        <div className="text-[10px] text-slate-500 font-medium flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="w-3 h-3 text-sky-400" />
                            <span>Nombre de Ventes VRS</span>
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            salesCount > 0
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}>
                            {salesCount > 0 ? `${salesCount} vente${salesCount > 1 ? 's' : ''}` : '0 vente'}
                          </span>
                        </div>
                        <div className="text-sm sm:text-base font-bold font-mono text-white mt-1">
                          {salesCount} <span className="text-xs font-normal text-slate-400">vente{salesCount > 1 ? 's' : ''}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {salesCount === 0 ? 'Aucune vente pour le moment' : 'Réalisée(s) auprès du PDV'}
                        </div>
                      </div>

                      {/* Stat: Chiffre d'Affaires */}
                      <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Chiffre d'Affaires</span>
                        </div>
                        <div className="text-sm sm:text-base font-bold font-mono text-emerald-400 mt-1">
                          {totalRevenue.toLocaleString('fr-FR')} FCFA
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Montant total cumulé
                        </div>
                      </div>

                      {/* Stat: Dernière Visite */}
                      <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <CalendarCheck className="w-3 h-3 text-amber-400" />
                          <span>Dernière Activité</span>
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-200 mt-1 truncate">
                          {pos.lastVisitDate ? new Date(pos.lastVisitDate).toLocaleDateString('fr-FR') : 'Aucune visite'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Visite ou transaction
                        </div>
                      </div>
                    </div>

                    {/* SECTION: GRAPHIQUE LINÉAIRE RECHARTS - ÉVOLUTION DES VENTES (6 DERNIERS MOIS) */}
                    <PosSalesEvolutionChart
                      data={monthlySales}
                      posName={pos.name}
                    />

                    {/* SECTION: HISTORIQUE / STATUT DES VENTES AUPRÈS DU PDV */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            salesCount > 0
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                              : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                          }`}>
                            <ShoppingCart className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-200">
                              {isVrs ? 'Mes ventes réalisées auprès de ce PDV' : 'Ventes réalisées auprès de ce PDV'}
                            </h4>
                            <span className="text-[10px] text-slate-400">
                              {salesCount === 0
                                ? 'Aucune vente enregistrée'
                                : `${salesCount} vente${salesCount > 1 ? 's' : ''} réalisée${salesCount > 1 ? 's' : ''} (${(pos.totalSalesAmount || 0).toLocaleString('fr-FR')} FCFA)`}
                            </span>
                          </div>
                        </div>

                        {onStartSale && (
                          pos.status === 'ACTIF' || pos.status === 'VALIDE' ? (
                            <button
                              type="button"
                              onClick={() => onStartSale(pos.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md active:scale-95 cursor-pointer"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>Nouvelle vente</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-300 text-[10px] font-bold">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Validation requise avant vente</span>
                            </span>
                          )
                        )}
                      </div>

                      {salesCount === 0 ? (
                        /* Cas où il n'y a pas eu de vente */
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-2">
                          <div className="inline-flex items-center justify-center p-2 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                            <ShoppingCart className="w-4 h-4 text-amber-400/80" />
                          </div>
                          <p className="text-xs sm:text-sm font-semibold text-amber-300">
                            {pos.status === 'EN ATTENTE'
                              ? 'Point de vente en attente de validation obligatoire'
                              : isVrs
                              ? "Vous n'avez pas encore réalisé de vente auprès de ce point de vente"
                              : 'Pas de vente réalisé pour le moment dans ce point de vente'}
                          </p>
                          <p className="text-[11px] sm:text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                            {pos.status === 'EN ATTENTE'
                              ? 'Ce point de vente doit impérativement être validé par le Sales Admin ou le Sales Admin National avant de pouvoir enregistrer des ventes ou l\'intégrer à vos tournées.'
                              : 'Le vendeur peut enregistrer un nouveau point de vente sans réaliser de vente immédiate. Ce point de vente est actif et prêt pour les commandes.'}
                          </p>
                          {onStartSale && (pos.status === 'ACTIF' || pos.status === 'VALIDE') && (
                            <div className="pt-1.5">
                              <button
                                type="button"
                                onClick={() => onStartSale(pos.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-semibold transition active:scale-95 cursor-pointer"
                              >
                                <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Effectuer une première vente (facultatif)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Liste des ventes enregistrées auprès de ce PDV */
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {effectiveSales.map((s: any) => (
                            <div
                              key={s.id}
                              className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-white text-xs">
                                    {s.saleNumber || s.sale_number}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    {s.status === 'COMPLETED' ? 'VALIDÉE' : s.status}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Par <span className="text-slate-300 font-medium">{s.vrsName}</span> • {new Date(s.createdAt || s.created_at).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="font-mono font-bold text-emerald-400 text-sm">
                                  {(s.totalAmount || s.total_amount || 0).toLocaleString('fr-FR')} FCFA
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {s.totalCartons || 0} carton{(s.totalCartons || 0) > 1 ? 's' : ''} ({s.itemCount || 1} réf)
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* SECTION: VALIDATION FOR SALES ADMIN */}
              {pos.status === 'EN ATTENTE' && (
                canValidate ? (
                  <div className="p-4 bg-amber-950/40 border border-amber-600/80 rounded-2xl space-y-2.5 shadow-lg">
                    <div className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-amber-400" />
                      <span>Validation obligatoire du Point de Vente</span>
                    </div>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      Ce point de vente a été créé et n'est pas encore actif. Conformément aux règles de gestion, seul un Sales Admin ou Sales Admin National peut valider son entrée dans le réseau commercial après vérification des coordonnées GPS et de la photo de façade.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus('ACTIF')}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Valider & Activer le PDV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus('REJETE')}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-red-900/80 text-slate-300 hover:text-red-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                      >
                        Rejeter
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-xl space-y-1">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>En attente de validation obligatoire</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Ce point de vente a été enregistré avec succès mais reste inactif. Il doit impérativement être validé par votre Sales Admin avant d'être activé pour les ventes et les tournées.
                    </p>
                  </div>
                )
              )}

              {/* SECTION: GESTION DE LA SUPPRESSION DU POINT DE VENTE */}
              {pos && pos.status !== 'SUPPRIME' && (
                <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Gestion de la suppression du PDV</span>
                    </div>
                    {pos.deletionStatus && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        pos.deletionStatus === 'EN_ATTENTE_APPROBATION'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : pos.deletionStatus === 'REJETEE'
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {pos.deletionStatus === 'EN_ATTENTE_APPROBATION'
                          ? 'En attente avis SAN'
                          : pos.deletionStatus === 'REJETEE'
                          ? 'Demande rejetée'
                          : 'Suppression approuvée'}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400">
                    {isSAN
                      ? 'En tant que Sales Admin National (SAN), vous disposez du privilège exclusif de supprimer directement un point de vente.'
                      : 'Les points de vente ne sont pas supprimés automatiquement. En tant que vendeur, vous pouvez soumettre une demande motivée qui sera examinée et approuvée par le Sales Admin National (SAN).'}
                  </p>

                  <div className="pt-1">
                    {isSAN ? (
                      <button
                        type="button"
                        onClick={() => setIsConfirmingDirectDelete(true)}
                        className="w-full sm:w-auto px-4 py-2 bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer ce PDV (Habilitation SAN)</span>
                      </button>
                    ) : (
                      pos.deletionStatus !== 'EN_ATTENTE_APPROBATION' && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeletionReasonInput('');
                            setIsRequestDeletionOpen(true);
                          }}
                          className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-red-950/60 border border-slate-700 hover:border-red-800 text-slate-300 hover:text-red-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>Demander la suppression du PDV (Approbation SAN)</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-950/90 gap-2">
          <span className="text-[11px] text-slate-500 truncate">
            {pos ? `ID Public : ${pos.publicId || pos.code}` : ''}
          </span>
          <div className="flex items-center gap-2">
            {pos && (
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Télécharger la fiche récapitulative en PDF"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>Exporter en PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>

        {/* SUB-MODAL: VRS Request Deletion Modal */}
        {isRequestDeletionOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Demande de suppression de PDV</h3>
                  <p className="text-[11px] text-slate-400">Soumise au Sales Admin National (SAN)</p>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1">
                <p>
                  <strong>PDV :</strong> {pos?.name} ({pos?.code})
                </p>
                <p className="text-[11px] text-slate-400">
                  Conformément aux règles de gestion, seul le SAN peut valider la suppression. Veuillez renseigner le motif ci-dessous.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Motif de la demande de suppression <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={deletionReasonInput}
                  onChange={(e) => setDeletionReasonInput(e.target.value)}
                  placeholder="Ex : Fermeture définitive de la boutique, changement d'activité, cessation d'exploitation..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRequestDeletionOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={!deletionReasonInput.trim() || isSubmittingDeletion}
                  onClick={handleRequestDeletionVRS}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingDeletion ? 'Envoi...' : 'Transmettre au SAN'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB-MODAL: SAN Confirm Direct Deletion Modal */}
        {isConfirmingDirectDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
            <div className="w-full max-w-md bg-slate-900 border border-red-800/80 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Confirmer la suppression par le SAN</h3>
                  <p className="text-[11px] text-red-300">Privilège Sales Admin National</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Êtes-vous certain de vouloir supprimer le point de vente <strong className="text-white">'{pos?.name}'</strong> ({pos?.code}) ?
              </p>

              <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-[11px] text-red-200">
                Le point de vente sera retiré de la liste active et archivé de façon sécurisée.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConfirmingDirectDelete(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isSubmittingDeletion}
                  onClick={handleDirectDeleteSAN}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isSubmittingDeletion ? 'Suppression...' : 'Confirmer la suppression'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB-MODAL: SAN Rejection Note Modal */}
        {isRejectingModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Rejeter la demande de suppression</h3>
                  <p className="text-[11px] text-slate-400">Le PDV restera actif dans le réseau</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Motif du rejet (facultatif)
                </label>
                <textarea
                  rows={3}
                  value={rejectionNoteInput}
                  onChange={(e) => setRejectionNoteInput(e.target.value)}
                  placeholder="Ex : Activité commerciale toujours en cours vérifiée sur le terrain..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRejectingModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isApprovingDeletion}
                  onClick={() => handleApproveDeletionSAN(false, rejectionNoteInput)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  {isApprovingDeletion ? 'Traitement...' : 'Confirmer le rejet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Camera Capture Modal avec diagnostic granulaire */}
      {isCameraModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsCameraModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-4 sm:p-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white truncate">
                  Photo de {pos ? pos.name : 'Point de vente'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-3">
              <CameraCapture
                onCapture={(dataUrl) => {
                  setIsCameraModalOpen(false);
                  setPendingPhotoPreview(dataUrl);
                }}
                label="Prendre une photo de la boutique"
                framingHint="Cadrez la façade du point de vente"
                defaultFacingMode="environment"
                showGalleryOption={true}
                aspectRatio="4/3"
                onCancel={() => setIsCameraModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
