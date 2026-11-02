import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, toMinorUnits } from '../src/data/localStore.js';

test('toMinorUnits stores exact centavos for supported monetary values', () => {
  assert.equal(toMinorUnits(1500), 150000);
  assert.equal(toMinorUnits(1500.25), 150025);
  assert.equal(toMinorUnits(0.1 + 0.2), 30);
});

test('toMinorUnits rejects negative and non-finite values', () => {
  assert.throws(() => toMinorUnits(-1), /no es válido/i);
  assert.throws(() => toMinorUnits(Number.NaN), /no es válido/i);
  assert.throws(() => toMinorUnits(Number.POSITIVE_INFINITY), /no es válido/i);
});

test('financial summary deducts only expenses explicitly marked for deduction', () => {
  const trip = { income: { amountMinor: 100000, currency: 'ARS' } };
  const expenses = [
    { amountMinor: 15000, currency: 'ARS', deductFromProfit: true },
    { amountMinor: 5000, currency: 'ARS', deductFromProfit: false },
  ];
  const summary = summarize(trip, expenses);
  assert.equal(summary.initialIncome, 1000);
  assert.equal(summary.totalExpenses, 200);
  assert.equal(summary.deductibleExpenses, 150);
  assert.equal(summary.nonDeductibleExpenses, 50);
  assert.equal(summary.availableProfit, 850);
  assert.equal(summary.expenseCount, 2);
});

test('financial summary flags other currencies without silently converting them', () => {
  const trip = { income: { amountMinor: 100000, currency: 'ARS' } };
  const expenses = [
    { amountMinor: 1000, currency: 'ARS', deductFromProfit: true },
    { amountMinor: 5000, currency: 'USD', deductFromProfit: true },
  ];
  const summary = summarize(trip, expenses);
  assert.equal(summary.availableProfit, 990);
  assert.equal(summary.mixedCurrencyWarning, true);
  assert.equal(summary.expenseCount, 1);
});
