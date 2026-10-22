import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, AlertCircle } from 'lucide-react';

interface InteractivePosMapProps {
  latitude: number;
  longitude: number;
  onCoordsChange: (lat: number, lng: number) => void;
}

// Icône de repère stylisée et robuste (aucun chargement réseau, fonctionne 100% hors-ligne)
const pinIcon = L.divIcon({
  className: 'pos-map-pin',
  html: `<div style="
    width: 32px;
    height: 32px;
    background: #DC2626;
    border: 3px solid #FFFFFF;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 4px 8px rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <div style="width: 10px; height: 10px; background: #FFFFFF; border-radius: 50%;"></div>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const InteractivePosMapComponent: React.FC<InteractivePosMapProps> = ({
  latitude,
  longitude,
  onCoordsChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const googleMapRef = useRef<any>(null);
  const googleMarkerRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);

  // Synchronisation du repère quand les coordonnées changent (sans recréer la carte)
  useEffect(() => {
    if (markerRef.current) {
      const current = markerRef.current.getLatLng();
      if (Math.abs(current.lat - latitude) > 0.00001 || Math.abs(current.lng - longitude) > 0.00001) {
        markerRef.current.setLatLng([latitude, longitude]);
        mapInstanceRef.current?.panTo([latitude, longitude]);
      }
    }
    if (googleMarkerRef.current && window.google?.maps) {
      const pos = googleMarkerRef.current.getPosition();
      if (pos && (Math.abs(pos.lat() - latitude) > 0.00001 || Math.abs(pos.lng() - longitude) > 0.00001)) {
        googleMarkerRef.current.setPosition({ lat: latitude, lng: longitude });
        googleMapRef.current?.panTo({ lat: latitude, lng: longitude });
      }
    }
  }, [latitude, longitude]);

  // Initialisation unique de la carte (Google Maps si clé configurée, sinon Leaflet + OSM)
  useEffect(() => {
    let isCancelled = false;
    const container = containerRef.current;
    if (!container) return;

    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;

    // Fonction d'initialisation Leaflet
    const initLeaflet = () => {
      try {
        if (mapInstanceRef.current) return;

        const map = L.map(container, {
          center: [latitude, longitude],
          zoom: 16,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        const marker = L.marker([latitude, longitude], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        // Déplacement du marqueur (dragend)
        marker.on('dragend', () => {
          const latlng = marker.getLatLng();
          onCoordsChange(latlng.lat, latlng.lng);
        });

        // Clic sur la carte pour déplacer le repère
        map.on('click', (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          onCoordsChange(lat, lng);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;

        if (!isCancelled) {
          setIsLoading(false);
          // Déclenche un resize après l'ouverture pour éviter les tuiles grises
          setTimeout(() => {
            map.invalidateSize();
          }, 150);
          setTimeout(() => {
            map.invalidateSize();
          }, 450);
        }
      } catch (err: any) {
        console.warn('[InteractivePosMap] Erreur Leaflet:', err);
        if (!isCancelled) {
          setIsLoading(false);
          setMapError("Impossible de charger la carte en ligne. Vos coordonnées GPS restent valides.");
        }
      }
    };

    // Si clé Google Maps valide présente
    if (apiKey && apiKey !== 'MY_GOOGLE_MAPS_KEY') {
      const loadGoogleMaps = () => {
        if (window.google?.maps) {
          try {
            const map = new window.google.maps.Map(container, {
              center: { lat: latitude, lng: longitude },
              zoom: 16,
              mapTypeControl: false,
              streetViewControl: false,
            });

            const marker = new window.google.maps.Marker({
              position: { lat: latitude, lng: longitude },
              map,
              draggable: true,
            });

            marker.addListener('dragend', () => {
              const pos = marker.getPosition();
              if (pos) onCoordsChange(pos.lat(), pos.lng());
            });

            map.addListener('click', (e: any) => {
              if (e.latLng) {
                marker.setPosition(e.latLng);
                onCoordsChange(e.latLng.lat(), e.latLng.lng());
              }
            });

            googleMapRef.current = map;
            googleMarkerRef.current = marker;

            if (!isCancelled) {
              setIsLoading(false);
              setTimeout(() => {
                window.google?.maps?.event?.trigger(map, 'resize');
              }, 150);
              setTimeout(() => {
                window.google?.maps?.event?.trigger(map, 'resize');
              }, 450);
            }
          } catch {
            initLeaflet();
          }
        } else {
          // Chargement du script Google Maps
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
          script.async = true;
          script.onload = () => {
            if (!isCancelled) loadGoogleMaps();
          };
          script.onerror = () => {
            if (!isCancelled) initLeaflet();
          };
          document.head.appendChild(script);
        }
      };

      loadGoogleMaps();
    } else {
      // Aucun token Google : Leaflet + OpenStreetMap direct
      initLeaflet();
    }

    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
      if (googleMapRef.current && window.google?.maps) {
        window.google.maps.event?.trigger(googleMapRef.current, 'resize');
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
      googleMapRef.current = null;
      googleMarkerRef.current = null;
    };
  }, []); // Dépendances vides : carte créée une seule fois

  return (
    <div className="relative w-full min-w-0 box-border">
      {/* Squelette de la même hauteur pendant le chargement */}
      {isLoading && (
        <div className="absolute inset-0 z-10 h-[320px] sm:h-[400px] lg:h-[440px] w-full rounded-[16px] bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-2 text-slate-400 box-border">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <span className="text-xs font-medium">Chargement de la carte interactive...</span>
        </div>
      )}

      {/* Message d'erreur si la carte ne peut pas charger (offline, etc.) */}
      {mapError && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-[16px] text-xs text-amber-300 flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{mapError}</span>
        </div>
      )}

      {/* Conteneur de la carte : Hauteur 320 px mobile, 400 px tablette, 440 px PC, 100% largeur, rayon 16 px */}
      <div
        ref={containerRef}
        className="h-[320px] sm:h-[400px] lg:h-[440px] w-full max-w-full rounded-[16px] overflow-hidden border border-slate-800 bg-slate-950 z-0 box-border"
      />
    </div>
  );
};

export const InteractivePosMap = React.memo(InteractivePosMapComponent);
export default InteractivePosMap;
