import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Map as MapIcon, WifiOff } from 'lucide-react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let mapsConfigured = false;
let mapsPromise;

async function loadMaps() {
  const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
  if (!key) throw new Error('Google Maps no está configurado en esta instalación.');
  if (!mapsConfigured) {
    setOptions({ key, v: 'weekly' });
    mapsConfigured = true;
  }
  if (!mapsPromise) mapsPromise = Promise.all([importLibrary('maps'), importLibrary('geometry')]);
  return mapsPromise;
}

function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      if (index >= encoded.length || shift > 30) return [];
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 0;
    shift = 0;
    do {
      if (index >= encoded.length || shift > 30) return [];
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function OfflineRouteSketch({ routes, selectedIndex, origin, destination, online }) {
  const points = useMemo(() => decodePolyline(routes[selectedIndex]?.encodedPolyline), [routes, selectedIndex]);
  const sketch = useMemo(() => {
    if (points.length < 2) return null;
    const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const adjusted = points.map((point) => ({ x: point.lng * Math.cos((meanLat * Math.PI) / 180), y: -point.lat }));
    const minX = Math.min(...adjusted.map((p) => p.x));
    const maxX = Math.max(...adjusted.map((p) => p.x));
    const minY = Math.min(...adjusted.map((p) => p.y));
    const maxY = Math.max(...adjusted.map((p) => p.y));
    const width = Math.max(maxX - minX, 0.00001);
    const height = Math.max(maxY - minY, 0.00001);
    const pad = 70;
    const scale = Math.min((1000 - pad * 2) / width, (560 - pad * 2) / height);
    const usedWidth = width * scale;
    const usedHeight = height * scale;
    const offsetX = (1000 - usedWidth) / 2;
    const offsetY = (560 - usedHeight) / 2;
    const xy = adjusted.map((p) => ({ x: offsetX + (p.x - minX) * scale, y: offsetY + (p.y - minY) * scale }));
    return {
      path: xy.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
      start: xy[0],
      end: xy[xy.length - 1],
      pointCount: points.length,
    };
  }, [points]);

  return (
    <div className="offline-map-sketch">
      <div className="offline-map-header"><WifiOff size={15} /><span>{points.length >= 2 ? (online ? 'Esquema local de ruta guardada · sin cartografía base' : 'Ruta guardada disponible sin conexión') : 'Vista local · sin cartografía base'}</span></div>
      {sketch ? (
        <svg viewBox="0 0 1000 560" role="img" aria-label={`Esquema del recorrido desde ${origin} hasta ${destination}`}>
          <defs>
            <pattern id="offlineGrid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M 42 0 L 0 0 0 42" fill="none" stroke="#e6ebf0" strokeWidth="1" /></pattern>
            <filter id="routeShadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          <rect width="1000" height="560" fill="#f7f9fb" />
          <rect width="1000" height="560" fill="url(#offlineGrid)" />
          <path d={sketch.path} fill="none" stroke="#aac6e7" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" opacity=".5" filter="url(#routeShadow)" />
          <path d={sketch.path} fill="none" stroke="#2f80ed" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={sketch.start.x} cy={sketch.start.y} r="18" fill="#fff" stroke="#18865e" strokeWidth="8" />
          <circle cx={sketch.end.x} cy={sketch.end.y} r="18" fill="#fff" stroke="#c34c55" strokeWidth="8" />
          <g fontFamily="Arial, sans-serif" fontSize="19" fontWeight="700" fill="#26364b">
            <text x={Math.min(sketch.start.x + 24, 820)} y={Math.max(sketch.start.y - 24, 28)}>A · ORIGEN</text>
            <text x={Math.min(sketch.end.x + 24, 820)} y={Math.max(sketch.end.y - 24, 28)}>B · DESTINO</text>
          </g>
        </svg>
      ) : (
        <div className="offline-map-empty"><MapIcon size={24} /><strong>No hay geometría guardada para mostrar</strong><span>Cuando el servicio de planificación esté conectado, calculá y guardá una ruta. Su trazado podrá consultarse después sin conexión.</span></div>
      )}
      <div className="offline-map-footer">El dibujo representa la forma aproximada de la polilínea guardada. No muestra calles, desvíos ni tráfico en tiempo real.</div>
    </div>
  );
}

export default function MapCanvas({ routes = [], selectedIndex = 0, origin, destination, online = navigator.onLine, allowOnlineMap = false }) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const [error, setError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const hasKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY);
  const canLoadGoogleMaps = Boolean(online && allowOnlineMap && hasKey && routes.length > 0);

  useEffect(() => {
    let mounted = true;
    if (!canLoadGoogleMaps) {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      setGoogleAvailable(false);
      setMapReady(false);
      setError('');
      return () => { mounted = false; };
    }

    setError('');
    loadMaps()
      .then(([mapsLib]) => {
        if (!mounted || !elementRef.current) return;
        if (!mapRef.current) mapRef.current = new mapsLib.Map(elementRef.current, {
          center: { lat: -34.6037, lng: -58.3816 }, zoom: 5,
          mapTypeControl: true, streetViewControl: false, fullscreenControl: true, mapTypeId: 'roadmap',
        });
        setGoogleAvailable(Boolean(mapRef.current));
        setMapReady(true);
      })
      .catch(() => {
        if (mounted) {
          mapsPromise = null;
          setError('Google Maps no está disponible. Se conserva la vista local de la ruta guardada.');
          setGoogleAvailable(false);
        }
      });
    return () => { mounted = false; };
  }, [canLoadGoogleMaps]);

  useEffect(() => {
    if (!canLoadGoogleMaps || !mapRef.current || !window.google?.maps || !googleAvailable) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];
    const bounds = new window.google.maps.LatLngBounds();
    routes.forEach((route, index) => {
      try {
        const path = window.google.maps.geometry.encoding.decodePath(route.encodedPolyline);
        const polyline = new window.google.maps.Polyline({
          path, map: mapRef.current, clickable: false,
          strokeColor: index === selectedIndex ? '#2f80ed' : '#8b98aa',
          strokeOpacity: index === selectedIndex ? 0.95 : 0.55,
          strokeWeight: index === selectedIndex ? 6 : 4,
          zIndex: index === selectedIndex ? 3 : 1,
        });
        overlaysRef.current.push(polyline);
        path.forEach((point) => bounds.extend(point));
        if (index === selectedIndex && path.length > 1) {
          const start = new window.google.maps.Marker({ map: mapRef.current, position: path[0], label: 'A', title: 'Origen' });
          const end = new window.google.maps.Marker({ map: mapRef.current, position: path[path.length - 1], label: 'B', title: 'Destino' });
          overlaysRef.current.push(start, end);
        }
      } catch { /* Una polilínea inválida no derriba el resto de la vista. */ }
    });
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds, 48);
    else if (origin || destination) mapRef.current.setCenter({ lat: -34.6037, lng: -64.0 });
  }, [routes, selectedIndex, origin, destination, mapReady, googleAvailable, canLoadGoogleMaps]);

  const showLocalSketch = !canLoadGoogleMaps || Boolean(error) || !googleAvailable;
  return (
    <div className="map-shell">
      <div ref={elementRef} className={`map-canvas ${showLocalSketch ? 'map-canvas-hidden' : ''}`} />
      {showLocalSketch && <OfflineRouteSketch routes={routes} selectedIndex={selectedIndex} origin={origin} destination={destination} online={online} />}
      {showLocalSketch && online && error && <div className="map-online-hint"><AlertTriangle size={14} />{error}</div>}
      {canLoadGoogleMaps && !showLocalSketch && !googleAvailable && <div className="map-loading">Conectando con Google Maps…</div>}
    </div>
  );
}
