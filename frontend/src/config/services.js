const DEFAULT_ROUTE_API_URL = 'https://rutas-gastos-route-service.onrender.com/api';

function normalizeRouteApiUrl(value) {
  const candidate = String(value || DEFAULT_ROUTE_API_URL).trim();
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    const isLocalHttp = parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !isLocalHttp) return '';

    let path = parsed.pathname;
    while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    parsed.pathname = !path || path === '/'
      ? '/api'
      : path.endsWith('/api')
        ? path
        : `${path}/api`;
    parsed.search = '';
    parsed.hash = '';
    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return '';
  }
}

// La URL del backend es pública (no es una credencial). El valor de Vercel
// puede sobrescribir el endpoint predeterminado sin recompilar el código fuente.
export const ROUTE_API_URL = normalizeRouteApiUrl(import.meta.env.VITE_ROUTE_API_URL);
export const ROUTE_SERVICE_CONFIGURED = Boolean(ROUTE_API_URL);
export const GOOGLE_MAPS_BROWSER_KEY_CONFIGURED = Boolean(
  String(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || '').trim(),
);
