import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { GiftCatalogItem } from '../../types/index.ts';
import { GiftIllustration } from './GiftIllustration.tsx';
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Power,
  Camera,
  Upload,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Package,
  Layers,
  Coins,
  Boxes,
  Eye,
  History,
  Check,
  AlertCircle,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';

interface AuditLogEntry {
  id: number;
  user_public_id?: string;
  action: string;
  details?: string;
  created_at: string;
}

export const GiftCatalogView: React.FC = () => {
  const { user } = useAuth();
  const isSan = user?.role === 'SALES_ADMIN_NATIONAL';

  // Data states
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'BRONZE' | 'OR'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIF' | 'INACTIF'>('ALL');
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Modal states for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingGift, setEditingGift] = useState<GiftCatalogItem | null>(null);
  const [modalFormName, setModalFormName] = useState<string>('');
  const [modalFormTier, setModalFormTier] = useState<'BRONZE' | 'OR'>('BRONZE');
  const [modalFormDescription, setModalFormDescription] = useState<string>('');
  const [modalFormEstimatedValue, setModalFormEstimatedValue] = useState<number>(100000);
  const [modalFormQuantity, setModalFormQuantity] = useState<number>(5);
  const [modalFormSvgKey, setModalFormSvgKey] = useState<string>('tv');
  const [modalFormPhotoUrl, setModalFormPhotoUrl] = useState<string | null>(null);
  const [modalFormStatus, setModalFormStatus] = useState<'ACTIF' | 'INACTIF'>('ACTIF');
  const [savingGift, setSavingGift] = useState<boolean>(false);

  // Photo upload & processing states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetGiftForPhotoRef = useRef<number | null>(null); // if null, photo is for active modal form
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);

  // Confirmation modal for deleting photo
  const [photoToDeleteGift, setPhotoToDeleteGift] = useState<{ id: number; name: string } | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState<boolean>(false);

  // Confirmation modal for deleting / deactivating
  const [giftToToggle, setGiftToToggle] = useState<GiftCatalogItem | null>(null);

  // Fetch gifts catalog
  const loadCatalog = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.getGiftCatalog();
      setCatalog(res.catalog || []);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Erreur lors du chargement du catalogue cadeaux.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch recent catalog audit logs
  const loadAuditLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await api.getActivityLogs({ limit: 40 });
      const filtered = (res.logs || []).filter((l: any) =>
        l.resource === 'SCORING_GIFTS' &&
        (l.action.includes('CADEAU') || l.action.includes('PHOTO'))
      );
      setAuditLogs(filtered);
    } catch {
      // Non-critical, ignore
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (showAuditLogs) {
      loadAuditLogs();
    }
  }, [showAuditLogs, loadAuditLogs]);

  // Clean feedback timer
  useEffect(() => {
    if (feedbackMsg) {
      const t = setTimeout(() => setFeedbackMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [feedbackMsg]);

  // Open Modal for New Gift
  const handleOpenAddModal = () => {
    setEditingGift(null);
    setModalFormName('');
    setModalFormTier('BRONZE');
    setModalFormDescription('');
    setModalFormEstimatedValue(50000);
    setModalFormQuantity(5);
    setModalFormSvgKey('tv');
    setModalFormPhotoUrl(null);
    setModalFormStatus('ACTIF');
    targetGiftForPhotoRef.current = null;
    setIsModalOpen(true);
  };

  // Open Modal for Editing Gift
  const handleOpenEditModal = (gift: GiftCatalogItem) => {
    setEditingGift(gift);
    setModalFormName(gift.name);
    setModalFormTier(gift.tier);
    setModalFormDescription(gift.description || '');
    setModalFormEstimatedValue(gift.estimated_value_fcfa || 0);
    setModalFormQuantity(gift.quantity || 0);
    setModalFormSvgKey(gift.svg_key || (gift.tier === 'OR' ? 'smartphone' : 'tv'));
    setModalFormPhotoUrl(gift.photo_url || gift.custom_photo || null);
    setModalFormStatus(gift.status || 'ACTIF');
    targetGiftForPhotoRef.current = gift.id;
    setIsModalOpen(true);
  };

  // Process square crop and compress to max 1024px JPEG 0.8
  const processSquareImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Validate strict 5 Mo client side
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return reject(new Error('La photo dépasse la limite autorisée de 5 Mo.'));
      }

      // Check mime type starts with image/
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && !file.type.startsWith('image/')) {
        return reject(new Error('Format non supporté. Seuls JPEG, PNG et WebP sont acceptés.'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (w <= 0 || h <= 0) {
            return reject(new Error('Dimensions image invalides.'));
          }

          // Center square crop
          const minSide = Math.min(w, h);
          const targetSize = Math.min(minSide, 1024);

          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Erreur context canvas 2D.'));
          }

          const sx = (w - minSide) / 2;
          const sy = (h - minSide) / 2;

          // High quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

          // Export as JPEG with 0.8 quality factor per requirements
          const jpegData = canvas.toDataURL('image/jpeg', 0.8);
          resolve(jpegData);
        };
        img.onerror = () => reject(new Error('Impossible de charger et décoder le fichier image.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier image.'));
      reader.readAsDataURL(file);
    });
  };

  // Trigger file input for photo
  const handleTriggerFileInput = (giftId: number | null) => {
    targetGiftForPhotoRef.current = giftId;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle file selected from camera / gallery
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const squareJpeg = await processSquareImage(file);
      const targetGiftId = targetGiftForPhotoRef.current;

      const res = await api.uploadGiftPhoto(squareJpeg, targetGiftId || undefined);

      if (res.success && res.photo_url) {
        setFeedbackMsg({
          type: 'success',
          text: `Photo importée et recadrée (carré 1024px, JPEG 0.8, ${(res.sizeBytes / 1024).toFixed(0)} Ko).`,
        });

        // If target was the modal form
        if (targetGiftId === null || (editingGift && editingGift.id === targetGiftId)) {
          setModalFormPhotoUrl(res.photo_url);
        }

        // Update in-memory catalog
        if (targetGiftId) {
          setCatalog((prev) =>
            prev.map((g) =>
              g.id === targetGiftId
                ? { ...g, photo_url: res.photo_url, custom_photo: res.photo_url }
                : g
            )
          );
        }

        if (showAuditLogs) loadAuditLogs();
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || "Échec de l'envoi de la photo.",
      });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete photo confirmation
  const handleConfirmDeletePhoto = async () => {
    if (!photoToDeleteGift) return;
    setIsDeletingPhoto(true);

    try {
      const giftId = photoToDeleteGift.id;
      // If deleting photo for active modal form (and gift not yet saved or currently editing)
      if (editingGift && editingGift.id === giftId) {
        setModalFormPhotoUrl(null);
      }

      await api.deleteGiftPhoto(giftId);

      setCatalog((prev) =>
        prev.map((g) =>
          g.id === giftId
            ? { ...g, photo_url: null, custom_photo: null }
            : g
        )
      );

      setFeedbackMsg({
        type: 'success',
        text: `Photo du cadeau "${photoToDeleteGift.name}" supprimée. Illustration SVG rétablie.`,
      });

      if (showAuditLogs) loadAuditLogs();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Erreur lors de la suppression de la photo.',
      });
    } finally {
      setIsDeletingPhoto(false);
      setPhotoToDeleteGift(null);
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (gift: GiftCatalogItem) => {
    try {
      const res = await api.toggleGiftStatus(gift.id);
      const updated = res.gift;
      setCatalog((prev) => prev.map((g) => (g.id === gift.id ? updated : g)));
      setFeedbackMsg({
        type: 'success',
        text: `Cadeau "${gift.name}" ${updated.status === 'ACTIF' ? 'activé' : 'désactivé'} avec succès.`,
      });
      if (showAuditLogs) loadAuditLogs();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Erreur lors du changement de statut.',
      });
    } finally {
      setGiftToToggle(null);
    }
  };

  // Submit modal form (Add or Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFormName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Le nom du cadeau est obligatoire.' });
      return;
    }

    setSavingGift(true);
    try {
      const payload = {
        name: modalFormName.trim(),
        tier: modalFormTier,
        description: modalFormDescription.trim(),
        estimated_value_fcfa: Math.max(0, Number(modalFormEstimatedValue) || 0),
        quantity: Math.max(0, parseInt(String(modalFormQuantity), 10) || 0),
        svg_key: modalFormSvgKey,
        photo_url: modalFormPhotoUrl,
        custom_photo: modalFormPhotoUrl,
        status: modalFormStatus,
      };

      if (editingGift) {
        // Edit existing
        const res = await api.updateGiftInCatalog(editingGift.id, payload);
        const updated = res.gift;
        setCatalog((prev) => prev.map((g) => (g.id === editingGift.id ? updated : g)));
        setFeedbackMsg({
          type: 'success',
          text: `Cadeau "${updated.name}" mis à jour avec succès.`,
        });
      } else {
        // Add new
        const res = await api.addGiftToCatalog(payload);
        const created = res.gift;
        setCatalog((prev) => [created, ...prev]);
        setFeedbackMsg({
          type: 'success',
          text: `Cadeau "${created.name}" ajouté au palier ${created.tier} avec succès.`,
        });
      }

      setIsModalOpen(false);
      setEditingGift(null);
      if (showAuditLogs) loadAuditLogs();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || "Erreur lors de l'enregistrement du cadeau.",
      });
    } finally {
      setSavingGift(false);
    }
  };

  // Filtered catalog list
  const filteredCatalog = catalog.filter((gift) => {
    if (tierFilter !== 'ALL' && gift.tier !== tierFilter) return false;
    if (statusFilter !== 'ALL' && gift.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = gift.name.toLowerCase().includes(q);
      const matchDesc = (gift.description || '').toLowerCase().includes(q);
      const matchTier = gift.tier.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchTier) return false;
    }
    return true;
  });

  // Split by tier for organized presentation
  const bronzeGifts = filteredCatalog.filter((g) => g.tier === 'BRONZE');
  const orGifts = filteredCatalog.filter((g) => g.tier === 'OR');

  // Stats
  const totalCount = catalog.length;
  const activeCount = catalog.filter((g) => g.status === 'ACTIF').length;
  const bronzeCount = catalog.filter((g) => g.tier === 'BRONZE' && g.status === 'ACTIF').length;
  const orCount = catalog.filter((g) => g.tier === 'OR' && g.status === 'ACTIF').length;
  const totalEstimatedValue = catalog.reduce(
    (acc, g) => acc + (g.status === 'ACTIF' ? (g.estimated_value_fcfa || 0) * (g.quantity || 0) : 0),
    0
  );

  const renderGiftCard = (gift: GiftCatalogItem) => {
    const isOr = gift.tier === 'OR';
    const isActive = gift.status === 'ACTIF';
    const hasCustomPhoto = Boolean(gift.photo_url || gift.custom_photo);
    const photoSrc = gift.photo_url || gift.custom_photo || null;

    return (
      <div
        key={gift.id}
        className={`flex flex-col bg-white dark:bg-slate-900 rounded-2xl border-2 transition-all shadow-sm overflow-hidden ${
          isActive
            ? isOr
              ? 'border-yellow-500/50 hover:border-yellow-500'
              : 'border-amber-600/50 hover:border-amber-600'
            : 'border-slate-300 dark:border-slate-700 opacity-75'
        }`}
      >
        {/* Top Bar: Palier Badge & Status */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span
            className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
              isOr
                ? 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border-yellow-500/40'
                : 'bg-amber-600/20 text-amber-900 dark:text-amber-300 border-amber-600/40'
            }`}
          >
            Palier {gift.tier}
          </span>

          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                isActive
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-400'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {isActive ? 'Actif' : 'Inactif'}
            </span>

            <button
              type="button"
              onClick={() => setGiftToToggle(gift)}
              title={isActive ? 'Désactiver le cadeau' : 'Activer le cadeau'}
              className={`p-1.5 rounded-lg border transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
                isActive
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-red-600 border-slate-300 dark:border-slate-700'
                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 border-emerald-400'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Media Area: Square Photo or SVG Illustration */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center border-b border-slate-200 dark:border-slate-800">
          <div className="relative w-36 h-36 rounded-xl overflow-hidden shadow-inner border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center group">
            {hasCustomPhoto && photoSrc ? (
              <img
                src={photoSrc}
                alt={gift.name}
                className="w-full h-full object-cover aspect-square"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full p-2 flex items-center justify-center">
                <GiftIllustration
                  svgKey={gift.svg_key}
                  name={gift.name}
                  tier={gift.tier}
                  className="w-full h-full"
                  size={110}
                />
              </div>
            )}

            {/* Overlaid Badge for illustration type */}
            <div className="absolute bottom-1 right-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-sm">
                {hasCustomPhoto ? 'Photo réelle' : 'Illustration SVG'}
              </span>
            </div>
          </div>

          {/* Photo Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 w-full">
            {hasCustomPhoto ? (
              <>
                <button
                  type="button"
                  onClick={() => handleTriggerFileInput(gift.id)}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                  title="Remplacer la photo (recadrage carré 1024px, JPEG 0.8)"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-600" />
                  <span>Remplacer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPhotoToDeleteGift({ id: gift.id, name: gift.name })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 rounded-xl text-xs font-bold transition cursor-pointer"
                  title="Supprimer la photo et rétablir le SVG par défaut"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>Supprimer</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleTriggerFileInput(gift.id)}
                disabled={uploadingPhoto}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[44px] w-full bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer active:scale-[0.98]"
              >
                <Upload className="w-4 h-4 text-[#15803D]" />
                <span>Ajouter une photo (44px)</span>
              </button>
            )}
          </div>
        </div>

        {/* Gift Info Body */}
        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
              {gift.name}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
              {gift.description || 'Aucune description spécifique fournie.'}
            </p>
          </div>

          {/* Data attributes: Valeur estimée & Quantité */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Valeur estimée</span>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {(gift.estimated_value_fcfa || 0).toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Quantité disponible</span>
              <span className={`text-xs font-black ${(gift.quantity || 0) <= 2 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                {gift.quantity || 0} {(gift.quantity || 0) <= 1 ? 'unité' : 'unités'}
              </span>
            </div>
          </div>

          {/* Edit button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleOpenEditModal(gift)}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 transition cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Modifier les informations</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!isSan) {
    return (
      <div className="p-6 max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 border-2 border-red-300 dark:border-red-900 rounded-2xl shadow-xl text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Accès Réservé au SAN</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          L'écran "Catalogue cadeaux" est exclusivement réservé au Sales Admin National (SAN) pour administrer les dotations semestrielles des vendeurs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 px-3 sm:px-6 pt-2">
      {/* Hidden file input for camera/gallery photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Notification Toast */}
      {feedbackMsg && (
        <div
          role="alert"
          className={`p-4 rounded-xl border-2 flex items-center justify-between shadow-lg text-sm font-bold transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-900 dark:text-emerald-100'
              : 'bg-red-50 dark:bg-red-950/80 border-red-500 text-red-900 dark:text-red-100'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fermer la notification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Screen Header */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Catalogue Cadeaux (SAN)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
              Dotations officielles pour les cartes à gratter semestrielles des VRS (tirage au sort côté serveur).
              Palier Bronze (note 10 à 14,5/20) &amp; Palier Or (note 15 à 20/20).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadCatalog(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Rafraîchir les données"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              className={`inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold border transition cursor-pointer ${
                showAuditLogs
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Journal d'audit</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau cadeau</span>
            </button>
          </div>
        </div>

        {/* Catalog KPI Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Cadeaux</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{totalCount}</span>
              <span className="text-xs text-slate-500 font-medium">({activeCount} actifs)</span>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
            <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Palier Bronze (10-14,5)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-amber-800 dark:text-amber-300">{bronzeCount}</span>
              <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">actifs</span>
            </div>
          </div>

          <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/40">
            <span className="text-[11px] font-black text-yellow-700 dark:text-yellow-400 uppercase tracking-wider block">Palier Or (15-20)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-yellow-800 dark:text-yellow-300">{orCount}</span>
              <span className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">actifs</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
            <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Valeur Dotations</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-300">
                {totalEstimatedValue.toLocaleString('fr-FR')}
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">FCFA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Panel (Collapsible) */}
      {showAuditLogs && (
        <div className="bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-900/60 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Journal d'audit du catalogue (Traçabilité serveur)
              </h3>
            </div>
            <button
              type="button"
              onClick={loadAuditLogs}
              disabled={loadingLogs}
              className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer min-h-[44px] px-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              Actualiser le journal
            </button>
          </div>

          {loadingLogs ? (
            <div className="p-6 text-center text-xs text-slate-500">Chargement des événements d'audit...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              Aucun événement récent sur le catalogue de cadeaux.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{log.details}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">{log.user_public_id}</span>
                    <span>•</span>
                    <span>{new Date(log.created_at).toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher par nom (TV, mixeur, smartphone...), description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-9 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tier filter */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setTierFilter('ALL')}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition cursor-pointer ${
                tierFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('BRONZE')}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition cursor-pointer ${
                tierFilter === 'BRONZE'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-800 dark:text-amber-400 hover:text-amber-900'
              }`}
            >
              Bronze
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('OR')}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition cursor-pointer ${
                tierFilter === 'OR'
                  ? 'bg-yellow-600 text-white shadow-sm'
                  : 'text-yellow-700 dark:text-yellow-400 hover:text-yellow-900'
              }`}
            >
              Or
            </button>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="min-h-[44px] px-3 bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Tous statuts</option>
            <option value="ACTIF">Actifs</option>
            <option value="INACTIF">Inactifs</option>
          </select>
        </div>
      </div>

      {/* Gifts Grid by Tiers */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
            Chargement du catalogue des cadeaux...
          </p>
        </div>
      ) : filteredCatalog.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl space-y-4">
          <Package className="w-12 h-12 text-slate-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Aucun cadeau trouvé
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Aucun cadeau ne correspond à vos critères de recherche ou de filtre. Modifiez vos filtres ou ajoutez un nouveau cadeau.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold rounded-xl shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un cadeau</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Palier Or Section (15 à 20) */}
          {(tierFilter === 'ALL' || tierFilter === 'OR') && orGifts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b-2 border-yellow-500/40 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-yellow-500/20 border border-yellow-500 flex items-center justify-center text-yellow-700 dark:text-yellow-400 font-black text-xs">
                    OR
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Palier Or (15 à 20 / 20)</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border border-yellow-500/40">
                        {orGifts.length} {orGifts.length > 1 ? 'cadeaux' : 'cadeau'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Attribué aux VRS ayant obtenu une note comprise entre 15 et 20/20 (ex: Smartphone, moto Jakarta, ordinateur).
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orGifts.map((gift) => renderGiftCard(gift))}
              </div>
            </div>
          )}

          {/* Palier Bronze Section (10 à 14,5) */}
          {(tierFilter === 'ALL' || tierFilter === 'BRONZE') && bronzeGifts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b-2 border-amber-600/40 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-600/20 border border-amber-600 flex items-center justify-center text-amber-800 dark:text-amber-400 font-black text-xs">
                    BR
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Palier Bronze (10 à 14,5 / 20)</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-900 dark:text-amber-300 border border-amber-600/40">
                        {bronzeGifts.length} {bronzeGifts.length > 1 ? 'cadeaux' : 'cadeau'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Attribué aux VRS ayant validé la note de 10 à 14,5/20 (ex: TV Smart, mini frigo, mixeur, machine à café).
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bronzeGifts.map((gift) => renderGiftCard(gift))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SHARED OPAQUE MODAL FOR ADDING / EDITING GIFTS (MOBILE FIRST)              */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {editingGift ? `Modifier : ${editingGift.name}` : 'Ajouter un cadeau au catalogue'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer"
                aria-label="Fermer le formulaire"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Photo Area inside Modal */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Visuel du cadeau (Photo carrée ou illustration SVG) :
                </label>

                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-inner">
                    {modalFormPhotoUrl ? (
                      <img
                        src={modalFormPhotoUrl}
                        alt="Aperçu"
                        className="w-full h-full object-cover aspect-square"
                      />
                    ) : (
                      <GiftIllustration
                        svgKey={modalFormSvgKey}
                        name={modalFormName || 'Cadeau'}
                        tier={modalFormTier}
                        className="w-full h-full"
                        size={80}
                      />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <p className="text-[11px] text-slate-500">
                      {modalFormPhotoUrl
                        ? 'Photo personnalisée active (carré 1024px max, JPEG 0.8).'
                        : 'Aucune photo importée. L\'illustration SVG sélectionnée sera affichée par défaut.'}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleTriggerFileInput(editingGift ? editingGift.id : null)}
                        disabled={uploadingPhoto}
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-amber-600" />
                        <span>{modalFormPhotoUrl ? 'Remplacer photo' : 'Ajouter une photo'}</span>
                      </button>

                      {modalFormPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Voulez-vous supprimer cette photo et réactiver l\'illustration SVG par défaut ?')) {
                              if (editingGift) {
                                setPhotoToDeleteGift({ id: editingGift.id, name: editingGift.name });
                              } else {
                                setModalFormPhotoUrl(null);
                              }
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] bg-red-50 hover:bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nom du cadeau * :
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: TV Smart, Mini frigo, Mixeur, Smartphone, Moto Jakarta, Ordinateur..."
                  value={modalFormName}
                  onChange={(e) => setModalFormName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Tier & SVG illustration default */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Palier d'éligibilité * :
                  </label>
                  <select
                    value={modalFormTier}
                    onChange={(e) => {
                      const newTier = e.target.value as 'BRONZE' | 'OR';
                      setModalFormTier(newTier);
                      if (newTier === 'OR' && modalFormSvgKey === 'tv') setModalFormSvgKey('smartphone');
                      if (newTier === 'BRONZE' && modalFormSvgKey === 'smartphone') setModalFormSvgKey('tv');
                    }}
                    className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="BRONZE">Bronze (Score 10 à 14,5/20)</option>
                    <option value="OR">Or (Score 15 à 20/20)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Illustration SVG par défaut * :
                  </label>
                  <select
                    value={modalFormSvgKey}
                    onChange={(e) => setModalFormSvgKey(e.target.value)}
                    className="w-full min-h-[44px] px-3 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <optgroup label="Palier Bronze">
                      <option value="tv">TV Smart</option>
                      <option value="fridge">Mini frigo</option>
                      <option value="blender">Mixeur</option>
                      <option value="coffeemaker">Machine à café</option>
                    </optgroup>
                    <optgroup label="Palier Or">
                      <option value="smartphone">Smartphone</option>
                      <option value="motorbike">Moto Jakarta</option>
                      <option value="computer">Ordinateur</option>
                    </optgroup>
                    <optgroup label="Autre">
                      <option value="gift">Cadeau générique</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Valeur estimée & Quantité */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Valeur estimée (FCFA) * :
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={modalFormEstimatedValue}
                    onChange={(e) => setModalFormEstimatedValue(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Quantité en stock disponible * :
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={modalFormQuantity}
                    onChange={(e) => setModalFormQuantity(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Description &amp; caractéristiques :
                </label>
                <textarea
                  rows={2}
                  placeholder="Caractéristiques du modèle, accessoires inclus, garantie..."
                  value={modalFormDescription}
                  onChange={(e) => setModalFormDescription(e.target.value)}
                  className="w-full min-h-[64px] px-3.5 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Statut du cadeau :
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                    <input
                      type="radio"
                      name="giftStatus"
                      value="ACTIF"
                      checked={modalFormStatus === 'ACTIF'}
                      onChange={() => setModalFormStatus('ACTIF')}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Actif (Éligible au tirage au sort semestriel)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                    <input
                      type="radio"
                      name="giftStatus"
                      value="INACTIF"
                      checked={modalFormStatus === 'INACTIF'}
                      onChange={() => setModalFormStatus('INACTIF')}
                      className="w-4 h-4 text-red-600"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Inactif (Désactivé)
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={savingGift}
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingGift ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingGift ? 'Mettre à jour' : 'Ajouter le cadeau'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL: DELETE PHOTO                                          */}
      {/* ========================================================================= */}
      {photoToDeleteGift && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border-2 border-red-300 dark:border-red-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Supprimer la photo du cadeau ?
                </h4>
                <p className="text-xs text-slate-500">
                  {photoToDeleteGift.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Êtes-vous sûr de vouloir supprimer définitivement la photo personnalisée de ce cadeau ?
              L'illustration SVG officielle 6C DMS sera rétablie et affichée sur la carte cadeau.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPhotoToDeleteGift(null)}
                className="px-4 py-2 min-h-[44px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePhoto}
                disabled={isDeletingPhoto}
                className="px-4 py-2 min-h-[44px] bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingPhoto ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Supprimer la photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL: TOGGLE STATUS (ACTIF / INACTIF)                       */}
      {/* ========================================================================= */}
      {giftToToggle && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  giftToToggle.status === 'ACTIF'
                    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 text-amber-700'
                    : 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 text-emerald-700'
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {giftToToggle.status === 'ACTIF' ? 'Désactiver le cadeau ?' : 'Activer le cadeau ?'}
                </h4>
                <p className="text-xs text-slate-500">{giftToToggle.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {giftToToggle.status === 'ACTIF'
                ? `Ce cadeau ne pourra plus être tiré au sort par le serveur lors des prochaines clôtures semestrielles du Palier ${giftToToggle.tier}. L'action sera inscrite au journal d'audit.`
                : `Ce cadeau sera réintégré dans le vivier officiel de tirage au sort semestriel du Palier ${giftToToggle.tier}. L'action sera inscrite au journal d'audit.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGiftToToggle(null)}
                className="px-4 py-2 min-h-[44px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleToggleStatus(giftToToggle)}
                className={`px-4 py-2 min-h-[44px] text-white rounded-xl text-xs font-bold shadow transition cursor-pointer flex items-center gap-1.5 ${
                  giftToToggle.status === 'ACTIF'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-[#15803D] hover:bg-[#166534]'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>{giftToToggle.status === 'ACTIF' ? 'Désactiver' : 'Activer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftCatalogView;
