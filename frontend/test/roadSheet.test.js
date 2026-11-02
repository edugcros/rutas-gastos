import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadSheetModel, orderedStops, parseDurationSeconds, roadSheetFileName, toPdfText } from '../src/utils/roadSheet.js';

const trip = { name: 'Traslado Neuquén', origin: 'Neuquén', destination: 'Mendoza', waypoints: ['San Rafael', 'Malargüe'], startDate: null };
const route = {
  description: 'RN151',
  distanceMeters: 817686,
  durationSeconds: 44007,
  legs: [
    { distanceMeters: 100000, duration: '3600s', instructions: ['Dirígete al norte  por Av. Olascoaga', ''] },
    { distanceMeters: 200000, duration: '7200s', instructions: ['Gira a la derecha'] },
    { distanceMeters: 300000, duration: '10800s', instructions: [] },
  ],
};

test('parses Google duration strings', () => {
  assert.equal(parseDurationSeconds('3600s'), 3600);
  assert.equal(parseDurationSeconds(90), 90);
  assert.equal(parseDurationSeconds(undefined), 0);
});

test('keeps entered stop order unless Google optimized it', () => {
  assert.deepEqual(orderedStops(trip, route), ['Neuquén', 'San Rafael', 'Malargüe', 'Mendoza']);
  assert.deepEqual(orderedStops(trip, { ...route, optimizedIntermediateWaypointIndex: [1, 0] }), ['Neuquén', 'Malargüe', 'San Rafael', 'Mendoza']);
  // An index list that does not match the stops is ignored rather than trusted.
  assert.deepEqual(orderedStops(trip, { ...route, optimizedIntermediateWaypointIndex: [5, 0] }), ['Neuquén', 'San Rafael', 'Malargüe', 'Mendoza']);
});

test('builds legs between consecutive stops with cleaned instructions', () => {
  const model = buildRoadSheetModel(trip, route, { now: new Date('2026-11-02T12:00:00Z') });
  assert.equal(model.legs.length, 3);
  assert.equal(model.legs[0].from, 'Neuquén');
  assert.equal(model.legs[2].to, 'Mendoza');
  assert.deepEqual(model.legs[0].instructions, ['Dirígete al norte por Av. Olascoaga']);
  assert.equal(model.totalSteps, 2);
  assert.deepEqual(model.stops.map((stop) => stop.label), ['Origen', 'Parada 1', 'Parada 2', 'Destino']);
});

test('PDF text helpers stay within Latin-1 and make safe file names', () => {
  assert.equal(toPdfText('A → B − “x” …'), 'A -> B - "x" ...');
  assert.equal(toPdfText('Neuquén 🚗'), 'Neuquén ');
  assert.equal(roadSheetFileName({ name: 'Traslado Neuquén / Mendoza!' }), 'hoja-de-ruta-traslado-neuquen-mendoza.pdf');
  assert.equal(roadSheetFileName({ name: '???' }), 'hoja-de-ruta-viaje.pdf');
});
