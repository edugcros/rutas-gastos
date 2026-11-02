import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisForRoute, normalizeRoadAnalysis } from '../src/utils/roadAnalysis.js';
import { buildRoadSheetModel } from '../src/utils/roadSheet.js';
import { buildSpeechScript, rankSpanishVoices, speakable } from '../src/utils/speech.js';

const trip = { name: 'Traslado', origin: 'Neuquén', destination: 'Mendoza', waypoints: ['San Rafael'], startDate: null };
const route = {
  description: 'RN151', distanceMeters: 817686, durationSeconds: 44007,
  legs: [
    { distanceMeters: 500000, duration: '28000s', instructions: ['Tomá RN151 hacia el norte', 'Gira a la derecha en 300 m'] },
    { distanceMeters: 300000, duration: '16000s', instructions: ['Continuá por Av. San Martín'] },
  ],
};
const rawAnalysis = {
  routes: [{
    routeIndex: 0, summary: 'Mayormente asfalto con un tramo de ripio.', unpavedLikelihood: 'LOW',
    segments: [{ road: 'RP 6', surface: 'GRAVEL', confidence: 'MEDIUM', note: 'Ripio consolidado' }, { road: 'RN151', surface: 'PAVED', confidence: 'HIGH', note: '' }],
    closures: [{ road: 'RN143', status: 'CLOSED', description: 'Corte por nevada', asOf: 'nov 2026' }],
    recommendations: ['Llevá rueda de auxilio'],
  }],
  avoidWarnings: [{ routeIndex: 0, message: 'Pasa por Ruta 40.' }],
  sources: [{ title: 'Vialidad', uri: 'https://vialidad.gob.ar' }, { title: 'mala', uri: 'javascript:alert(1)' }],
  generatedAt: '2026-11-02T12:00:00Z', grounded: true,
};

test('speakable expands road names, units and abbreviations', () => {
  assert.equal(speakable('Tomá RN151 y luego RP 6'), 'Tomá Ruta Nacional 151 y luego Ruta Provincial 6');
  assert.equal(speakable('Gira en 300 m por Av. San Martín'), 'Gira en 300 metros por Avenida San Martín');
  assert.equal(speakable('817,7 km'), '817,7 kilómetros');
  assert.equal(speakable('12 h 13 min'), '12 horas 13 minutos');
  assert.equal(speakable('1 h 1 min'), '1 hora 1 minuto');
});

test('normalizeRoadAnalysis cleans untrusted data and drops unsafe links', () => {
  const normalized = normalizeRoadAnalysis(rawAnalysis);
  assert.equal(normalized.sources.length, 1);
  assert.equal(normalized.routes[0].closures[0].status, 'CLOSED');
  assert.equal(normalizeRoadAnalysis({ routes: [{ routeIndex: 0, summary: 's', unpavedLikelihood: 'WAT', segments: [{ road: 'X', surface: 'LAVA' }] }] }).routes[0].segments[0].surface, 'UNKNOWN');
  assert.equal(normalizeRoadAnalysis(null), null);
  assert.equal(normalizeRoadAnalysis({ routes: [], avoidWarnings: [] }), null);
  assert.equal(normalizeRoadAnalysis('texto'), null);
  assert.equal(normalizeRoadAnalysis({ routes: [{ routeIndex: 0, summary: 'x'.repeat(100), segments: Array.from({ length: 50 }, () => ({ road: 'r'.repeat(5000), note: 'n'.repeat(5000) })) }] }).routes[0].segments.length, 12);
});

test('analysisForRoute selects the alternative and attaches its avoid warnings', () => {
  const found = analysisForRoute(rawAnalysis, 0);
  assert.equal(found.summary, 'Mayormente asfalto con un tramo de ripio.');
  assert.deepEqual(found.avoidWarnings, ['Pasa por Ruta 40.']);
  assert.equal(analysisForRoute(rawAnalysis, 1), null);
  assert.equal(analysisForRoute(undefined, 0), null);
});

test('speech script covers every direction in order, with the condition notes before the legs', () => {
  const model = buildRoadSheetModel(trip, route, { analysis: analysisForRoute(rawAnalysis, 0) });
  const script = buildSpeechScript(model);
  const kinds = script.map((segment) => segment.kind);
  assert.equal(kinds[0], 'intro');
  assert.equal(kinds.at(-1), 'closing');
  assert.equal(kinds.filter((kind) => kind === 'step').length, 3, 'one segment per direction');
  assert.ok(kinds.indexOf('closure') < kinds.indexOf('leg'), 'closures are read before the turn-by-turn');
  assert.ok(kinds.includes('warning'));
  const first = script.find((segment) => segment.kind === 'step');
  assert.match(first.text, /^Paso 1\. Tomá Ruta Nacional 151 hacia el norte\.$/);
  assert.ok(script.every((segment) => !/RN151|\bkm\b/.test(segment.text)), 'nothing is left in a form the voice would spell out');
  assert.equal(new Set(script.map((segment) => segment.id)).size, script.length, 'segment ids are unique');
});

test('speech script without analysis has no condition segments', () => {
  const script = buildSpeechScript(buildRoadSheetModel(trip, route));
  assert.ok(!script.some((segment) => ['condition', 'closure', 'warning', 'surface', 'advice'].includes(segment.kind)));
});

test('road sheet model carries labels for the PDF and extra caveat when analyzed', () => {
  const withAnalysis = buildRoadSheetModel(trip, route, { analysis: analysisForRoute(rawAnalysis, 0) });
  assert.equal(withAnalysis.condition.closures[0].status, 'Cortada');
  assert.equal(withAnalysis.condition.segments[0].surface, 'Ripio');
  assert.ok(withAnalysis.caveats.length > buildRoadSheetModel(trip, route).caveats.length);
  assert.equal(buildRoadSheetModel(trip, route).condition, null);
});

test('voices are ranked es-AR first and non-Spanish voices are excluded', () => {
  const ranked = rankSpanishVoices([
    { name: 'English', lang: 'en-US' }, { name: 'España', lang: 'es-ES', localService: true },
    { name: 'Argentina', lang: 'es_AR', localService: false }, { name: 'México', lang: 'es-MX', localService: true },
  ]);
  assert.deepEqual(ranked.map((voice) => voice.name), ['Argentina', 'México', 'España']);
});
