import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFinancialSummary } from '../src/utils/finance.js';
import { toMinorUnits, fromMinorUnits, isValidMoneyAmount } from '../src/utils/money.js';

test('descends only expenses flagged to reduce profit', () => {
  const summary = buildFinancialSummary(
    { amountMinor: 100_000_000, currency: 'ARS' },
    [{ _id: 'ARS', totalMinor: 21_500_000, deductibleMinor: 19_500_000, nonDeductibleMinor: 2_000_000, count: 4 }],
  );
  assert.equal(summary.initialIncome, 1_000_000);
  assert.equal(summary.deductibleExpenses, 195_000);
  assert.equal(summary.nonDeductibleExpenses, 20_000);
  assert.equal(summary.availableProfit, 805_000);
});

test('does not mix currencies in a financial balance', () => {
  const summary = buildFinancialSummary(
    { amountMinor: 10_000_000, currency: 'ARS' },
    [
      { _id: 'ARS', totalMinor: 1_000_000, deductibleMinor: 800_000, nonDeductibleMinor: 200_000, count: 2 },
      { _id: 'USD', totalMinor: 10_000, deductibleMinor: 10_000, nonDeductibleMinor: 0, count: 1 },
    ],
  );
  assert.equal(summary.availableProfit, 92_000);
  assert.equal(summary.mixedCurrencyWarning, true);
});

test('allows a negative available balance when deductible expenses exceed income', () => {
  const summary = buildFinancialSummary(
    { amountMinor: 5_000_000, currency: 'ARS' },
    [{ _id: 'ARS', totalMinor: 7_000_000, deductibleMinor: 7_000_000, nonDeductibleMinor: 0, count: 3 }],
  );
  assert.equal(summary.availableProfit, -20_000);
});

test('stores decimal currency values as exact minor units', () => {
  assert.equal(toMinorUnits(1234.56), 123456);
  assert.equal(fromMinorUnits(123456), 1234.56);
  assert.equal(isValidMoneyAmount(10.999), false);
  assert.equal(isValidMoneyAmount(10.99), true);
});
