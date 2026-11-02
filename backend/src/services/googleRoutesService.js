import { HttpError } from '../utils/httpError.js';

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const FIELD_MASK = [
  'routes.description',
  'routes.distanceMeters',
  'routes.duration',
  'routes.polyline.encodedPolyline',
  'routes.legs.distanceMeters',
  'routes.legs.duration',
  'routes.legs.startLocation',
  'routes.legs.endLocation',
  'routes.legs.steps.navigationInstruction.instructions',
  'routes.routeLabels',
  'routes.travelAdvisory.tollInfo',
  'routes.localizedValues.distance',
  'routes.localizedValues.duration',
].join(',');

export async function computeGoogleRoutes(intent) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new HttpError(503, 'Google Routes API no está configurada. Configure GOOGLE_MAPS_API_KEY.');

  const body = {
    origin: { address: intent.origin },
    destination: { address: intent.destination },
    intermediates: intent.waypoints.map((address) => ({ address })),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: intent.waypoints.length === 0,
    optimizeWaypointOrder: Boolean(intent.optimizeWaypointOrder && intent.waypoints.length > 1),
    languageCode: 'es-AR',
    units: 'METRIC',
    // Para salida inmediata se omite departureTime: Google Routes toma el momento de recepción.
    routeModifiers: {
      avoidTolls: intent.avoidTolls,
      avoidHighways: intent.avoidHighways,
    },
  };

  const fieldMask = FIELD_MASK.split(',');
  if (intent.optimizeWaypointOrder && intent.waypoints.length > 1) {
    fieldMask.push('routes.optimizedIntermediateWaypointIndex');
  }

  let response;
  try {
    response = await fetch(ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask.join(','),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    // Network failures and timeouts would otherwise surface as an opaque 500.
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw new HttpError(
      timedOut ? 504 : 502,
      timedOut
        ? 'Google Routes tardó demasiado en responder. Volvé a intentar.'
        : 'No se pudo conectar con Google Routes. Volvé a intentar en unos momentos.',
      undefined,
      { code: timedOut ? 'ROUTES_PROVIDER_TIMEOUT' : 'ROUTES_PROVIDER_UNREACHABLE', retryable: true, expose: true },
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || 'Google Routes API no pudo calcular el recorrido.';
    throw new HttpError(response.status === 429 ? 429 : 502, message);
  }

  const routes = (payload.routes || []).map((route, index) => {
    const durationSeconds = Number.parseInt(String(route.duration || '0s').replace('s', ''), 10) || 0;
    return {
      provider: 'google-routes',
      optionIndex: index,
      description: route.description || `Alternativa ${index + 1}`,
      distanceMeters: Number(route.distanceMeters || 0),
      durationSeconds,
      encodedPolyline: route.polyline?.encodedPolyline || '',
      legs: (route.legs || []).map((leg) => ({
        distanceMeters: Number(leg.distanceMeters || 0),
        duration: leg.duration || '0s',
        startLocation: leg.startLocation || null,
        endLocation: leg.endLocation || null,
        instructions: (leg.steps || []).map((step) => step.navigationInstruction?.instructions).filter(Boolean),
      })),
      tollInfo: route.travelAdvisory?.tollInfo || null,
      labels: route.routeLabels || [],
      optimizedIntermediateWaypointIndex: route.optimizedIntermediateWaypointIndex || [],
      roadSurfaceStatus: 'UNVERIFIED',
      closureStatus: 'TRAFFIC_ESTIMATE_ONLY',
      calculatedAt: new Date().toISOString(),
    };
  }).filter((route) => route.encodedPolyline && route.distanceMeters > 0 && route.durationSeconds > 0);

  if (!routes.length) throw new HttpError(404, 'Google no encontró rutas para las ubicaciones indicadas. Revisá origen, destino y paradas.');
  return routes;
}
