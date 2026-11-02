import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeUserNotes } from '../src/services/aiRoutePlanner.js';

test('drops notes that echo internal instructions', () => {
  const notes = [
    'Recorrido obligatorio y en este orden: A a B.',
    'El usuario ya definió el recorrido con campos estructurados.',
    'No agregues, elimines ni reordenes ninguna ubicación.',
    'Evitar peajes',
  ];
  assert.deepEqual(sanitizeUserNotes(notes), ['Evitar peajes']);
});

test('removes empty and duplicate notes, keeping order', () => {
  assert.deepEqual(sanitizeUserNotes(['Priorizar asfalto', '  ', 'priorizar asfalto', 'Evitar peajes']), ['Priorizar asfalto', 'Evitar peajes']);
});
