import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { RoleSwitcherModal } from '../common/RoleSwitcherModal.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import { CounterBadge } from '../common/CounterBadge.tsx';
import {
  LayoutDashboard,
  Building2,
  Users,
  MapPin,
  Store,
  Package,
  Boxes,
  FileCheck2,
  Truck,
  ShoppingCart,
  CalendarCheck,
  Map,
  Compass,
  BarChart3,
  FileSpreadsheet,
  History,
  CheckCircle,
  PlusCircle,
  PackageCheck,
  UserCheck,
  Receipt,
  Sparkles,
  Gift,
  Trophy,
  Loader2,
  LogOut,
  ChevronDown,
} from 'lucide-react';

interface SidebarProps {
  currentView?: string;
  activeTab?: string;
  onNavigate?: (view: string) => void;
  onSelectTab?: (tab: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  activeTab,
  onNavigate,
  onSelectTab,
  isMobileOpen = false,
  onCloseMobile,
  isCollapsed = false,
}) => {
  const {
    user,
    pendingSupplyCount,
    readySupplyCount,
    pendingDpSupplyCount,
    pendingPosRequestsCount,
    giftsBadgeCount,
    switchRoleShortcut,
    logout,
  } = useAuth();
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isRolesExpanded, setIsRolesExpanded] = useState(false);

  if (!user) return null;

  const activeId = currentView || activeTab || 'dashboard';

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
    isNewSale?: boolean;
    badgeCount?: number;
    badgeAriaLabel?: string;
  }

  interface NavGroup {
    title?: string;
    items: NavItem[];
  }

  const getNavGroups = (): NavGroup[] => {
    switch (user.role) {
      case 'SALES_ADMIN_NATIONAL':
        return [
          {
            title: 'Pilotage National',
            items: [
              { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
              { id: 'scoring', label: 'Notation & Semestres', icon: Trophy },
              { id: 'gift-catalog', label: 'Catalogue cadeaux', icon: Sparkles },
              { id: 'gifts', label: 'Cadeaux & Remises', icon: Gift, badgeCount: giftsBadgeCount > 0 ? giftsBadgeCount : undefined, badgeAriaLabel: `${giftsBadgeCount} cadeaux à traiter` },
              { id: 'stats', label: 'Statistiques', icon: BarChart3 },
              { id: 'reports', label: 'Rapports', icon: FileSpreadsheet },
            ],
          },
          {
            title: 'Réseau & Points de Vente',
            items: [
              { id: 'drop-points', label: 'Drop Points (Dépôts)', icon: Building2 },
              { id: 'users', label: 'Utilisateurs (SA, FSS, VRS)', icon: Users },
              {
                id: 'pos-requests',
                label: 'Demandes PDV',
                icon: FileCheck2,
                badgeCount: pendingPosRequestsCount > 0 ? pendingPosRequestsCount : undefined,
                badgeAriaLabel: `${pendingPosRequestsCount} demande${pendingPosRequestsCount > 1 ? 's' : ''} PDV en attente`,
              },
              { id: 'pos', label: 'Points de Vente (PDV)', icon: Store },
              { id: 'sectors', label: 'Secteurs', icon: MapPin },
              { id: 'map', label: 'Carte', icon: Map },
            ],
          },
          {
            title: 'Approvisionnement Drop Points',
            items: [
              {
                id: 'dp-supply-requests',
                label: 'Commandes stock',
                icon: Truck,
                badgeCount: pendingDpSupplyCount > 0 ? pendingDpSupplyCount : undefined,
                badgeAriaLabel: `${pendingDpSupplyCount} commande${pendingDpSupplyCount > 1 ? 's' : ''} stock en attente`,
              },
              { id: 'dp-invoices', label: 'Factures DP', icon: Receipt },
              { id: 'dp-transfers', label: 'Transferts', icon: Boxes },
            ],
          },
          {
            title: 'Opérations & Stocks',
            items: [
              { id: 'stocks', label: 'Stocks', icon: Boxes },
              { id: 'receipts', label: 'Réceptions Fournisseur', icon: FileCheck2 },
              {
                id: 'supply-requests',
                label: 'Chargements',
                icon: Truck,
                badgeCount: pendingSupplyCount > 0 ? pendingSupplyCount : undefined,
                badgeAriaLabel: `${pendingSupplyCount} chargement${pendingSupplyCount > 1 ? 's' : ''} en attente`,
              },
              { id: 'products', label: 'Catalogue', icon: Package },
              { id: 'sales', label: 'Ventes', icon: ShoppingCart },
              { id: 'tours', label: 'Plans de Tournée', icon: Compass },
              { id: 'visits', label: 'Visites', icon: CalendarCheck },
            ],
          },
          {
            title: 'Gouvernance & Conformité',
            items: [
              { id: 'activity-logs', label: "Journal d'Activité", icon: History },
              { id: 'acceptance-tests', label: "Tests d'Acceptation (10)", icon: CheckCircle },
            ],
          },
        ];

      case 'SALES_ADMIN':
        return [
          {
            title: `Drop Point ${user.dropPointCode || ''}`,
            items: [
              { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
              { id: 'my-droppoint', label: 'Mon Dépôt & Secteurs', icon: Building2 },
              { id: 'users', label: 'Équipe (FSS & VRS)', icon: Users },
              {
                id: 'pos-requests',
                label: 'Demandes PDV',
                icon: FileCheck2,
                badgeCount: pendingPosRequestsCount > 0 ? pendingPosRequestsCount : undefined,
                badgeAriaLabel: `${pendingPosRequestsCount} demande${pendingPosRequestsCount > 1 ? 's' : ''} PDV en attente`,
              },
              { id: 'pos', label: 'Points de Vente', icon: Store },
              { id: 'map', label: 'Carte', icon: Map },
            ],
          },
          {
            title: 'Commandes & Facturation',
            items: [
              { id: 'dp-supply-requests', label: 'Mes commandes', icon: Truck },
              { id: 'dp-invoices', label: 'Mes factures', icon: Receipt },
              { id: 'dp-transfers', label: 'Transferts', icon: Boxes },
            ],
          },
          {
            title: 'Gestion des Stocks',
            items: [
              { id: 'stocks', label: 'Stocks', icon: Boxes },
              {
                id: 'supply-requests',
                label: 'Chargements VRS',
                icon: Truck,
                badgeCount: pendingSupplyCount > 0 ? pendingSupplyCount : undefined,
                badgeAriaLabel: `${pendingSupplyCount} chargement${pendingSupplyCount > 1 ? 's' : ''} VRS en attente`,
              },
              { id: 'products', label: 'Catalogue', icon: Package },
            ],
          },
          {
            title: 'Ventes & Terrain',
            items: [
              { id: 'sales', label: 'Ventes', icon: ShoppingCart },
              { id: 'gifts', label: 'Cadeaux & Remises', icon: Gift, badgeCount: giftsBadgeCount > 0 ? giftsBadgeCount : undefined, badgeAriaLabel: `${giftsBadgeCount} remises à traiter` },
              { id: 'tours', label: 'Plans de Tournée', icon: Compass },
              { id: 'visits', label: 'Visites', icon: CalendarCheck },
              { id: 'stats', label: 'Statistiques', icon: BarChart3 },
              { id: 'acceptance-tests', label: "Tests d'Acceptation", icon: CheckCircle },
            ],
          },
        ];

      case 'FSS':
        return [
          {
            title: 'Supervision Terrain',
            items: [
              { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
              { id: 'my-vrs', label: 'Mes Vendeurs (VRS)', icon: UserCheck },
              {
                id: 'pos-requests',
                label: 'Demandes PDV',
                icon: FileCheck2,
                badgeCount: pendingPosRequestsCount > 0 ? pendingPosRequestsCount : undefined,
                badgeAriaLabel: `${pendingPosRequestsCount} demande${pendingPosRequestsCount > 1 ? 's' : ''} PDV en attente`,
              },
              { id: 'pos', label: 'Points de Vente', icon: Store },
              { id: 'map', label: 'Carte', icon: Map },
            ],
          },
          {
            title: 'Suivi des Activités',
            items: [
              { id: 'sales', label: 'Ventes', icon: ShoppingCart },
              { id: 'gifts', label: 'Cadeaux VRS', icon: Gift },
              { id: 'visits', label: 'Visites', icon: CalendarCheck },
              { id: 'tours', label: 'Tournées Commerciales', icon: Compass },
              {
                id: 'supply-requests',
                label: 'Chargements',
                icon: Truck,
                badgeCount: pendingSupplyCount > 0 ? pendingSupplyCount : undefined,
                badgeAriaLabel: `${pendingSupplyCount} chargement${pendingSupplyCount > 1 ? 's' : ''} en attente`,
              },
              { id: 'stats', label: 'Statistiques', icon: BarChart3 },
              { id: 'acceptance-tests', label: "Tests d'Acceptation", icon: CheckCircle },
            ],
          },
        ];

      case 'VRS':
        return [
          {
            title: 'ACTIONS RAPIDES TERRAIN',
            items: [
              { id: 'dashboard', label: 'Mon Accueil', icon: LayoutDashboard },
              { id: 'new-sale', label: 'Nouvelle Vente', icon: PlusCircle, isNewSale: true },
              { id: 'new-supply', label: 'Mon chargement', icon: Truck },
              { id: 'new-pos', label: 'Nouveau PDV', icon: Store },
              { id: 'visits', label: 'Visites', icon: CalendarCheck },
            ],
          },
          {
            title: 'MON ESPACE COMMERCIAL',
            items: [
              {
                id: 'gifts',
                label: 'Mes cadeaux',
                icon: Gift,
                badgeCount: giftsBadgeCount > 0 ? giftsBadgeCount : undefined,
                badgeAriaLabel: `${giftsBadgeCount} carte(s) cadeau disponible(s)`,
              },
              {
                id: 'pos-requests',
                label: 'Mes demandes PDV',
                icon: FileCheck2,
                badgeCount: pendingPosRequestsCount > 0 ? pendingPosRequestsCount : undefined,
                badgeAriaLabel: `${pendingPosRequestsCount} demande${pendingPosRequestsCount > 1 ? 's' : ''} PDV en attente`,
              },
              { id: 'pos', label: 'Mes Points de Vente', icon: Store },
              { id: 'sales', label: 'Mes ventes', icon: ShoppingCart },
              { id: 'dp-invoices', label: 'Factures & Règlements', icon: Receipt },
              { id: 'my-stock', label: 'Mon stock', icon: Boxes },
              {
                id: 'supply-requests',
                label: 'Mes chargements',
                icon: Truck,
                badgeCount:
                  readySupplyCount > 0
                    ? readySupplyCount
                    : pendingSupplyCount > 0
                    ? pendingSupplyCount
                    : undefined,
                badgeAriaLabel:
                  readySupplyCount > 0
                    ? `${readySupplyCount} chargement${readySupplyCount > 1 ? 's' : ''} prêt${readySupplyCount > 1 ? 's' : ''}`
                    : `${pendingSupplyCount} chargement${pendingSupplyCount > 1 ? 's' : ''} en attente`,
              },
              { id: 'tours', label: 'Ma Tournée', icon: Compass },
              { id: 'map', label: 'Carte', icon: Map },
              { id: 'acceptance-tests', label: "Tests d'Acceptation", icon: CheckCircle },
            ],
          },
        ];
      default:
        return [];
    }
  };

  const navGroups = getNavGroups() || [];

  const handleItemClick = (id: string) => {
    const navFn = onNavigate || onSelectTab;
    if (navFn) {
      navFn(id);
    }
    if (onCloseMobile) onCloseMobile();
  };

  const getRoleDisplayName = () => {
    switch (user.role) {
      case 'SALES_ADMIN_NATIONAL':
        return 'SAN National';
      case 'SALES_ADMIN':
        return 'SA DKN';
      case 'FSS':
        return 'FSS DKN';
      case 'VRS':
        return 'VRS Terrain';
      default:
        return user.role || 'Rôle';
    }
  };

  const getScopeLineText = () => {
    if (user.role === 'SALES_ADMIN_NATIONAL') {
      return '6C National · Tout réseau';
    }
    const dp = user.dropPointName || 'Drop Point DAKAN';
    const sec = user.sectorName ? ` · ${user.sectorName}` : ' · Secteur 01';
    return `${dp}${sec}`;
  };

  const userInitials = `${(user.firstName?.[0] || 'U')}${(user.lastName?.[0] || '')}`.toUpperCase();
  const userFullTooltip = `${user.firstName || ''} ${user.lastName || ''} (${user.publicId || ''}) · ${getRoleDisplayName()}`.trim();

  const handleSwitchDemoRole = async (targetRoleId: string) => {
    setSwitchingRole(targetRoleId);
    try {
      await switchRoleShortcut(targetRoleId);
      setIsRolesExpanded(false);
      if (typeof window !== 'undefined') {
        window.location.hash = '#/dashboard';
        try {
          localStorage.setItem('6c_active_tab', 'dashboard');
          localStorage.removeItem('6c_selected_pos_id');
        } catch {}
      }
      if (onNavigate) onNavigate('dashboard');
      if (onCloseMobile) onCloseMobile();
    } finally {
      setSwitchingRole(null);
    }
  };

  const sidebarContent = (
    <div
      className={`flex flex-col h-[100dvh] max-h-[100dvh] bg-[var(--bg-sidebar)] text-[var(--text-secondary)] border-r border-[var(--border-color)] ${
        isCollapsed ? 'w-[72px]' : 'w-[280px]'
      } select-none overflow-hidden transition-all duration-200 pb-[env(safe-area-inset-bottom)]`}
    >
      {/* =========================================================================
          ZONE 1 : HAUT COMPACT (fixe) - 48 px
          Une ligne de 48 px : icône de lieu + "Drop Point DAKAN · Secteur 01" (SAN : "6C National · Tout réseau")
          14 px, texte sur une ligne avec ellipsis tolérée uniquement ici.
         ========================================================================= */}
      <div className="h-[48px] min-h-[48px] max-h-[48px] px-3 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-sidebar-header)] flex items-center">
        {isCollapsed ? (
          <div className="w-full flex justify-center" title={getScopeLineText()}>
            <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
        ) : (
          <div
            className="flex items-center gap-2 min-w-0 w-full text-slate-700 dark:text-slate-200 font-medium text-[14px]"
            title={getScopeLineText()}
          >
            <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate flex-1">{getScopeLineText()}</span>
          </div>
        )}
      </div>

      {/* =========================================================================
          ZONE 2 : MILIEU = LISTE DU MENU
          Occupe TOUTE la hauteur restante (flex: 1, min-height: 0, overflow-y: auto,
          défilement fluide, scrollbar fine).
          Comprend les entrées du menu (44 px, 2 px entre entrées, titres 12 px avec 12 px marge haute)
          Puis en BAS de la zone du milieu : Bloc "RÔLES" (outil de démo) replié par défaut en une ligne de 44 px.
         ========================================================================= */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col justify-between p-2 scrollbar-thin">
        {/* Navigation Groups */}
        <nav className="space-y-3">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-[2px]">
              {group.title && !isCollapsed && (
                <div className="px-3 pt-3 pb-1 text-[12px] font-bold text-slate-400 uppercase tracking-[0.04em]">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = activeId === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full h-[44px] flex items-center ${
                      isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                    } rounded-xl text-[15px] font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/15 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/30'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : item.isNewSale
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-[var(--text-muted)]'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate flex-1 text-left leading-normal">{item.label}</span>}
                    {!isCollapsed && (
                      <CounterBadge
                        count={item.badgeCount}
                        borderColor="var(--bg-sidebar)"
                        className="ml-auto shrink-0"
                        ariaLabel={item.badgeAriaLabel}
                      />
                    )}
                    {isCollapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                      <CounterBadge
                        count={item.badgeCount}
                        borderColor="var(--bg-sidebar)"
                        className="absolute top-1 right-1"
                        ariaLabel={item.badgeAriaLabel}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* BLOC "RÔLES" (outil de démo) : en bas de la zone du milieu, après les entrées */}
        {!isCollapsed ? (
          <div className="pt-3 pb-1 border-t border-[var(--border-color)]/60 mt-4 shrink-0">
            {/* Ligne repliée de 44 px "Rôle : VRS Terrain ▾" */}
            <button
              type="button"
              onClick={() => setIsRolesExpanded(!isRolesExpanded)}
              className="w-full h-[44px] px-2.5 rounded-lg flex items-center justify-between text-[14px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-[var(--bg-hover)] transition cursor-pointer border border-[var(--border-color)] bg-[var(--bg-card-subtle)]"
              aria-expanded={isRolesExpanded}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">Rôle : {getRoleDisplayName()}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                  isRolesExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Menu déployé : 4 boutons en grille 2x2 de 40 px de haut, texte 14 px */}
            {isRolesExpanded && (
              <div className="mt-2 grid grid-cols-2 gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  type="button"
                  disabled={!!switchingRole}
                  onClick={() => handleSwitchDemoRole('6CDISTSAN')}
                  className={`h-[40px] px-2 rounded-lg text-[14px] font-semibold transition flex items-center justify-between border cursor-pointer ${
                    user.role === 'SALES_ADMIN_NATIONAL'
                      ? 'bg-purple-900/40 text-purple-200 border-purple-500/60 shadow-xs'
                      : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">SAN</span>
                  {switchingRole === '6CDISTSAN' ? (
                    <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin shrink-0" />
                  ) : user.role === 'SALES_ADMIN_NATIONAL' ? (
                    <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                  ) : null}
                </button>

                <button
                  type="button"
                  disabled={!!switchingRole}
                  onClick={() => handleSwitchDemoRole('6CDISTSA-DKN')}
                  className={`h-[40px] px-2 rounded-lg text-[14px] font-semibold transition flex items-center justify-between border cursor-pointer ${
                    user.role === 'SALES_ADMIN'
                      ? 'bg-blue-900/40 text-blue-200 border-blue-500/60 shadow-xs'
                      : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">SA DKN</span>
                  {switchingRole === '6CDISTSA-DKN' ? (
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                  ) : user.role === 'SALES_ADMIN' ? (
                    <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  ) : null}
                </button>

                <button
                  type="button"
                  disabled={!!switchingRole}
                  onClick={() => handleSwitchDemoRole('6CDISTFSS-DKN')}
                  className={`h-[40px] px-2 rounded-lg text-[14px] font-semibold transition flex items-center justify-between border cursor-pointer ${
                    user.role === 'FSS'
                      ? 'bg-teal-900/40 text-teal-200 border-teal-500/60 shadow-xs'
                      : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">FSS DKN</span>
                  {switchingRole === '6CDISTFSS-DKN' ? (
                    <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin shrink-0" />
                  ) : user.role === 'FSS' ? (
                    <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                  ) : null}
                </button>

                <button
                  type="button"
                  disabled={!!switchingRole}
                  onClick={() => handleSwitchDemoRole('6CDISTVRS-DKN-001')}
                  className={`h-[40px] px-2 rounded-lg text-[14px] font-semibold transition flex items-center justify-between border cursor-pointer ${
                    user.role === 'VRS'
                      ? 'bg-amber-900/40 text-amber-200 border-amber-500/60 shadow-xs'
                      : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">VRS</span>
                  {switchingRole === '6CDISTVRS-DKN-001' ? (
                    <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                  ) : user.role === 'VRS' ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  ) : null}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="pt-2 pb-1 border-t border-[var(--border-color)]/60 mt-2 shrink-0 flex justify-center">
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(true)}
              title={`Changer de rôle (actuel: ${getRoleDisplayName()})`}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-amber-500 hover:bg-[var(--bg-hover)] transition cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          ZONE 3 : BAS COMPACT (fixe) - 52 px
          Une seule ligne de 52 px, séparateur fin au-dessus, dans cet ordre :
          a) Sélecteur de thème : 3 icônes (soleil, lune, écran) dans un segment
             de 96 px de large et 32 px de haut, icônes 16 px, zone tactile 32 px
             minimum (36 px sur mobile).
          b) Avatar rond de 32 px avec les initiales (code complet et nom en
             infobulle et dans le header, plus de code tronqué affiché).
          c) Bouton de déconnexion : icône seule (sortie) de 36 px, couleur danger
             discrète (fond transparent, icône rouge #B91C1C en clair, #F87171 en sombre,
             fond rouge très léger au survol), infobulle et aria-label "Déconnexion".
          Les 3 éléments tiennent sur une ligne sans débordement.
         ========================================================================= */}
      <div className="h-[52px] min-h-[52px] max-h-[52px] px-2.5 shrink-0 border-t border-[var(--border-color)] flex items-center bg-[var(--bg-sidebar-header)]">
        {isCollapsed ? (
          <div className="w-full flex items-center justify-around">
            <button
              type="button"
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
                logout();
              }}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-transparent hover:bg-red-500/10 active:scale-95 text-[#B91C1C] dark:text-[#F87171] transition cursor-pointer"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between gap-1.5">
            {/* a) Sélecteur de thème : 96 px de large, 32 px de haut */}
            <div className="shrink-0">
              <ThemeToggle variant="sidebar-segmented" />
            </div>

            {/* b) Avatar rond de 32 px avec les initiales */}
            <div
              className="w-8 h-8 min-w-[32px] rounded-full bg-slate-800 dark:bg-slate-700 text-white font-bold text-[13px] flex items-center justify-center border border-slate-600/70 shrink-0 cursor-default shadow-2xs select-none"
              title={userFullTooltip}
              aria-label={userFullTooltip}
            >
              {userInitials}
            </div>

            {/* c) Bouton de déconnexion : icône seule de 36 px, danger discret */}
            <button
              type="button"
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
                logout();
              }}
              className="flex items-center justify-center w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-transparent hover:bg-red-500/10 active:bg-red-500/20 active:scale-95 text-[#B91C1C] dark:text-[#F87171] transition cursor-pointer shrink-0"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden lg:flex shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-150 animate-modal-backdrop"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full max-h-screen max-h-dvh flex flex-col shadow-2xl animate-drawer-left">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Role Switcher Modal */}
      <RoleSwitcherModal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          if (onCloseMobile) onCloseMobile();
        }}
        onNavigate={onNavigate}
      />
    </>
  );
};
