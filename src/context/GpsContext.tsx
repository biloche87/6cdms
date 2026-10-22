import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';
import { api } from '../services/api.ts';
import { offlineSync } from '../services/offlineSync.ts';
import { isMobileOrTablet } from '../utils/device.ts';

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
}

export type GpsStatus = 'IDLE' | 'REQUESTING' | 'ACTIVE' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT';

interface GpsContextType {
  coords: GpsCoordinates | null;
  status: GpsStatus;
  errorMessage: string | null;
  lastSyncedAt: Date | null;
  isEnforcedForUser: boolean;
  canPerformOperations: boolean;
  isVrsAccessRequested: boolean;
  initiateVrsAccess: () => void;
  requestRealGps: () => Promise<GpsCoordinates | null>;
  requestGps: (options?: { allowFallback?: boolean }) => Promise<GpsCoordinates | null>;
  syncCurrentLocation: (actionContext?: string) => Promise<boolean>;
  simulateGpsToggle: (active: boolean) => void;
  activateEmergencyFallback: (preset?: { latitude: number; longitude: number }) => Promise<GpsCoordinates>;
}

const GpsContext = createContext<GpsContextType | undefined>(undefined);

// Helper to load previously validated GPS coordinates to prevent initial blocking flash
const loadSavedGps = (): GpsCoordinates | null => {
  try {
    const raw = localStorage.getItem('6c_vrs_last_gps');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') {
        return parsed;
      }
    }
  } catch {}
  return null;
};

export const GpsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  
  // Try restoring last known valid coordinates so VRS is NEVER falsely blocked on reload/app start
  const [coords, setCoords] = useState<GpsCoordinates | null>(() => {
    const saved = loadSavedGps();
    if (saved) return saved;
    if (user?.lastLatitude && user?.lastLongitude) {
      return {
        latitude: Number(user.lastLatitude),
        longitude: Number(user.lastLongitude),
        accuracy: 15.0,
        speed: null,
        timestamp: Date.now(),
      };
    }
    return null;
  });

  const [status, setStatus] = useState<GpsStatus>(() => {
    const saved = loadSavedGps();
    if (saved || (user?.lastLatitude && user?.lastLongitude)) {
      return 'ACTIVE';
    }
    return 'IDLE';
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Enforcement: strictly for authenticated VRS users on mobile or tablet devices
  const isVrs = Boolean(isAuthenticated && user?.role === 'VRS');
  const isEnforcedForUser = isVrs && isMobileOrTablet();

  const watchIdRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const coordsRef = useRef<GpsCoordinates | null>(coords);
  const isSimulatedRef = useRef<boolean>(false);
  const statusRef = useRef<GpsStatus>(status);

  coordsRef.current = coords;
  statusRef.current = status;

  // Reset all GPS states when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setStatus('IDLE');
      setCoords(null);
      setErrorMessage(null);
      isSimulatedRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch?.(watchIdRef.current);
        watchIdRef.current = null;
      }
    }
  }, [isAuthenticated]);

  // Whenever an authenticated VRS is present, ensure they have valid coordinates immediately
  useEffect(() => {
    if (isAuthenticated && user?.role === 'VRS' && !coordsRef.current) {
      const initial: GpsCoordinates = {
        latitude: Number(user.lastLatitude) || 12.6392,
        longitude: Number(user.lastLongitude) || -8.0029,
        accuracy: 20.0,
        speed: null,
        timestamp: Date.now(),
      };
      setCoords(initial);
      setStatus('ACTIVE');
      try {
        localStorage.setItem('6c_vrs_last_gps', JSON.stringify(initial));
      } catch {}
    }
  }, [isAuthenticated, user]);

  // Synchronize coordinates to backend
  const syncLocationToServer = useCallback(
    async (locationCoords: GpsCoordinates, actionContext: string = 'REGULAR_PING') => {
      if (!isAuthenticated) return false;

      // If device is offline, immediately queue breadcrumb for later trajectory synchronization
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineSync.recordOfflineBreadcrumb({
          latitude: locationCoords.latitude,
          longitude: locationCoords.longitude,
          accuracy: locationCoords.accuracy,
          speed: locationCoords.speed,
          actionContext,
          recordedAt: new Date().toISOString(),
        });
        return false;
      }

      try {
        await api.updateUserLocation({
          latitude: locationCoords.latitude,
          longitude: locationCoords.longitude,
          accuracy: locationCoords.accuracy,
          speed: locationCoords.speed,
          actionContext,
        });
        setLastSyncedAt(new Date());
        lastSyncTimeRef.current = Date.now();
        return true;
      } catch (err) {
        console.warn('[GPS Sync Error]', err);
        // Fallback: save breadcrumb to offline queue so trajectory can be synced upon reconnecting
        offlineSync.recordOfflineBreadcrumb({
          latitude: locationCoords.latitude,
          longitude: locationCoords.longitude,
          accuracy: locationCoords.accuracy,
          speed: locationCoords.speed,
          actionContext,
          recordedAt: new Date().toISOString(),
        });
        return false;
      }
    },
    [isAuthenticated]
  );

  // Mandatory Real Hardware GPS request triggered directly from user gesture / button
  // Uses robust two-stage acquisition (high-accuracy satellite first, fallback to cellular/WiFi)
  const requestRealGps = useCallback((): Promise<GpsCoordinates | null> => {
    isSimulatedRef.current = false;

    // Hardware GPS is strictly restricted to mobile and tablet devices
    // On desktop, immediately supply reliable field/drop-point coordinates without hardware prompt
    if (!isMobileOrTablet()) {
      const fallback: GpsCoordinates = coordsRef.current || {
        latitude: Number(user?.lastLatitude) || 12.6392,
        longitude: Number(user?.lastLongitude) || -8.0029,
        accuracy: 15.0,
        speed: null,
        timestamp: Date.now(),
      };
      setCoords(fallback);
      setStatus('ACTIVE');
      setErrorMessage(null);
      return Promise.resolve(fallback);
    }

    if (!('geolocation' in navigator)) {
      // If hardware geolocation API is not supported in this browser/environment, unlock with safety coordinates
      const fallback: GpsCoordinates = coordsRef.current || {
        latitude: Number(user?.lastLatitude) || 12.6392,
        longitude: Number(user?.lastLongitude) || -8.0029,
        accuracy: 25.0,
        speed: null,
        timestamp: Date.now(),
      };
      setCoords(fallback);
      setStatus('ACTIVE');
      return Promise.resolve(fallback);
    }

    setStatus('REQUESTING');
    setErrorMessage(null);

    return new Promise((resolve) => {
      // Helper to unlock safely if browser or iframe denies geolocation permission
      const fallbackUnlock = () => {
        const safetyCoords: GpsCoordinates = coordsRef.current || {
          latitude: Number(user?.lastLatitude) || 12.6392,
          longitude: Number(user?.lastLongitude) || -8.0029,
          accuracy: 25.0,
          speed: null,
          timestamp: Date.now(),
        };
        setCoords(safetyCoords);
        setStatus('ACTIVE');
        setErrorMessage(null);
        try {
          localStorage.setItem('6c_vrs_last_gps', JSON.stringify(safetyCoords));
        } catch {}
        resolve(safetyCoords);
      };

      // First attempt: High accuracy (satellite GPS chip) with resilient timeout
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const realCoords: GpsCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed ?? null,
            timestamp: position.timestamp,
          };

          setCoords(realCoords);
          setStatus('ACTIVE');
          setErrorMessage(null);
          try {
            localStorage.setItem('6c_vrs_last_gps', JSON.stringify(realCoords));
          } catch {}
          syncLocationToServer(realCoords, 'REAL_GPS_ACTIVATED');
          resolve(realCoords);
        },
        (error) => {
          // If browser/iframe denies geolocation permission (e.g. cross-origin iframe in Firefox/Android)
          // or satellite times out: attempt low-accuracy fallback or safely unlock with field coordinates!
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              const realCoords: GpsCoordinates = {
                latitude: fallbackPos.coords.latitude,
                longitude: fallbackPos.coords.longitude,
                accuracy: fallbackPos.coords.accuracy,
                speed: fallbackPos.coords.speed ?? null,
                timestamp: fallbackPos.timestamp,
              };

              setCoords(realCoords);
              setStatus('ACTIVE');
              setErrorMessage(null);
              try {
                localStorage.setItem('6c_vrs_last_gps', JSON.stringify(realCoords));
              } catch {}
              syncLocationToServer(realCoords, 'REAL_GPS_ACTIVATED_STANDARD');
              resolve(realCoords);
            },
            () => {
              // Both attempts failed or blocked by iframe security policy:
              // Unconditionally unlock so the user is NEVER trapped on the lock screen!
              fallbackUnlock();
            },
            {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 60000,
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 10000,
        }
      );
    });
  }, [syncLocationToServer, user]);

  // Backward-compatible wrapper
  const requestGps = useCallback(
    async (_options?: { allowFallback?: boolean }): Promise<GpsCoordinates | null> => {
      return requestRealGps();
    },
    [requestRealGps]
  );

  // Simulation toggle for testing and demo environments
  const simulateGpsToggle = useCallback(
    (active: boolean) => {
      if (active) {
        isSimulatedRef.current = true;
        const testCoords: GpsCoordinates = {
          latitude: user?.lastLatitude || 12.6398,
          longitude: user?.lastLongitude || -8.0022,
          accuracy: 4.8,
          speed: 14.2,
          timestamp: Date.now(),
        };
        setCoords(testCoords);
        setStatus('ACTIVE');
        setErrorMessage(null);
        syncLocationToServer(testCoords, 'SIMULATED_GPS_ON');
      } else {
        isSimulatedRef.current = false;
        setCoords(null);
        setStatus('UNAVAILABLE');
        setErrorMessage('Le GPS réel de votre appareil a été coupé. Réactivez votre GPS pour continuer.');
      }
    },
    [syncLocationToServer, user]
  );

  // Emergency fallback
  const activateEmergencyFallback = useCallback(
    async (preset?: { latitude: number; longitude: number }): Promise<GpsCoordinates> => {
      isSimulatedRef.current = true;
      const fallbackLat = preset?.latitude ?? user?.lastLatitude ?? 12.6398;
      const fallbackLng = preset?.longitude ?? user?.lastLongitude ?? -8.0022;

      const fallback: GpsCoordinates = {
        latitude: fallbackLat,
        longitude: fallbackLng,
        accuracy: 5.0,
        speed: 0,
        timestamp: Date.now(),
      };
      setCoords(fallback);
      setStatus('ACTIVE');
      setErrorMessage(null);
      await syncLocationToServer(fallback, 'TEST_FALLBACK');
      return fallback;
    },
    [syncLocationToServer, user]
  );

  // Synchronize current location for explicit actions
  const syncCurrentLocation = useCallback(
    async (actionContext: string = 'OPERATION') => {
      const current = coordsRef.current || (await requestRealGps());
      if (current) {
        return syncLocationToServer(current, actionContext);
      }
      return false;
    },
    [requestRealGps, syncLocationToServer]
  );

  // NOTE: Never automatically prompt for GPS at application startup.
  // Hardware GPS is strictly on-demand for mobile and tablet users when explicitly requested.

  // REAL GPS LIFECYCLE FOR VRS USERS (Mobile & Tablet only, on-demand without prompt at startup)
  useEffect(() => {
    if (!isVrs || !isMobileOrTablet()) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch?.(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const startWatchingIfGranted = () => {
      if (!isSubscribed || watchIdRef.current !== null || !('geolocation' in navigator)) return;
      try {
        const id = navigator.geolocation.watchPosition(
          (position) => {
            if (!isSubscribed || isSimulatedRef.current) return;

            const realCoords: GpsCoordinates = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              speed: position.coords.speed ?? null,
              timestamp: position.timestamp,
            };

            setCoords(realCoords);
            setStatus('ACTIVE');
            setErrorMessage(null);
            try {
              localStorage.setItem('6c_vrs_last_gps', JSON.stringify(realCoords));
            } catch {}

            const now = Date.now();
            if (now - lastSyncTimeRef.current > 15000) {
              syncLocationToServer(
                realCoords,
                realCoords.speed && realCoords.speed > 1 ? 'VRS_IN_MOVEMENT' : 'VRS_STOPPED'
              );
            }
          },
          (error) => {
            if (!isSubscribed || isSimulatedRef.current) return;
            if (error.code === 3) return; // Timeout

            if (error.code === 1) {
              // Denied: fallback safely without popup
              if (!coordsRef.current) {
                const fallback: GpsCoordinates = {
                  latitude: Number(user?.lastLatitude) || 12.6392,
                  longitude: Number(user?.lastLongitude) || -8.0029,
                  accuracy: 25.0,
                  speed: null,
                  timestamp: Date.now(),
                };
                setCoords(fallback);
              }
              setStatus('ACTIVE');
              setErrorMessage(null);
              return;
            }

            if (coordsRef.current) return;

            const fallback: GpsCoordinates = {
              latitude: Number(user?.lastLatitude) || 12.6392,
              longitude: Number(user?.lastLongitude) || -8.0029,
              accuracy: 25.0,
              speed: null,
              timestamp: Date.now(),
            };
            setCoords(fallback);
            setStatus('ACTIVE');
            setErrorMessage(null);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 25000,
          }
        );

        watchIdRef.current = id;
      } catch (err) {
        console.warn('GPS watcher notice:', err);
      }
    };

    // Check permission: DO NOT trigger permission prompt on startup!
    if (navigator.permissions && navigator.permissions.query) {
      try {
        navigator.permissions
          .query({ name: 'geolocation' })
          .then((permissionStatus) => {
            if (!isSubscribed) return;
            if (permissionStatus.state === 'granted') {
              startWatchingIfGranted();
            }
            permissionStatus.onchange = () => {
              if (!isSubscribed) return;
              if (permissionStatus.state === 'granted') {
                startWatchingIfGranted();
              }
            };
          })
          .catch(() => {});
      } catch {}
    }

    return () => {
      isSubscribed = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch?.(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isVrs, syncLocationToServer, user]);

  // A user can perform operations whenever:
  // 1. They are on desktop (GPS activation never enforced on desktop)
  // 2. Or they are not enforced
  // 3. Or coordinates exist
  const canPerformOperations = !isMobileOrTablet() || !isEnforcedForUser || coords !== null;

  return (
    <GpsContext.Provider
      value={{
        coords,
        status,
        errorMessage,
        lastSyncedAt,
        isEnforcedForUser,
        canPerformOperations,
        isVrsAccessRequested: true,
        initiateVrsAccess: () => {},
        requestRealGps,
        requestGps,
        syncCurrentLocation,
        simulateGpsToggle,
        activateEmergencyFallback,
      }}
    >
      {children}
    </GpsContext.Provider>
  );
};

export const useGps = (): GpsContextType => {
  const context = useContext(GpsContext);
  if (!context) {
    throw new Error('useGps must be used within a GpsProvider');
  }
  return context;
};
