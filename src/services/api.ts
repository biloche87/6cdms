import {
  User,
  DropPoint,
  Sector,
  Product,
  StockItem,
  StockMovement,
  StockReceipt,
  SupplyRequest,
  PointOfSale,
  Sale,
  SellerPerformance,
  TourPlan,
  Visit,
  NotificationItem,
  PosMonthlySalesData,
  ActivityLogItem,
  AcceptanceScenarioResult,
  VrsScoringSettings,
  Semester,
  VrsSemesterScore,
  GiftCatalogItem,
  ScratchCard,
} from '../types/index.ts';
import { offlineCache, OfflineCacheStats } from './offlineCache.ts';
import { apiCache } from './apiCache.ts';

const TOKEN_KEY = '6c_dist_token';

export class ApiError extends Error {
  status: number;
  isNetworkError: boolean;
  constructor(message: string, status = 500, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}, retries = 2): Promise<T> {
  const isGetOrHead = !options.method || options.method === 'GET' || options.method === 'HEAD';

  // 1. If currently offline and reading data, serve immediately from IndexedDB cache
  if (isGetOrHead && typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = await offlineCache.getEntry<T>(endpoint);
    if (cached) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('6c-offline-cache-hit', {
            detail: { endpoint, timestamp: cached.timestamp, fromOffline: true },
          })
        );
      }
      return cached.data;
    }
    throw new ApiError(
      'Mode Hors-ligne : Cette information n\'est pas encore disponible dans votre cache local. Connectez-vous à nouveau avec du réseau pour la synchroniser.',
      0,
      true
    );
  }

  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
    });
  } catch (err: any) {
    // If request was aborted by user leaving screen or unmounting, immediately abort without retrying
    const isAbort =
      err?.name === 'AbortError' ||
      err?.name === 'CanceledError' ||
      err?.code === 20 ||
      (typeof err?.message === 'string' &&
        (err.message.includes('aborted') || err.message.includes('aborter') || err.message.includes('The user aborted')));
    if (isAbort) {
      throw err;
    }

    // If it's a safe request and network glitched, retry with backoff
    if (retries > 0 && isGetOrHead) {
      const delay = (3 - retries) * 400; // 400ms, 800ms
      await new Promise((resolve) => setTimeout(resolve, delay));
      return request<T>(endpoint, options, retries - 1);
    }

    // Network error occurred: check if we have a valid offline cache fallback
    if (isGetOrHead) {
      const cached = await offlineCache.getEntry<T>(endpoint);
      if (cached) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('6c-offline-cache-hit', {
              detail: { endpoint, timestamp: cached.timestamp, fromFallback: true },
            })
          );
        }
        return cached.data;
      }
    }

    const isNet =
      err?.name === 'TypeError' ||
      err?.message?.includes('fetch') ||
      err?.message?.includes('NetworkError') ||
      err?.message?.includes('Failed to fetch');
    throw new ApiError(
      isNet ? 'Connexion au serveur temporairement indisponible. Veuillez vérifier votre connexion.' : (err?.message || 'Erreur réseau'),
      0,
      true
    );
  }

  const contentType = response.headers.get('content-type');
  let data: any;
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = '';
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error || (typeof data === 'string' ? data : 'Une erreur est survenue.');
    throw new ApiError(errorMsg, response.status, false);
  }

  // If GET request succeeded, save automatically into local IndexedDB cache for offline access
  if (isGetOrHead && data) {
    offlineCache.saveEntry(endpoint, data).catch(() => {});
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { identifier: string; password: string }) =>
    request<{ token: string; user: User; message: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    }),

  getCurrentUser: () => request<{ user: User }>('/api/auth/me'),

  getDemoAccounts: () =>
    request<{
      accounts: Array<{
        role: string;
        roleLabel: string;
        publicId: string;
        name: string;
        description: string;
        scope: string;
        defaultPassword: string;
      }>;
    }>('/api/auth/demo-accounts'),

  updateProfile: (profileData: any) =>
    request<{ user: User; message: string }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    }),

  // Drop Points
  getDropPoints: () => request<{ dropPoints: DropPoint[] }>('/api/drop-points'),

  getDropPoint: (id: number) =>
    request<{ dropPoint: DropPoint; sectors: Sector[]; staff: User[] }>(`/api/drop-points/${id}`),

  createDropPoint: (dp: Partial<DropPoint>) =>
    request<{ dropPoint: DropPoint; message: string }>('/api/drop-points', {
      method: 'POST',
      body: JSON.stringify(dp),
    }),

  updateDropPoint: (id: number, dp: Partial<DropPoint>) =>
    request<{ dropPoint: DropPoint; message: string }>(`/api/drop-points/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dp),
    }),

  getSectors: (dropPointId: number) =>
    request<{ sectors: Sector[] }>(`/api/drop-points/${dropPointId}/sectors`),

  createSector: (dropPointId: number, sector: { name: string; code: string; neighborhood?: string }) =>
    request<{ sector: Sector; message: string }>(`/api/drop-points/${dropPointId}/sectors`, {
      method: 'POST',
      body: JSON.stringify(sector),
    }),

  // Users
  getUsers: (params?: { role?: string; dropPointId?: number; fssId?: number }) => {
    const query = new URLSearchParams();
    if (params?.role) query.append('role', params.role);
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    if (params?.fssId) query.append('fssId', String(params.fssId));
    return request<{ users: User[] }>(`/api/users?${query.toString()}`);
  },

  createUser: (userData: any) =>
    request<{ user: User; publicId: string; temporaryPassword?: string; message: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  updateUser: (id: number, userData: any) =>
    request<{ user: User; message: string }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    }),

  sendCredentials: (userId: number, temporaryPassword?: string) =>
    request<{
      success: boolean;
      message: string;
      publicId: string;
      phone?: string;
      email?: string;
      temporaryPassword: string;
      whatsappUrl?: string;
      whatsappMessage: string;
      mailtoUrl?: string;
      emailSubject: string;
      emailBody: string;
    }>(`/api/users/${userId}/send-credentials`, {
      method: 'POST',
      body: JSON.stringify({ temporaryPassword }),
    }),

  sendMyCredentials: () =>
    request<{
      success: boolean;
      message: string;
      publicId: string;
      phone?: string;
      email?: string;
      whatsappUrl?: string;
      whatsappMessage: string;
      mailtoUrl?: string;
      emailSubject: string;
      emailBody: string;
    }>('/api/auth/send-my-credentials', {
      method: 'POST',
    }),

  getUserPerformance: (id: number | 'me') =>
    request<{ performance: SellerPerformance }>(`/api/users/${id}/performance`),

  // Live GPS Tracking & Verification
  updateUserLocation: (locationData: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    speed?: number | null;
    actionContext?: string;
  }) =>
    request<{ success: boolean; message: string; location: any }>('/api/users/current-location', {
      method: 'POST',
      body: JSON.stringify(locationData),
    }),

  getVrsLocations: () =>
    request<{ vrs: import('../types/index.ts').VrsLiveLocation[] }>('/api/users/vrs-locations'),

  getVrsTrajectory: (vrsId: number, date?: string) => {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<import('../types/index.ts').VrsTrajectoryResponse>(`/api/users/vrs-trajectory/${vrsId}${q}`);
  },

  simulateVrsStep: () =>
    request<{ success: boolean; message: string; vrs: import('../types/index.ts').VrsLiveLocation[] }>(
      '/api/users/simulate-vrs-step',
      { method: 'POST' }
    ),

  // Products
  getProducts: (dropPointId?: number | string) => {
    const q = dropPointId && dropPointId !== 'ALL' ? `?dropPointId=${dropPointId}` : '';
    return request<{ products: Product[] }>(`/api/products${q}`);
  },

  createProduct: (product: any) =>
    request<{ product: Product; message: string }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(product),
    }),

  updateProduct: (id: number, product: any) =>
    request<{ product: Product; message: string }>(`/api/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(product),
    }),

  // Stocks
  getDropPointStocks: (dropPointId?: number) => {
    const q = dropPointId ? `?dropPointId=${dropPointId}` : '';
    return request<{ stocks: StockItem[] }>(`/api/stocks/drop-point${q}`);
  },

  getVrsStocks: (params?: { vrsId?: number; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.vrsId) query.append('vrsId', String(params.vrsId));
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{ stocks: StockItem[] }>(`/api/stocks/vrs?${query.toString()}`);
  },

  createReceipt: async (receiptData: any) => {
    const res = await request<{ receiptId: number; receiptNumber: string; message: string }>('/api/stocks/receipts', {
      method: 'POST',
      body: JSON.stringify(receiptData),
    });
    apiCache.invalidate();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('6c:stock-updated', { detail: res }));
    }
    return res;
  },

  getReceipts: (params?: { blNumber?: string; date?: string; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.blNumber) query.append('blNumber', params.blNumber);
    if (params?.date) query.append('date', params.date);
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{ receipts: StockReceipt[] }>(`/api/stocks/receipts?${query.toString()}`);
  },

  getSupplyRequests: (params?: { status?: string; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{ requests: SupplyRequest[] }>(`/api/stocks/supply-requests?${query.toString()}`);
  },

  getSupplyRequestBadgeCounts: () =>
    request<{ pendingApprovalCount: number; readyForReceptionCount: number; totalBadgeCount: number }>('/api/stocks/supply-requests/badge-counts'),

  createSupplyRequest: async (requestData: any) => {
    const res = await request<{ requestId: number; requestNumber: string; message: string }>('/api/stocks/supply-requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
    apiCache.invalidate();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('6c:supply-request-changed', { detail: res }));
    }
    return res;
  },

  updateSupplyRequestStatus: async (
    id: number,
    statusData: {
      newStatus: string;
      approvedItems?: any[];
      blNumber?: string;
      blAttachment?: string;
      blFileName?: string;
      blFileType?: string;
      rejectionReason?: string;
    }
  ) => {
    const res = await request<{ message: string; status: string }>(`/api/stocks/supply-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(statusData),
    });
    apiCache.invalidate();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('6c:stock-updated', { detail: res }));
    }
    return res;
  },

  updateSupplyRequest: (
    id: number,
    data: {
      notes?: string;
      desiredLoadingDate?: string;
      items?: Array<{ productId: number; quantityRequested: number }>;
    }
  ) =>
    request<{ message: string }>(`/api/stocks/supply-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  cancelSupplyRequest: (id: number, data?: { reason?: string }) =>
    request<{ message: string }>(`/api/stocks/supply-requests/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  updateSupplyRequestBL: (
    id: number,
    blData: {
      blNumber?: string;
      blAttachment?: string;
      blFileName?: string;
      blFileType?: string;
    }
  ) =>
    request<{ success: boolean; message: string }>(`/api/stocks/supply-requests/${id}/bl`, {
      method: 'PATCH',
      body: JSON.stringify(blData),
    }),

  getStockMovements: (params?: { movementType?: string; productId?: number; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.movementType) query.append('movementType', params.movementType);
    if (params?.productId) query.append('productId', String(params.productId));
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{ movements: StockMovement[] }>(`/api/stocks/movements?${query.toString()}`);
  },

  // Sales
  getSales: (params?: {
    pointOfSaleId?: number;
    vrsId?: number;
    dropPointId?: number;
    status?: string;
    search?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.pointOfSaleId) query.append('pointOfSaleId', String(params.pointOfSaleId));
    if (params?.vrsId) query.append('vrsId', String(params.vrsId));
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', String(params.limit));
    return request<{ sales: Sale[] }>(`/api/sales?${query.toString()}`);
  },

  getSale: (id: number) =>
    request<{ sale: Sale }>(`/api/sales/${id}`),

  createSale: async (saleData: any) => {
    const res = await request<{ saleId: number; saleNumber: string; message: string }>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
    apiCache.invalidate();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('6c:sale-recorded', { detail: res }));
    }
    return res;
  },

  syncOfflineSales: async (sales: any[]) => {
    const res = await request<{ success: boolean; count: number; sales: any[]; message: string }>('/api/sales/sync-offline', {
      method: 'POST',
      body: JSON.stringify({ sales }),
    });
    apiCache.invalidate();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('6c:sale-recorded', { detail: res }));
    }
    return res;
  },

  syncOfflineTrajectory: (points: any[]) =>
    request<{ success: boolean; count: number; message: string }>('/api/users/sync-offline-trajectory', {
      method: 'POST',
      body: JSON.stringify({ points }),
    }),

  cancelSale: async (id: number, reason?: string) => {
    const res = await request<{ message: string }>(`/api/sales/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
    apiCache.invalidate();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('6c:sale-recorded', { detail: res }));
    }
    return res;
  },

  // Points of Sale
  getPointsOfSale: (params?: { status?: string; sectorId?: number; dropPointId?: number; search?: string; deletionStatus?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.sectorId) query.append('sectorId', String(params.sectorId));
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    if (params?.search) query.append('search', params.search);
    if (params?.deletionStatus) query.append('deletionStatus', params.deletionStatus);
    return request<{ pointsOfSale: PointOfSale[]; pendingDeletionCount?: number }>(`/api/points-of-sale?${query.toString()}`);
  },

  getPointOfSale: (id: number) =>
    request<{ pos: PointOfSale; salesHistory: Sale[]; visitsHistory: Visit[]; monthlySales?: PosMonthlySalesData[] }>(`/api/points-of-sale/${id}`),

  createPointOfSale: (posData: any) =>
    request<{ pos: PointOfSale; message: string }>('/api/points-of-sale', {
      method: 'POST',
      body: JSON.stringify(posData),
    }),

  updatePointOfSaleStatus: (id: number, statusData: { newStatus: string; notes?: string }) =>
    request<{ pos: PointOfSale; message: string }>(`/api/points-of-sale/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(statusData),
    }),

  updatePointOfSalePhoto: (id: number, data: { photo: string; latitude?: number; longitude?: number }) =>
    request<{ pos: PointOfSale; message: string }>(`/api/points-of-sale/${id}/photo`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  requestPointOfSaleDeletion: (id: number, data: { reason: string }) =>
    request<{ pos: PointOfSale; message: string }>(`/api/points-of-sale/${id}/request-deletion`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approvePointOfSaleDeletion: (id: number, data: { approved: boolean; note?: string }) =>
    request<{ message: string; pos?: PointOfSale; id?: number }>(`/api/points-of-sale/${id}/approve-deletion`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deletePointOfSale: (id: number) =>
    request<{ message: string; id: number }>(`/api/points-of-sale/${id}`, {
      method: 'DELETE',
    }),

  // Tours & Visits
  getTourPlans: (params?: { dayOfWeek?: string; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.dayOfWeek) query.append('dayOfWeek', params.dayOfWeek);
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{ tourPlans: TourPlan[] }>(`/api/tour-plans?${query.toString()}`);
  },

  createTourPlan: (tourData: any) =>
    request<{ tourPlan: TourPlan; message: string }>('/api/tour-plans', {
      method: 'POST',
      body: JSON.stringify(tourData),
    }),

  proposeTourPlan: (data: { sectorId: number | string; dayOfWeek?: string; plannedDate?: string; executionDate?: string; name?: string; neighborhood?: string; notes?: string; targetVisitsCount?: number }) =>
    request<{ tourPlan: TourPlan; message: string }>('/api/tour-plans/propose', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approveTourPlan: (id: number) =>
    request<{ message: string }>(`/api/tour-plans/${id}/approve`, {
      method: 'POST',
    }),

  rejectTourPlan: (id: number, reason?: string) =>
    request<{ message: string }>(`/api/tour-plans/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  updateTourPlanStatus: (id: number, data: { status: string }) =>
    request<{ message: string }>(`/api/tour-plans/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getVisits: (params?: { pointOfSaleId?: number; date?: string; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.pointOfSaleId) query.append('pointOfSaleId', String(params.pointOfSaleId));
    if (params?.date) query.append('date', params.date);
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{ visits: Visit[] }>(`/api/visits?${query.toString()}`);
  },

  recordVisit: (id: number, visitData: { latitude?: number; longitude?: number; notes?: string; stockCheckNotes?: string; status?: string }) =>
    request<{ message: string }>(`/api/visits/${id}/record`, {
      method: 'POST',
      body: JSON.stringify(visitData),
    }),

  startVisit: (visitData: { pointOfSaleId: number; latitude?: number; longitude?: number }) =>
    request<{ visitId: number; message: string }>('/api/visits/start', {
      method: 'POST',
      body: JSON.stringify(visitData),
    }),

  finishVisit: (id: number, visitData: { durationMinutes?: number; notes?: string; photo?: string; saleId?: number }) =>
    request<{ message: string }>(`/api/visits/${id}/finish`, {
      method: 'POST',
      body: JSON.stringify(visitData),
    }),

  // Dashboard Stats (cached with staleTime 60s, abortable)
  getDashboardStats: (params?: { dropPointId?: number; period?: string; forceRefresh?: boolean; signal?: AbortSignal }) => {
    const query = new URLSearchParams();
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    if (params?.period) query.append('period', params.period);
    const qs = query.toString();
    const endpoint = qs ? `/api/stats/dashboard?${qs}` : '/api/stats/dashboard';
    const token = getStoredToken() || 'anon';
    const cacheKey = `dashboard-stats-${token.slice(-12)}-${params?.dropPointId || 'all'}-${params?.period || 'current'}`;

    return apiCache.fetchWithCache(
      cacheKey,
      (sig) =>
        request<{
          kpis: any;
          charts: {
            salesByCategory: Array<{ category: string; amount: number; cartons: number }>;
            topProducts: Array<{ productName: string; category: string; cartonsSold: number; totalRevenue: number }>;
            salesByDropPoint: Array<{ dropPointName: string; dropPointCode: string; totalAmount: number; salesCount: number }>;
            salesByVrs: Array<{ vrsName: string; vrsPublicId: string; totalAmount: number; salesCount: number }>;
            monthlySales?: Array<{
              month: string;
              monthLabel: string;
              shortLabel: string;
              totalAmount: number;
              salesCount: number;
              cartonsSold: number;
              objectiveAmount: number;
              growthRate?: number;
            }>;
          };
          recentSales: any[];
        }>(endpoint, { signal: params?.signal || sig }),
      { ttl: 60_000, forceRefresh: params?.forceRefresh, signal: params?.signal }
    );
  },

  // Notifications
  getNotifications: () =>
    request<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications'),

  markNotificationRead: (id: number) =>
    request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),

  markAllNotificationsRead: () =>
    request<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' }),

  // Activity Logs
  getActivityLogs: (params?: { action?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.append('action', params.action);
    if (params?.limit) query.append('limit', String(params.limit));
    return request<{ logs: ActivityLogItem[] }>(`/api/activity-logs?${query.toString()}`);
  },

  // Acceptance Tests
  runAcceptanceTests: () =>
    request<{ passed: boolean; results: AcceptanceScenarioResult[]; summary: string }>(
      '/api/acceptance-tests/run',
      { method: 'POST' }
    ),

  getAcceptanceTestsStatus: () =>
    request<{ passed: boolean; results: AcceptanceScenarioResult[]; summary: string }>(
      '/api/acceptance-tests/status'
    ),

  // Offline Cache Management
  getOfflineStats: (): Promise<OfflineCacheStats> => offlineCache.getStats(),
  syncOfflineCache: (): Promise<{ success: boolean; stats: OfflineCacheStats; message: string }> =>
    offlineCache.precacheEssentialData((url) => request(url)),
  clearOfflineCache: (): Promise<void> => offlineCache.clearAll(),

  // Data Protection & Zero-Data-Loss Backups
  getDataProtectionStatus: () =>
    request<{
      status: string;
      mode: string;
      lastBackupTimestamp: number;
      lastBackupDate: string;
      storage: {
        databaseFileMb: number;
        walFileMb: number;
        snapshotFileMb: number;
        jsonBackupFileMb: number;
      };
      counts: {
        users: number;
        pointsOfSale: number;
        sales: number;
        vrsStockLines: number;
        dropPointStockLines: number;
        receipts: number;
      };
    }>('/api/system/data-protection'),

  triggerImmediateBackup: () =>
    request<{ success: boolean; message: string; stats: any }>('/api/system/trigger-backup', {
      method: 'POST',
    }),

  resetDemoData: (confirmation: string) =>
    request<{ success: boolean; message: string }>('/api/system/reset-demo-data', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    }),

  getBackupList: () =>
    request<{
      backups: Array<{
        filename: string;
        filepath: string;
        sizeFormatted: string;
        createdAt: string;
        ageDays: number;
      }>;
    }>('/api/backup/list'),

  triggerDailyBackup: () =>
    request<{ success: boolean; message: string }>('/api/backup/trigger-daily', {
      method: 'POST',
    }),

  importBackup: (fileData: string, fileName: string) =>
    request<{ success: boolean; message: string }>('/api/backup/import', {
      method: 'POST',
      body: JSON.stringify({ fileData, fileName }),
    }),

  restoreBackupFile: (filename: string) =>
    request<{ success: boolean; message: string }>('/api/backup/restore-file', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    }),

  // Drop Point Supply Workflow (Sections A, B, C)
  getDpSupplyRequests: (params?: { status?: string; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{ requests: any[]; pendingCount: number }>(`/api/dp-supply/requests?${query.toString()}`);
  },

  createDpSupplyRequest: (data: {
    dropPointId?: number;
    desiredDate?: string;
    comments?: string;
    items: Array<{ productId: number; quantityRequested: number }>;
  }) =>
    request<{ message: string; requestId: number; requestNumber: string }>('/api/dp-supply/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reviewDpSupplyRequest: (
    id: number,
    data: {
      decision: 'VALIDEE' | 'REFUSEE';
      rejectionReason?: string;
      validationNotes?: string;
      items?: Array<{ id?: number; productId?: number; quantityApproved: number }>;
    }
  ) =>
    request<{
      message: string;
      invoiceNumber?: string;
      transferNumber?: string;
      totalApprovedCartons?: number;
      totalInvoiceAmount?: number;
    }>(`/api/dp-supply/requests/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getDpInvoices: (params?: { paymentStatus?: string; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.paymentStatus) query.append('paymentStatus', params.paymentStatus);
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{ invoices: any[] }>(`/api/dp-supply/invoices?${query.toString()}`);
  },

  getDpInvoicesSummary: () =>
    request<{
      totalUnpaid: number;
      totalPaid: number;
      totalBilled: number;
      count: number;
      byDropPoint: Array<{
        dropPointId: number;
        dropPointName: string;
        dropPointCode: string;
        dropPointCity: string;
        unpaidAmount: number;
        paidAmount: number;
        totalAmount: number;
        invoiceCount: number;
      }>;
    }>('/api/dp-supply/invoices/summary'),

  recordDpInvoicePayment: (
    invoiceId: number,
    data: {
      amount: number;
      paymentMethod: string;
      reference?: string;
      notes?: string;
      paymentDate?: string;
    }
  ) =>
    request<{ message: string; invoice: any }>(`/api/dp-supply/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateDpInvoice: (invoiceId: number, data?: { applyTva?: boolean }) =>
    request<{ message: string; invoice: any }>(`/api/dp-supply/invoices/${invoiceId}/generate`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  cancelDpInvoiceAvoir: (invoiceId: number, data?: { reason?: string }) =>
    request<{ message: string; creditNoteNumber: string }>(`/api/dp-supply/invoices/${invoiceId}/cancel-avoir`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  updateDpInvoicePayment: (
    paymentId: number,
    data: { amount?: number; paymentMethod?: string; reference?: string; notes?: string; paymentDate?: string }
  ) =>
    request<{ message: string }>(`/api/dp-supply/invoices/payments/${paymentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  cancelDpInvoicePayment: (paymentId: number, data?: { reason?: string }) =>
    request<{ message: string }>(`/api/dp-supply/invoices/payments/${paymentId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  updateDpSupplyRequest: (
    requestId: number,
    data: { desiredDate?: string; comments?: string; items?: Array<{ productId: number; quantityRequested: number }> }
  ) =>
    request<{ message: string }>(`/api/dp-supply/requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  cancelDpSupplyRequest: (requestId: number, data?: { reason?: string }) =>
    request<{ message: string }>(`/api/dp-supply/requests/${requestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  // VRS Invoices
  getVrsInvoices: (params?: { paymentStatus?: string; vrsId?: number; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.paymentStatus) query.append('paymentStatus', params.paymentStatus);
    if (params?.vrsId) query.append('vrsId', String(params.vrsId));
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{
      invoices: any[];
      summary: { totalUnpaid: number; totalPaid: number; totalBilled: number; count: number };
    }>(`/api/vrs-invoices?${query.toString()}`);
  },

  getVrsInvoice: (id: number) =>
    request<{ invoice: any }>(`/api/vrs-invoices/${id}`),

  recordVrsInvoicePayment: (
    invoiceId: number,
    data: {
      amount: number;
      paymentMethod: string;
      reference?: string;
      notes?: string;
      paymentDate?: string;
    }
  ) =>
    request<{ message: string; paidAmount: number; remainingAmount: number; paymentStatus: string }>(
      `/api/vrs-invoices/${invoiceId}/payments`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  generateVrsInvoice: (invoiceId: number, data?: { applyTva?: boolean }) =>
    request<{ message: string; invoice: any }>(`/api/vrs-invoices/${invoiceId}/generate`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  cancelVrsInvoiceAvoir: (invoiceId: number, data?: { reason?: string }) =>
    request<{ message: string; creditNoteNumber: string }>(`/api/vrs-invoices/${invoiceId}/cancel-avoir`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  updateVrsInvoicePayment: (
    paymentId: number,
    data: { amount?: number; paymentMethod?: string; reference?: string; notes?: string; paymentDate?: string }
  ) =>
    request<{ message: string }>(`/api/vrs-invoices/payments/${paymentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  cancelVrsInvoicePayment: (paymentId: number, data?: { reason?: string }) =>
    request<{ message: string }>(`/api/vrs-invoices/payments/${paymentId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  getDpTransfers: (params?: { status?: string; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{ transfers: any[] }>(`/api/dp-supply/transfers?${query.toString()}`);
  },

  updateDpTransferStatus: (id: number, data: { newStatus: 'EN_TRANSIT' | 'RECU' }) =>
    request<{ message: string }>(`/api/dp-supply/transfers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getDpSupplySettings: () =>
    request<{ shippingConditionedOnPayment: boolean }>('/api/dp-supply/settings'),

  updateDpSupplySettings: (data: { shippingConditionedOnPayment: boolean }) =>
    request<{ shippingConditionedOnPayment: boolean }>('/api/dp-supply/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // POS Creation Requests (Section D)
  getPosRequests: (params?: { status?: string; dropPointId?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.dropPointId) query.append('dropPointId', String(params.dropPointId));
    return request<{ requests: any[]; pendingCount: number }>(`/api/pos-requests?${query.toString()}`);
  },

  createPosRequest: (data: {
    name: string;
    ownerName: string;
    phone: string;
    storeType?: string;
    neighborhood?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    photo?: string | null;
    sectorId?: number;
    dropPointId?: number;
  }) =>
    request<{ message: string; request: any }>('/api/pos-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reviewPosRequest: (id: number, data: { decision: 'VALIDEE' | 'REFUSEE'; rejectionReason?: string }) =>
    request<{ message: string; pos?: any }>(`/api/pos-requests/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addPosRequestFssNote: (id: number, data: { fssNote: string }) =>
    request<{ message: string }>(`/api/pos-requests/${id}/fss-note`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // ==========================================
  // VRS SCORING & GIFT SCRATCH CARDS MODULE
  // ==========================================
  getScoringSettings: () =>
    request<{ settings: VrsScoringSettings }>('/api/scoring/settings'),

  updateScoringSettings: (data: {
    weight_turnover: number;
    weight_regularity: number;
    weight_payments: number;
    weight_new_pos: number;
    weight_rigor: number;
  }) =>
    request<{ success: boolean; settings: VrsScoringSettings }>('/api/scoring/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getSemesters: () =>
    request<{ semesters: Semester[] }>('/api/scoring/semesters'),

  closeSemester: (semesterId: number, force?: boolean) =>
    request<{ success: boolean; message: string; cardsGenerated: any[] }>('/api/scoring/semesters/close', {
      method: 'POST',
      body: JSON.stringify({ semester_id: semesterId, force: Boolean(force) }),
    }),

  reopenSemester: (semesterId: number) =>
    request<{ success: boolean; message: string }>('/api/scoring/semesters/reopen', {
      method: 'POST',
      body: JSON.stringify({ semester_id: semesterId }),
    }),

  resetDemoSemester: () =>
    request<{ success: boolean; message: string }>('/api/scoring/semesters/reset-demo', {
      method: 'POST',
    }),

  getVrsScores: (semesterId?: number) => {
    const q = semesterId ? `?semester_id=${semesterId}` : '';
    return request<{
      semester_id: number;
      scores: VrsSemesterScore[];
      previous_semester: Semester | null;
    }>(`/api/scoring/scores${q}`);
  },

  correctVrsScore: (scoreId: number, data: { new_total_score: number; reason: string }) =>
    request<{ success: boolean; score: VrsSemesterScore }>(`/api/scoring/scores/${scoreId}/correct`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getGiftCatalog: () =>
    request<{ catalog: GiftCatalogItem[] }>('/api/scoring/gifts/catalog'),

  addGiftToCatalog: (data: {
    name: string;
    tier: 'BRONZE' | 'OR';
    description?: string;
    estimated_value_fcfa?: number;
    quantity?: number;
    photo_url?: string | null;
    svg_key: string;
    custom_photo?: string | null;
  }) =>
    request<{ success: boolean; gift: GiftCatalogItem }>('/api/scoring/gifts/catalog', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateGiftInCatalog: (id: number, data: Partial<GiftCatalogItem>) =>
    request<{ success: boolean; gift: GiftCatalogItem }>(`/api/scoring/gifts/catalog/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleGiftStatus: (id: number) =>
    request<{ success: boolean; gift: GiftCatalogItem }>(`/api/scoring/gifts/catalog/${id}/toggle-status`, {
      method: 'PATCH',
    }),

  uploadGiftPhoto: (imageData: string, giftId?: number) =>
    request<{ success: boolean; photo_url: string; filename: string; sizeBytes: number; format: string }>(
      '/api/scoring/gifts/upload-photo',
      {
        method: 'POST',
        body: JSON.stringify({ image_data: imageData, gift_id: giftId }),
      }
    ),

  deleteGiftPhoto: (giftId: number) =>
    request<{ success: boolean; message: string; gift: GiftCatalogItem }>(`/api/scoring/gifts/${giftId}/photo`, {
      method: 'DELETE',
    }),

  getMyScratchCard: (semesterId?: number) => {
    const q = semesterId ? `?semester_id=${semesterId}` : '';
    return request<{
      semester: Semester;
      score: VrsSemesterScore | null;
      card: ScratchCard | null;
      eligible: boolean;
      missing_points: number;
    }>(`/api/scoring/scratch-cards/my-card${q}`);
  },

  revealScratchCard: (cardId: number, method: 'SCRATCH' | 'BUTTON') =>
    request<{
      success: boolean;
      card: ScratchCard;
      cadeau?: {
        nom: string;
        photo?: string | null;
        palier: 'BRONZE' | 'OR';
        valeur: number;
        description?: string;
        svg_key?: string;
      };
      gift?: {
        name: string;
        photo?: string | null;
        tier: 'BRONZE' | 'OR';
        estimated_value_fcfa: number;
        description?: string;
      };
    }>(`/api/cartes/${cardId}/reveler`, {
      method: 'POST',
      body: JSON.stringify({ method }),
    }),

  getGiftDeliveries: (params?: { semester_id?: number; tier?: string; delivery_status?: string }) => {
    const q = new URLSearchParams();
    if (params?.semester_id) q.append('semester_id', String(params.semester_id));
    if (params?.tier) q.append('tier', params.tier);
    if (params?.delivery_status) q.append('delivery_status', params.delivery_status);
    return request<{ deliveries: ScratchCard[] }>(`/api/scoring/gifts/deliveries?${q.toString()}`);
  },

  scheduleDelivery: (
    cardId: number,
    data: { delivery_date: string; delivery_location: string; delivered_by: string; delivery_comment?: string }
  ) =>
    request<{ success: boolean; message: string }>(`/api/scoring/scratch-cards/${cardId}/schedule-delivery`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  confirmDeliveryDone: (cardId: number) =>
    request<{ success: boolean; message: string }>(`/api/scoring/scratch-cards/${cardId}/confirm-delivery`, {
      method: 'POST',
    }),

  confirmReceiptByVrs: (cardId: number) =>
    request<{ success: boolean; message: string }>(`/api/scoring/scratch-cards/${cardId}/confirm-receipt`, {
      method: 'POST',
    }),

  getScoringBadgeCount: () =>
    request<{ badgeCount: number }>('/api/scoring/badge-count'),
};
