import test from 'node:test';
import assert from 'node:assert/strict';
import { updateLocalTrip } from '../src/data/localStore.js';

// These inputs are rejected before IndexedDB is opened, so no browser is needed.

test('updateLocalTrip rejects an unknown trip status', async () => {
  await assert.rejects(updateLocalTrip('trip-1', { status: 'DONE' }), /estado/i);
});

test('updateLocalTrip rejects a too-short trip name', async () => {
  await assert.rejects(updateLocalTrip('trip-1', { name: ' a ' }), /nombre/i);
});

test('updateLocalTrip rejects an unsupported currency', async () => {
  await assert.rejects(updateLocalTrip('trip-1', { incomeCurrency: 'EUR' }), /moneda/i);
});

test('updateLocalTrip reports an invalid income amount with its real message', async () => {
  await assert.rejects(updateLocalTrip('trip-1', { incomeAmount: 'abc' }), /importe no es válido/i);
  await assert.rejects(updateLocalTrip('trip-1', { incomeAmount: -5 }), /importe no es válido/i);
});
