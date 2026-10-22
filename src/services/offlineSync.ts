/**
 * 6C Distribution - Offline Sales & GPS Trajectory Engine
 * Permet au VRS d'effectuer toutes ses ventes sans connexion internet.
 * Dès la reconnexion au réseau, synchronise automatiquement toutes les ventes
 * dans la base de données et retrace l'intégralité du parcours GPS de la journée
 * sur la carte Google Maps pour consultation par le SA et le SAN.
 */

import { api } from './api.ts';
import { offlineCache } from './offlineCache.ts';

export interface OfflineSaleItem {
  productId: number;
  productName?: string;
  quantityCartons: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OfflineSale {
  id: number; // Temporary negative ID
  clientGeneratedId: string;
  saleNumber: string;
  vrsId: number;
  vrsName: string;
  vrsPublicId?: string;
  dropPointId: number;
  dropPointCode?: string;
  dropPointName?: string;
  pointOfSaleId: number;
  posName: string;
  posCode?: string;
  posOwner?: string;
  posPhone?: string;
  posAddress?: string;
  posNeighborhood?: string;
  totalAmount: number;
  discount: number;
  notes: string;
  status: 'OFFLINE_PENDING' | 'COMPLETED';
  isOfflinePending: boolean;
  createdAt: string;
  items: OfflineSaleItem[];
  totalCartons: number;
  itemCount: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface OfflineGpsPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number | null;
  actionContext: string;
  recordedAt: string;
}

const STORAGE_KEY_PENDING_SALES = '6c_offline_pending_sales';
const STORAGE_KEY_OFFLINE_GPS = '6c_offline_gps_breadcrumbs';

class OfflineSyncManager {
  private isSyncing: boolean = false;
  private syncTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncAllPendingData();
      });

      // Periodic check every 60 seconds if online and tab is visible
      this.syncTimer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          return;
        }
        if (navigator.onLine) {
          const pending = this.getPendingOfflineSales();
          const points = this.getPendingBreadcrumbs();
          if (pending.length > 0 || points.length > 0) {
            this.syncAllPendingData();
          }
        }
      }, 60000);
    }
  }

  // --- SALES QUEUE MANAGEMENT ---

  public getPendingOfflineSales(): OfflineSale[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PENDING_SALES);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public savePendingOfflineSales(sales: OfflineSale[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_PENDING_SALES, JSON.stringify(sales));
    } catch (e) {
      console.warn('[OfflineSync] Erreur sauvegarde localStorage:', e);
    }
  }

  public async recordOfflineSale(saleData: {
    pointOfSaleId: number;
    posName?: string;
    posOwner?: string;
    posPhone?: string;
    posAddress?: string;
    posNeighborhood?: string;
    items: { productId: number; productName?: string; quantityCartons: number; unitPrice: number }[];
    discount?: number;
    notes?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    user: any;
  }): Promise<OfflineSale> {
    const { pointOfSaleId, items, discount = 0, notes = '', latitude, longitude, accuracy, user } = saleData;

    const timestamp = Date.now();
    const clientGeneratedId = `off-vnt-${timestamp}-${Math.random().toString(36).substring(2, 6)}`;
    const saleNumber = `VNT-OFF-${timestamp.toString().slice(-6)}`;

    let subTotal = 0;
    let totalCartons = 0;

    const validatedItems: OfflineSaleItem[] = items.map((i) => {
      const itemTotal = i.quantityCartons * i.unitPrice;
      subTotal += itemTotal;
      totalCartons += i.quantityCartons;
      return {
        productId: i.productId,
        productName: i.productName || `Produit #${i.productId}`,
        quantityCartons: i.quantityCartons,
        unitPrice: i.unitPrice,
        totalPrice: itemTotal,
      };
    });

    const finalAmount = Math.max(0, subTotal - discount);

    const offlineSale: OfflineSale = {
      id: -timestamp,
      clientGeneratedId,
      saleNumber,
      vrsId: user?.id || 1,
      vrsName: user ? `${user.firstName} ${user.lastName}` : 'VRS Terrain',
      vrsPublicId: user?.publicId || 'VRS',
      dropPointId: user?.dropPointId || 1,
      dropPointCode: user?.dropPointCode || 'DP',
      dropPointName: user?.dropPointName || 'Dépôt',
      pointOfSaleId,
      posName: saleData.posName || `Point de Vente #${pointOfSaleId}`,
      posCode: `POS-${pointOfSaleId}`,
      posOwner: saleData.posOwner || 'Client',
      posPhone: saleData.posPhone || '-',
      posAddress: saleData.posAddress || '-',
      posNeighborhood: saleData.posNeighborhood || '-',
      totalAmount: finalAmount,
      discount,
      notes: notes ? `${notes} [Vente Hors-ligne]` : '[Vente Hors-ligne]',
      status: 'OFFLINE_PENDING',
      isOfflinePending: true,
      createdAt: new Date().toISOString(),
      items: validatedItems,
      totalCartons,
      itemCount: validatedItems.length,
      latitude: latitude || user?.lastLatitude || 12.6392,
      longitude: longitude || user?.lastLongitude || -8.0029,
      accuracy: accuracy || 15,
    };

    // 1. Save to pending offline sales queue
    const current = this.getPendingOfflineSales();
    current.unshift(offlineSale);
    this.savePendingOfflineSales(current);

    // 2. Decrement local stock in offline cache if present
    try {
      const cachedStocks = await offlineCache.getEntry<any>('/api/stocks/vrs');
      if (cachedStocks?.data?.stocks && Array.isArray(cachedStocks.data.stocks)) {
        for (const item of validatedItems) {
          const s = cachedStocks.data.stocks.find((st: any) => st.productId === item.productId || st.id === item.productId);
          if (s) {
            s.availableQuantity = Math.max(0, (s.availableQuantity || 0) - item.quantityCartons);
            s.available_quantity = s.availableQuantity;
          }
        }
        await offlineCache.saveEntry('/api/stocks/vrs', cachedStocks.data);
      }
    } catch {}

    // 3. Prepend into cached sales list
    try {
      const cachedSales = await offlineCache.getEntry<any>('/api/sales');
      if (cachedSales?.data?.sales && Array.isArray(cachedSales.data.sales)) {
        cachedSales.data.sales.unshift(offlineSale);
        await offlineCache.saveEntry('/api/sales', cachedSales.data);
      }
    } catch {}

    // 4. Record GPS breadcrumb for this sale
    if (latitude && longitude) {
      this.recordOfflineBreadcrumb({
        latitude,
        longitude,
        accuracy,
        speed: 0,
        actionContext: `VENTE HORS-LIGNE (${saleData.posName || 'PDV'})`,
        recordedAt: offlineSale.createdAt,
      });
    }

    // 5. Notify UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('6c-sales-updated', {
          detail: { offlineSale, count: current.length },
        })
      );
    }

    return offlineSale;
  }

  // --- GPS TRAJECTORY QUEUE MANAGEMENT ---

  public getPendingBreadcrumbs(): OfflineGpsPoint[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_OFFLINE_GPS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public savePendingBreadcrumbs(points: OfflineGpsPoint[]): void {
    try {
      // Keep last 300 points max to avoid memory bloat
      const trimmed = points.slice(-300);
      localStorage.setItem(STORAGE_KEY_OFFLINE_GPS, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('[OfflineSync] Erreur sauvegarde breadcrumbs:', e);
    }
  }

  public recordOfflineBreadcrumb(point: OfflineGpsPoint): void {
    if (!point.latitude || !point.longitude) return;
    const current = this.getPendingBreadcrumbs();
    current.push({
      ...point,
      recordedAt: point.recordedAt || new Date().toISOString(),
    });
    this.savePendingBreadcrumbs(current);
  }

  // --- SYNCHRONIZATION EXECUTION ---

  public async syncAllPendingData(): Promise<{
    syncedSalesCount: number;
    syncedBreadcrumbsCount: number;
    message: string;
  }> {
    if (this.isSyncing) {
      return { syncedSalesCount: 0, syncedBreadcrumbsCount: 0, message: 'Synchronisation déjà en cours...' };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { syncedSalesCount: 0, syncedBreadcrumbsCount: 0, message: 'Appareil hors-ligne.' };
    }

    const pendingSales = this.getPendingOfflineSales();
    const pendingPoints = this.getPendingBreadcrumbs();

    if (pendingSales.length === 0 && pendingPoints.length === 0) {
      return { syncedSalesCount: 0, syncedBreadcrumbsCount: 0, message: 'Aucune donnée en attente de synchronisation.' };
    }

    this.isSyncing = true;
    let syncedSalesCount = 0;
    let syncedBreadcrumbsCount = 0;

    try {
      // 1. Sync pending sales first
      if (pendingSales.length > 0) {
        try {
          const res = await api.syncOfflineSales(pendingSales);
          if (res.success) {
            syncedSalesCount = res.count;
            // Clear pending sales
            this.savePendingOfflineSales([]);
            
            // Dispatch sync event so lists & components reload fresh database data
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('6c-sales-synced', {
                  detail: { count: syncedSalesCount, message: res.message },
                })
              );
            }
          }
        } catch (saleErr: any) {
          console.warn('[OfflineSync] Erreur synchronisation ventes:', saleErr);
        }
      }

      // 2. Sync pending GPS trajectory breadcrumbs
      if (pendingPoints.length > 0) {
        try {
          const res = await api.syncOfflineTrajectory(pendingPoints);
          if (res.success) {
            syncedBreadcrumbsCount = res.count;
            // Clear synced breadcrumbs
            this.savePendingBreadcrumbs([]);

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('6c-trajectory-synced', {
                  detail: { count: syncedBreadcrumbsCount, message: res.message },
                })
              );
            }
          }
        } catch (geoErr: any) {
          console.warn('[OfflineSync] Erreur synchronisation parcours GPS:', geoErr);
        }
      }

      const summary = `Synchronisation réussie : ${syncedSalesCount} vente(s) enregistrée(s) en base de données et ${syncedBreadcrumbsCount} point(s) GPS de parcours retracé(s).`;
      return {
        syncedSalesCount,
        syncedBreadcrumbsCount,
        message: summary,
      };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const offlineSync = new OfflineSyncManager();
