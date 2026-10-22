import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import {
  Semester,
  VrsSemesterScore,
  VrsScoringSettings,
  GiftCatalogItem,
} from '../../types/index.ts';
import { GiftIllustration } from './GiftIllustration.tsx';
import {
  Award,
  Settings,
  Download,
  Calendar,
  Lock,
  LockOpen,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  X,
  FileSpreadsheet,
  Check,
  Gift,
  Camera,
  Image as ImageIcon,
  Upload,
  Eye,
  ExternalLink,
  ZoomIn,
} from 'lucide-react';

export const PRESET_GIFT_PHOTOS = [
  {
    key: 'tv',
    title: 'TV Smart LED 43"',
    tier: 'BRONZE' as const,
    url: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80',
    description: 'Téléviseur Smart Full HD connectivité Wi-Fi',
    svg_key: 'tv',
  },
  {
    key: 'fridge',
    title: 'Mini Réfrigérateur Compact',
    tier: 'BRONZE' as const,
    url: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80',
    description: 'Mini réfrigérateur compact basse consommation',
    svg_key: 'fridge',
  },
  {
    key: 'blender',
    title: 'Mixeur Inox Multifonction',
    tier: 'BRONZE' as const,
    url: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80',
    description: 'Mixeur multifonction haute performance inox',
    svg_key: 'blender',
  },
  {
    key: 'coffeemaker',
    title: 'Machine à Café Expresso',
    tier: 'BRONZE' as const,
    url: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=800&q=80',
    description: 'Machine à café expresso automatique',
    svg_key: 'coffeemaker',
  },
  {
    key: 'smartphone',
    title: 'Smartphone 4G/5G Double SIM',
    tier: 'OR' as const,
    url: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80',
    description: 'Smartphone 4G/5G haute autonomie et double SIM',
    svg_key: 'smartphone',
  },
  {
    key: 'motorbike',
    title: 'Moto Jakarta Tout-Terrain',
    tier: 'OR' as const,
    url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    description: 'Moto Jakarta tout-terrain économique pour prospection',
    svg_key: 'motorbike',
  },
  {
    key: 'computer',
    title: 'Ordinateur Portable Pro 15.6"',
    tier: 'OR' as const,
    url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80',
    description: 'Ordinateur portable professionnel écran 15.6"',
    svg_key: 'computer',
  },
  {
    key: 'speaker',
    title: 'Enceinte Bluetooth Nomade',
    tier: 'BRONZE' as const,
    url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
    description: 'Enceinte sans fil haute autonomie étanche',
    svg_key: 'gift',
  },
  {
    key: 'generator',
    title: 'Groupe Électrogène Compact',
    tier: 'OR' as const,
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    description: 'Générateur portable silencieux à démarrage rapide',
    svg_key: 'gift',
  },
];

export const SanScoringManagementView: React.FC = () => {
  const { user, refreshNotifications } = useAuth();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'scores' | 'closing' | 'settings' | 'catalog'>('scores');

  // Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [scores, setScores] = useState<VrsSemesterScore[]>([]);
  const [settings, setSettings] = useState<VrsScoringSettings | null>(null);
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);

  // Search filter in table
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Settings form states
  const [wTurnover, setWTurnover] = useState<number>(8);
  const [wRegularity, setWRegularity] = useState<number>(4);
  const [wPayments, setWPayments] = useState<number>(4);
  const [wNewPos, setWNewPos] = useState<number>(2);
  const [wRigor, setWRigor] = useState<number>(2);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Correction modal states
  const [correctingScore, setCorrectingScore] = useState<VrsSemesterScore | null>(null);
  const [newScoreVal, setNewScoreVal] = useState<number>(0);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [submittingCorrection, setSubmittingCorrection] = useState<boolean>(false);

  // Add / Edit gift modal states
  const [editingGift, setEditingGift] = useState<Partial<GiftCatalogItem> | null>(null);
  const [isNewGift, setIsNewGift] = useState<boolean>(false);
  const [giftName, setGiftName] = useState<string>('');
  const [giftTier, setGiftTier] = useState<'BRONZE' | 'OR'>('BRONZE');
  const [giftSvgKey, setGiftSvgKey] = useState<string>('tv');
  const [giftDescription, setGiftDescription] = useState<string>('');
  const [giftPhotoUrl, setGiftPhotoUrl] = useState<string>('');
  const [savingGift, setSavingGift] = useState<boolean>(false);

  // Real photo upload & preview states
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoTab, setPhotoTab] = useState<'upload' | 'camera' | 'presets' | 'url'>('upload');
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string; subtitle?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Closing / Demo actions state
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load all initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [semRes, setRes, catRes] = await Promise.all([
        api.getSemesters().catch(() => ({ semesters: [] })),
        api.getScoringSettings().catch(() => ({ settings: null })),
        api.getGiftCatalog().catch(() => ({ catalog: [] })),
      ]);

      setSemesters(semRes.semesters);
      if (setRes.settings) {
        setSettings(setRes.settings);
        setWTurnover(setRes.settings.weight_turnover);
        setWRegularity(setRes.settings.weight_regularity);
        setWPayments(setRes.settings.weight_payments);
        setWNewPos(setRes.settings.weight_new_pos);
        setWRigor(setRes.settings.weight_rigor);
      }
      setCatalog(catRes.catalog);

      // Default semester
      const activeSemId = selectedSemesterId || semRes.semesters[0]?.id || null;
      if (activeSemId) {
        setSelectedSemesterId(activeSemId);
        const scoresRes = await api.getVrsScores(activeSemId);
        setScores(scoresRes.scores);
      }
    } catch (err: any) {
      console.error('Erreur chargement notation SAN:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSemesterId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Semester change
  const handleSemesterChange = async (id: number) => {
    setSelectedSemesterId(id);
    try {
      setLoading(true);
      const res = await api.getVrsScores(id);
      setScores(res.scores);
    } finally {
      setLoading(false);
    }
  };

  // In-app modal confirmation states (replacing window.confirm which is blocked in iframes)
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [closeForceMode, setCloseForceMode] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);

  // Open close confirmation modal
  const handleOpenCloseModal = (force = false) => {
    setCloseForceMode(force);
    setShowCloseModal(true);
  };

  const handleCloseSemester = () => {
    handleOpenCloseModal(false);
  };

  const handleResetDemoSemester = () => {
    setShowResetModal(true);
  };

  // Perform actual semester closing via API
  const proceedCloseSemester = async () => {
    const semId = selectedSemesterId || currentSem?.id || (semesters[0] ? semesters[0].id : null);
    if (!semId) {
      setFeedbackMsg({ type: 'error', text: 'Aucun semestre sélectionné.' });
      return;
    }

    try {
      setActionLoading(true);
      setShowCloseModal(false);
      const res = await api.closeSemester(semId, closeForceMode);
      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: `${res.message} ${res.cardsGenerated ? res.cardsGenerated.length : ''} carte(s) cadeau générée(s) avec succès !`,
        });
        refreshNotifications();
        await loadData();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de la clôture du semestre.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Reopen semester action
  const proceedReopenSemester = async () => {
    const semId = selectedSemesterId || currentSem?.id || (semesters[0] ? semesters[0].id : null);
    if (!semId) return;

    try {
      setActionLoading(true);
      setShowReopenModal(false);
      const res = await api.reopenSemester(semId);
      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Semestre "${currentSem?.name}" rouvert avec succès. Les notes sont de nouveau en cours de calcul.`,
        });
        refreshNotifications();
        await loadData();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de la réouverture du semestre.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Reset demo semester action (for verification & tests)
  const proceedResetDemoSemester = async () => {
    try {
      setActionLoading(true);
      setShowResetModal(false);
      const res = await api.resetDemoSemester();
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message });
        const semRes = await api.getSemesters();
        setSemesters(semRes.semesters);
        const s1 = semRes.semesters.find((s) => s.code === 'S1-2026');
        if (s1) {
          setSelectedSemesterId(s1.id);
          const scRes = await api.getVrsScores(s1.id);
          setScores(scRes.scores);
        }
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de la réinitialisation de la démo.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Save weights settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const sum = Number(wTurnover) + Number(wRegularity) + Number(wPayments) + Number(wNewPos) + Number(wRigor);
    if (Math.abs(sum - 20) > 0.01) {
      setFeedbackMsg({
        type: 'error',
        text: `La somme des pondérations doit être exactement égale à 20 points (total actuel : ${sum.toFixed(1)} pts).`,
      });
      return;
    }

    try {
      setSavingSettings(true);
      const res = await api.updateScoringSettings({
        weight_turnover: Number(wTurnover),
        weight_regularity: Number(wRegularity),
        weight_payments: Number(wPayments),
        weight_new_pos: Number(wNewPos),
        weight_rigor: Number(wRigor),
      });

      if (res.success) {
        setSettings(res.settings);
        setFeedbackMsg({
          type: 'success',
          text: 'Réglages de notation enregistrés avec succès et inscrits au journal d\'audit.',
        });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde des réglages.' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Open correction modal
  const openCorrectionModal = (score: VrsSemesterScore) => {
    setCorrectingScore(score);
    setNewScoreVal(score.total_score);
    setCorrectionReason('');
  };

  // Submit exceptional score correction
  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingScore || submittingCorrection) return;

    if (!correctionReason.trim() || correctionReason.trim().length < 5) {
      setFeedbackMsg({
        type: 'error',
        text: 'Un motif circonstancié (au moins 5 caractères) est strictement obligatoire.',
      });
      return;
    }

    try {
      setSubmittingCorrection(true);
      const res = await api.correctVrsScore(correctingScore.id, {
        new_total_score: Number(newScoreVal),
        reason: correctionReason.trim(),
      });

      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Note corrigée avec succès pour ${correctingScore.vrs_first_name} ${correctingScore.vrs_last_name}. Tracé dans l'audit.`,
        });
        setCorrectingScore(null);
        if (selectedSemesterId) {
          const scRes = await api.getVrsScores(selectedSemesterId);
          setScores(scRes.scores);
        }
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de la correction de la note.' });
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // Compress and prepare image file client-side
  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Le fichier sélectionné n\'est pas une image valide.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 1200;
          let width = img.width;
          let height = img.height;
          if (width > height && width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error('Erreur lors du chargement de l\'image.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
      reader.readAsDataURL(file);
    });
  };

  // Handle file or camera photo selection
  const handlePhotoSelected = async (file: File) => {
    try {
      setUploadingPhoto(true);
      setPhotoError(null);
      const base64Data = await processImageFile(file);
      // Try to upload to server storage
      try {
        const res = await api.uploadGiftPhoto(base64Data, editingGift?.id);
        if (res.success && res.photo_url) {
          setGiftPhotoUrl(res.photo_url);
          setFeedbackMsg({ type: 'success', text: 'Photo réelle téléversée avec succès sur le serveur.' });
          return;
        }
      } catch {
        // Fallback: keep base64 data URL
      }
      setGiftPhotoUrl(base64Data);
    } catch (err: any) {
      setPhotoError(err.message || 'Impossible de traiter cette image.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Open Add/Edit Gift Modal
  const openAddGiftModal = () => {
    setIsNewGift(true);
    setEditingGift({});
    setGiftName('');
    setGiftTier('BRONZE');
    setGiftSvgKey('tv');
    setGiftDescription('');
    setGiftPhotoUrl('');
    setPhotoError(null);
    setPhotoTab('presets');
  };

  const openEditGiftModal = (gift: GiftCatalogItem) => {
    setIsNewGift(false);
    setEditingGift(gift);
    setGiftName(gift.name);
    setGiftTier(gift.tier);
    setGiftSvgKey(gift.svg_key);
    setGiftDescription(gift.description || '');
    setGiftPhotoUrl(gift.photo_url || gift.custom_photo || '');
    setPhotoError(null);
    setPhotoTab(gift.photo_url || gift.custom_photo ? 'upload' : 'presets');
  };

  // Submit Gift
  const handleSubmitGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftName.trim() || savingGift) return;

    const photoToSave = giftPhotoUrl.trim() || null;

    try {
      setSavingGift(true);
      if (isNewGift) {
        const res = await api.addGiftToCatalog({
          name: giftName.trim(),
          tier: giftTier,
          svg_key: giftSvgKey,
          description: giftDescription.trim(),
          custom_photo: photoToSave,
          photo_url: photoToSave,
        });
        if (res.success) {
          setFeedbackMsg({ type: 'success', text: `Cadeau "${giftName}" ajouté au catalogue avec succès.` });
          setEditingGift(null);
          const catRes = await api.getGiftCatalog();
          setCatalog(catRes.catalog);
        }
      } else if (editingGift && editingGift.id) {
        const res = await api.updateGiftInCatalog(editingGift.id, {
          name: giftName.trim(),
          tier: giftTier,
          svg_key: giftSvgKey,
          description: giftDescription.trim(),
          custom_photo: photoToSave,
          photo_url: photoToSave,
        });
        if (res.success) {
          setFeedbackMsg({ type: 'success', text: `Cadeau "${giftName}" mis à jour avec succès.` });
          setEditingGift(null);
          const catRes = await api.getGiftCatalog();
          setCatalog(catRes.catalog);
        }
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de l\'enregistrement du cadeau.' });
    } finally {
      setSavingGift(false);
    }
  };

  // Toggle Gift Active / Inactive
  const handleToggleGiftStatus = async (gift: GiftCatalogItem) => {
    const newStatus = gift.status === 'ACTIF' ? 'INACTIF' : 'ACTIF';
    try {
      const res = await api.updateGiftInCatalog(gift.id, { status: newStatus });
      if (res.success) {
        setCatalog((prev) =>
          prev.map((g) => (g.id === gift.id ? { ...g, status: newStatus } : g))
        );
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors du changement de statut.' });
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!selectedSemesterId) return;
    const token = localStorage.getItem('6c_dist_token');
    const url = `/api/scoring/export-csv?semester_id=${selectedSemesterId}`;
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `notation-vrs-semestre-${selectedSemesterId}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => {
        setFeedbackMsg({ type: 'error', text: 'Erreur lors du téléchargement du CSV.' });
      });
  };

  // Current active semester entity
  const currentSem = semesters.find((s) => s.id === selectedSemesterId) || semesters[0];

  // Filtered scores by search term
  const filteredScores = scores.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (s.vrs_first_name && s.vrs_first_name.toLowerCase().includes(term)) ||
      (s.vrs_last_name && s.vrs_last_name.toLowerCase().includes(term)) ||
      (s.vrs_public_id && s.vrs_public_id.toLowerCase().includes(term)) ||
      (s.drop_point_name && s.drop_point_name.toLowerCase().includes(term)) ||
      (s.gift_name && s.gift_name.toLowerCase().includes(term))
    );
  });

  const settingsSum = Number(wTurnover) + Number(wRegularity) + Number(wPayments) + Number(wNewPos) + Number(wRigor);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase bg-[#15803D] text-white mb-1">
            <Trophy className="w-3.5 h-3.5" />
            Administration Nationale SAN
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Notation des VRS & Cartes Cadeaux
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Pilotage national des pondérations, clôture semestrielle, tirage serveur, catalogue de cadeaux et export CSV.
          </p>
        </div>

        {/* Global Semester Switcher & Export & Clôture */}
        <div className="flex flex-wrap items-center gap-2">
          {semesters.length > 0 && (
            <select
              value={selectedSemesterId || ''}
              onChange={(e) => handleSemesterChange(Number(e.target.value))}
              className="min-h-[48px] px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status === 'CLOTURE' ? 'Clôturé' : 'En cours'})
                </option>
              ))}
            </select>
          )}

          {currentSem?.status !== 'CLOTURE' ? (
            <button
              type="button"
              onClick={handleCloseSemester}
              disabled={actionLoading}
              className="min-h-[48px] px-4 py-2.5 bg-[#15803D] hover:bg-[#15803D]/90 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow active:scale-98 cursor-pointer disabled:opacity-50"
              title="Clôturer le semestre et générer les cartes cadeaux pour les vendeurs"
            >
              <Lock className="w-4 h-4" />
              Clôturer & Générer les cartes
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenCloseModal(true)}
              disabled={actionLoading}
              className="min-h-[48px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Semestre clôturé. Cliquez pour actualiser ou forcer la régénération des cartes"
            >
              <CheckCircle className="w-4 h-4 text-[#15803D]" />
              Semestre clôturé (Régénérer)
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[48px] px-4 py-2.5 bg-[#15803D] hover:bg-[#15803D]/90 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow active:scale-98 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center justify-between ${
            feedbackMsg.type === 'success' ? 'bg-[#15803D] text-white' : 'bg-[#DC2626] text-white'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="text-white hover:opacity-80 p-1">
            ✕
          </button>
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('scores')}
          className={`min-h-[48px] px-4 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'scores'
              ? 'border-[#15803D] text-[#15803D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Award className="w-4 h-4" />
          Tableau du Semestre ({scores.length} VRS)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('closing')}
          className={`min-h-[48px] px-4 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'closing'
              ? 'border-[#15803D] text-[#15803D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Clôture & Démo
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`min-h-[48px] px-4 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'settings'
              ? 'border-[#15803D] text-[#15803D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          Réglages de Notation (Total 20)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`min-h-[48px] px-4 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'catalog'
              ? 'border-[#15803D] text-[#15803D]'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Gift className="w-4 h-4" />
          Catalogue de Cadeaux ({catalog.length})
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: TABLEAU DU SEMESTRE */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'scores' && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total VRS Évalués</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{scores.length}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Cartes Palier Or (≥ 15)</span>
              <p className="text-2xl font-black text-[#15803D] mt-1">
                {scores.filter((s) => s.total_score >= 15).length}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Cartes Palier Bronze (10 à 14,5)</span>
              <p className="text-2xl font-black text-[#92400E] mt-1">
                {scores.filter((s) => s.total_score >= 10 && s.total_score < 15).length}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Sans Carte (&lt; 10)</span>
              <p className="text-2xl font-black text-slate-500 mt-1">
                {scores.filter((s) => s.total_score < 10).length}
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, Drop Point, cadeau..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[48px] pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
            />
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3">Vendeur (VRS)</th>
                    <th className="p-3">Drop Point</th>
                    <th className="p-3 text-center">CA (/8)</th>
                    <th className="p-3 text-center">Régularité (/4)</th>
                    <th className="p-3 text-center">Paiements (/4)</th>
                    <th className="p-3 text-center">PDV (/2)</th>
                    <th className="p-3 text-center">Rigueur (/2)</th>
                    <th className="p-3 text-center font-black">Note (/20)</th>
                    <th className="p-3 text-center">Palier</th>
                    <th className="p-3">Carte & Cadeau Tiré</th>
                    <th className="p-3">Remise</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredScores.map((s) => {
                    const isOr = s.total_score >= 15;
                    const isBronze = s.total_score >= 10 && s.total_score < 15;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {s.vrs_first_name} {s.vrs_last_name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">{s.vrs_public_id}</span>
                        </td>
                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                          {s.drop_point_name || 'N/A'}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                          {s.turnover_score.toFixed(1)}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                          {s.regularity_score.toFixed(1)}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                          {s.payments_score.toFixed(1)}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                          {s.new_pos_score.toFixed(1)}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                          {s.rigor_score.toFixed(1)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {s.total_score.toFixed(1)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              isOr
                                ? 'bg-[#15803D] text-white'
                                : isBronze
                                ? 'bg-[#92400E] text-white'
                                : 'bg-[#E2E8F0] text-black dark:text-white'
                            }`}
                          >
                            {isOr ? 'Or' : isBronze ? 'Bronze' : 'Aucun'}
                          </span>
                        </td>
                        <td className="p-3">
                          {s.card_id ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="relative cursor-pointer group shrink-0"
                                onClick={() => {
                                  const photo = s.gift_photo_url || s.gift_custom_photo;
                                  if (photo) {
                                    setLightboxImage({
                                      src: photo,
                                      title: s.gift_name || 'Cadeau',
                                      subtitle: `Attribué à ${s.vrs_first_name} ${s.vrs_last_name} (${s.vrs_public_id}) • Palier ${s.tier || (s.total_score >= 15 ? 'OR' : 'BRONZE')}`,
                                    });
                                  }
                                }}
                              >
                                <GiftIllustration
                                  svgKey={s.gift_svg_key}
                                  name={s.gift_name}
                                  tier={s.total_score >= 15 ? 'OR' : 'BRONZE'}
                                  customPhoto={s.gift_custom_photo}
                                  photoUrl={s.gift_photo_url}
                                  className="w-10 h-10 rounded-lg shadow-xs"
                                  size={32}
                                  showRealBadge={false}
                                />
                                {(s.gift_photo_url || s.gift_custom_photo) && (
                                  <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <ZoomIn className="w-3.5 h-3.5 text-white" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 dark:text-white truncate">
                                    {s.gift_name}
                                  </span>
                                  {s.card_is_revealed === 1 ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#15803D] text-white font-bold shrink-0">
                                      Révélée
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#92400E] text-white font-bold shrink-0">
                                      À gratter
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                  {(s.gift_photo_url || s.gift_custom_photo) ? (
                                    <span className="text-[#15803D] font-bold flex items-center gap-0.5">
                                      <ImageIcon className="w-2.5 h-2.5" /> Photo réelle
                                    </span>
                                  ) : (
                                    <span className="italic">Illustration SVG</span>
                                  )}
                                  {s.gift_estimated_value && (
                                    <span>• ~{s.gift_estimated_value.toLocaleString('fr-FR')} F</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Pas de carte</span>
                          )}
                        </td>
                        <td className="p-3">
                          {s.delivery_status ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                s.delivery_status === 'RECU'
                                  ? 'bg-[#15803D] text-white'
                                  : s.delivery_status === 'REMISE_EFFECTUEE'
                                  ? 'bg-[#DC2626] text-white'
                                  : s.delivery_status === 'PROGRAMMEE'
                                  ? 'bg-[#92400E] text-white'
                                  : 'bg-[#E2E8F0] text-black dark:text-white'
                              }`}
                            >
                              {s.delivery_status === 'RECU'
                                ? 'Reçu'
                                : s.delivery_status === 'REMISE_EFFECTUEE'
                                ? 'Remis'
                                : s.delivery_status === 'PROGRAMMEE'
                                ? 'Programmé'
                                : 'À programmer'}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => openCorrectionModal(s)}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#E2E8F0] hover:bg-slate-300 text-black dark:bg-slate-800 dark:text-white cursor-pointer"
                            title="Correction exceptionnelle motivée"
                          >
                            Corriger
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: CLÔTURE & DÉMO */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'closing' && (
        <div className="space-y-6 max-w-3xl">
          {/* Semester Closing Status Card */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-slate-500">Semestre sélectionné</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {currentSem?.name} ({currentSem?.code})
                </h3>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                  currentSem?.status === 'CLOTURE' ? 'bg-[#15803D] text-white' : 'bg-[#92400E] text-white'
                }`}
              >
                {currentSem?.status === 'CLOTURE' ? 'Semestre Clôturé' : 'En cours d\'évaluation'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Période :</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  Du {currentSem?.start_date} au {currentSem?.end_date}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date de clôture fixée (fuseau Africa/Bamako) :</span>
                <span className="font-bold text-slate-900 dark:text-white">{currentSem?.closing_date}</span>
              </div>
              {currentSem?.closed_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Clôturé le :</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {new Date(currentSem.closed_at).toLocaleString('fr-FR')}
                  </span>
                </div>
              )}
            </div>

            {currentSem?.status !== 'CLOTURE' ? (
              <button
                type="button"
                onClick={handleCloseSemester}
                disabled={actionLoading}
                className="w-full min-h-[48px] px-4 py-3 bg-[#15803D] hover:bg-[#15803D]/90 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-5 h-5" />
                {actionLoading ? 'Clôture en cours...' : `Clôturer le ${currentSem?.name} & Générer les cartes`}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-[#15803D]/10 text-[#15803D] rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Ce semestre est déjà clôturé. Les notes sont figées et les cartes ont été attribuées aux vendeurs éligibles.
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCloseModal(true)}
                    disabled={actionLoading}
                    className="flex-1 min-h-[48px] px-4 py-2.5 bg-[#15803D] hover:bg-[#15803D]/90 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Régénérer les cartes cadeaux (Forcer)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReopenModal(true)}
                    disabled={actionLoading}
                    className="flex-1 min-h-[48px] px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <LockOpen className="w-4 h-4" />
                    Rouvrir le semestre
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Test & Acceptance Shortcut Card */}
          <div className="bg-white dark:bg-slate-900 border-2 border-[#92400E] rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#92400E]" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Scénario de Test & Démo Clôture (Vérification Acceptance)
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Ce bouton réinitialise le semestre de démo S1-2026 à l'état non clôturé avec les 3 profils cibles exigés par le test :
            </p>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc pl-5">
              <li>
                <strong>VRS 1 (Ibrahim Sangaré) : 16.0 / 20</strong> → Palier Or (reçoit une carte Or avec tirage d'un cadeau Or)
              </li>
              <li>
                <strong>VRS 2 (Bakary Coulibaly) : 12.0 / 20</strong> → Palier Bronze (reçoit une carte Bronze avec cadeau Bronze)
              </li>
              <li>
                <strong>VRS 3 (Oumar Kone) : 8.0 / 20</strong> → Aucun cadeau (affiche "Pas de carte ce semestre, objectif : 10/20" et points manquants)
              </li>
            </ul>
            <button
              type="button"
              onClick={handleResetDemoSemester}
              disabled={actionLoading}
              className="mt-2 min-h-[48px] px-4 py-3 bg-[#92400E] hover:bg-[#92400E]/90 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              {actionLoading ? 'Réinitialisation...' : 'Réinitialiser la Démo (16/20, 12/20, 8/20)'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: RÉGLAGES DE NOTATION */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-sm max-w-2xl space-y-5">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#15803D]" />
              Réglages des Pondérations de Notation
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Règle stricte : la somme des 5 pondérations doit être <strong>toujours égale à 20 points</strong>. Les modifications sont enregistrées côté serveur et consignées dans l'audit.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Critère 1: CA */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  1. Chiffre d'affaires vs objectif (points) :
                </label>
                <span className="text-xs font-black text-[#15803D]">{wTurnover} pts</span>
              </div>
              <input
                type="number"
                step="0.5"
                min="0"
                max="20"
                required
                value={wTurnover}
                onChange={(e) => setWTurnover(Number(e.target.value))}
                className="w-full min-h-[48px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Critère 2: Régularité */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  2. Régularité (jours avec au moins une vente / jours ouvrés) :
                </label>
                <span className="text-xs font-black text-[#15803D]">{wRegularity} pts</span>
              </div>
              <input
                type="number"
                step="0.5"
                min="0"
                max="20"
                required
                value={wRegularity}
                onChange={(e) => setWRegularity(Number(e.target.value))}
                className="w-full min-h-[48px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Critère 3: Paiements */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  3. Paiements dans les délais (solde sous plafond, aucun retard) :
                </label>
                <span className="text-xs font-black text-[#15803D]">{wPayments} pts</span>
              </div>
              <input
                type="number"
                step="0.5"
                min="0"
                max="20"
                required
                value={wPayments}
                onChange={(e) => setWPayments(Number(e.target.value))}
                className="w-full min-h-[48px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Critère 4: Nouveaux PDV */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  4. Nouveaux PDV validés par le SAN :
                </label>
                <span className="text-xs font-black text-[#15803D]">{wNewPos} pts</span>
              </div>
              <input
                type="number"
                step="0.5"
                min="0"
                max="20"
                required
                value={wNewPos}
                onChange={(e) => setWNewPos(Number(e.target.value))}
                className="w-full min-h-[48px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Critère 5: Rigueur */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  5. Rigueur (aucun écart de stock à régulariser, aucun rejet) :
                </label>
                <span className="text-xs font-black text-[#15803D]">{wRigor} pts</span>
              </div>
              <input
                type="number"
                step="0.5"
                min="0"
                max="20"
                required
                value={wRigor}
                onChange={(e) => setWRigor(Number(e.target.value))}
                className="w-full min-h-[48px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Sum indicator */}
            <div
              className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between ${
                Math.abs(settingsSum - 20) < 0.01
                  ? 'bg-[#15803D] text-white'
                  : 'bg-[#DC2626] text-white'
              }`}
            >
              <span>Total des pondérations :</span>
              <span className="text-base font-black">{settingsSum.toFixed(1)} / 20 points</span>
            </div>

            <button
              type="submit"
              disabled={savingSettings || Math.abs(settingsSum - 20) > 0.01}
              className="w-full min-h-[48px] px-4 py-3 bg-[#15803D] hover:bg-[#15803D]/90 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {savingSettings ? 'Enregistrement...' : 'Enregistrer les nouvelles pondérations'}
            </button>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: CATALOGUE DES CADEAUX */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Catalogue Officiel des Cadeaux
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Géré par le SAN : ajout, modification, désactivation. Illustrations vectorielles SVG intégrées.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddGiftModal}
              className="min-h-[48px] px-4 py-2 bg-[#15803D] hover:bg-[#15803D]/90 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow active:scale-98 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Ajouter un cadeau
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalog.map((gift) => {
              const isOr = gift.tier === 'OR';
              const isActive = gift.status === 'ACTIF';
              return (
                <div
                  key={gift.id}
                  className={`bg-white dark:bg-slate-900 border-2 rounded-2xl p-4 shadow-sm flex flex-col justify-between ${
                    isActive ? 'border-slate-300 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                          isOr ? 'bg-[#15803D] text-white' : 'bg-[#92400E] text-white'
                        }`}
                      >
                        Palier {gift.tier}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          isActive ? 'bg-[#15803D] text-white' : 'bg-[#E2E8F0] text-black dark:text-white'
                        }`}
                      >
                        {isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="relative cursor-pointer group shrink-0"
                        onClick={() => {
                          const photo = gift.photo_url || gift.custom_photo;
                          if (photo) {
                            setLightboxImage({
                              src: photo,
                              title: gift.name,
                              subtitle: `Palier ${gift.tier} • ${gift.description || 'Illustration par défaut'}`,
                            });
                          }
                        }}
                      >
                        <GiftIllustration
                          svgKey={gift.svg_key}
                          name={gift.name}
                          tier={gift.tier}
                          customPhoto={gift.custom_photo}
                          photoUrl={gift.photo_url}
                          className="w-16 h-16 flex-shrink-0"
                          size={56}
                          showRealBadge={Boolean(gift.photo_url || gift.custom_photo)}
                        />
                        {(gift.photo_url || gift.custom_photo) && (
                          <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ZoomIn className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-black text-slate-900 dark:text-white truncate">{gift.name}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {gift.description || 'Illustration par défaut SVG'}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          {(gift.photo_url || gift.custom_photo) ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#15803D]">
                              <CheckCircle className="w-3 h-3" /> Photo HD configurée
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                              Illustration vectorielle SVG
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        openEditGiftModal(gift);
                        setPhotoTab('presets');
                      }}
                      className="min-h-[48px] px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
                      title="Changer la photo réelle"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleGiftStatus(gift)}
                      className="min-h-[48px] px-3 py-1.5 text-xs font-bold rounded-xl bg-[#E2E8F0] hover:bg-slate-300 text-black dark:bg-slate-800 dark:text-white cursor-pointer"
                    >
                      {isActive ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditGiftModal(gift)}
                      className="min-h-[48px] px-3 py-1.5 text-xs font-bold rounded-xl bg-[#92400E] hover:bg-[#92400E]/90 text-white cursor-pointer"
                    >
                      Modifier
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: CORRECTION EXCEPTIONNELLE DE NOTE */}
      {/* ---------------------------------------------------- */}
      {correctingScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-[#DC2626]">Contrôle & Audit SAN</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Correction exceptionnelle de note
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCorrectingScore(null)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">
                  Vendeur : {correctingScore.vrs_first_name} {correctingScore.vrs_last_name} ({correctingScore.vrs_public_id})
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  Note actuelle : <strong>{correctingScore.total_score.toFixed(1)}/20</strong>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nouvelle note globale (/20, arrondie à 0,5) * :
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="20"
                  required
                  value={newScoreVal}
                  onChange={(e) => setNewScoreVal(Number(e.target.value))}
                  className="w-full min-h-[48px] px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-base font-black text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Motif obligatoire de la correction (inscrit au journal d'audit) * :
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex : Régularisation d'une vente du 28 juin comptabilisée avec retard par le Drop Point suite à panne réseau..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCorrectingScore(null)}
                  className="min-h-[48px] px-4 py-2 rounded-xl text-xs font-bold bg-[#E2E8F0] text-black hover:bg-slate-300 cursor-pointer dark:bg-slate-800 dark:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingCorrection}
                  className="min-h-[48px] px-5 py-2 rounded-xl text-xs font-bold bg-[#15803D] hover:bg-[#15803D]/90 text-white shadow active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {submittingCorrection ? 'Correction...' : 'Enregistrer la correction tracée'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: AJOUT / ÉDITION DE CADEAU DANS LE CATALOGUE */}
      {/* ---------------------------------------------------- */}
      {editingGift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#15803D]" />
                {isNewGift ? 'Ajouter un cadeau au catalogue' : 'Modifier le cadeau'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingGift(null)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitGift} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Hidden file & camera inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoSelected(file);
                  e.target.value = '';
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoSelected(file);
                  e.target.value = '';
                }}
              />

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nom du cadeau * :
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Smartphone Samsung Galaxy, TV Smart LED 43 pouces, Moto Jakarta..."
                  value={giftName}
                  onChange={(e) => setGiftName(e.target.value)}
                  className="w-full min-h-[48px] px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Palier de notation * :
                  </label>
                  <select
                    value={giftTier}
                    onChange={(e) => setGiftTier(e.target.value as 'BRONZE' | 'OR')}
                    className="w-full min-h-[48px] px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="BRONZE">Bronze (Note 10 à 14,5)</option>
                    <option value="OR">Or (Note 15 à 20)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Illustration SVG par défaut * :
                  </label>
                  <select
                    value={giftSvgKey}
                    onChange={(e) => setGiftSvgKey(e.target.value)}
                    className="w-full min-h-[48px] px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="tv">TV Smart</option>
                    <option value="fridge">Mini frigo</option>
                    <option value="blender">Mixeur</option>
                    <option value="coffeemaker">Machine à café</option>
                    <option value="smartphone">Smartphone</option>
                    <option value="motorbike">Moto Jakarta</option>
                    <option value="computer">Ordinateur</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Description du cadeau :
                </label>
                <textarea
                  rows={2}
                  placeholder="Spécifications, modèle exact, garantie constructeur..."
                  value={giftDescription}
                  onChange={(e) => setGiftDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              {/* REAL PHOTO MANAGEMENT SECTION */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#15803D]" />
                    <span className="text-xs font-black uppercase text-slate-900 dark:text-white">
                      Image Réelle du Cadeau
                    </span>
                  </div>
                  {giftPhotoUrl && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#15803D] text-white">
                      Photo Réelle Active
                    </span>
                  )}
                </div>

                {/* Live Preview Box */}
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div
                    className="relative shrink-0 cursor-pointer group"
                    onClick={() => {
                      if (giftPhotoUrl) {
                        setLightboxImage({
                          src: giftPhotoUrl,
                          title: giftName || 'Aperçu cadeau',
                          subtitle: 'Aperçu en haute définition',
                        });
                      }
                    }}
                  >
                    <GiftIllustration
                      svgKey={giftSvgKey}
                      name={giftName || 'Aperçu'}
                      tier={giftTier}
                      customPhoto={giftPhotoUrl}
                      photoUrl={giftPhotoUrl}
                      className="w-20 h-20 rounded-xl"
                      size={64}
                      showRealBadge={Boolean(giftPhotoUrl)}
                    />
                    {giftPhotoUrl && (
                      <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {giftPhotoUrl ? 'Photo réelle enregistrée' : 'Illustration vectorielle SVG par défaut'}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                      {giftPhotoUrl
                        ? 'Cette photo sera affichée lors du grattage par le VRS et dans le suivi des remises.'
                        : 'Aucune photo réelle n\'est définie. L\'application affichera l\'illustration vectorielle.'}
                    </p>
                    {giftPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setGiftPhotoUrl('')}
                        className="mt-2 text-[11px] font-bold text-[#DC2626] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Retirer la photo (revenir au SVG)
                      </button>
                    )}
                  </div>
                </div>

                {uploadingPhoto && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Traitement et compression de la photo en cours...</span>
                  </div>
                )}

                {photoError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{photoError}</span>
                  </div>
                )}

                {/* Sub-tabs for adding real image */}
                <div className="border-b border-slate-200 dark:border-slate-700 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPhotoTab('presets')}
                    className={`min-h-[44px] px-3 py-1.5 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      photoTab === 'presets'
                        ? 'border-[#15803D] text-[#15803D]'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Photos Prédéfinies
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoTab('upload')}
                    className={`min-h-[44px] px-3 py-1.5 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      photoTab === 'upload'
                        ? 'border-[#15803D] text-[#15803D]'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Téléverser
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoTab('camera')}
                    className={`min-h-[44px] px-3 py-1.5 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      photoTab === 'camera'
                        ? 'border-[#15803D] text-[#15803D]'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Prendre Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoTab('url')}
                    className={`min-h-[44px] px-3 py-1.5 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      photoTab === 'url'
                        ? 'border-[#15803D] text-[#15803D]'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    URL Web
                  </button>
                </div>

                {/* TAB 1: PRESETS */}
                {photoTab === 'presets' && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">
                      Sélectionnez une photo haute définition certifiée en 1 clic :
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
                      {PRESET_GIFT_PHOTOS.map((preset) => {
                        const isSelected = giftPhotoUrl === preset.url;
                        return (
                          <div
                            key={preset.key}
                            onClick={() => {
                              setGiftPhotoUrl(preset.url);
                              if (!giftName) setGiftName(preset.title);
                              if (!giftDescription) setGiftDescription(preset.description);
                              setGiftSvgKey(preset.svg_key);
                            }}
                            className={`p-1.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center text-center ${
                              isSelected
                                ? 'border-[#15803D] bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-[#15803D]/40'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 bg-white dark:bg-slate-900'
                            }`}
                          >
                            <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-1">
                              <img
                                src={preset.url}
                                alt={preset.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                              {preset.title}
                            </span>
                            <span
                              className={`text-[8px] font-black uppercase px-1 py-0.2 rounded mt-0.5 ${
                                preset.tier === 'OR' ? 'bg-[#15803D] text-white' : 'bg-[#92400E] text-white'
                              }`}
                            >
                              {preset.tier}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 2: UPLOAD FILE */}
                {photoTab === 'upload' && (
                  <div className="space-y-2">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#15803D] rounded-xl p-6 text-center cursor-pointer bg-white dark:bg-slate-900 transition-colors"
                    >
                      <Upload className="w-8 h-8 mx-auto text-[#15803D] mb-2" />
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Cliquez pour choisir un fichier image
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Formats acceptés : PNG, JPG, JPEG, WEBP (max 5 Mo)
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 3: CAMERA CAPTURE */}
                {photoTab === 'camera' && (
                  <div className="space-y-2">
                    <div
                      onClick={() => cameraInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#15803D] rounded-xl p-6 text-center cursor-pointer bg-white dark:bg-slate-900 transition-colors"
                    >
                      <Camera className="w-8 h-8 mx-auto text-[#15803D] mb-2" />
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Prendre une photo avec l'appareil
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Ouvre l'appareil photo du smartphone ou de la tablette
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 4: WEB URL */}
                {photoTab === 'url' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Lien direct vers l'image (HTTPS) :
                    </label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/photo-..."
                      value={giftPhotoUrl}
                      onChange={(e) => setGiftPhotoUrl(e.target.value)}
                      className="w-full min-h-[48px] px-3 py-2 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingGift(null)}
                  className="min-h-[48px] px-4 py-2 rounded-xl text-xs font-bold bg-[#E2E8F0] text-black hover:bg-slate-300 cursor-pointer dark:bg-slate-800 dark:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingGift || uploadingPhoto}
                  className="min-h-[48px] px-5 py-2 rounded-xl text-xs font-bold bg-[#15803D] hover:bg-[#15803D]/90 text-white shadow active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {savingGift ? 'Enregistrement...' : 'Enregistrer le cadeau'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: CONFIRMATION CLÔTURE DU SEMESTRE & GÉNÉRATION DES CARTES */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#15803D]/10 text-[#15803D] flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {closeForceMode ? 'Régénérer les cartes cadeaux' : 'Clôturer le semestre'}
                  </h3>
                  <p className="text-xs text-slate-500">{currentSem?.name} ({currentSem?.code})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 text-xs">
              <p className="font-bold text-slate-900 dark:text-white">
                Cette action va exécuter les opérations suivantes :
              </p>
              <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 list-disc pl-5">
                <li>
                  <strong>Figer définitivement les notes</strong> des vendeurs pour le semestre {currentSem?.name}.
                </li>
                <li>
                  <strong>Tirage au sort automatique</strong> d'un cadeau par le serveur selon le palier atteint (Or ≥ 15/20, Bronze 10 à 14,5/20).
                </li>
                <li>
                  <strong>Génération des cartes à gratter</strong> dans « Mes cadeaux » pour chaque vendeur éligible.
                </li>
                <li>
                  <strong>Notification des vendeurs</strong> (félicitations ou bilan et points manquants si &lt; 10/20).
                </li>
              </ul>
              {closeForceMode && (
                <div className="mt-2 p-2.5 bg-[#92400E]/10 border border-[#92400E]/30 rounded-lg text-[#92400E] font-medium">
                  Mode forcé : actualise les cartes cadeaux. Les cartes déjà révélées par les vendeurs restent intactes.
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="min-h-[48px] px-4 py-2 rounded-xl text-xs font-bold bg-[#E2E8F0] text-black hover:bg-slate-300 cursor-pointer dark:bg-slate-800 dark:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={proceedCloseSemester}
                disabled={actionLoading}
                className="min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-bold bg-[#15803D] hover:bg-[#15803D]/90 text-white shadow-lg active:scale-98 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {actionLoading ? 'Clôture en cours...' : 'Confirmer la clôture & Générer les cartes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMATION RÉOUVERTURE DU SEMESTRE */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#92400E]/10 text-[#92400E] flex items-center justify-center">
                  <LockOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Rouvrir le semestre ?
                  </h3>
                  <p className="text-xs text-slate-500">{currentSem?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Le semestre repassera au statut <strong>« En cours d'évaluation »</strong>. Les notes ne seront plus figées et pourront continuer à être calculées.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="min-h-[48px] px-4 py-2 rounded-xl text-xs font-bold bg-[#E2E8F0] text-black hover:bg-slate-300 cursor-pointer dark:bg-slate-800 dark:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={proceedReopenSemester}
                disabled={actionLoading}
                className="min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-bold bg-[#92400E] hover:bg-[#92400E]/90 text-white shadow active:scale-98 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <LockOpen className="w-4 h-4" />
                {actionLoading ? 'Réouverture...' : 'Confirmer la réouverture'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMATION RÉINITIALISATION DÉMO */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#92400E]/10 text-[#92400E] flex items-center justify-center">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Réinitialiser la Démo S1-2026 ?
                  </h3>
                  <p className="text-xs text-slate-500">Profils cibles 16/20, 12/20, 8/20</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Cette action réinitialise le semestre S1-2026 au statut non clôturé avec les 3 profils cibles du protocole d'acceptance :
            </p>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc pl-5">
              <li>Ibrahim Sangaré : 16.0/20 (Palier Or)</li>
              <li>Bakary Coulibaly : 12.0/20 (Palier Bronze)</li>
              <li>Oumar Kone : 8.0/20 (Pas de carte)</li>
            </ul>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="min-h-[48px] px-4 py-2 rounded-xl text-xs font-bold bg-[#E2E8F0] text-black hover:bg-slate-300 cursor-pointer dark:bg-slate-800 dark:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={proceedResetDemoSemester}
                disabled={actionLoading}
                className="min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-bold bg-[#92400E] hover:bg-[#92400E]/90 text-white shadow active:scale-98 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {actionLoading ? 'Réinitialisation...' : 'Confirmer la réinitialisation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX: AGRANDISSEMENT PHOTO RÉELLE EN HAUTE RÉSOLUTION */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 border-2 border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-4 my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Fermer l'agrandissement"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative aspect-4/3 w-full bg-black rounded-2xl overflow-hidden flex items-center justify-center">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.title}
                className="w-full h-full object-contain"
              />
              <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-[#15803D]/95 text-white text-xs font-black uppercase shadow">
                Photo Réelle Certifiée
              </span>
            </div>

            <div className="mt-3 px-1 text-left">
              <h3 className="text-lg font-black text-white">{lightboxImage.title}</h3>
              {lightboxImage.subtitle && (
                <p className="text-xs text-slate-400 mt-0.5">{lightboxImage.subtitle}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SanScoringManagementView;
