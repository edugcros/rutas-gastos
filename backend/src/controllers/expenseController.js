import mongoose from 'mongoose';
import { z } from 'zod';
import Expense from '../models/Expense.js';
import Trip from '../models/Trip.js';
import { HttpError } from '../utils/httpError.js';
import { toMinorUnits, fromMinorUnits, isValidMoneyAmount } from '../utils/money.js';

const expenseSchema = z.object({
  category: z.enum(['FUEL', 'FOOD', 'LODGING', 'TOLLS', 'REPAIRS', 'TRANSPORT', 'VETERINARY', 'OTHER']),
  description: z.string().trim().min(2).max(300),
  amount: z.number().positive().max(1_000_000_000).refine(isValidMoneyAmount, 'El importe admite hasta dos decimales.'),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
  expenseDate: z.coerce.date().optional(),
  deductFromProfit: z.boolean().default(true),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'OTHER']).default('CASH'),
  receiptReference: z.string().max(120).optional(),
});

const patchSchema = expenseSchema.partial();

function presentExpense(expense) {
  const value = expense.toObject ? expense.toObject() : { ...expense };
  value.amount = fromMinorUnits(value.amountMinor);
  delete value.amountMinor;
  return value;
}

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Identificador inválido.');
}

async function assertTripAccess(tripId, tenantId) {
  checkId(tripId);
  const trip = await Trip.findOne({ _id: tripId, tenantId }).select('_id income');
  if (!trip) throw new HttpError(404, 'Viaje no encontrado.');
  return trip;
}

export async function createExpense(req, res) {
  const data = expenseSchema.parse(req.body);
  const trip = await assertTripAccess(req.params.tripId, req.tenantId);
  if (data.currency !== trip.income.currency) {
    throw new HttpError(400, `La moneda del gasto debe coincidir con la moneda del ingreso del viaje (${trip.income.currency}). No se realiza conversión automática.`);
  }
  const { amount, ...fields } = data;
  const expense = await Expense.create({
    ...fields,
    amountMinor: toMinorUnits(amount),
    tenantId: req.tenantId,
    tripId: trip._id,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, expense: presentExpense(expense) });
}

export async function updateExpense(req, res) {
  checkId(req.params.expenseId);
  const data = patchSchema.parse(req.body);
  const trip = await assertTripAccess(req.params.tripId, req.tenantId);
  const currentExpense = await Expense.findOne({
    _id: req.params.expenseId,
    tripId: req.params.tripId,
    tenantId: req.tenantId,
  });
  if (!currentExpense) throw new HttpError(404, 'Gasto no encontrado.');
  const effectiveCurrency = data.currency || currentExpense.currency;
  if (effectiveCurrency !== trip.income.currency) {
    throw new HttpError(400, `La moneda del gasto debe coincidir con la moneda del ingreso del viaje (${trip.income.currency}).`);
  }
  const { amount, ...fields } = data;
  Object.assign(currentExpense, fields);
  if (amount !== undefined) currentExpense.amountMinor = toMinorUnits(amount);
  await currentExpense.save();
  res.json({ success: true, expense: presentExpense(currentExpense) });
}

export async function deleteExpense(req, res) {
  checkId(req.params.expenseId);
  const expense = await Expense.findOneAndDelete({
    _id: req.params.expenseId,
    tripId: req.params.tripId,
    tenantId: req.tenantId,
  });
  if (!expense) throw new HttpError(404, 'Gasto no encontrado.');
  res.json({ success: true, message: 'Gasto eliminado.' });
}
