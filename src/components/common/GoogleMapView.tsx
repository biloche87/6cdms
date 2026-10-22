import React, { useEffect, useRef, useState } from 'react';
import { MapPin, ExternalLink, Navigation, Compass, Layers, Info } from 'lucide-react';

export interface MapMarker {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  color?: string; // 'red' | 'emerald' | 'cyan' | 'amber' | 'purple' | 'blue'
  badge?: string;
  iconType?: 'pos' | 'vrs';
  onClick?: () => void;
}

export interface PathCoordinate {
  lat: number;
  lng: number;
  label?: string;
  time?: string;
}

interface GoogleMapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  pathCoordinates?: PathCoordinate[];
  pathColor?: string;
  selectedMarkerId?: string | number | null;
  interactive?: boolean; // If true, clicking sets pin
  onLocationSelect?: (coords: { lat: number; lng: number }) => void;
  height?: string;
  title?: string;
  showSatelliteToggle?: boolean;
}

declare global {
  interface Window {
    google?: any;
    __googleMapsLoadingPromise?: Promise<void>;
  }
}

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  center,
  zoom = 14,
  markers = [],
  pathCoordinates = [],
  pathColor = '#3b82f6',
  selectedMarkerId = null,
  interactive = false,
  onLocationSelect,
  height = '350px',
  title,
  showSatelliteToggle = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const selectionMarkerRef = useRef<any>(null);

  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [isApiLoaded, setIsApiLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [pinPos, setPinPos] = useState<{ lat: number; lng: number }>(center);

  // Synchronize pin position with center
  useEffect(() => {
    if (center && (center.lat !== pinPos.lat || center.lng !== pinPos.lng)) {
      setPinPos(center);
      if (mapInstanceRef.current && isApiLoaded) {
        mapInstanceRef.current.setCenter({ lat: center.lat, lng: center.lng });
      }
    }
  }, [center.lat, center.lng]);

  // Load Google Maps script safely
  useEffect(() => {
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;

    if (window.google?.maps) {
      setIsApiLoaded(true);
      return;
    }

    if (!apiKey) {
      // No key declared: use high-fidelity Google Maps embed fallback
      setLoadError(true);
      return;
    }

    if (!window.__googleMapsLoadingPromise) {
      window.__googleMapsLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
      });
    }

    window.__googleMapsLoadingPromise
      .then(() => {
        setIsApiLoaded(true);
      })
      .catch((err) => {
        console.warn('Google Maps JS API load failed, using Google Maps Embed fallback:', err);
        setLoadError(true);
      });
  }, []);

  // Initialize native Google Map if script succeeded
  useEffect(() => {
    if (!isApiLoaded || !mapContainerRef.current || !window.google?.maps) return;

    try {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom,
        mapTypeId: mapType,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#374151' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1f2937' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
        ],
      });

      mapInstanceRef.current = map;

      // Click listener for interactive placement
      if (interactive && onLocationSelect) {
        map.addListener('click', (e: any) => {
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();
          setPinPos({ lat: newLat, lng: newLng });
          onLocationSelect({ lat: newLat, lng: newLng });

          if (selectionMarkerRef.current) {
            selectionMarkerRef.current.setPosition(e.latLng);
          } else {
            selectionMarkerRef.current = new window.google.maps.Marker({
              position: e.latLng,
              map,
              draggable: true,
              icon: {
                path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: '#ef4444',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#ffffff',
              },
            });
            selectionMarkerRef.current.addListener('dragend', (ev: any) => {
              const dragLat = ev.latLng.lat();
              const dragLng = ev.latLng.lng();
              setPinPos({ lat: dragLat, lng: dragLng });
              onLocationSelect({ lat: dragLat, lng: dragLng });
            });
          }
        });
      }
    } catch (err) {
      console.error('Error creating Google Map instance:', err);
      setLoadError(true);
    }
  }, [isApiLoaded]);

  // Synchronize Map Type
  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps) {
      mapInstanceRef.current.setMapTypeId(mapType);
    }
  }, [mapType]);

  // Synchronize Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    markers.forEach((m) => {
      let iconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
      if (m.color === 'blue' || m.color === 'cyan') {
        iconUrl = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
      } else if (m.color === 'purple') {
        iconUrl = 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png';
      } else if (m.color === 'emerald' || m.color === 'green') {
        iconUrl = 'https://maps.google.com/mapfiles/ms/icons/green-dot.png';
      } else if (m.color === 'amber' || m.color === 'yellow') {
        iconUrl = 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
      }

      const marker = new window.google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: mapInstanceRef.current,
        title: m.title,
        icon: iconUrl,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="color:#0f172a;font-family:sans-serif;padding:6px;max-width:220px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.color === 'blue' || m.color === 'cyan' ? '#0284c7' : '#10b981'}"></span>
              <b style="font-size:13px;color:#0f172a">${m.title}</b>
            </div>
            ${m.subtitle ? `<div style="font-size:11px;color:#475569;margin-top:2px">${m.subtitle}</div>` : ''}
            ${m.badge ? `<div style="font-size:10px;font-weight:bold;margin-top:4px;padding:2px 6px;border-radius:4px;display:inline-block;background:#f1f5f9;color:#0284c7">${m.badge}</div>` : ''}
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
        if (m.onClick) m.onClick();
      });

      markersRef.current.push(marker);
    });
  }, [markers, isApiLoaded]);

  // Synchronize Polyline (Trajectory path)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (pathCoordinates && pathCoordinates.length > 1) {
      const linePath = pathCoordinates.map((p) => ({ lat: p.lat, lng: p.lng }));
      polylineRef.current = new window.google.maps.Polyline({
        path: linePath,
        geodesic: true,
        strokeColor: pathColor,
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map: mapInstanceRef.current,
      });

      // Fit map to show full route
      try {
        const bounds = new window.google.maps.LatLngBounds();
        linePath.forEach((pt) => bounds.extend(pt));
        mapInstanceRef.current.fitBounds(bounds);
      } catch {}
    }
  }, [pathCoordinates, pathColor, isApiLoaded]);

  const googleMapsUrl = `https://www.google.com/maps?q=${pinPos.lat},${pinPos.lng}&z=${zoom}`;
  const embedUrl = `https://maps.google.com/maps?q=${pinPos.lat},${pinPos.lng}&t=${mapType === 'satellite' ? 'k' : 'm'}&z=${zoom}&output=embed`;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner group">
      {/* Map Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          {title && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-700/80 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              <span>{title}</span>
            </div>
          )}
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-700/80 text-slate-300 font-mono text-[11px] shadow-lg">
            {pinPos.lat.toFixed(5)}, {pinPos.lng.toFixed(5)}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {showSatelliteToggle && (
            <button
              type="button"
              onClick={() => setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700/80 shadow-lg flex items-center gap-1.5 transition"
              title="Basculer Vue Satellite / Plan"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{mapType === 'roadmap' ? 'Satellite' : 'Plan'}</span>
            </button>
          )}

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-lg transition"
            title="Ouvrir dans Google Maps (Nouvel onglet)"
          >
            <ExternalLink className="w-4 h-4 text-emerald-400" />
          </a>
        </div>
      </div>

      {/* Main Map Viewport */}
      {isApiLoaded && !loadError ? (
        <div ref={mapContainerRef} style={{ height, width: '100%' }} />
      ) : (
        /* High-fidelity Google Maps Embed Engine */
        <div className="relative" style={{ height }}>
          <iframe
            title="Google Maps"
            src={embedUrl}
            width="100%"
            height="100%"
            style={{ border: 0, filter: mapType === 'roadmap' ? 'brightness(0.9) contrast(1.05)' : 'none' }}
            loading="lazy"
            allowFullScreen
          />
          {interactive && (
            <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
              <div className="pointer-events-auto p-2.5 rounded-xl bg-slate-900/95 backdrop-blur border border-slate-700 text-[11px] text-slate-300 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Position GPS sélectionnée : <strong className="text-white font-mono">{pinPos.lat.toFixed(5)}, {pinPos.lng.toFixed(5)}</strong></span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Carte Google Map Active</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Marker Legend Overlay (if multiple markers) */}
      {markers.length > 0 && (
        <div className="absolute bottom-2 left-2 z-10 max-w-md pointer-events-none">
          <div className="pointer-events-auto px-2.5 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span><strong>{markers.length}</strong> emplacement(s) géo-référencé(s)</span>
          </div>
        </div>
      )}
    </div>
  );
};
