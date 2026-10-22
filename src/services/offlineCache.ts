/**
 * 6C Distribution - Offline Cache Engine (IndexedDB)
 * Fournit une mise en cache persistante des Ventes, Stocks, Tournées,
 * Visites, Points de Vente et Produits pour consultation complète sans connexion internet.
 */

export interface CacheEntry {
  key: string;
  url: string;
  category: 'sales' | 'stocks' | 'tours' | 'visits' | 'pos' | 'products' | 'general';
  data: any;
  timestamp: number;
}

export interface OfflineCacheStats {
  salesCount: number;
  stocksCount: number;
  toursCount: number;
  visitsCount: number;
  posCount: number;
  productsCount: number;
  totalEntries: number;
  lastSyncTime: number | null;
  storageEstimateBytes?: number;
}

const DB_NAME = '6c_distribution_offline_db';
const DB_VERSION = 1;
const STORE_ENTRIES = 'cache_entries';
const STORE_META = 'sync_meta';

class OfflineCacheManager {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isSupported: boolean = typeof window !== 'undefined' && 'indexedDB' in window;

  constructor() {
    if (this.isSupported) {
      this.initDb();
    }
  }

  private initDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (!this.isSupported) {
        reject(new Error('IndexedDB non supporté par ce navigateur'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for cached endpoints
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'key' });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store for metadata (timestamps, last sync)
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[OfflineCache] Erreur ouverture IndexedDB:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Catégorise automatiquement une URL d'API
   */
  private detectCategory(url: string): CacheEntry['category'] {
    const clean = url.toLowerCase();
    if (clean.includes('/api/sales')) return 'sales';
    if (clean.includes('/api/stocks')) return 'stocks';
    if (clean.includes('/api/tour-plans')) return 'tours';
    if (clean.includes('/api/visits')) return 'visits';
    if (clean.includes('/api/points-of-sale')) return 'pos';
    if (clean.includes('/api/products')) return 'products';
    return 'general';
  }

  /**
   * Normalise une clé de cache
   */
  private normalizeKey(url: string): string {
    return url.trim();
  }

  /**
   * Enregistre une réponse API dans le cache IndexedDB
   */
  public async saveEntry(url: string, data: any, customCategory?: CacheEntry['category']): Promise<void> {
    if (!this.isSupported || !data) return;

    try {
      const db = await this.initDb();
      const category = customCategory || this.detectCategory(url);
      const key = this.normalizeKey(url);
      const entry: CacheEntry = {
        key,
        url,
        category,
        data,
        timestamp: Date.now(),
      };

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_ENTRIES, STORE_META], 'readwrite');
        const store = transaction.objectStore(STORE_ENTRIES);
        const metaStore = transaction.objectStore(STORE_META);

        store.put(entry);

        // Update meta for this category & global sync
        metaStore.put({ id: `last_${category}`, timestamp: Date.now() });
        metaStore.put({ id: 'last_global_sync', timestamp: Date.now() });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (err) {
      console.warn('[OfflineCache] Impossible de sauvegarder en cache local:', err);
    }
  }

  /**
   * Récupère une entrée du cache par son URL exacte
   */
  public async getEntry<T>(url: string): Promise<{ data: T; timestamp: number; key: string } | null> {
    if (!this.isSupported) return null;

    try {
      const db = await this.initDb();
      const key = this.normalizeKey(url);

      const entry = await new Promise<CacheEntry | null>((resolve, reject) => {
        const transaction = db.transaction([STORE_ENTRIES], 'readonly');
        const store = transaction.objectStore(STORE_ENTRIES);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      if (entry) {
        return { data: entry.data as T, timestamp: entry.timestamp, key: entry.key };
      }

      // If exact query not found, try to fallback to base endpoint (e.g. /api/sales instead of /api/sales?status=...)
      return this.findFallbackEntry<T>(url);
    } catch (err) {
      console.warn('[OfflineCache] Erreur lecture cache IndexedDB:', err);
      return null;
    }
  }

  /**
   * Tente de trouver une correspondance approchante si des filtres spécifiques échouent
   */
  private async findFallbackEntry<T>(url: string): Promise<{ data: T; timestamp: number; key: string } | null> {
    try {
      const db = await this.initDb();
      const basePath = url.split('?')[0];

      return new Promise((resolve) => {
        const transaction = db.transaction([STORE_ENTRIES], 'readonly');
        const store = transaction.objectStore(STORE_ENTRIES);
        const request = store.openCursor();

        let bestMatch: CacheEntry | null = null;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            const entry = cursor.value as CacheEntry;
            if (entry.url.startsWith(basePath)) {
              if (!bestMatch || entry.timestamp > bestMatch.timestamp) {
                bestMatch = entry;
              }
            }
            cursor.continue();
          } else {
            if (bestMatch) {
              resolve({ data: (bestMatch as CacheEntry).data as T, timestamp: (bestMatch as CacheEntry).timestamp, key: (bestMatch as CacheEntry).key });
            } else {
              resolve(null);
            }
          }
        };

        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Récupère les métriques et statistiques du cache local (quantité de données en cache)
   */
  public async getStats(): Promise<OfflineCacheStats> {
    const defaultStats: OfflineCacheStats = {
      salesCount: 0,
      stocksCount: 0,
      toursCount: 0,
      visitsCount: 0,
      posCount: 0,
      productsCount: 0,
      totalEntries: 0,
      lastSyncTime: null,
    };

    if (!this.isSupported) return defaultStats;

    try {
      const db = await this.initDb();

      return new Promise((resolve) => {
        const transaction = db.transaction([STORE_ENTRIES, STORE_META], 'readonly');
        const store = transaction.objectStore(STORE_ENTRIES);
        const metaStore = transaction.objectStore(STORE_META);

        const stats = { ...defaultStats };

        // Read metadata
        const metaReq = metaStore.get('last_global_sync');
        metaReq.onsuccess = () => {
          if (metaReq.result?.timestamp) {
            stats.lastSyncTime = metaReq.result.timestamp;
          }
        };

        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            stats.totalEntries++;
            const entry = cursor.value as CacheEntry;
            const data = entry.data;

            if (entry.category === 'sales') {
              const count = Array.isArray(data?.sales) ? data.sales.length : (Array.isArray(data) ? data.length : 1);
              if (count > stats.salesCount) stats.salesCount = count;
            } else if (entry.category === 'stocks') {
              const count = Array.isArray(data?.stocks) ? data.stocks.length : (Array.isArray(data) ? data.length : 1);
              if (count > stats.stocksCount) stats.stocksCount = count;
            } else if (entry.category === 'tours') {
              const count = Array.isArray(data?.tourPlans) ? data.tourPlans.length : (Array.isArray(data) ? data.length : 1);
              if (count > stats.toursCount) stats.toursCount = count;
            } else if (entry.category === 'visits') {
              const count = Array.isArray(data?.visits) ? data.visits.length : (Array.isArray(data) ? data.length : 1);
              if (count > stats.visitsCount) stats.visitsCount = count;
            } else if (entry.category === 'pos') {
              const count = Array.isArray(data?.pointsOfSale) ? data.pointsOfSale.length : (Array.isArray(data) ? data.length : 1);
              if (count > stats.posCount) stats.posCount = count;
            } else if (entry.category === 'products') {
              const count = Array.isArray(data?.products) ? data.products.length : (Array.isArray(data) ? data.length : 1);
              if (count > stats.productsCount) stats.productsCount = count;
            }

            if (!stats.lastSyncTime || entry.timestamp > stats.lastSyncTime) {
              stats.lastSyncTime = entry.timestamp;
            }

            cursor.continue();
          } else {
            resolve(stats);
          }
        };

        cursorReq.onerror = () => resolve(stats);
      });
    } catch {
      return defaultStats;
    }
  }

  /**
   * Efface l'intégralité du cache local IndexedDB
   */
  public async clearAll(): Promise<void> {
    if (!this.isSupported) return;
    try {
      const db = await this.initDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_ENTRIES, STORE_META], 'readwrite');
        transaction.objectStore(STORE_ENTRIES).clear();
        transaction.objectStore(STORE_META).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      console.log('[OfflineCache] Cache local IndexedDB vidé avec succès.');
    } catch (err) {
      console.error('[OfflineCache] Erreur lors du vidage du cache:', err);
    }
  }

  /**
   * Pré-charge toutes les données critiques nécessaires au travail sur le terrain :
   * - Ventes récentes
   * - Stocks Dépôt & Stocks VRS
   * - Plans de tournée et visites
   * - Points de vente (PDV)
   * - Produits
   */
  public async precacheEssentialData(fetcher: (url: string) => Promise<any>): Promise<{ success: boolean; stats: OfflineCacheStats; message: string }> {
    const endpointsToSync = [
      { url: '/api/sales', cat: 'sales' as const },
      { url: '/api/stocks/drop-point', cat: 'stocks' as const },
      { url: '/api/stocks/vrs', cat: 'stocks' as const },
      { url: '/api/tour-plans', cat: 'tours' as const },
      { url: '/api/visits', cat: 'visits' as const },
      { url: '/api/points-of-sale', cat: 'pos' as const },
      { url: '/api/products', cat: 'products' as const },
      { url: '/api/drop-points', cat: 'general' as const },
    ];

    let successCount = 0;

    for (const item of endpointsToSync) {
      try {
        const data = await fetcher(item.url);
        if (data) {
          await this.saveEntry(item.url, data, item.cat);
          successCount++;
        }
      } catch (err) {
        console.warn(`[OfflineCache] Échec pré-chargement ${item.url}:`, err);
      }
    }

    const stats = await this.getStats();

    return {
      success: successCount > 0,
      stats,
      message: `${successCount}/${endpointsToSync.length} modules synchronisés en mémoire locale pour consultation hors-ligne.`,
    };
  }
}

export const offlineCache = new OfflineCacheManager();
