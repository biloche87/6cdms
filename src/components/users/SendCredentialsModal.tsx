import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Mail,
  MessageCircle,
  Copy,
  Check,
  ShieldCheck,
  KeyRound,
  User as UserIcon,
  Building2,
  Phone,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '../../services/api.ts';

interface SendCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: number;
    publicId: string;
    firstName: string;
    lastName: string;
    role: string;
    phone?: string;
    email?: string;
    dropPointName?: string;
    sectorName?: string;
  } | null;
  initialTemporaryPassword?: string;
}

export const SendCredentialsModal: React.FC<SendCredentialsModalProps> = ({
  isOpen,
  onClose,
  user,
  initialTemporaryPassword,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    whatsappUrl?: string;
    whatsappMessage: string;
    mailtoUrl?: string;
    emailSubject: string;
    emailBody: string;
    temporaryPassword: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadCredentialsData();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, user]);

  const loadCredentialsData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.sendCredentials(user.id, initialTemporaryPassword);
      setData({
        whatsappUrl: res.whatsappUrl,
        whatsappMessage: res.whatsappMessage,
        mailtoUrl: res.mailtoUrl,
        emailSubject: res.emailSubject,
        emailBody: res.emailBody,
        temporaryPassword: res.temporaryPassword,
      });
    } catch (err: any) {
      setError(err.message || 'Impossible de générer le récapitulatif des identifiants.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  if (!isOpen || !user) return null;

  const roleLabels: Record<string, string> = {
    SALES_ADMIN_NATIONAL: 'Sales Admin National',
    SALES_ADMIN: 'Sales Admin (Dépôt)',
    FSS: 'Field Sales Supervisor (FSS)',
    VRS: 'Vendeur Terrain (VRS)',
  };

  const roleLabel = roleLabels[user.role] || user.role;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-modal-backdrop">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Transmettre les identifiants</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {user.publicId}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Envoi sécurisé des accès par WhatsApp et par Email
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* User Recipient Summary Card */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {user.firstName} {user.lastName}
                  </h3>
                  <p className="text-xs text-slate-400">{roleLabel}</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                {user.dropPointName || 'National'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Tél / WhatsApp :</span>
                <span className="font-semibold text-white">
                  {user.phone || 'Non renseigné'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-400">Email :</span>
                <span className="font-semibold text-white truncate">
                  {user.email || 'Non renseigné'}
                </span>
              </div>
            </div>
          </div>

          {/* Credentials Credentials Card */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-red-500" />
                Identifiants Officiels
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `Identifiant: ${user.publicId}\nMot de passe: ${
                      data?.temporaryPassword || '6CDist@2026'
                    }`,
                    'all-creds'
                  )
                }
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition"
              >
                {copiedField === 'all-creds' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier le pack</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Identifiant Opérationnel
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono text-sm font-bold text-white">
                    {user.publicId}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(user.publicId, 'pubId')}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedField === 'pubId' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Mot de passe provisoire
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono text-sm font-bold text-amber-300">
                    {showPassword
                      ? data?.temporaryPassword || '6CDist@2026'
                      : '••••••••••••'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-white"
                      title={showPassword ? 'Masquer' : 'Afficher'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          data?.temporaryPassword || '6CDist@2026',
                          'pass'
                        )
                      }
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      {copiedField === 'pass' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Channels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WhatsApp Card */}
            <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Canal WhatsApp
                    </span>
                  </div>
                  {user.phone ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Numéro prêt
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      Sans numéro
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">
                  Envoie automatiquement un message formaté avec le lien de
                  connexion et les identifiants sur le numéro WhatsApp du collaborateur.
                </p>
              </div>

              <div className="space-y-2">
                {data?.whatsappUrl ? (
                  <a
                    href={data.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/40 transition active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Envoyer sur WhatsApp</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-500 rounded-xl text-xs font-semibold cursor-not-allowed border border-slate-700"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Numéro non renseigné</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    data?.whatsappMessage &&
                    handleCopy(data.whatsappMessage, 'wa-text')
                  }
                  className="w-full text-center text-[11px] text-emerald-400 hover:text-emerald-300 py-1 transition flex items-center justify-center gap-1"
                >
                  {copiedField === 'wa-text' ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Message WhatsApp copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copier le texte du message</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Email Card */}
            <div className="p-4 bg-blue-950/20 border border-blue-800/40 rounded-xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Canal Email
                    </span>
                  </div>
                  {user.email ? (
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      Email prêt
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      Sans email
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">
                  Prépare un courriel officiel complet avec récapitulatif de rôle,
                  matricule et consignes de première connexion.
                </p>
              </div>

              <div className="space-y-2">
                {data?.mailtoUrl ? (
                  <a
                    href={data.mailtoUrl}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-950/40 transition active:scale-95"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Ouvrir client Email</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-500 rounded-xl text-xs font-semibold cursor-not-allowed border border-slate-700"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email non renseigné</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    data?.emailBody && handleCopy(data.emailBody, 'mail-text')
                  }
                  className="w-full text-center text-[11px] text-blue-400 hover:text-blue-300 py-1 transition flex items-center justify-center gap-1"
                >
                  {copiedField === 'mail-text' ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Texte de l'email copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copier le corps de l'email</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-3.5 bg-slate-950/90 border border-slate-800/80 rounded-xl flex items-start gap-3 text-xs text-slate-400">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block">
                Consigne de sécurité post-connexion
              </span>
              <span>
                Dès que le Sales Admin, le FSS ou le VRS se connecte avec ces
                identifiants, il lui est recommandé de se rendre dans son{' '}
                <strong className="text-slate-200">Profil</strong> afin de
                personnaliser son mot de passe en toute autonomie.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
