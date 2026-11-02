import { dateLabel, distance, duration } from '../utils.js';
import { CLOSURE_LABELS, CONFIDENCE_LABELS, SURFACE_LABELS, UNPAVED_LABELS, formatGeneratedAt } from './roadAnalysis.js';

const DEFAULT_CAVEATS = [
  'La distancia y la duración son estimaciones de Google Routes y pueden variar.',
  'La condición de pavimentación no está verificada. No se presume que un tramo sin datos sea asfaltado.',
  'El tráfico estimado no equivale a un listado oficial de cortes. Confirmá restricciones con Vialidad y autoridades locales antes de salir.',
];

/** Google devuelve duraciones como "1234s"; también aceptamos números. */
export function parseDurationSeconds(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const seconds = Number.parseInt(String(value ?? '').replace('s', ''), 10);
  return Number.isFinite(seconds) ? seconds : 0;
}

/**
 * Ordena las ubicaciones tal como las recorre la ruta. Si Google optimizó el
 * orden de las paradas, el índice devuelto manda sobre el orden ingresado.
 */
export function orderedStops(trip, route) {
  const waypoints = trip.waypoints || [];
  const optimized = route?.optimizedIntermediateWaypointIndex;
  const middle = Array.isArray(optimized) && optimized.length === waypoints.length && optimized.every((index) => waypoints[index] !== undefined)
    ? optimized.map((index) => waypoints[index])
    : waypoints;
  return [trip.origin, ...middle, trip.destination];
}

/** Modelo del documento, sin dependencias de renderizado (testeable en Node). */
/** `analysis` es el resultado de analysisForRoute() para la alternativa elegida (o null). */
export function buildRoadSheetModel(trip, route, { now = new Date(), analysis = null } = {}) {
  const stops = orderedStops(trip, route);
  const legs = (route.legs || []).map((leg, index) => ({
    title: `Tramo ${index + 1}`,
    from: stops[index] || '',
    to: stops[index + 1] || '',
    distance: leg.distanceMeters ? distance(leg.distanceMeters) : '',
    duration: parseDurationSeconds(leg.duration) ? duration(parseDurationSeconds(leg.duration)) : '',
    instructions: (leg.instructions || []).map((text) => String(text).replace(/\s+/g, ' ').trim()).filter(Boolean),
  }));

  return {
    title: trip.name,
    generatedAt: new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeStyle: 'short' }).format(now),
    startDate: trip.startDate ? dateLabel(trip.startDate) : 'Sin fecha',
    description: route.description || '',
    summary: { distance: distance(route.distanceMeters), duration: duration(route.durationSeconds) },
    stops: stops.map((name, index) => ({
      label: index === 0 ? 'Origen' : index === stops.length - 1 ? 'Destino' : `Parada ${index}`,
      name,
    })),
    condition: analysis ? {
      summary: analysis.summary,
      unpaved: UNPAVED_LABELS[analysis.unpavedLikelihood] || UNPAVED_LABELS.UNKNOWN,
      segments: analysis.segments.map((segment) => ({ road: segment.road, surface: SURFACE_LABELS[segment.surface], confidence: CONFIDENCE_LABELS[segment.confidence], note: segment.note })),
      closures: analysis.closures.map((closure) => ({ road: closure.road, status: CLOSURE_LABELS[closure.status], description: closure.description, asOf: closure.asOf })),
      recommendations: analysis.recommendations,
      avoidWarnings: analysis.avoidWarnings,
      sources: analysis.sources,
      asOf: formatGeneratedAt(analysis.generatedAt),
      liveData: analysis.mode !== 'knowledge',
    } : null,
    legs,
    totalSteps: legs.reduce((sum, leg) => sum + leg.instructions.length, 0),
    caveats: analysis ? [...DEFAULT_CAVEATS, 'El estado del camino fue analizado por una IA con búsqueda web: es orientativo, puede estar desactualizado y no reemplaza a las fuentes oficiales.'] : DEFAULT_CAVEATS,
  };
}

/** jsPDF usa fuentes Latin-1: reemplaza símbolos fuera de ese rango. */
export function toPdfText(value) {
  return String(value ?? '')
    .replace(/[→⟶➜]/g, '->')
    .replace(/[−–—]/g, '-')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\n -ÿ]/g, '');
}

export function roadSheetFileName(trip) {
  const slug = String(trip.name || 'viaje')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'viaje';
  return `hoja-de-ruta-${slug}.pdf`;
}

const COLORS = {
  ink: [16, 24, 40],
  muted: [102, 112, 133],
  line: [228, 231, 236],
  brand: [50, 72, 200],
  soft: [245, 246, 248],
};

/** Genera y descarga el PDF. jsPDF se carga bajo demanda para no pesar en el arranque. */
export async function downloadRoadSheet(trip, route, options = {}) {
  const { jsPDF } = await import('jspdf');
  const model = buildRoadSheetModel(trip, route, options);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const bottom = pageHeight - 18;
  let y = margin;

  const setColor = (rgb) => doc.setTextColor(...rgb);
  const ensure = (height) => {
    if (y + height > bottom) {
      doc.addPage();
      y = margin;
    }
  };
  const lines = (text, width, size, style = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    return doc.splitTextToSize(toPdfText(text), width);
  };
  const write = (text, { size = 10, style = 'normal', color = COLORS.ink, x = margin, width = contentWidth, gap = 1.6 } = {}) => {
    const wrapped = lines(text, width, size, style);
    const lineHeight = size * 0.45;
    ensure(wrapped.length * lineHeight);
    setColor(color);
    doc.text(wrapped, x, y + size * 0.32);
    y += wrapped.length * lineHeight + gap;
  };
  const rule = () => {
    doc.setDrawColor(...COLORS.line);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  };

  // Encabezado
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, pageWidth, 4, 'F');
  y = margin + 2;
  write('HOJA DE RUTA', { size: 9, style: 'bold', color: COLORS.brand, gap: 1 });
  write(model.title, { size: 20, style: 'bold', gap: 2 });
  write(`Inicio: ${model.startDate}   |   Generada: ${model.generatedAt}`, { size: 9, color: COLORS.muted, gap: 5 });

  // Resumen
  const boxHeight = 16;
  doc.setFillColor(...COLORS.soft);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'F');
  [['Distancia', model.summary.distance], ['Duración estimada', model.summary.duration], ['Paradas intermedias', String(Math.max(model.stops.length - 2, 0))], ['Indicaciones', String(model.totalSteps)]].forEach(([label, value], index) => {
    const x = margin + 4 + index * (contentWidth / 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setColor(COLORS.muted);
    doc.text(label, x, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); setColor(COLORS.ink);
    doc.text(toPdfText(value), x, y + 12);
  });
  y += boxHeight + 7;

  // Recorrido
  write('Recorrido en orden', { size: 12, style: 'bold', gap: 3 });
  model.stops.forEach((stop, index) => {
    const text = toPdfText(stop.name);
    const wrapped = lines(text, contentWidth - 34, 10);
    ensure(wrapped.length * 4.6 + 2);
    doc.setDrawColor(...COLORS.brand);
    doc.setFillColor(...(index === 0 ? COLORS.brand : [255, 255, 255]));
    doc.circle(margin + 2, y + 2.2, 1.7, index === 0 ? 'F' : 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setColor(COLORS.muted);
    doc.text(toPdfText(stop.label), margin + 8, y + 3);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setColor(COLORS.ink);
    doc.text(wrapped, margin + 32, y + 3);
    y += wrapped.length * 4.6 + 2;
  });
  y += 3;
  rule();

  // Estado del camino (análisis IA)
  if (model.condition) {
    const c = model.condition;
    write('Estado del camino', { size: 12, style: 'bold', gap: 1 });
    write(`Análisis orientativo con IA${c.asOf ? ` (${c.asOf})` : ''}. ${c.unpaved}.${c.liveData ? '' : ' Sin datos en vivo: cortes y obras NO verificados.'}`, { size: 9, color: COLORS.muted, gap: 2.5 });
    if (c.summary) write(c.summary, { size: 10, gap: 3 });
    c.avoidWarnings.forEach((item) => write(`ATENCIÓN: ${item}`, { size: 10, style: 'bold', color: [180, 35, 24], gap: 2 }));
    c.closures.forEach((closure) => write(`${closure.status.toUpperCase()} - ${closure.road}: ${closure.description}${closure.asOf ? ` (${closure.asOf})` : ''}`, { size: 9.5, style: 'bold', color: [181, 71, 8], x: margin + 2, width: contentWidth - 4, gap: 1.6 }));
    c.segments.forEach((segment) => write(`${segment.road}: ${segment.surface} (${segment.confidence.toLowerCase()})${segment.note ? ` - ${segment.note}` : ''}`, { size: 9.5, x: margin + 2, width: contentWidth - 4, gap: 1.4 }));
    if (c.recommendations.length) write('Recomendaciones', { size: 10, style: 'bold', gap: 1.2 });
    c.recommendations.forEach((item) => write(`-  ${item}`, { size: 9.5, x: margin + 2, width: contentWidth - 4, gap: 1.2 }));
    if (c.sources.length) write(`Fuentes consultadas: ${c.sources.map((source) => source.title).join('; ')}`, { size: 8, color: COLORS.muted, gap: 2 });
    y += 2;
    rule();
  }

  // Indicaciones por tramo
  write('Indicaciones por tramo', { size: 12, style: 'bold', gap: 3 });
  if (!model.legs.some((leg) => leg.instructions.length)) {
    write('Esta ruta no incluye indicaciones paso a paso.', { color: COLORS.muted });
  }
  model.legs.forEach((leg) => {
    ensure(18);
    doc.setFillColor(...COLORS.soft);
    doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setColor(COLORS.ink);
    doc.text(toPdfText(`${leg.title}: ${leg.from} -> ${leg.to}`), margin + 3, y + 6, { maxWidth: contentWidth - 50 });
    const meta = [leg.distance, leg.duration].filter(Boolean).join('  |  ');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setColor(COLORS.muted);
    doc.text(toPdfText(meta), pageWidth - margin - 3, y + 6, { align: 'right' });
    y += 12;

    leg.instructions.forEach((instruction, index) => {
      const wrapped = lines(instruction, contentWidth - 14, 9.5);
      ensure(wrapped.length * 4.3 + 1.6);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setColor(COLORS.brand);
      doc.text(`${index + 1}.`, margin + 6, y + 3, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); setColor(COLORS.ink);
      doc.text(wrapped, margin + 9, y + 3);
      y += wrapped.length * 4.3 + 1.6;
    });
    y += 4;
  });

  // Advertencias
  ensure(30);
  rule();
  write('Antes de salir', { size: 12, style: 'bold', gap: 2 });
  model.caveats.forEach((item) => write(`-  ${item}`, { size: 9, color: COLORS.muted, x: margin + 2, width: contentWidth - 4, gap: 1.2 }));

  // Pie de página con numeración
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setColor(COLORS.muted);
    doc.text('Rutas & Gastos', margin, pageHeight - 9);
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
  }

  doc.save(roadSheetFileName(trip));
  return model;
}
