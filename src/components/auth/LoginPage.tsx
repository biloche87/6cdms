import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Boxes,
  Truck,
  Building2,
  Users,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface LoginPageProps {
  onOpenAcceptanceTests?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onOpenAcceptanceTests }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('6CDISTSAN');
  const [password, setPassword] = useState('6CDist@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectingDemoId, setConnectingDemoId] = useState<string | null>(null);

  const redirectToDashboard = () => {
    try {
      localStorage.setItem('6c_active_tab', 'dashboard');
      localStorage.removeItem('6c_selected_pos_id');
      if (typeof window !== 'undefined') {
        window.location.hash = '#/dashboard';
      }
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Veuillez renseigner votre identifiant et mot de passe.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      redirectToDashboard();
      await login(identifier.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Identifiant ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = async (demoId: string) => {
    setIdentifier(demoId);
    setPassword('6CDist@2026');
    setError(null);
    setConnectingDemoId(demoId);
    setLoading(true);
    try {
      redirectToDashboard();
      await login(demoId, '6CDist@2026');
    } catch (err: any) {
      setError(err.message || 'Impossible de se connecter à ce profil.');
    } finally {
      setConnectingDemoId(null);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-[var(--text-primary)] relative">
      {/* Theme Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-[440px]">
        {/* Brand header */}
        <div className="text-center flex flex-col items-center mb-6">
          <h1 className="text-[32px] font-black tracking-tight text-[var(--text-primary)] flex items-center gap-2 justify-center leading-[1.25] font-display">
            <span>6C</span>
            <span className="text-[var(--color-green-text)]">DMS</span>
          </h1>
          <p className="mt-1 text-[15px] text-[var(--text-secondary)] truncate max-w-full">
            Distribution Management System • Snack & Boissons Mali
          </p>
        </div>

        {/* Card max-w 440px */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 sm:p-8 shadow-xl rounded-2xl w-full">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[15px] font-medium text-[var(--text-primary)] mb-2">
                Identifiant opérationnel
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--text-muted)]">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ex. 6CDISTSAN ou 6CDISTSA-DKN"
                  className="block w-full h-[52px] pl-11 pr-4 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#54a835] focus:border-transparent font-mono transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[15px] font-medium text-[var(--text-primary)] mb-2">
                Mot de passe
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--text-muted)]">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full h-[52px] pl-11 pr-12 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#54a835] focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute inset-y-0 right-0 w-11 h-11 my-auto mr-1 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/20 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-[14px] text-red-600 dark:text-red-300">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] flex justify-center items-center gap-2 px-4 rounded-xl shadow-md text-[16px] font-bold text-white bg-[#54a835] hover:bg-[#46912b] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#54a835] transition disabled:opacity-50 cursor-pointer"
            >
              {loading && !connectingDemoId ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <span>Se connecter</span>
              )}
            </button>
          </form>

          {/* Collapsible Demo Accounts Selector */}
          <div className="mt-6 pt-5 border-t border-[var(--border-color)]">
            <button
              type="button"
              onClick={() => setShowDemoProfiles(!showDemoProfiles)}
              className="w-full flex items-center justify-between text-[14px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition py-1 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Profils démo
              </span>
              <span className="text-[14px] text-[#54a835] font-semibold">
                {showDemoProfiles ? 'Masquer' : 'Afficher les 4 rôles'}
              </span>
            </button>

            {showDemoProfiles && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSelectDemo('6CDISTSAN')}
                    className={`p-3 rounded-xl border text-left transition relative cursor-pointer group ${
                      connectingDemoId === '6CDISTSAN'
                        ? 'bg-purple-900/80 border-purple-400 text-white shadow-lg'
                        : 'bg-[var(--bg-card-subtle)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-purple-500/60 hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="font-bold text-[15px] flex items-center justify-between">
                      <span className="group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">SAN National</span>
                      {connectingDemoId === '6CDISTSAN' ? (
                        <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                      ) : (
                        <Building2 className="w-4 h-4 text-purple-500" />
                      )}
                    </div>
                    <div className="text-[14px] text-[var(--text-secondary)] font-mono mt-0.5">6CDISTSAN</div>
                    <div className="text-[14px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1.5">
                      <span>Connexion directe</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSelectDemo('6CDISTSA-DKN')}
                    className={`p-3 rounded-xl border text-left transition relative cursor-pointer group ${
                      connectingDemoId === '6CDISTSA-DKN'
                        ? 'bg-blue-900/80 border-blue-400 text-white shadow-lg'
                        : 'bg-[var(--bg-card-subtle)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-blue-500/60 hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="font-bold text-[15px] flex items-center justify-between">
                      <span className="group-hover:text-blue-600 dark:group-hover:text-blue-300 transition">Sales Admin</span>
                      {connectingDemoId === '6CDISTSA-DKN' ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      ) : (
                        <Boxes className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <div className="text-[14px] text-[var(--text-secondary)] font-mono mt-0.5">6CDISTSA-DKN</div>
                    <div className="text-[14px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1.5">
                      <span>Connexion directe</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSelectDemo('6CDISTFSS-DKN')}
                    className={`p-3 rounded-xl border text-left transition relative cursor-pointer group ${
                      connectingDemoId === '6CDISTFSS-DKN'
                        ? 'bg-teal-900/80 border-teal-400 text-white shadow-lg'
                        : 'bg-[var(--bg-card-subtle)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-teal-500/60 hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="font-bold text-[15px] flex items-center justify-between">
                      <span className="group-hover:text-teal-600 dark:group-hover:text-teal-300 transition">FSS Superviseur</span>
                      {connectingDemoId === '6CDISTFSS-DKN' ? (
                        <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />
                      ) : (
                        <Users className="w-4 h-4 text-teal-500" />
                      )}
                    </div>
                    <div className="text-[14px] text-[var(--text-secondary)] font-mono mt-0.5">6CDISTFSS-DKN</div>
                    <div className="text-[14px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1.5">
                      <span>Connexion directe</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSelectDemo('6CDISTVRS-DKN-001')}
                    className={`p-3 rounded-xl border text-left transition relative cursor-pointer group ${
                      connectingDemoId === '6CDISTVRS-DKN-001'
                        ? 'bg-amber-900/80 border-amber-400 text-white shadow-lg'
                        : 'bg-[var(--bg-card-subtle)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-amber-500/60 hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="font-bold text-[15px] flex items-center justify-between">
                      <span className="group-hover:text-amber-600 dark:group-hover:text-amber-300 transition">VRS Terrain</span>
                      {connectingDemoId === '6CDISTVRS-DKN-001' ? (
                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                      ) : (
                        <Truck className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <div className="text-[14px] text-[var(--text-secondary)] font-mono mt-0.5">6CDISTVRS-DKN-001</div>
                    <div className="text-[14px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1.5">
                      <span>Connexion directe</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                </div>
                <p className="text-[14px] text-[var(--text-secondary)] text-center pt-1">
                  Tous les profils sont pré-configurés pour tester le flux complet terrain & bureau.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Link to launch Acceptance Tests */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onOpenAcceptanceTests}
            className="inline-flex items-center gap-2 text-[14px] text-[#54a835] hover:text-[#46912b] bg-[var(--bg-card)] border border-[var(--border-color)] px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 text-[#54a835]" />
            <span>Vérifier les 10 Scénarios d'Acceptation du Système</span>
          </button>
        </div>
      </div>
    </div>
  );
};
