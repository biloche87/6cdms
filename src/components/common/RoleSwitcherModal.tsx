import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import {
  Sparkles,
  CheckCircle2,
  X,
  Loader2,
  ShieldAlert,
  ArrowRight,
  Crown,
  Building2,
  Briefcase,
  Bike,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: string) => void;
}

interface DemoRoleOption {
  id: string;
  roleCode: string;
  title: string;
  name: string;
  scope: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
  borderHoverColor: string;
}

const DEMO_ROLES: DemoRoleOption[] = [
  {
    id: '6CDISTSAN',
    roleCode: 'SALES_ADMIN_NATIONAL',
    title: 'Sales Admin National',
    name: 'Amadou Touré',
    scope: 'National • Tout Réseau',
    description: 'Vision stratégique globale, tous les Dépôts (Drop Points), gestion des utilisateurs et KPIs consolidés.',
    icon: Crown,
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    borderHoverColor: 'hover:border-purple-500/60 focus:border-purple-500',
  },
  {
    id: '6CDISTSA-DKN',
    roleCode: 'SALES_ADMIN',
    title: 'Sales Admin (DAKAN)',
    name: 'Fatoumata Diarra',
    scope: 'Drop Point DAKAN (DKN)',
    description: 'Gestion des stocks du Dépôt, réceptions BL fournisseur, validation des demandes d\'appro VRS et validation PDV.',
    icon: Building2,
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    borderHoverColor: 'hover:border-blue-500/60 focus:border-blue-500',
  },
  {
    id: '6CDISTFSS-DKN',
    roleCode: 'FSS',
    title: 'Field Sales Supervisor (FSS)',
    name: 'Oumar Coulibaly',
    scope: 'Supervision Équipe DAKAN',
    description: 'Encadrement terrain des vendeurs (VRS), suivi des tournées journalières, visites PDV et coaching des ventes.',
    icon: Briefcase,
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    borderHoverColor: 'hover:border-teal-500/60 focus:border-teal-500',
  },
  {
    id: '6CDISTVRS-DKN-001',
    roleCode: 'VRS',
    title: 'VRS - Vendeur Terrain',
    name: 'Ibrahim Sangaré',
    scope: 'Secteur 01 - Dakan Marché (DKN)',
    description: 'Prise de commandes au carton, exécution de tournée terrain, géolocalisation PDV et confirmation de réception stock.',
    icon: Bike,
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    borderHoverColor: 'hover:border-amber-500/60 focus:border-amber-500',
  },
];

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const { user, switchRoleShortcut } = useAuth();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const [resetConfirmationWord, setResetConfirmationWord] = useState('');

  if (!isOpen) return null;

  const handleSelectRole = async (roleId: string) => {
    const redirectToDashboard = () => {
      if (typeof window !== 'undefined') {
        window.location.hash = '#/dashboard';
        try {
          localStorage.setItem('6c_active_tab', 'dashboard');
          localStorage.removeItem('6c_selected_pos_id');
        } catch {}
      }
      if (onNavigate) onNavigate('dashboard');
    };

    if (user?.publicId === roleId) {
      redirectToDashboard();
      onClose();
      return;
    }

    setSwitchingId(roleId);
    setErrorMessage(null);

    try {
      await switchRoleShortcut(roleId);
      redirectToDashboard();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Échec du basculement de rôle.');
      setSwitchingId(null);
    }
  };

  const handleResetDemoData = async () => {
    if (resetConfirmationWord.trim() !== 'REINITIALISER') {
      setErrorMessage("Veuillez saisir exactement le mot 'REINITIALISER' en majuscules pour confirmer.");
      return;
    }
    setIsResetting(true);
    setErrorMessage(null);
    try {
      const res = await api.resetDemoData('REINITIALISER');
      setResetSuccess(res.message || 'Données de démo réinitialisées avec succès.');
      setShowConfirmReset(false);
      setResetConfirmationWord('');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Échec de la réinitialisation des données.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[90vh] my-0 sm:my-auto animate-sheet-up sm:animate-modal-content"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Changer de Rôle</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  Mode démo
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Basculez instantanément pour tester chaque interface mobile
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="m-4 p-3 bg-red-950/80 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Role Cards List */}
        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {DEMO_ROLES.map((r) => {
            const isCurrent = user?.publicId === r.id;
            const isTarget = switchingId === r.id;
            const Icon = r.icon;

            return (
              <button
                key={r.id}
                type="button"
                disabled={!!switchingId}
                onClick={() => handleSelectRole(r.id)}
                className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all relative flex flex-col gap-2 ${
                  isCurrent
                    ? 'bg-slate-800/90 border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-md shadow-emerald-950/20'
                    : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 active:scale-[0.98]'
                } ${r.borderHoverColor}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs truncate">{r.title}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${r.badgeColor}`}>
                          {r.roleCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {r.name} • <span className="font-mono text-slate-300">{r.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="shrink-0 flex items-center">
                    {isTarget ? (
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    ) : isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Actif</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 hover:text-slate-300 p-1">
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                  {r.description}
                </p>

                <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400">Périmètre :</span>
                  <span className="text-slate-300">{r.scope}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* SAN Demo Data Reset Section */}
        {user?.role === 'SALES_ADMIN_NATIONAL' && (
          <div className="mx-4 mb-3 p-3.5 bg-amber-950/40 border border-amber-600/40 rounded-xl space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-300">Mode démo (SAN)</span>
              </div>
              {!showConfirmReset && !resetSuccess && (
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => setShowConfirmReset(true)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white transition flex items-center gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réinitialiser les données de démo</span>
                </button>
              )}
            </div>

            {resetSuccess && (
              <div className="text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 p-2 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{resetSuccess} Rechargement...</span>
              </div>
            )}

            {showConfirmReset && (
              <div className="p-3 bg-slate-950/90 border border-amber-500/50 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Confirmation en deux étapes : saisissez "REINITIALISER"</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Pour éviter toute suppression accidentelle, une sauvegarde automatique sera créée juste avant. Veuillez taper le mot <strong className="text-amber-400 font-mono">REINITIALISER</strong> pour confirmer :
                </p>
                <input
                  type="text"
                  value={resetConfirmationWord}
                  onChange={(e) => setResetConfirmationWord(e.target.value)}
                  placeholder="Tapez REINITIALISER"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-amber-500"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isResetting || resetConfirmationWord.trim() !== 'REINITIALISER'}
                    onClick={handleResetDemoData}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Réinitialisation...</span>
                      </>
                    ) : (
                      <span>Confirmer la réinitialisation</span>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={() => {
                      setShowConfirmReset(false);
                      setResetConfirmationWord('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Connecté : <strong className="text-white font-mono">{user?.publicId}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
