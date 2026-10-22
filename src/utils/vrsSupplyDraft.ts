import { useState, useEffect, useCallback } from 'react';

export interface VrsSupplyDraftItem {
  productId: number;
  productName: string;
  productRef: string;
  categoryName: string;
  quantityRequested: number;
  availableStock: number;
}

export interface VrsSupplyDraft {
  items: VrsSupplyDraftItem[];
  desiredLoadingDate?: string;
  notes?: string;
  blNumber?: string;
  blAttachment?: string;
  blFileName?: string;
  blFileType?: string;
}

const DRAFT_STORAGE_PREFIX = '6c_vrs_supply_draft_';
const DRAFT_EVENT_NAME = '6c-vrs-supply-draft-changed';

function getStorageKey(vrsId: number | string | undefined): string {
  return `${DRAFT_STORAGE_PREFIX}${vrsId ?? 'default'}`;
}

export function getVrsSupplyDraft(vrsId: number | string | undefined): VrsSupplyDraft {
  if (typeof window === 'undefined') return { items: [] };
  try {
    const raw = localStorage.getItem(getStorageKey(vrsId));
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch (err) {
    console.warn('[VRS Draft] Erreur lecture brouillon:', err);
    return { items: [] };
  }
}

export function setVrsSupplyDraft(vrsId: number | string | undefined, draft: VrsSupplyDraft): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(vrsId);
    localStorage.setItem(key, JSON.stringify(draft));
    window.dispatchEvent(new CustomEvent(DRAFT_EVENT_NAME, { detail: { vrsId, draft } }));
  } catch (err) {
    console.error('[VRS Draft] Erreur sauvegarde brouillon:', err);
  }
}

export function clearVrsSupplyDraft(vrsId: number | string | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(vrsId);
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent(DRAFT_EVENT_NAME, { detail: { vrsId, draft: { items: [] } } }));
  } catch (err) {
    console.error('[VRS Draft] Erreur suppression brouillon:', err);
  }
}

export function addOrUpdateDraftItem(vrsId: number | string | undefined, item: VrsSupplyDraftItem): VrsSupplyDraft {
  const current = getVrsSupplyDraft(vrsId);
  const existingIdx = current.items.findIndex((it) => it.productId === item.productId);

  let newItems: VrsSupplyDraftItem[];
  if (existingIdx >= 0) {
    newItems = [...current.items];
    newItems[existingIdx] = { ...newItems[existingIdx], ...item };
  } else {
    newItems = [...current.items, item];
  }

  const updated: VrsSupplyDraft = { ...current, items: newItems };
  setVrsSupplyDraft(vrsId, updated);
  return updated;
}

export function removeDraftItem(vrsId: number | string | undefined, productId: number): VrsSupplyDraft {
  const current = getVrsSupplyDraft(vrsId);
  const newItems = current.items.filter((it) => it.productId !== productId);
  const updated: VrsSupplyDraft = { ...current, items: newItems };
  setVrsSupplyDraft(vrsId, updated);
  return updated;
}

export function useVrsSupplyDraft(vrsId: number | string | undefined) {
  const [draft, setDraft] = useState<VrsSupplyDraft>(() => getVrsSupplyDraft(vrsId));

  useEffect(() => {
    setDraft(getVrsSupplyDraft(vrsId));

    const handleSync = (e: Event) => {
      const custom = e as CustomEvent<{ vrsId: any; draft: VrsSupplyDraft }>;
      if (!custom.detail || String(custom.detail.vrsId) === String(vrsId)) {
        setDraft(getVrsSupplyDraft(vrsId));
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === getStorageKey(vrsId)) {
        setDraft(getVrsSupplyDraft(vrsId));
      }
    };

    window.addEventListener(DRAFT_EVENT_NAME, handleSync);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(DRAFT_EVENT_NAME, handleSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, [vrsId]);

  const addItem = useCallback(
    (item: VrsSupplyDraftItem) => addOrUpdateDraftItem(vrsId, item),
    [vrsId]
  );

  const removeItem = useCallback(
    (productId: number) => removeDraftItem(vrsId, productId),
    [vrsId]
  );

  const clear = useCallback(() => clearVrsSupplyDraft(vrsId), [vrsId]);

  const totalCartons = draft.items.reduce((sum, it) => sum + (it.quantityRequested || 0), 0);
  const totalProducts = draft.items.length;

  return {
    draft,
    addItem,
    removeItem,
    clearDraft: clear,
    totalCartons,
    totalProducts,
  };
}
