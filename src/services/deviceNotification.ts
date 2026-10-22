/**
 * Service pour la gestion des notifications web et système
 * et de la bulle de notification (Badging API).
 */

export interface NotificationOptions {
  body?: string;
  tag?: string;
  url?: string;
  icon?: string;
  badge?: string;
  silent?: boolean;
}

/**
 * Vérifie si les notifications sont supportées sur l'appareil
 */
export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Vérifie si l'API App Badging (bulle sur l'icône de l'app) est supportée
 */
export const isBadgingSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
};

/**
 * Demande l'autorisation d'envoyer des notifications sur l'appareil
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) {
    console.warn('[Notification] API non supportée sur cet appareil.');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('[Notification] Erreur lors de la demande de permission:', err);
    return 'denied';
  }
};

/**
 * Joue un signal sonore discret (synthétisé via AudioContext, sans dépendance externe)
 */
export const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignorer si bloqué par l'autoplay du navigateur
  }
};

/**
 * Met à jour la bulle de notification (Badge) sur l'icône de l'application
 * et dans la barre des tâches
 */
export const setDeviceAppBadge = (count: number) => {
  if (typeof navigator === 'undefined') return;

  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  } catch {
    // Fallback silencieux
  }

  // Synchronisation visuelle de l'onglet du navigateur
  try {
    if (typeof document !== 'undefined') {
      const baseTitle = '6C DMS - Distribution Management System';
      if (count > 0) {
        document.title = `(${count}) ${baseTitle}`;
      } else {
        document.title = baseTitle;
      }
    }
  } catch {
    // Ignorer
  }
};

/**
 * Envoie une notification native sur le téléphone / ordinateur
 */
export const sendDeviceNotification = async (
  title: string,
  options: NotificationOptions = {}
): Promise<boolean> => {
  if (!isNotificationSupported()) return false;

  if (Notification.permission !== 'granted') {
    return false;
  }

  if (!options.silent) {
    playNotificationChime();
  }

  const notificationPayload = {
    body: options.body || '',
    icon: options.icon || '/pwa-192x192.png',
    badge: options.badge || '/badge-72x72.png',
    tag: options.tag || '6c-dms-notif',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: options.url || '/',
    },
  };

  try {
    // Méthode prioritaire : via le Service Worker (indispensable sur Android / mobile)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationPayload as any);
        return true;
      }
    }

    // Méthode de secours : API Notification classique (desktop)
    new Notification(title, notificationPayload);
    return true;
  } catch (err) {
    console.warn('[Notification] Impossible d’afficher la notification système:', err);
    return false;
  }
};
