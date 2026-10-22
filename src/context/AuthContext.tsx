import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, NotificationItem } from '../types/index.ts';
import { api, getStoredToken, setStoredToken, removeStoredToken } from '../services/api.ts';
import { apiCache } from '../services/apiCache.ts';
import { sendDeviceNotification, setDeviceAppBadge } from '../services/deviceNotification.ts';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  unreadCount: number;
  pendingSupplyCount: number;
  readySupplyCount: number;
  supplyBadgeCount: number;
  pendingDpSupplyCount: number;
  pendingPosRequestsCount: number;
  giftsBadgeCount: number;
  activeNotificationToast: NotificationItem | null;
  dismissActiveToast: () => void;
  login: (identifier: string, pass: string) => Promise<User>;
  logout: () => Promise<void>;
  switchRoleShortcut: (identifier: string) => Promise<void>;
  reloadUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshSupplyBadgeCounts: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [pendingSupplyCount, setPendingSupplyCount] = useState<number>(0);
  const [readySupplyCount, setReadySupplyCount] = useState<number>(0);
  const [supplyBadgeCount, setSupplyBadgeCount] = useState<number>(0);
  const [pendingDpSupplyCount, setPendingDpSupplyCount] = useState<number>(0);
  const [pendingPosRequestsCount, setPendingPosRequestsCount] = useState<number>(0);
  const [giftsBadgeCount, setGiftsBadgeCount] = useState<number>(0);
  const [activeNotificationToast, setActiveNotificationToast] = useState<NotificationItem | null>(null);

  const prevMaxNotifIdRef = useRef<number>(0);
  const isInitialNotifLoadRef = useRef<boolean>(true);

  const dismissActiveToast = useCallback(() => {
    setActiveNotificationToast(null);
  }, []);

  const refreshSupplyBadgeCounts = useCallback(async () => {
    if (!getStoredToken()) return;
    try {
      const [res, dpRes, posRes, scoringRes] = await Promise.all([
        api.getSupplyRequestBadgeCounts().catch(() => ({ pendingApprovalCount: 0, readyForReceptionCount: 0, totalBadgeCount: 0 })),
        api.getDpSupplyRequests({ status: 'DEMANDEE' }).catch(() => ({ pendingCount: 0 })),
        api.getPosRequests({ status: 'EN_ATTENTE' }).catch(() => ({ pendingCount: 0 })),
        api.getScoringBadgeCount().catch(() => ({ badgeCount: 0 })),
      ]);
      const pSupply = res.pendingApprovalCount || 0;
      const rSupply = res.readyForReceptionCount || 0;
      const tBadge = res.totalBadgeCount || 0;
      const pDp = (dpRes as any)?.pendingCount || 0;
      const pPos = (posRes as any)?.pendingCount || 0;
      const gBadge = scoringRes.badgeCount || 0;

      setPendingSupplyCount((prev) => (prev !== pSupply ? pSupply : prev));
      setReadySupplyCount((prev) => (prev !== rSupply ? rSupply : prev));
      setSupplyBadgeCount((prev) => (prev !== tBadge ? tBadge : prev));
      setPendingDpSupplyCount((prev) => (prev !== pDp ? pDp : prev));
      setPendingPosRequestsCount((prev) => (prev !== pPos ? pPos : prev));
      setGiftsBadgeCount((prev) => (prev !== gBadge ? gBadge : prev));
    } catch {
      // background fallback
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!getStoredToken()) return;
    try {
      const [res] = await Promise.all([
        api.getNotifications(),
        refreshSupplyBadgeCounts()
      ]);
      setUnreadCount((prev) => (prev !== res.unreadCount ? res.unreadCount : prev));
      setDeviceAppBadge(res.unreadCount);

      if (res.notifications && res.notifications.length > 0) {
        const newest = res.notifications[0];
        if (isInitialNotifLoadRef.current) {
          prevMaxNotifIdRef.current = newest.id;
          isInitialNotifLoadRef.current = false;
        } else if (newest.id > prevMaxNotifIdRef.current && !newest.is_read) {
          prevMaxNotifIdRef.current = newest.id;
          setActiveNotificationToast(newest);
          // Trigger real notification on the phone / desktop
          sendDeviceNotification(newest.title, {
            body: newest.message,
            tag: `dms-notif-${newest.id}`,
            url: '/',
          });
        }
      }
    } catch {
      // ignore in background
    }
  }, [refreshSupplyBadgeCounts]);

  const reloadUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.getCurrentUser();
      setUser(res.user);
      await refreshNotifications();
    } catch (err: any) {
      // Only wipe session if server explicitly rejected credentials (401 or invalid token)
      if (err?.status === 401 || err?.message?.includes('Jeton expiré') || err?.message?.includes('non autorisé')) {
        removeStoredToken();
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    reloadUser();
  }, [reloadUser]);

  // Periodic notification polling: at most every 60 seconds and strictly when document is visible
  useEffect(() => {
    if (!user) return;

    const poll = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshNotifications();
      }
    };

    const interval = setInterval(poll, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshNotifications]);

  const login = async (identifier: string, pass: string) => {
    setIsLoading(true);
    try {
      isInitialNotifLoadRef.current = true;
      apiCache.invalidate();
      const res = await api.login({ identifier, password: pass });
      setStoredToken(res.token);
      setUser(res.user);
      await refreshNotifications();
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const switchRoleShortcut = async (identifier: string) => {
    apiCache.invalidate();
    await login(identifier, '6CDist@2026');
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // proceed with local cleanup
    } finally {
      apiCache.invalidate();
      removeStoredToken();
      setUser(null);
      setActiveNotificationToast(null);
      setDeviceAppBadge(0);
      isInitialNotifLoadRef.current = true;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        unreadCount,
        pendingSupplyCount,
        readySupplyCount,
        supplyBadgeCount,
        pendingDpSupplyCount,
        pendingPosRequestsCount,
        giftsBadgeCount,
        activeNotificationToast,
        dismissActiveToast,
        login,
        logout,
        switchRoleShortcut,
        reloadUser,
        refreshUser: reloadUser,
        refreshNotifications,
        refreshSupplyBadgeCounts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
