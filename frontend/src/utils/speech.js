/**
 * Guion de lectura en voz alta de la hoja de ruta.
 *
 * Se divide en segmentos cortos (una indicación = un segmento). Los motores de
 * síntesis cortan o se traban con textos largos, y los segmentos permiten
 * pausar, repetir y saltar entre pasos sin perder el lugar.
 */

/** Expande abreviaturas y unidades para que el motor de voz las pronuncie bien. */
export function speakable(value) {
  return String(value ?? '')
    .replace(/\bR\.?\s?N\.?\s?(\d+[A-Za-z]?)\b/g, 'Ruta Nacional $1')
    .replace(/\bR\.?\s?P\.?\s?(\d+[A-Za-z]?)\b/g, 'Ruta Provincial $1')
    .replace(/\bR\.?\s?C\.?\s?(\d+[A-Za-z]?)\b/g, 'Ruta Comunal $1')
    .replace(/\bAv\.\s?/g, 'Avenida ')
    .replace(/\bAutop\.\s?/g, 'Autopista ')
    .replace(/(\d)\s?km\b/gi, '$1 kilómetros')
    .replace(/(\d)\s?m\b/g, '$1 metros')
    .replace(/(\d+)\s?h\b/g, (_, n) => `${n} ${n === '1' ? 'hora' : 'horas'}`)
    .replace(/(\d+)\s?min\b/g, (_, n) => `${n} ${n === '1' ? 'minuto' : 'minutos'}`)
    .replace(/→|->/g, ' a ')
    .replace(/[“”«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const sentence = (text) => {
  const clean = speakable(text);
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
};

/**
 * @param {ReturnType<import('./roadSheet.js').buildRoadSheetModel>} model
 * @returns {{id: string, kind: string, label: string, text: string}[]}
 */
export function buildSpeechScript(model) {
  const segments = [];
  const add = (kind, label, text) => {
    const spoken = String(text ?? '').trim();
    if (spoken) segments.push({ id: `${kind}-${segments.length}`, kind, label, text: spoken });
  };

  add('intro', 'Resumen', `Hoja de ruta: ${speakable(model.title)}. Distancia total ${speakable(model.summary.distance)}. Duración estimada ${speakable(model.summary.duration)}.`);
  const stops = model.stops.map((stop) => `${stop.label}: ${speakable(stop.name)}`).join('. ');
  add('stops', 'Recorrido', `Recorrido en orden. ${stops}.`);

  const c = model.condition;
  if (c) {
    add('condition', 'Estado del camino', `Estado del camino. Análisis orientativo de inteligencia artificial${c.asOf ? `, ${speakable(c.asOf)}` : ''}. ${sentence(c.unpaved)} ${c.summary ? sentence(c.summary) : ''}`);
    c.avoidWarnings.forEach((warning) => add('warning', 'Atención', `Atención. ${sentence(warning)}`));
    c.closures.forEach((closure) => add('closure', `${closure.status}: ${closure.road}`, `${closure.status} en ${speakable(closure.road)}. ${sentence(closure.description)}${closure.asOf ? ` Información de ${speakable(closure.asOf)}.` : ''}`));
    const surfaces = c.segments.filter((segment) => segment.surface !== 'Sin datos');
    if (surfaces.length) {
      add('surface', 'Tipo de camino', `Tipo de camino. ${surfaces.map((segment) => `${speakable(segment.road)}: ${segment.surface.toLowerCase()}, ${segment.confidence.toLowerCase()}`).join('. ')}.`);
    }
    c.recommendations.forEach((item) => add('advice', 'Recomendación', `Recomendación. ${sentence(item)}`));
  }

  model.legs.forEach((leg) => {
    const meta = [leg.distance, leg.duration].filter(Boolean).map(speakable).join(', ');
    add('leg', leg.title, `${leg.title}: de ${speakable(leg.from)} a ${speakable(leg.to)}.${meta ? ` ${meta}.` : ''}${leg.instructions.length ? ` ${leg.instructions.length} indicaciones.` : ''}`);
    leg.instructions.forEach((instruction, index) => add('step', `${leg.title} · paso ${index + 1}`, `Paso ${index + 1}. ${sentence(instruction)}`));
  });

  add('closing', 'Fin', 'Fin de la hoja de ruta. Antes de salir, confirmá el estado de las rutas con Vialidad y las autoridades locales.');
  return segments;
}

/** Voces en español, mejor primero: es-AR, otros es-419/MX/US, luego cualquier es-*. */
export function rankSpanishVoices(voices = []) {
  const score = (voice) => {
    const lang = String(voice.lang || '').replace('_', '-').toLowerCase();
    if (lang === 'es-ar') return 0;
    if (['es-419', 'es-mx', 'es-us', 'es-uy', 'es-cl', 'es-co'].includes(lang)) return 1;
    if (lang.startsWith('es')) return 2;
    return 99;
  };
  return voices
    .filter((voice) => score(voice) < 99)
    .sort((a, b) => score(a) - score(b) || Number(b.localService) - Number(a.localService) || String(a.name).localeCompare(String(b.name)));
}
