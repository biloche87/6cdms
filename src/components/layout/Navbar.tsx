import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useOfflineCache } from '../../hooks/useOfflineCache.ts';
import { RoleSwitcherModal } from '../common/RoleSwitcherModal.tsx';
import { BrandLogo } from '../common/BrandLogo.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import { CounterBadge } from '../common/CounterBadge.tsx';
import { GpsStatusBadge } from '../common/GpsStatusBadge.tsx';
import {
  ShieldCheck,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
  Truck,
  UserCog,
  Search,
  Plus,
  Wifi,
  WifiOff,
  User,
} from 'lucide-react';

interface NavbarProps {
  onOpenAcceptanceTests: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onOpenSearch?: () => void;
  onOpenNewSale?: () => void;
  onToggleSidebar?: () => void;
  onNavigate?: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAcceptanceTests,
  onOpenNotifications,
  onOpenProfile,
  onOpenSearch,
  onOpenNewSale,
  onToggleSidebar,
  onNavigate,
}) => {
  const { user, logout, unreadCount, pendingSupplyCount, readySupplyCount } = useAuth();
  const { isOnline } = useOfflineCache();
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  if (!user) return null;

  const getRoleConfig = () => {
    switch (user.role) {
      case 'SALES_ADMIN_NATIONAL':
        return {
          label: 'SAN National',
          badgeClass: 'status-badge status-badge-grey',
        };
      case 'SALES_ADMIN':
        return {
          label: `Sales Admin • ${user.dropPointName || 'DP'}`,
          badgeClass: 'status-badge status-badge-grey',
        };
      case 'FSS':
        return {
          label: `FSS Superviseur • ${user.dropPointName || 'DP'}`,
          badgeClass: 'status-badge status-badge-grey',
        };
      case 'VRS':
        return {
          label: `VRS Vendeur • ${user.sectorName || 'Terrain'}`,
          badgeClass: 'status-badge status-badge-grey',
        };
      default:
        return {
          label: user.role || 'Utilisateur',
          badgeClass: 'status-badge status-badge-grey',
        };
    }
  };

  const roleConfig = getRoleConfig();

  return (
    <header className="sticky top-0 z-30 h-16 bg-[var(--bg-header)] text-[var(--text-primary)] border-b border-[var(--border-color)] shadow-sm select-none w-full max-w-full overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-5 lg:px-6 h-full">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Left section: Hamburger (mobile/tablet) + Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="lg:hidden flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                aria-label="Ouvrir le menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}

            {/* Desktop (≥1024px) & Tablet (768-1023px): "6C DMS" / Mobile (<768px): "6C" */}
            <div className="hidden md:block">
              <BrandLogo size="md" variant="mark" showSubtitle={false} />
            </div>
            <div className="block md:hidden">
              <BrandLogo size="md" variant="compact-6c" />
            </div>
          </div>

          {/* PC (≥ 1024 px): Search Bar (Ctrl+K) */}
          <div className="hidden lg:flex items-center flex-1 max-w-md mx-4">
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 text-[15px] transition cursor-pointer min-h-[44px]"
                title="Recherche globale et actions (Ctrl+K)"
              >
                <div className="flex items-center gap-2.5">
                  <Search className="w-5 h-5 text-slate-400" />
                  <span className="font-normal text-[15px]">Rechercher...</span>
                </div>
                <kbd className="px-2 py-0.5 rounded-md bg-slate-900 text-xs font-mono text-slate-400 border border-slate-700 font-medium">
                  Ctrl K
                </kbd>
              </button>
            )}
          </div>

          {/* Right section items */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Tablet search icon button (768 - 1023 px) */}
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                className="hidden md:flex lg:hidden items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                title="Rechercher"
                aria-label="Rechercher"
              >
                <Search className="w-6 h-6" />
              </button>
            )}

            {/* Online / Offline status indicator */}
            {/* PC (≥ 1024 px): dot + short text */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm font-medium">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              <span className="text-slate-300 text-sm font-medium">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
            </div>

            {/* Tablet (768 - 1023 px): connection point only */}
            <div
              className="hidden md:flex lg:hidden w-8 h-8 rounded-full items-center justify-center shrink-0"
              title={isOnline ? 'En ligne' : 'Hors ligne'}
            >
              <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            </div>

            {/* VRS GPS Status Indicator (VRS only on PC/tablet ≥ 768 px) */}
            {user.role === 'VRS' && (
              <div className="hidden md:block">
                <GpsStatusBadge className="shrink-0" />
              </div>
            )}

            {/* Mobile (< 768 px): connection dot visible right next to avatar/bell */}
            <div
              className="flex md:hidden w-5 h-5 items-center justify-center shrink-0"
              title={isOnline ? 'En ligne' : 'Hors ligne'}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            </div>

            {/* Notifications Bell with round red badge 20px (#DC2626) */}
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0 overflow-visible"
              title="Notifications"
              aria-label={unreadCount > 0 ? `${unreadCount > 99 ? 'Plus de 99' : unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
            >
              <Bell className="w-6 h-6" />
              <CounterBadge
                count={unreadCount}
                borderColor="var(--bg-header)"
                className="absolute -top-1 -right-1"
                ariaLabel={unreadCount > 0 ? `${unreadCount > 99 ? 'Plus de 99' : unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}` : undefined}
              />
            </button>

            {/* User Avatar with Dropdown Menu */}
            <div className="relative shrink-0" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-800 transition cursor-pointer group min-h-[44px]"
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-10 h-10 rounded-full bg-[#15803D] flex items-center justify-center font-bold text-sm text-[#FFFFFF] shadow-xs select-none shrink-0">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform hidden sm:block ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Avatar Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* User Profile Summary */}
                  <div className="px-4 py-3 border-b border-slate-800">
                    <div className="font-bold text-base text-white truncate">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-sm font-mono text-slate-400 mt-0.5">
                      {user.publicId}
                    </div>
                    <div className="mt-2">
                      <span className={roleConfig.badgeClass}>
                        {roleConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Mobile-only shortcuts (<768px) inside avatar dropdown */}
                  <div className="block md:hidden border-b border-slate-800 py-2 px-3 space-y-2">
                    {onOpenSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenSearch();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition min-h-[44px]"
                      >
                        <Search className="w-5 h-5 text-slate-400" />
                        <span className="font-medium">Rechercher...</span>
                      </button>
                    )}

                    <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-300 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      <span className="flex items-center gap-2">
                        {isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-amber-400" />}
                        <span className="font-medium">Réseau</span>
                      </span>
                      <span className="text-sm font-semibold text-slate-300">
                        {isOnline ? 'En ligne' : 'Hors ligne'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-3 py-1.5 text-sm text-slate-300">
                      <span className="font-medium">Thème d'affichage</span>
                      <ThemeToggle variant="compact" />
                    </div>

                    {user.role === 'VRS' && (
                      <div className="pt-1 flex items-center justify-between px-1">
                        <span className="text-sm font-medium text-slate-300">Signal GPS</span>
                        <GpsStatusBadge />
                      </div>
                    )}
                  </div>

                  {/* Actions inside dropdown */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsRoleModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Changer de rôle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenProfile();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                      <UserCog className="w-4 h-4 text-slate-400" />
                      <span>Paramètres du profil</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAcceptanceTests();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Tests d'acceptation (10)</span>
                    </button>
                  </div>

                  {/* Disconnect inside dropdown */}
                  <div className="pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition cursor-pointer font-medium"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span>Se déconnecter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Role Switcher Modal */}
      <RoleSwitcherModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onNavigate={onNavigate}
      />
    </header>
  );
};
