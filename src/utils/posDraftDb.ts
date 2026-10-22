/**
 * Utilitaire IndexedDB pour la persistance locale sans rechargement du brouillon "Nouveau PDV"
 */

export interface PosDraftData {
  name: string;
  ownerName: string;
  phone: string;
  storeType: string;
  address: string;
  neighborhood: string;
  sectorId: string;
  latitude: number;
  longitude: number;
  photo: string | null;
  step?: number;
  updatedAt?: number;
}

const DB_NAME = '6c_dms_db';
const DB_VERSION = 1;
const STORE_NAME = 'pos_draft';
const DRAFT_KEY = 'current_pos_draft';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non disponible'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Erreur ouverture IndexedDB'));
    };
  });
}

/**
 * Récupère le brouillon sauvegardé dans IndexedDB avec repli SessionStorage / LocalStorage
 */
export async function getPosDraft(): Promise<PosDraftData | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DRAFT_KEY);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result as PosDraftData);
        } else {
          // Repli sessionStorage / localStorage si vide
          try {
            const ss = sessionStorage.getItem('6c_new_pos_draft');
            if (ss) return resolve(JSON.parse(ss));
            const ls = localStorage.getItem('6c_new_pos_draft');
            if (ls) return resolve(JSON.parse(ls));
          } catch {}
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    try {
      const ss = sessionStorage.getItem('6c_new_pos_draft');
      if (ss) return JSON.parse(ss);
      const ls = localStorage.getItem('6c_new_pos_draft');
      if (ls) return JSON.parse(ls);
    } catch {}
    return null;
  }
}

/**
 * Enregistre le brouillon dans IndexedDB
 */
export async function savePosDraft(data: PosDraftData): Promise<void> {
  const payload: PosDraftData = {
    ...data,
    updatedAt: Date.now(),
  };

  // Synchronisation synchrone en secours
  try {
    sessionStorage.setItem('6c_new_pos_draft', JSON.stringify(payload));
  } catch {}

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(payload, DRAFT_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[posDraftDb] Enregistrement IndexedDB échoué:', err);
  }
}

/**
 * Supprime le brouillon (après soumission réussie ou annulation confirmée)
 */
export async function deletePosDraft(): Promise<void> {
  try {
    sessionStorage.removeItem('6c_new_pos_draft');
    localStorage.removeItem('6c_new_pos_draft');
    sessionStorage.removeItem('6c_new_pos_open');
    localStorage.removeItem('6c_new_pos_open');
  } catch {}

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(DRAFT_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {}
}
