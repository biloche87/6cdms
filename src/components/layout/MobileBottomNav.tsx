import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { CounterBadge } from '../common/CounterBadge.tsx';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Store,
  Menu,
  Truck,
  FileCheck2,
  Building2,
  Users,
  Gift,
} from 'lucide-react';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onToggleMobileMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onToggleMobileMenu,
}) => {
  const { user, pendingSupplyCount, readySupplyCount, giftsBadgeCount } = useAuth();
  if (!user) return null;

  interface MobileNavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    isMenuToggle?: boolean;
  }

  const getNavItems = (): MobileNavItem[] => {
    switch (user.role) {
      case 'VRS':
        return [
          { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
          { id: 'sales', label: 'Ventes', icon: ShoppingCart },
          {
            id: 'gifts',
            label: 'Cadeaux',
            icon: Gift,
            badge: giftsBadgeCount > 0 ? giftsBadgeCount : undefined,
          },
          { id: 'pos', label: 'Clients', icon: Store },
          {
            id: 'menu',
            label: 'Menu',
            icon: Menu,
            isMenuToggle: true,
            badge: readySupplyCount > 0 ? readySupplyCount : pendingSupplyCount,
          },
        ];

      case 'SALES_ADMIN':
        return [
          { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
          { id: 'stocks', label: 'Stocks', icon: Boxes },
          {
            id: 'supply-requests',
            label: 'VRS',
            icon: Truck,
            badge: pendingSupplyCount,
          },
          { id: 'receipts', label: 'Entrées', icon: FileCheck2 },
          { id: 'menu', label: 'Menu', icon: Menu, isMenuToggle: true },
        ];

      case 'SALES_ADMIN_NATIONAL':
        return [
          { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
          { id: 'stocks', label: 'Stocks', icon: Boxes },
          {
            id: 'supply-requests',
            label: 'Charg.',
            icon: Truck,
            badge: pendingSupplyCount,
          },
          { id: 'drop-points', label: 'Dépôts', icon: Building2 },
          { id: 'menu', label: 'Menu', icon: Menu, isMenuToggle: true },
        ];

      case 'FSS':
        return [
          { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
          { id: 'my-vrs', label: 'Équipe', icon: Users },
          { id: 'pos', label: 'Clients', icon: Store },
          {
            id: 'supply-requests',
            label: 'Charg.',
            icon: Truck,
            badge: pendingSupplyCount,
          },
          { id: 'menu', label: 'Menu', icon: Menu, isMenuToggle: true },
        ];

      default:
        return [
          { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
          { id: 'stocks', label: 'Stocks', icon: Boxes },
          { id: 'supply-requests', label: 'Charg.', icon: Truck },
          { id: 'pos', label: 'Clients', icon: Store },
          { id: 'menu', label: 'Menu', icon: Menu, isMenuToggle: true },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <nav
      id="mobile-bottom-navbar"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-color)] lg:hidden select-none"
      style={{
        backgroundColor: 'var(--bg-card)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        className="w-full h-16 items-center px-0"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            !item.isMenuToggle &&
            (currentView === item.id ||
              (item.id === 'supply-requests' && (currentView === 'supply-requests' || currentView === 'my-stock')));

          return (
            <button
              key={item.id}
              id={`mobile-nav-${item.id}`}
              type="button"
              onClick={() => {
                if (item.isMenuToggle) {
                  onToggleMobileMenu();
                } else {
                  onNavigate(item.id);
                }
              }}
              className={`w-full h-[56px] relative flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-colors cursor-pointer select-none ${
                isActive
                  ? 'text-emerald-500 font-bold bg-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              style={{ minWidth: 0, overflow: 'hidden' }}
            >
              <div className="relative flex items-center justify-center shrink-0">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-105' : ''}`} />
                <CounterBadge
                  count={item.badge}
                  borderColor="var(--bg-card)"
                  className="absolute -top-1.5 -right-3"
                  ariaLabel={`${item.badge} notifications`}
                />
              </div>
              <span
                className="text-[12px] font-medium leading-tight mt-1 truncate w-full text-center whitespace-nowrap overflow-hidden block"
                style={{
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'clip',
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
