/**
 * 6C DMS - In-Memory API Response Cache & Request Deduplicator
 * Provides staleTime caching (60s default) to prevent refetching on every tab switch
 * and supports AbortController cancellation.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();
  private readonly defaultTtl = 60_000; // 60 seconds staleTime

  /**
   * Fetches data with 60s memory caching and in-flight request deduplication
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options?: { ttl?: number; forceRefresh?: boolean; signal?: AbortSignal }
  ): Promise<T> {
    const ttl = options?.ttl ?? this.defaultTtl;
    const now = Date.now();

    // 1. Check valid cache entry if not forcing refresh
    if (!options?.forceRefresh) {
      const entry = this.cache.get(key);
      if (entry && entry.expiresAt > now) {
        return entry.data as T;
      }
    }

    // 2. Deduplicate in-flight requests (independent background fetch)
    let inFlightPromise = this.inFlight.get(key);
    if (!inFlightPromise) {
      inFlightPromise = (async () => {
        try {
          const data = await fetcher();
          this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttl,
          });
          return data;
        } finally {
          this.inFlight.delete(key);
        }
      })();

      this.inFlight.set(key, inFlightPromise);
    }

    // 3. If caller supplied an AbortSignal, abort only for THIS caller without canceling other callers or cache
    if (options?.signal) {
      const sig = options.signal;
      if (sig.aborted) {
        return Promise.reject(new DOMException('The user aborted a request.', 'AbortError'));
      }
      return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
          sig.removeEventListener('abort', onAbort);
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        };
        sig.addEventListener('abort', onAbort);
        inFlightPromise!
          .then((result) => {
            sig.removeEventListener('abort', onAbort);
            resolve(result);
          })
          .catch((err) => {
            sig.removeEventListener('abort', onAbort);
            reject(err);
          });
      });
    }

    return inFlightPromise as Promise<T>;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    return null;
  }

  set<T>(key: string, data: T, ttl = this.defaultTtl): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  }

  invalidate(prefixOrKey?: string): void {
    if (!prefixOrKey) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefixOrKey)) {
        this.cache.delete(key);
      }
    }
  }
}

export const apiCache = new ApiCache();
