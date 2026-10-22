import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Resilient lazy loader for code-split components.
 * Retries dynamic import on network hiccups or Vite/asset cache invalidation,
 * and falls back to a clean page reload once if chunk hashes have rotated.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | { [key: string]: any }>,
  componentName?: string
): LazyExoticComponent<T> {
  return lazy(async () => {
    const storageKey = `chunk_retry_${componentName || 'module'}`;
    const hasRetried = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null;

    const executeImport = async (retriesLeft = 2, delayMs = 400): Promise<{ default: T }> => {
      try {
        const mod = await factory();
        const resolved = (mod as any)?.default || (componentName ? (mod as any)[componentName] : null) || Object.values(mod)[0];
        if (typeof window !== 'undefined' && hasRetried) {
          sessionStorage.removeItem(storageKey);
        }
        return { default: resolved as T };
      } catch (err: any) {
        if (retriesLeft > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return executeImport(retriesLeft - 1, delayMs * 1.5);
        }

        // If chunk is outdated or dynamic import completely failed and haven't force reloaded yet
        const isModuleLoadError =
          err?.message?.includes('dynamically imported module') ||
          err?.message?.includes('Failed to fetch dynamically imported module') ||
          err?.name === 'ChunkLoadError';

        if (isModuleLoadError && typeof window !== 'undefined' && !hasRetried) {
          sessionStorage.setItem(storageKey, 'true');
          window.location.reload();
          // Return a pending promise while the browser is reloading
          return new Promise<{ default: T }>(() => {});
        }

        console.error(`[lazyWithRetry] Échec du chargement du module ${componentName || ''}:`, err);
        throw err;
      }
    };

    return executeImport();
  });
}
