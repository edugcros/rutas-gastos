import { fromMinorUnits } from './money.js';

/** Financial calculations run entirely on integer minor units (centavos). */
export function buildFinancialSummary(income = {}, expenseGroups = []) {
  const currency = income.currency || 'ARS';
  const matching = expenseGroups.find((group) => group._id === currency);
  const totals = matching || { totalMinor: 0, deductibleMinor: 0, nonDeductibleMinor: 0, count: 0 };
  const initialMinor = Number(income.amountMinor || 0);
  const deductibleMinor = Number(totals.deductibleMinor || 0);
  return {
    currency,
    initialIncome: fromMinorUnits(initialMinor),
    totalExpenses: fromMinorUnits(totals.totalMinor),
    deductibleExpenses: fromMinorUnits(deductibleMinor),
    nonDeductibleExpenses: fromMinorUnits(totals.nonDeductibleMinor),
    availableProfit: fromMinorUnits(initialMinor - deductibleMinor),
    expenseCount: Number(totals.count || 0),
    mixedCurrencyWarning: expenseGroups.some((group) => group._id !== currency),
  };
}
