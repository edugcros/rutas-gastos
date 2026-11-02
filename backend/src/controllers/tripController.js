import mongoose from 'mongoose';
import { z } from 'zod';
import Trip from '../models/Trip.js';
import Expense from '../models/Expense.js';
import { HttpError } from '../utils/httpError.js';
import { buildFinancialSummary } from '../utils/finance.js';
import { toMinorUnits, fromMinorUnits, isValidMoneyAmount } from '../utils/money.js';

const createSchema = z.object({
  name: z.string().trim().min(2).max(140),
  origin: z.string().trim().min(2).max(180),
  destination: z.string().trim().min(2).max(180),
  waypoints: z.array(z.string().trim().min(2).max(180)).max(10).default([]),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  incomeAmount: z.number().min(0).refine(isValidMoneyAmount, 'El importe admite hasta dos decimales.').default(0),
  incomeCurrency: z.enum(['ARS', 'USD']).default('ARS'),
  incomeDescription: z.string().max(240).optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  incomeAmount: z.number().min(0).refine(isValidMoneyAmount, 'El importe admite hasta dos decimales.').optional(),
  incomeCurrency: z.enum(['ARS', 'USD']).optional(),
  incomeDescription: z.string().max(240).optional(),
});

function presentTrip(trip) {
  const value = trip.toObject ? trip.toObject() : { ...trip };
  value.income = { ...value.income, amount: fromMinorUnits(value.income?.amountMinor) };
  delete value.income.amountMinor;
  return value;
}

function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Identificador de viaje inválido.');
}

async function getFinancialSummary(trip) {
  const groups = await Expense.aggregate([
    { $match: { tenantId: trip.tenantId, tripId: trip._id } },
    { $group: {
      _id: '$currency',
      totalMinor: { $sum: '$amountMinor' },
      deductibleMinor: { $sum: { $cond: ['$deductFromProfit', '$amountMinor', 0] } },
      nonDeductibleMinor: { $sum: { $cond: ['$deductFromProfit', 0, '$amountMinor'] } },
      count: { $sum: 1 },
    } },
  ]);
  return buildFinancialSummary(trip.income, groups);
}

export async function createTrip(req, res) {
  const data = createSchema.parse(req.body);
  if (data.startDate && data.endDate && data.endDate < data.startDate) throw new HttpError(400, 'La fecha de finalización no puede ser anterior al inicio.');

  const trip = await Trip.create({
    tenantId: req.tenantId,
    createdBy: req.user._id,
    name: data.name,
    origin: data.origin,
    destination: data.destination,
    waypoints: data.waypoints,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    income: {
      amountMinor: toMinorUnits(data.incomeAmount),
      currency: data.incomeCurrency,
      description: data.incomeDescription || 'Ganancia inicial',
    },
  });
  res.status(201).json({ success: true, trip: presentTrip(trip), financialSummary: await getFinancialSummary(trip) });
}

export async function listTrips(req, res) {
  const trips = await Trip.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).lean();
  const groups = await Expense.aggregate([
    { $match: { tenantId: req.tenantId, tripId: { $in: trips.map((trip) => trip._id) } } },
    { $group: {
      _id: { tripId: '$tripId', currency: '$currency' },
      totalMinor: { $sum: '$amountMinor' },
      deductibleMinor: { $sum: { $cond: ['$deductFromProfit', '$amountMinor', 0] } },
      nonDeductibleMinor: { $sum: { $cond: ['$deductFromProfit', 0, '$amountMinor'] } },
      count: { $sum: 1 },
    } },
  ]);
  const groupedByTrip = new Map();
  for (const group of groups) {
    const id = group._id.tripId.toString();
    if (!groupedByTrip.has(id)) groupedByTrip.set(id, []);
    groupedByTrip.get(id).push({ ...group, _id: group._id.currency });
  }
  const items = trips.map((trip) => ({
    trip: presentTrip(trip),
    financialSummary: buildFinancialSummary(trip.income, groupedByTrip.get(trip._id.toString()) || []),
  }));
  res.json({ success: true, items });
}

export async function getTrip(req, res) {
  assertObjectId(req.params.id);
  const trip = await Trip.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!trip) throw new HttpError(404, 'Viaje no encontrado.');
  const [expenses, financialSummary] = await Promise.all([
    Expense.find({ tripId: trip._id, tenantId: req.tenantId }).sort({ expenseDate: -1, createdAt: -1 }).lean(),
    getFinancialSummary(trip),
  ]);
  res.json({ success: true, trip: presentTrip(trip), expenses: expenses.map(({ amountMinor, ...item }) => ({ ...item, amount: fromMinorUnits(amountMinor) })), financialSummary });
}

export async function updateTrip(req, res) {
  assertObjectId(req.params.id);
  const data = updateSchema.parse(req.body);
  const currentTrip = await Trip.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!currentTrip) throw new HttpError(404, 'Viaje no encontrado.');
  if (data.incomeCurrency && data.incomeCurrency !== currentTrip.income.currency) {
    const expenseCount = await Expense.countDocuments({ tripId: currentTrip._id, tenantId: req.tenantId });
    if (expenseCount > 0) throw new HttpError(409, 'No se puede cambiar la moneda del viaje después de registrar gastos.');
  }
  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.status !== undefined) update.status = data.status;
  if (data.incomeAmount !== undefined) update['income.amountMinor'] = toMinorUnits(data.incomeAmount);
  if (data.incomeCurrency !== undefined) update['income.currency'] = data.incomeCurrency;
  if (data.incomeDescription !== undefined) update['income.description'] = data.incomeDescription;

  const trip = await Trip.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.tenantId },
    { $set: update },
    { new: true, runValidators: true },
  );
  if (!trip) throw new HttpError(404, 'Viaje no encontrado.');
  res.json({ success: true, trip: presentTrip(trip), financialSummary: await getFinancialSummary(trip) });
}

export async function saveTripRoutes(req, res) {
  assertObjectId(req.params.id);
  const schema = z.object({
    intent: z.object({
      origin: z.string().trim().min(2).max(180),
      destination: z.string().trim().min(2).max(180),
      waypoints: z.array(z.string().trim().min(2).max(180)).max(10),
    }),
    prompt: z.string().max(2000).optional(),
    routes: z.array(z.object({
    provider: z.literal('google-routes'),
    description: z.string().max(240).optional(),
    distanceMeters: z.number().positive(),
    durationSeconds: z.number().positive(),
    encodedPolyline: z.string().min(10).max(100000),
    legs: z.array(z.unknown()).max(30).optional(),
    calculatedAt: z.coerce.date().optional(),
    trafficMode: z.string().max(40).optional(),
    roadSurfaceStatus: z.enum(['UNVERIFIED', 'PARTIALLY_VERIFIED', 'VERIFIED']).optional(),
    closureStatus: z.enum(['NOT_CHECKED', 'TRAFFIC_ESTIMATE_ONLY', 'OFFICIAL_REPORT']).optional(),
    optimizedIntermediateWaypointIndex: z.array(z.number().int().min(0)).max(10).optional(),
  })).min(1).max(3), selectedRouteIndex: z.number().int().min(0).max(2) });
  const data = schema.parse(req.body);
  if (data.selectedRouteIndex >= data.routes.length) throw new HttpError(400, 'La alternativa seleccionada no existe.');

  const trip = await Trip.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.tenantId },
    { $set: {
      origin: data.intent.origin,
      destination: data.intent.destination,
      waypoints: data.intent.waypoints,
      createdFromPrompt: data.prompt || '',
      routeOptions: data.routes,
      selectedRouteIndex: data.selectedRouteIndex,
    } },
    { new: true, runValidators: true },
  );
  if (!trip) throw new HttpError(404, 'Viaje no encontrado.');
  res.json({ success: true, trip: presentTrip(trip) });
}

export async function deleteTrip(req, res) {
  assertObjectId(req.params.id);
  const trip = await Trip.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!trip) throw new HttpError(404, 'Viaje no encontrado.');
  await Expense.deleteMany({ tripId: trip._id, tenantId: req.tenantId });
  await trip.deleteOne();
  res.json({ success: true, message: 'Viaje y movimientos asociados eliminados.' });
}
