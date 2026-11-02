/** Utilidades del análisis del camino (tipo de superficie y cortes) devuelto por el servicio de rutas. */

export const SURFACE_LABELS = {
  PAVED: 'Asfalto', GRAVEL: 'Ripio', DIRT: 'Tierra', MIXED: 'Mixto', UNKNOWN: 'Sin datos',
};
export const CONFIDENCE_LABELS = { HIGH: 'Confianza alta', MEDIUM: 'Confianza media', LOW: 'Confianza baja' };
export const CLOSURE_LABELS = { CLOSED: 'Cortada', PARTIAL: 'Corte parcial', WORKS: 'Obras', RISK: 'Riesgo' };
export const UNPAVED_LABELS = {
  NONE: 'Sin tramos sin asfaltar conocidos',
  LOW: 'Pocos tramos sin asfaltar',
  MEDIUM: 'Varios tramos sin asfaltar',
  HIGH: 'Gran parte sin asfaltar',
  UNKNOWN: 'Estado del pavimento sin verificar',
};

const MAX_STORED_CHARS = 60_000;
const text = (value, max) => String(value ?? '').slice(0, max);

/**
 * Valida y recorta un análisis antes de guardarlo o mostrarlo. Devuelve null si
 * no hay nada utilizable. Nunca confía en el formato: viene de la red o de un backup.
 */
export function normalizeRoadAnalysis(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.routes)) return null;
  const routes = value.routes.slice(0, 3).map((entry) => ({
    routeIndex: Number.isInteger(entry?.routeIndex) ? entry.routeIndex : 0,
    summary: text(entry?.summary, 600),
    unpavedLikelihood: UNPAVED_LABELS[entry?.unpavedLikelihood] ? entry.unpavedLikelihood : 'UNKNOWN',
    segments: (Array.isArray(entry?.segments) ? entry.segments : []).slice(0, 12).map((segment) => ({
      road: text(segment?.road, 120),
      surface: SURFACE_LABELS[segment?.surface] ? segment.surface : 'UNKNOWN',
      confidence: CONFIDENCE_LABELS[segment?.confidence] ? segment.confidence : 'LOW',
      note: text(segment?.note, 300),
    })).filter((segment) => segment.road),
    closures: (Array.isArray(entry?.closures) ? entry.closures : []).slice(0, 8).map((closure) => ({
      road: text(closure?.road, 120),
      status: CLOSURE_LABELS[closure?.status] ? closure.status : 'RISK',
      description: text(closure?.description, 400),
      asOf: text(closure?.asOf, 60),
    })).filter((closure) => closure.road && closure.description),
    recommendations: (Array.isArray(entry?.recommendations) ? entry.recommendations : []).slice(0, 6).map((item) => text(item, 300)).filter(Boolean),
  })).filter((entry) => entry.summary);

  const avoidWarnings = (Array.isArray(value.avoidWarnings) ? value.avoidWarnings : []).slice(0, 6)
    .map((warning) => ({ routeIndex: Number.isInteger(warning?.routeIndex) ? warning.routeIndex : 0, message: text(warning?.message, 300) }))
    .filter((warning) => warning.message);

  if (!routes.length && !avoidWarnings.length) return null;
  const normalized = {
    routes,
    avoidWarnings,
    sources: (Array.isArray(value.sources) ? value.sources : []).slice(0, 8)
      .map((source) => ({ title: text(source?.title, 120), uri: text(source?.uri, 400) }))
      .filter((source) => /^https?:\/\//i.test(source.uri)),
    generatedAt: text(value.generatedAt, 40),
    grounded: Boolean(value.grounded),
  };
  return JSON.stringify(normalized).length > MAX_STORED_CHARS ? null : normalized;
}

/** Análisis aplicable a una alternativa concreta (o null). */
export function analysisForRoute(analysis, routeIndex) {
  const normalized = normalizeRoadAnalysis(analysis);
  if (!normalized) return null;
  const entry = normalized.routes.find((item) => item.routeIndex === routeIndex) || null;
  const warnings = normalized.avoidWarnings.filter((warning) => warning.routeIndex === routeIndex).map((warning) => warning.message);
  if (!entry && !warnings.length) return null;
  return { ...(entry || { routeIndex, summary: '', unpavedLikelihood: 'UNKNOWN', segments: [], closures: [], recommendations: [] }), avoidWarnings: warnings, sources: normalized.sources, generatedAt: normalized.generatedAt, grounded: normalized.grounded };
}

export function formatGeneratedAt(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(date);
}
