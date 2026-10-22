import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { GpsProvider, useGps } from './context/GpsContext.tsx';
import { VrsGpsEnforcementModal } from './components/common/VrsGpsEnforcementModal.tsx';
import { api } from './services/api.ts';
import { offlineSync } from './services/offlineSync.ts';
import { PointOfSale } from './types/index.ts';
import { CheckCircle2, X, ArrowRight } from 'lucide-react';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { MobileBottomNav } from './components/layout/MobileBottomNav.tsx';
import { NationalDashboard } from './components/dashboard/NationalDashboard.tsx';
// NewPosModal is eagerly loaded (per requirement 8: instant opening, camera & GPS preserved)
import { NewPosModal } from './components/pos/NewPosModal.tsx';
import { GlobalSearchPalette } from './components/common/GlobalSearchPalette.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { OfflineNoticeBanner } from './components/offline/OfflineNoticeBanner.tsx';

import { StocksView } from './components/stocks/StocksView.tsx';
import { lazyWithRetry } from './utils/lazyWithRetry.ts';

// Code-split views loaded on demand with resilient retry mechanism
const SalesList = lazyWithRetry(() => import('./components/sales/SalesList.tsx'), 'SalesList');
const NewSaleModal = lazyWithRetry(() => import('./components/sales/NewSaleModal.tsx'), 'NewSaleModal');
const PointOfSaleList = lazyWithRetry(() => import('./components/pos/PointOfSaleList.tsx'), 'PointOfSaleList');
const PosDetailModal = lazyWithRetry(() => import('./components/pos/PosDetailModal.tsx'), 'PosDetailModal');
const PosMapView = lazyWithRetry(() => import('./components/pos/PosMapView.tsx'), 'PosMapView');
const PosRequestsView = lazyWithRetry(() => import('./components/pos/PosRequestsView.tsx'), 'PosRequestsView');
const ReceiptsList = lazyWithRetry(() => import('./components/stocks/ReceiptsList.tsx'), 'ReceiptsList');
const NewReceiptModal = lazyWithRetry(() => import('./components/stocks/NewReceiptModal.tsx'), 'NewReceiptModal');
const SupplyRequestsList = lazyWithRetry(() => import('./components/stocks/SupplyRequestsList.tsx'), 'SupplyRequestsList');
const SupplyRequestModal = lazyWithRetry(() => import('./components/stocks/SupplyRequestModal.tsx'), 'SupplyRequestModal');
const DpSupplyRequestsView = lazyWithRetry(() => import('./components/stocks/DpSupplyRequestsView.tsx'), 'DpSupplyRequestsView');
const DpInvoicesView = lazyWithRetry(() => import('./components/stocks/DpInvoicesView.tsx'), 'DpInvoicesView');
const DpTransfersView = lazyWithRetry(() => import('./components/stocks/DpTransfersView.tsx'), 'DpTransfersView');
const TourPlansView = lazyWithRetry(() => import('./components/tours/TourPlansView.tsx'), 'TourPlansView');
const UsersView = lazyWithRetry(() => import('./components/users/UsersView.tsx'), 'UsersView');
const DropPointsView = lazyWithRetry(() => import('./components/droppoints/DropPointsView.tsx'), 'DropPointsView');
const ProductsView = lazyWithRetry(() => import('./components/products/ProductsView.tsx'), 'ProductsView');
const StatsAndReportsView = lazyWithRetry(() => import('./components/stats/StatsAndReportsView.tsx'), 'StatsAndReportsView');
const VisitsView = lazyWithRetry(() => import('./components/visits/VisitsView.tsx'), 'VisitsView');
const ActivityLogsView = lazyWithRetry(() => import('./components/logs/ActivityLogsView.tsx'), 'ActivityLogsView');
const NotificationsModal = lazyWithRetry(() => import('./components/notifications/NotificationsModal.tsx'), 'NotificationsModal');
const ProfileModal = lazyWithRetry(() => import('./components/profile/ProfileModal.tsx'), 'ProfileModal');
const AcceptanceTestModal = lazyWithRetry(() => import('./components/acceptance/AcceptanceTestModal.tsx'), 'AcceptanceTestModal');
const OfflineStatusModal = lazyWithRetry(() => import('./components/offline/OfflineStatusModal.tsx'), 'OfflineStatusModal');
const VrsGiftsView = lazyWithRetry(() => import('./components/gifts/VrsGiftsView.tsx'), 'VrsGiftsView');
const DeliveriesAndGiftsView = lazyWithRetry(() => import('./components/gifts/DeliveriesAndGiftsView.tsx'), 'DeliveriesAndGiftsView');
const SanScoringManagementView = lazyWithRetry(() => import('./components/gifts/SanScoringManagementView.tsx'), 'SanScoringManagementView');
const GiftCatalogView = lazyWithRetry(() => import('./components/gifts/GiftCatalogView.tsx'), 'GiftCatalogView');

const ViewLoadingFallback = () => (
  <div className="space-y-4 animate-pulse p-4">
    <div className="h-8 w-48 bg-slate-900 rounded-xl" />
    <div className="h-64 w-full bg-slate-900 rounded-2xl" />
  </div>
);

export const normalizeView = (view: string): string => {
  let clean = view.replace(/^\/+/, '').trim().toLowerCase();
  if (clean === 'dp-supply' || clean === 'dp-supplies' || clean === 'dp-supply-requests' || clean === 'dp-supply-request' || clean === 'appro-dp' || clean === 'demandes-appro') return 'dp-supply-requests';
  if (clean === 'dp-invoices' || clean === 'dp-invoice' || clean === 'factures-dp' || clean === 'factures' || clean === 'facturation') return 'dp-invoices';
  if (clean === 'dp-transfers' || clean === 'dp-transfer' || clean === 'transferts-dp' || clean === 'transferts') return 'dp-transfers';
  if (clean === 'pos-requests' || clean === 'pos-request' || clean === 'demandes-pdv' || clean === 'demande-pdv') return 'pos-requests';
  if (clean === 'new-supply' || clean === 'demande-appro' || clean === 'demande-approvisionnement' || clean === 'demande-d-approvisionnement' || clean === 'demander-du-stock' || clean === 'demander-stock') return 'new-supply';
  if (clean === 'mes-approvisionnements' || clean === 'mes-appros' || clean === 'approvisionnements-vrs' || clean === 'supply' || clean === 'supplies' || clean === 'supply-requests' || clean === 'supply-request' || clean === 'appro' || clean === 'approvisionnement' || clean === 'approvisionnements') return 'supply-requests';
  if (clean === 'my-stock' || clean === 'stock' || clean === 'stocks') return 'stocks';
  if (clean === 'my-droppoint' || clean === 'droppoint' || clean === 'droppoints' || clean === 'drop-points' || clean === 'drop-point' || clean === 'depot' || clean === 'depots') return 'drop-points';
  if (clean === 'pos' || clean === 'pdv' || clean === 'point-of-sale' || clean === 'points-of-sale' || clean === 'points-of-sales' || clean === 'point-de-vente' || clean === 'points-de-vente') return 'pos';
  if (clean === 'sale' || clean === 'sales' || clean === 'vente' || clean === 'ventes') return 'sales';
  if (clean === 'receipt' || clean === 'receipts' || clean === 'reception' || clean === 'receptions' || clean === 'bl' || clean === 'bon-de-livraison' || clean === 'bons-de-livraison') return 'receipts';
  if (clean === 'tour' || clean === 'tours' || clean === 'tournee' || clean === 'tournees') return 'tours';
  if (clean === 'visit' || clean === 'visits' || clean === 'visite' || clean === 'visites') return 'visits';
  if (clean === 'stat' || clean === 'stats' || clean === 'statistiques') return 'stats';
  if (clean === 'report' || clean === 'reports' || clean === 'rapport' || clean === 'rapports') return 'reports';
  if (clean === 'user' || clean === 'users' || clean === 'utilisateur' || clean === 'utilisateurs') return 'users';
  if (clean === 'activity-logs' || clean === 'activity-log' || clean === 'log' || clean === 'logs' || clean === 'journal') return 'activity-logs';
  if (clean === 'product' || clean === 'products' || clean === 'produit' || clean === 'produits') return 'products';
  if (clean === 'sector' || clean === 'sectors' || clean === 'secteur' || clean === 'secteurs') return 'sectors';
  if (clean === 'map' || clean === 'carte') return 'map';
  if (clean === 'gifts' || clean === 'cadeaux' || clean === 'mes-cadeaux' || clean === 'cadeau' || clean === 'remises' || clean === 'remise') return 'gifts';
  if (clean === 'scoring' || clean === 'notation' || clean === 'notations' || clean === 'vrs-scores' || clean === 'semestres' || clean === 'semestre') return 'scoring';
  if (clean === 'gift-catalog' || clean === 'catalogue-cadeaux' || clean === 'catalogue-cadeau' || clean === 'cadeaux-catalogue') return 'gift-catalog';
  return clean || 'dashboard';
};

const AppContent: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    activeNotificationToast,
    dismissActiveToast,
  } = useAuth();

  const { canPerformOperations } = useGps();

  // Helper to parse URL hash (e.g. #/pos/123 or #/pos or #/sales)
  const parseLocationHash = (): { tab: string | null; posId: number | null } => {
    if (typeof window === 'undefined') return { tab: null, posId: null };
    try {
      const raw = (window.location.hash || '').replace(/^#\/?/, '').trim();
      if (!raw) return { tab: null, posId: null };

      const posDetailMatch = raw.match(/^pos\/(\d+)/i) || raw.match(/^pos\?detail=(\d+)/i);
      if (posDetailMatch) {
        const id = parseInt(posDetailMatch[1], 10);
        return { tab: 'pos', posId: !isNaN(id) && id > 0 ? id : null };
      }

      const clean = raw.split('?')[0].split('/')[0].toLowerCase();
      const normalized = normalizeView(clean);
      return { tab: normalized, posId: null };
    } catch {
      return { tab: null, posId: null };
    }
  };

  // Robust tab and PDV state persistence to prevent unwanted redirects (e.g. mobile camera tab reloads or intent returns)
  const [activeTab, setActiveTabState] = useState<string>(() => {
    const fromHash = parseLocationHash();
    if (fromHash.posId) return 'pos';
    if (fromHash.tab) return fromHash.tab;
    try {
      const savedPos = localStorage.getItem('6c_selected_pos_id') || sessionStorage.getItem('6c_selected_pos_id');
      if (savedPos) return 'pos';
      const saved = localStorage.getItem('6c_active_tab');
      if (saved && [
        'dashboard', 'sales', 'pos', 'pos-requests', 'map', 'stocks', 'my-stock', 'receipts',
        'dp-supply-requests', 'dp-invoices', 'dp-transfers',
        'supply-requests', 'tours', 'users', 'my-vrs', 'drop-points',
        'my-droppoint', 'sectors', 'products', 'stats', 'reports', 'visits', 'activity-logs',
        'gifts', 'scoring', 'gift-catalog'
      ].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'dashboard';
  });

  // Preserve selected POS detail when URL hash or storage has it (e.g. #/pos/123 or after camera capture)
  const [selectedPosDetailId, setSelectedPosDetailIdState] = useState<number | null>(() => {
    const fromHash = parseLocationHash();
    if (fromHash.posId) return fromHash.posId;
    try {
      const saved = localStorage.getItem('6c_selected_pos_id') || sessionStorage.getItem('6c_selected_pos_id');
      if (saved) {
        const id = parseInt(saved, 10);
        if (!isNaN(id) && id > 0) return id;
      }
    } catch {}
    return null;
  });

  const [lastUpdatedPos, setLastUpdatedPos] = useState<PointOfSale | null>(null);
  const [posListSuccessMsg, setPosListSuccessMsg] = useState<string | null>(null);
  const [syncToastMsg, setSyncToastMsg] = useState<string | null>(null);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('6c_active_tab', tab);
      if (typeof window !== 'undefined') {
        const newHash = `#/${tab}`;
        if (window.location.hash !== newHash) {
          window.location.hash = newHash;
        }
      }
    } catch {}
  };

  const setSelectedPosDetailId = (id: number | null) => {
    setSelectedPosDetailIdState(id);
    try {
      if (id !== null) {
        localStorage.setItem('6c_selected_pos_id', String(id));
        localStorage.setItem('6c_active_tab', 'pos');
        setActiveTabState('pos');
        if (typeof window !== 'undefined') {
          window.location.hash = `#/pos/${id}`;
        }
      } else {
        localStorage.removeItem('6c_selected_pos_id');
        if (typeof window !== 'undefined') {
          if (window.location.hash.startsWith('#/pos/') || window.location.hash.startsWith('#pos/') || window.location.hash.includes('detail=')) {
            window.location.hash = '#/pos';
          }
        }
      }
    } catch {}
  };

  // Sync state if user uses browser Back / Forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const { tab, posId } = parseLocationHash();
      if (posId) {
        setSelectedPosDetailIdState(posId);
        setActiveTabState('pos');
        try {
          localStorage.setItem('6c_selected_pos_id', String(posId));
          localStorage.setItem('6c_active_tab', 'pos');
        } catch {}
      } else if (tab) {
        setActiveTabState(tab);
        // Only clear selected POS detail if navigating to a different view (e.g. sales, stocks, etc.)
        // Never clear it if remaining on pos tab
        if (tab !== 'pos') {
          setSelectedPosDetailIdState(null);
          try {
            localStorage.removeItem('6c_selected_pos_id');
          } catch {}
        }
        try {
          localStorage.setItem('6c_active_tab', tab);
        } catch {}
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [posDetailSuccessMsg, setPosDetailSuccessMsg] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Modals state - all modals closed on startup
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isNewSaleOpen, setIsNewSaleOpen] = useState<boolean>(false);
  const [preselectedSalePosId, setPreselectedSalePosId] = useState<number | null>(null);
  const [isNewPosOpen, setIsNewPosOpen] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem('6c_new_pos_open') === 'true' ||
        localStorage.getItem('6c_new_pos_open') === 'true'
      );
    } catch {
      return false;
    }
  });
  const [isNewReceiptOpen, setIsNewReceiptOpen] = useState<boolean>(false);
  const [isNewSupplyOpen, setIsNewSupplyOpen] = useState<boolean>(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [supplyKey, setSupplyKey] = useState<number>(0);
  const [posListKey, setPosListKey] = useState<number>(0);
  const [salesKey, setSalesKey] = useState<number>(0);

  // Global Ctrl+K / Cmd+K Spotlight shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenNewSale = (posId?: number) => {
    if (posId !== undefined) setPreselectedSalePosId(posId);
    setIsNewSaleOpen(true);
  };

  const handleOpenNewPos = () => {
    try {
      sessionStorage.setItem('6c_new_pos_open', 'true');
      localStorage.setItem('6c_new_pos_open', 'true');
    } catch {}
    setActiveTab('pos');
    setIsNewPosOpen(true);
  };

  const handleCloseNewPos = () => {
    try {
      sessionStorage.removeItem('6c_new_pos_open');
      localStorage.removeItem('6c_new_pos_open');
    } catch {}
    setActiveTab('pos');
    setIsNewPosOpen(false);
  };

  // Auto-sync offline sales and GPS trajectory on startup if online
  useEffect(() => {

    // Auto-sync offline sales and GPS trajectory on startup if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      offlineSync.syncAllPendingData().catch(() => {});
    }

    const handleSynced = (e: any) => {
      const count = e.detail?.count || 0;
      if (count > 0) {
        setSyncToastMsg(`${count} vente(s) enregistrée(s) hors-ligne ont été synchronisées avec succès dans la base de données.`);
        setTimeout(() => {
          setSyncToastMsg(null);
        }, 8000);
      }
    };

    window.addEventListener('6c-sales-synced', handleSynced);
    return () => window.removeEventListener('6c-sales-synced', handleSynced);
  }, []);

  // Auto-dismiss notification toast after 10 seconds
  useEffect(() => {
    if (!activeNotificationToast) return;
    const timer = setTimeout(() => {
      dismissActiveToast();
    }, 10000);
    return () => clearTimeout(timer);
  }, [activeNotificationToast, dismissActiveToast]);

  const handleNavigate = (view: string) => {
    const normalized = normalizeView(view);
    if (normalized === 'acceptance-tests') {
      setIsTestModalOpen(true);
    } else if (normalized === 'new-sale') {
      setIsNewSaleOpen(true);
    } else if (normalized === 'new-pos') {
      handleOpenNewPos();
    } else if (normalized === 'new-supply') {
      if (user?.role === 'SALES_ADMIN') {
        setActiveTab('dp-supply-requests');
      } else {
        setIsNewSupplyOpen(true);
      }
    } else if (normalized === 'new-receipt') {
      setIsNewReceiptOpen(true);
    } else if (user?.role === 'VRS' && (normalized === 'users' || normalized === 'my-vrs' || normalized === 'drop-points' || normalized === 'my-droppoint')) {
      setActiveTab('dashboard');
    } else {
      setActiveTab(normalized);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center text-[var(--text-secondary)] gap-3">
        <div className="w-10 h-10 border-4 border-[#54a835] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-mono">Chargement de 6C Distribution...</span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <>
        <LoginPage onOpenAcceptanceTests={() => setIsTestModalOpen(true)} />
        {/* Quick access to Acceptance Test Suite from Login */}
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 max-w-[calc(100vw-1.5rem)]">
          <button
            type="button"
            onClick={() => setIsTestModalOpen(true)}
            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg border border-emerald-400/40 flex items-center gap-1.5 sm:gap-2 transition truncate cursor-pointer"
          >
            <span>🛡️ Tests d'Acceptation (10 Scénarios)</span>
          </button>
        </div>
        <AcceptanceTestModal
          isOpen={isTestModalOpen}
          onClose={() => setIsTestModalOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        onOpenAcceptanceTests={() => setIsTestModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNewSale={() => handleOpenNewSale()}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        onNavigate={handleNavigate}
      />

      {/* Offline Alert Banner (Appears when connection drops) */}
      <OfflineNoticeBanner onOpenModal={() => setIsOfflineModalOpen(true)} />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden w-full max-w-full">
        {/* Sidebar */}
        <Sidebar
          currentView={activeTab}
          onNavigate={handleNavigate}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Content View Area with safe padding for mobile bottom bar */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full p-3 sm:p-6 lg:p-8 lg:pb-8 bg-slate-950"
          style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="max-w-7xl mx-auto w-full">
            <ErrorBoundary key={activeTab}>
              <Suspense fallback={<ViewLoadingFallback />}>
            {activeTab === 'dashboard' && (
              <NationalDashboard
                key={`dash-${user?.id || 'guest'}-${user?.role || 'none'}-${salesKey}`}
                onNavigate={handleNavigate}
                onOpenNewSale={() => handleOpenNewSale()}
                onOpenNewReceipt={() => setIsNewReceiptOpen(true)}
                onOpenNewPos={() => handleOpenNewPos()}
                onOpenNewSupply={() => setIsNewSupplyOpen(true)}
                onOpenAcceptanceTests={() => setIsTestModalOpen(true)}
              />
            )}

            {activeTab === 'sales' && (
              <SalesList
                key={`sales-${user?.id || 'guest'}-${user?.role || 'none'}-${salesKey}`}
                onOpenNewSale={() => handleOpenNewSale()}
              />
            )}

            {activeTab === 'pos' && (
              <PointOfSaleList
                key={posListKey}
                onOpenNewPos={() => handleOpenNewPos()}
                onOpenNewSaleForPos={(posId) => handleOpenNewSale(posId)}
                selectedPosId={selectedPosDetailId}
                onSelectPos={(id) => setSelectedPosDetailId(id)}
                lastUpdatedPos={lastUpdatedPos}
                initialSuccessMessage={posListSuccessMsg}
              />
            )}

            {activeTab === 'pos-requests' && (
              <PosRequestsView onOpenNewPos={() => handleOpenNewPos()} />
            )}

            {activeTab === 'dp-supply-requests' && (
              <DpSupplyRequestsView onNavigateTab={handleNavigate} />
            )}

            {activeTab === 'dp-invoices' && (
              <DpInvoicesView />
            )}

            {activeTab === 'dp-transfers' && (
              <DpTransfersView />
            )}

            {activeTab === 'map' && <PosMapView />}

            {(activeTab === 'stocks' || activeTab === 'my-stock') && (
              <StocksView key={`stocks-${salesKey}`} />
            )}

            {activeTab === 'receipts' && (
              <ReceiptsList onOpenNewReceipt={() => setIsNewReceiptOpen(true)} />
            )}

            {activeTab === 'supply-requests' && (
              <SupplyRequestsList
                key={supplyKey}
                onOpenNewSupply={() => setIsNewSupplyOpen(true)}
              />
            )}

            {activeTab === 'tours' && (
              <TourPlansView
                onTriggerSaleForPos={(_posId) => {
                  setActiveTab('sales');
                  setIsNewSaleOpen(true);
                }}
              />
            )}

            {activeTab === 'users' && user?.role !== 'VRS' && (
              <UsersView onNavigate={handleNavigate} />
            )}

            {activeTab === 'my-vrs' && user?.role !== 'VRS' && (
              <UsersView initialRoleFilter="VRS" title="Mes Vendeurs Terrain (VRS)" onNavigate={handleNavigate} />
            )}

            {activeTab === 'drop-points' && user?.role !== 'VRS' && (
              <DropPointsView />
            )}

            {activeTab === 'my-droppoint' && user?.role !== 'VRS' && (
              <DropPointsView onlyMyDropPoint={true} />
            )}

            {/* Fallback to Dashboard if VRS accesses forbidden admin tabs */}
            {user?.role === 'VRS' && ['users', 'my-vrs', 'drop-points', 'my-droppoint'].includes(activeTab) && (
              <NationalDashboard
                onNavigate={handleNavigate}
                onOpenNewSale={() => handleOpenNewSale()}
                onOpenNewReceipt={() => setIsNewReceiptOpen(true)}
                onOpenNewPos={() => handleOpenNewPos()}
                onOpenNewSupply={() => setIsNewSupplyOpen(true)}
                onOpenAcceptanceTests={() => setIsTestModalOpen(true)}
              />
            )}

            {activeTab === 'sectors' && (
              <DropPointsView activeSection="sectors" />
            )}

            {activeTab === 'products' && (
              <ProductsView />
            )}

            {activeTab === 'stats' && (
              <StatsAndReportsView initialTab="stats" />
            )}

            {activeTab === 'reports' && (
              <StatsAndReportsView initialTab="reports" />
            )}

            {activeTab === 'visits' && (
              <VisitsView />
            )}

            {activeTab === 'activity-logs' && (
              <ActivityLogsView />
            )}

            {activeTab === 'gifts' && (
              user?.role === 'VRS' ? (
                <VrsGiftsView />
              ) : (
                <DeliveriesAndGiftsView />
              )
            )}

            {activeTab === 'scoring' && (
              user?.role === 'SALES_ADMIN_NATIONAL' ? (
                <SanScoringManagementView />
              ) : user?.role === 'VRS' ? (
                <VrsGiftsView />
              ) : (
                <DeliveriesAndGiftsView />
              )
            )}

            {activeTab === 'gift-catalog' && (
              <GiftCatalogView />
            )}

            {/* Fallback to Dashboard if any unmapped tab is visited */}
            {![
              'dashboard', 'sales', 'pos', 'pos-requests', 'map', 'stocks', 'my-stock', 'receipts',
              'dp-supply-requests', 'dp-invoices', 'dp-transfers',
              'supply-requests', 'tours', 'users', 'my-vrs', 'drop-points',
              'my-droppoint', 'sectors', 'products', 'stats', 'reports', 'visits', 'activity-logs',
              'gifts', 'scoring', 'gift-catalog'
            ].includes(activeTab) && (
              <NationalDashboard
                onNavigate={handleNavigate}
                onOpenNewSale={() => handleOpenNewSale()}
                onOpenNewReceipt={() => setIsNewReceiptOpen(true)}
                onOpenNewPos={() => handleOpenNewPos()}
                onOpenNewSupply={() => setIsNewSupplyOpen(true)}
                onOpenAcceptanceTests={() => setIsTestModalOpen(true)}
              />
            )}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Optimized for Smartphones) */}
      <MobileBottomNav
        currentView={activeTab}
        onNavigate={handleNavigate}
        onToggleMobileMenu={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* Global Modals (Mounted strictly when opened to keep memory footprint minimal) */}
      <Suspense fallback={null}>
        {isNewSaleOpen && (
          <NewSaleModal
            isOpen={isNewSaleOpen}
            initialPosId={preselectedSalePosId}
            onClose={() => {
              setIsNewSaleOpen(false);
              setPreselectedSalePosId(null);
            }}
            onSaleCreated={() => {
              setPosListKey((prev) => prev + 1);
              setSalesKey((prev) => prev + 1);
            }}
          />
        )}

        {isNewPosOpen && (
          <NewPosModal
            isOpen={isNewPosOpen}
            onClose={handleCloseNewPos}
            onPosCreated={(createdPos) => {
              handleCloseNewPos();
              setPosListKey((prev) => prev + 1);
              if (createdPos) {
                setLastUpdatedPos(createdPos);
                setSelectedPosDetailId(createdPos.id);
                setPosDetailSuccessMsg(`Point de vente '${createdPos.name}' créé avec succès ! Sa photo et sa position GPS sont enregistrées sur la carte Google Maps.`);
              }
            }}
          />
        )}

        {selectedPosDetailId !== null && (
          <PosDetailModal
            posId={selectedPosDetailId}
            isOpen={selectedPosDetailId !== null}
            initialSuccessMessage={posDetailSuccessMsg}
            onClose={() => {
              setSelectedPosDetailId(null);
              setPosDetailSuccessMsg(null);
              setActiveTabState('pos');
              try {
                localStorage.setItem('6c_active_tab', 'pos');
                localStorage.removeItem('6c_selected_pos_id');
                if (typeof window !== 'undefined') {
                  window.location.hash = '#/pos';
                }
              } catch {}
            }}
            onStartSale={(posId) => {
              setPreselectedSalePosId(posId);
              setIsNewSaleOpen(true);
            }}
            onPosUpdated={(updatedPos) => {
              if (updatedPos?.id) {
                setSelectedPosDetailId(updatedPos.id);
                setLastUpdatedPos(updatedPos);
              }
            }}
          />
        )}

        {isNewReceiptOpen && (
          <NewReceiptModal
            isOpen={isNewReceiptOpen}
            onClose={() => setIsNewReceiptOpen(false)}
            onReceiptCreated={() => {}}
          />
        )}

        {isNewSupplyOpen && (
          <SupplyRequestModal
            isOpen={isNewSupplyOpen}
            onClose={() => setIsNewSupplyOpen(false)}
            onRequestCreated={() => {
              setSupplyKey((prev) => prev + 1);
            }}
          />
        )}

        {isTestModalOpen && (
          <AcceptanceTestModal
            isOpen={isTestModalOpen}
            onClose={() => setIsTestModalOpen(false)}
          />
        )}

        {isNotificationsOpen && (
          <NotificationsModal
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            onNavigate={handleNavigate}
          />
        )}

        {isProfileOpen && (
          <ProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            onNavigate={handleNavigate}
          />
        )}

        {isOfflineModalOpen && (
          <OfflineStatusModal
            isOpen={isOfflineModalOpen}
            onClose={() => setIsOfflineModalOpen(false)}
          />
        )}

        {isSearchOpen && (
          <GlobalSearchPalette
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onNavigate={handleNavigate}
            onOpenNewSale={(posId) => handleOpenNewSale(posId)}
            onOpenNewPos={() => handleOpenNewPos()}
            onOpenNewSupply={() => setIsNewSupplyOpen(true)}
            onOpenNewReceipt={() => setIsNewReceiptOpen(true)}
            onSelectPos={(id) => setSelectedPosDetailId(id)}
          />
        )}
      </Suspense>

      {/* Offline Sales Sync Success Toast */}
      {syncToastMsg && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-16 sm:top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100vw-24px)] bg-slate-900/95 backdrop-blur-md border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl shadow-emerald-950/70 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-xs font-bold text-white">Ventes Hors-Ligne Synchronisées</h4>
              <button
                type="button"
                onClick={() => setSyncToastMsg(null)}
                className="text-slate-400 hover:text-white p-0.5 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
              {syncToastMsg}
            </p>
          </div>
        </aside>
      )}
      {activeNotificationToast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-16 sm:top-5 right-3 sm:right-6 z-50 max-w-sm w-[calc(100vw-24px)] sm:w-96 bg-slate-900/95 backdrop-blur-md border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl shadow-emerald-950/60 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-sm font-bold text-white truncate">
                {activeNotificationToast.title}
              </h4>
              <button
                type="button"
                onClick={dismissActiveToast}
                className="text-slate-400 hover:text-white p-0.5 rounded transition"
                aria-label="Fermer la notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-300 mt-1 line-clamp-2 leading-relaxed">
              {activeNotificationToast.message}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const targetLink = activeNotificationToast.link || 'supply-requests';
                  try {
                    api.markNotificationRead(activeNotificationToast.id);
                  } catch {}
                  dismissActiveToast();
                  handleNavigate(targetLink);
                }}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg flex items-center gap-1 transition shadow"
              >
                <span>Consulter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={dismissActiveToast}
                className="px-2.5 py-1 text-sm text-slate-400 hover:text-slate-200 transition"
              >
                Ignorer
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Popup de demande d'accès Caméra et GPS */}
      <VrsGpsEnforcementModal />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <GpsProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </GpsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
