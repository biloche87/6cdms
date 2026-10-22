import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { SellerPerformanceCard } from './SellerPerformanceCard.tsx';
import { RoleSwitcherModal } from '../common/RoleSwitcherModal.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import { AvatarPicker } from '../common/AvatarPicker.tsx';
import {
  User as UserIcon,
  Shield,
  Building2,
  MapPin,
  Phone,
  Mail,
  Lock,
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  Award,
  TrendingUp,
  SunMoon,
  MessageCircle,
  Send,
  Eye,
  EyeOff,
  KeyRound,
  ExternalLink,
  LogOut,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'performance';
  onNavigate?: (view: string) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, initialTab, onNavigate }) => {
  const { user, refreshUser, switchRoleShortcut, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'performance'>(
    initialTab || (user?.role === 'VRS' ? 'performance' : 'profile')
  );
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photo, setPhoto] = useState(user?.photo || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCredentials, setIsSendingCredentials] = useState<'whatsapp' | 'email' | null>(null);
  const [credentialsSentInfo, setCredentialsSentInfo] = useState<{
    whatsappUrl?: string;
    mailtoUrl?: string;
    message: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  if (!isOpen || !user) return null;

  const handleSendCredentials = async (channel: 'whatsapp' | 'email') => {
    setIsSendingCredentials(channel);
    setErrorMessage(null);
    try {
      const res = await api.sendMyCredentials();
      setCredentialsSentInfo({
        whatsappUrl: res.whatsappUrl,
        mailtoUrl: res.mailtoUrl,
        message: channel === 'whatsapp' 
          ? 'Lien WhatsApp préparé avec succès !' 
          : 'Lien Email préparé avec succès !',
      });
      
      // Auto open link
      if (channel === 'whatsapp' && res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank');
      } else if (channel === 'email' && res.mailtoUrl) {
        window.location.href = res.mailtoUrl;
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de préparer les identifiants');
    } finally {
      setIsSendingCredentials(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    if (newPassword) {
      if (newPassword.length < 6) {
        setErrorMessage('Le nouveau mot de passe doit comporter au moins 6 caractères.');
        setIsSubmitting(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('Les deux mots de passe ne correspondent pas.');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await api.updateProfile({
        phone,
        email,
        photo: photo || null,
        currentPassword: currentPassword || undefined,
        password: newPassword || undefined,
      });
      setMessage('Profil mis à jour avec succès !');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-slate-900 border border-slate-800 rounded-2xl w-full ${
          activeTab === 'performance' ? 'max-w-2xl' : 'max-w-md'
        } max-h-[92vh] my-auto overflow-hidden shadow-2xl flex flex-col animate-modal-content`}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">Profil & Espace Collaborateur</h2>
              <p className="text-[11px] text-slate-400">6C Distribution • {user.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex-shrink-0 px-4 sm:px-5 pt-3 pb-1 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border ${
                activeTab === 'performance'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Performances & Note (/10)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border ${
                activeTab === 'profile'
                  ? 'bg-slate-800 text-white border-slate-700 shadow-xs'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Mon Compte & Infos</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Performance & Rating on 10 */}
        {activeTab === 'performance' ? (
          <div className="overflow-y-auto p-4 sm:p-5 flex-1 space-y-4">
            <SellerPerformanceCard userId="me" />
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="px-3.5 py-2 bg-red-950/50 hover:bg-red-900/60 active:bg-red-800 text-red-300 border border-red-800/60 font-bold rounded-xl flex items-center gap-1.5 text-xs transition active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span>Se déconnecter</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          /* Tab 2: Profile & Edit form */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
            <div className="overflow-y-auto p-5 space-y-4 flex-1">
            {message && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2">
                <X className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* User identity card & Photo */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3.5">
              {photo ? (
                <img
                  src={photo}
                  alt={`${user.firstName} ${user.lastName}`}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border-2 border-red-500/50 shadow-md shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-lg shadow-inner shrink-0">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-base truncate">
                  {user.firstName} {user.lastName}
                </div>
                <div className="font-mono text-slate-400 text-xs">{user.publicId}</div>
                <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {user.role}
                </div>
              </div>
            </div>

            {/* Optional Photo Management */}
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <AvatarPicker
                value={photo}
                onChange={setPhoto}
                label="Photo de profil"
                initials={`${user.firstName[0]}${user.lastName[0]}`}
                isOptional={true}
              />
            </div>

            {/* Reception des identifiants (WhatsApp & Email) */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Send className="w-3.5 h-3.5" />
                </div>
                <span>Recevoir mes accès de connexion</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Recevez directement un récapitulatif de votre identifiant officiel et vos accès de connexion par WhatsApp ou Email.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSendingCredentials !== null}
                  onClick={() => handleSendCredentials('whatsapp')}
                  className="px-3 py-2.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 active:scale-98"
                >
                  {isSendingCredentials === 'whatsapp' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Envoyer sur WhatsApp</span>
                </button>

                <button
                  type="button"
                  disabled={isSendingCredentials !== null}
                  onClick={() => handleSendCredentials('email')}
                  className="px-3 py-2.5 rounded-xl bg-blue-950/50 hover:bg-blue-900/60 text-blue-300 border border-blue-800/60 text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 active:scale-98"
                >
                  {isSendingCredentials === 'email' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span>Envoyer par Email</span>
                </button>
              </div>

              {credentialsSentInfo && (
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-[11px] text-emerald-300 flex items-center justify-between gap-2">
                  <span>{credentialsSentInfo.message}</span>
                  {credentialsSentInfo.whatsappUrl && (
                    <a
                      href={credentialsSentInfo.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-400 font-bold underline"
                    >
                      Ouvrir <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Scope details */}
            <div className="space-y-2 p-3 bg-slate-950/50 rounded-xl border border-slate-800 text-slate-400">
              {user.dropPointName && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    Drop Point (Dépôt)
                  </span>
                  <strong className="text-white font-mono">{user.dropPointName} ({user.dropPointCode})</strong>
                </div>
              )}
              {user.sectorName && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    Secteur Opérationnel
                  </span>
                  <strong className="text-amber-400">{user.sectorName}</strong>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  Statut Compte
                </span>
                <span className="text-emerald-400 font-semibold">{user.status}</span>
              </div>
            </div>

            {/* Role & Permissions Info (Non-switchable for VRS) */}
            {user.role === 'VRS' ? (
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Rôle & Périmètre Assigné</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Rôle actif : <strong className="text-amber-400 font-bold">VRS — Vendeur Responsable de Secteur</strong>
                </p>
                <p className="text-[10px] text-slate-500">
                  Profil opérationnel terrain verrouillé sur votre compte et vos tournées affectées.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Changer de rôles (Mode démo)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRoleModalOpen(true)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    Détails
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (user.role === 'SALES_ADMIN_NATIONAL') return;
                      await switchRoleShortcut('6CDISTSAN');
                      if (typeof window !== 'undefined') {
                        window.location.hash = '#/dashboard';
                        try {
                          localStorage.setItem('6c_active_tab', 'dashboard');
                          localStorage.removeItem('6c_selected_pos_id');
                        } catch {}
                      }
                      if (onNavigate) onNavigate('dashboard');
                      onClose();
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between border cursor-pointer ${
                      user.role === 'SALES_ADMIN_NATIONAL'
                        ? 'bg-purple-900/50 text-purple-200 border-purple-600/70 shadow-xs'
                        : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span>SAN National</span>
                    {user.role === 'SALES_ADMIN_NATIONAL' && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (user.role === 'SALES_ADMIN') return;
                      await switchRoleShortcut('6CDISTSA-DKN');
                      if (typeof window !== 'undefined') {
                        window.location.hash = '#/dashboard';
                        try {
                          localStorage.setItem('6c_active_tab', 'dashboard');
                          localStorage.removeItem('6c_selected_pos_id');
                        } catch {}
                      }
                      if (onNavigate) onNavigate('dashboard');
                      onClose();
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between border cursor-pointer ${
                      user.role === 'SALES_ADMIN'
                        ? 'bg-blue-900/50 text-blue-200 border-blue-600/70 shadow-xs'
                        : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span>SA Dépôt</span>
                    {user.role === 'SALES_ADMIN' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (user.role === 'FSS') return;
                      await switchRoleShortcut('6CDISTFSS-DKN');
                      if (typeof window !== 'undefined') {
                        window.location.hash = '#/dashboard';
                        try {
                          localStorage.setItem('6c_active_tab', 'dashboard');
                          localStorage.removeItem('6c_selected_pos_id');
                        } catch {}
                      }
                      if (onNavigate) onNavigate('dashboard');
                      onClose();
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between border cursor-pointer ${
                      user.role === 'FSS'
                        ? 'bg-teal-900/50 text-teal-200 border-teal-600/70 shadow-xs'
                        : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span>FSS Superviseur</span>
                    {user.role === 'FSS' && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await switchRoleShortcut('6CDISTVRS-DKN-001');
                      if (typeof window !== 'undefined') {
                        window.location.hash = '#/dashboard';
                        try {
                          localStorage.setItem('6c_active_tab', 'dashboard');
                          localStorage.removeItem('6c_selected_pos_id');
                        } catch {}
                      }
                      if (onNavigate) onNavigate('dashboard');
                      onClose();
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between border bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800 cursor-pointer"
                  >
                    <span>VRS Vendeur</span>
                  </button>
                </div>
              </div>
            )}

            {/* Apparence & Thème */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <SunMoon className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white">Thème d'affichage</label>
                    <p className="text-[11px] text-slate-400">Basculer entre le mode clair et le mode sombre</p>
                  </div>
                </div>
                <ThemeToggle variant="selector" />
              </div>
            </div>

            {/* Editable fields */}
            <div>
              <label className="block text-slate-400 mb-1">Numéro de Téléphone</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Adresse Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>
            </div>

            {/* Section Modification de mot de passe */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <div className="w-6 h-6 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                    <KeyRound className="w-3.5 h-3.5" />
                  </div>
                  <span>Modifier mon mot de passe</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? 'Masquer' : 'Afficher'}</span>
                </button>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Mot de passe actuel (si défini)
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mot de passe initial (ex: 6CDist@2026)"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Au moins 6 caractères"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Confirmer le mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Répéter le mot de passe"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full pl-9 pr-3 py-2 bg-slate-950 border rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none ${
                          confirmPassword && confirmPassword !== newPassword
                            ? 'border-red-500'
                            : 'border-slate-800 focus:border-red-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-red-400">⚠️ Les deux mots de passe ne correspondent pas.</p>
                )}
              </div>
            </div>
            </div>

            <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="px-3 py-2 bg-red-950/50 hover:bg-red-900/60 active:bg-red-800 text-red-300 border border-red-800/60 font-bold rounded-xl flex items-center gap-1.5 text-xs transition active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span>Se déconnecter</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50 transition active:scale-95"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Enregistrer les modifications</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <RoleSwitcherModal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          onClose();
        }}
        onNavigate={onNavigate}
      />
    </div>
  );
};
