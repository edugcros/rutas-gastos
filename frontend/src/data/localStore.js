import { normalizeRoadAnalysis } from '../utils/roadAnalysis.js';

const DB_NAME = 'rutas-gastos-local';
const DB_VERSION = 1;
const PROFILE_KEY = 'profile';

let dbPromise;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Este navegador no permite almacenamiento local. Utilizá una versión actualizada de Chrome o Edge.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('trips')) {
        const trips = db.createObjectStore('trips', { keyPath: '_id' });
        trips.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('expenses')) {
        const expenses = db.createObjectStore('expenses', { keyPath: '_id' });
        expenses.createIndex('tripId', 'tripId');
        expenses.createIndex('expenseDate', 'expenseDate');
      }
    };
    request.onsuccess = async () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      try {
        if (navigator.storage?.persist) await navigator.storage.persist();
      } catch {
        // Persistent storage is a browser hint; normal IndexedDB storage remains usable.
      }
      resolve(db);
    };
    request.onerror = () => { dbPromise = null; reject(request.error || new Error('No se pudo abrir la base de datos local.')); };
    request.onblocked = () => { dbPromise = null; reject(new Error('Cerrá otras ventanas de Rutas & Gastos para actualizar el almacenamiento local.')); };
  });
  return dbPromise;
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falló una operación de almacenamiento local.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar la información local.'));
    transaction.onabort = () => reject(transaction.error || new Error('La operación local fue cancelada.'));
  });
}

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const TRIP_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const EXPENSE_CATEGORIES = ['FUEL', 'FOOD', 'LODGING', 'TOLLS', 'REPAIRS', 'TRANSPORT', 'VETERINARY', 'OTHER'];
const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'CARD', 'OTHER'];
const CURRENCIES = ['ARS', 'USD'];

export function toMinorUnits(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) throw new Error('El importe no es válido.');
  const minor = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(minor)) throw new Error('El importe supera el límite permitido.');
  return minor;
}

function fromMinorUnits(value) {
  return Number(value || 0) / 100;
}

function presentTrip(trip) {
  const income = { ...trip.income, amount: fromMinorUnits(trip.income?.amountMinor) };
  delete income.amountMinor;
  return { ...trip, waypoints: Array.isArray(trip.waypoints) ? trip.waypoints : [], income };
}

function normalizeWaypoints(value, origin, destination) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 10) {
    throw new Error('El recorrido admite hasta 10 paradas intermedias.');
  }

  const waypoints = value.map((point) => String(point || '').trim());
  if (waypoints.some((point) => point.length < 2 || point.length > 180)) {
    throw new Error('Cada parada debe tener entre 2 y 180 caracteres.');
  }

  const normalize = (point) => point.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase();
  const locations = [origin, ...waypoints, destination].map(normalize);
  if (new Set(locations).size !== locations.length) {
    throw new Error('El origen, el destino y las paradas deben ser ubicaciones diferentes.');
  }
  return waypoints;
}

function presentExpense(expense) {
  const value = { ...expense, amount: fromMinorUnits(expense.amountMinor) };
  delete value.amountMinor;
  return value;
}

export function summarize(trip, expenses) {
  const currency = trip.income?.currency || 'ARS';
  let totalMinor = 0;
  let deductibleMinor = 0;
  let nonDeductibleMinor = 0;
  let count = 0;
  let mixedCurrencyWarning = false;

  for (const expense of expenses) {
    if (expense.currency !== currency) {
      mixedCurrencyWarning = true;
      continue;
    }
    const amount = Number(expense.amountMinor || 0);
    totalMinor += amount;
    if (expense.deductFromProfit) deductibleMinor += amount;
    else nonDeductibleMinor += amount;
    count += 1;
  }

  const initialMinor = Number(trip.income?.amountMinor || 0);
  return {
    currency,
    initialIncome: fromMinorUnits(initialMinor),
    totalExpenses: fromMinorUnits(totalMinor),
    deductibleExpenses: fromMinorUnits(deductibleMinor),
    nonDeductibleExpenses: fromMinorUnits(nonDeductibleMinor),
    availableProfit: fromMinorUnits(initialMinor - deductibleMinor),
    expenseCount: count,
    mixedCurrencyWarning,
  };
}

async function getAllFrom(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const done = transactionDone(tx);
  const records = await requestValue(tx.objectStore(storeName).getAll());
  await done;
  return records;
}

export async function getLocalProfile() {
  const db = await openDatabase();
  const tx = db.transaction('settings', 'readonly');
  const done = transactionDone(tx);
  const record = await requestValue(tx.objectStore('settings').get(PROFILE_KEY));
  await done;
  return record?.value || null;
}

export async function saveLocalProfile({ name, organizationName }) {
  const cleanName = String(name || '').trim();
  const cleanOrganization = String(organizationName || '').trim();
  if (cleanName.length < 2 || cleanName.length > 100) throw new Error('Ingresá un nombre de al menos 2 caracteres.');
  if (cleanOrganization.length < 2 || cleanOrganization.length > 100) throw new Error('Ingresá un nombre de espacio de trabajo válido.');
  const existing = await getLocalProfile();
  const profile = {
    id: existing?.id || makeId(),
    name: cleanName,
    organizationName: cleanOrganization,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mode: 'local-independent',
  };
  const db = await openDatabase();
  const tx = db.transaction('settings', 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('settings').put({ key: PROFILE_KEY, value: profile });
  await done;
  return profile;
}

export async function clearLocalProfile() {
  const db = await openDatabase();
  const tx = db.transaction('settings', 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('settings').delete(PROFILE_KEY);
  await done;
}

export async function listLocalTrips() {
  const [trips, expenses] = await Promise.all([getAllFrom('trips'), getAllFrom('expenses')]);
  trips.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    success: true,
    items: trips.map((trip) => {
      const tripExpenses = expenses.filter((expense) => expense.tripId === trip._id);
      return { trip: presentTrip(trip), financialSummary: summarize(trip, tripExpenses) };
    }),
  };
}

export async function createLocalTrip(data) {
  const now = new Date().toISOString();
  const name = String(data.name || '').trim();
  const origin = String(data.origin || '').trim();
  const destination = String(data.destination || '').trim();
  if (!name || name.length < 2 || !origin || !destination) {
    throw new Error('Completá el nombre, origen y destino del viaje.');
  }
  const waypoints = normalizeWaypoints(data.waypoints, origin, destination);
  const trip = {
    _id: makeId(),
    name,
    origin,
    destination,
    waypoints,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    status: 'PLANNED',
    income: {
      amountMinor: toMinorUnits(data.incomeAmount || 0),
      currency: data.incomeCurrency || 'ARS',
      description: data.incomeDescription || 'Ganancia inicial',
    },
    routeOptions: [],
    selectedRouteIndex: null,
    createdFromPrompt: '',
    createdAt: now,
    updatedAt: now,
    storageMode: 'local',
  };
  const db = await openDatabase();
  const tx = db.transaction('trips', 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('trips').add(trip);
  await done;
  return { success: true, trip: presentTrip(trip), financialSummary: summarize(trip, []) };
}

export async function getLocalTrip(tripId) {
  const db = await openDatabase();
  const tx = db.transaction(['trips', 'expenses'], 'readonly');
  const done = transactionDone(tx);
  const tripRequest = requestValue(tx.objectStore('trips').get(tripId));
  const expensesRequest = requestValue(tx.objectStore('expenses').index('tripId').getAll(tripId));
  const [trip, expenses] = await Promise.all([tripRequest, expensesRequest]);
  await done;
  if (!trip) {
    const error = new Error('Viaje no encontrado en este equipo.');
    error.status = 404;
    throw error;
  }
  expenses.sort((a, b) => String(b.expenseDate).localeCompare(String(a.expenseDate)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    success: true,
    trip: presentTrip(trip),
    expenses: expenses.map(presentExpense),
    financialSummary: summarize(trip, expenses),
  };
}

export async function deleteLocalTrip(tripId) {
  const db = await openDatabase();
  const tx = db.transaction(['trips', 'expenses'], 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('trips').delete(tripId);
  const cursorRequest = tx.objectStore('expenses').index('tripId').openCursor(IDBKeyRange.only(tripId));
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor) { cursor.delete(); cursor.continue(); }
  };
  await done;
  return { success: true, message: 'Viaje y movimientos asociados eliminados de este equipo.' };
}

export async function updateLocalTrip(tripId, data) {
  // Validate first: an exception thrown inside an IndexedDB callback would abort
  // the transaction and hide the real reason behind a generic message.
  const name = data.name !== undefined ? String(data.name).trim() : undefined;
  if (name !== undefined && (name.length < 2 || name.length > 140)) throw new Error('El nombre del viaje debe tener entre 2 y 140 caracteres.');
  if (data.status !== undefined && !TRIP_STATUSES.includes(data.status)) throw new Error('El estado del viaje no es válido.');
  if (data.incomeCurrency !== undefined && !CURRENCIES.includes(data.incomeCurrency)) throw new Error('La moneda no es válida.');
  const incomeMinor = data.incomeAmount !== undefined ? toMinorUnits(data.incomeAmount) : undefined;
  const db = await openDatabase();
  const tx = db.transaction(['trips', 'expenses'], 'readwrite');
  const done = transactionDone(tx);
  const trips = tx.objectStore('trips');
  const request = trips.get(tripId);
  let updatedTrip;
  request.onsuccess = () => {
    const trip = request.result;
    if (!trip) { tx.abort(); return; }
    if (name !== undefined) trip.name = name;
    if (data.status !== undefined) trip.status = data.status;
    if (incomeMinor !== undefined) trip.income.amountMinor = incomeMinor;
    if (data.incomeCurrency !== undefined && data.incomeCurrency !== trip.income.currency) {
      const expenseCountRequest = tx.objectStore('expenses').index('tripId').count(tripId);
      expenseCountRequest.onsuccess = () => {
        if (expenseCountRequest.result > 0) { tx.abort(); return; }
        trip.income.currency = data.incomeCurrency;
        if (data.incomeDescription !== undefined) trip.income.description = data.incomeDescription;
        trip.updatedAt = new Date().toISOString();
        trips.put(trip);
        updatedTrip = trip;
      };
    } else {
      if (data.incomeDescription !== undefined) trip.income.description = data.incomeDescription;
      trip.updatedAt = new Date().toISOString();
      trips.put(trip);
      updatedTrip = trip;
    }
  };
  try { await done; } catch (error) {
    if (error?.name === 'AbortError') throw new Error('No se pudo actualizar. Verificá que el viaje exista y que no tenga gastos al cambiar la moneda.');
    throw error;
  }
  if (!updatedTrip) throw new Error('No se pudo actualizar el viaje.');
  const expenses = await getAllExpensesForTrip(tripId);
  return { success: true, trip: presentTrip(updatedTrip), financialSummary: summarize(updatedTrip, expenses) };
}

async function getAllExpensesForTrip(tripId) {
  const db = await openDatabase();
  const tx = db.transaction('expenses', 'readonly');
  const done = transactionDone(tx);
  const expenses = await requestValue(tx.objectStore('expenses').index('tripId').getAll(tripId));
  await done;
  return expenses;
}

export async function saveLocalTripRoutes(tripId, data) {
  const roadAnalysis = normalizeRoadAnalysis(data.roadAnalysis);
  const origin = String(data.intent.origin || '').trim();
  const destination = String(data.intent.destination || '').trim();
  const waypoints = normalizeWaypoints(data.intent.waypoints || [], origin, destination);
  const db = await openDatabase();
  const tx = db.transaction('trips', 'readwrite');
  const done = transactionDone(tx);
  const store = tx.objectStore('trips');
  const request = store.get(tripId);
  let updatedTrip;
  request.onsuccess = () => {
    const trip = request.result;
    if (!trip) { tx.abort(); return; }
    trip.origin = origin;
    trip.destination = destination;
    trip.waypoints = waypoints;
    trip.createdFromPrompt = data.prompt || '';
    trip.routeOptions = (data.routes || []).map((route) => ({ ...route, calculatedAt: route.calculatedAt || new Date().toISOString() }));
    trip.selectedRouteIndex = data.selectedRouteIndex ?? 0;
    trip.roadAnalysis = roadAnalysis;
    trip.updatedAt = new Date().toISOString();
    store.put(trip);
    updatedTrip = trip;
  };
  try { await done; } catch (error) { if (error?.name === 'AbortError') throw new Error('No se encontró el viaje para guardar la ruta.'); throw error; }
  if (!updatedTrip) throw new Error('No se pudo guardar la ruta.');
  return { success: true, trip: presentTrip(updatedTrip) };
}

export async function createLocalExpense(tripId, data) {
  const trip = (await getLocalTrip(tripId)).trip;
  if (data.category && !EXPENSE_CATEGORIES.includes(data.category)) throw new Error('La categoría del gasto no es válida.');
  if (data.paymentMethod && !PAYMENT_METHODS.includes(data.paymentMethod)) throw new Error('El medio de pago no es válido.');
  if (data.expenseDate && Number.isNaN(new Date(data.expenseDate).getTime())) throw new Error('La fecha del gasto no es válida.');
  if (data.currency !== trip.income.currency) throw new Error(`La moneda del gasto debe coincidir con la moneda del ingreso (${trip.income.currency}).`);
  const now = new Date().toISOString();
  const amountMinor = toMinorUnits(data.amount);
  if (amountMinor <= 0) throw new Error('El importe del gasto debe ser mayor que cero.');
  const expense = {
    _id: makeId(), tripId, category: data.category || 'OTHER', description: String(data.description || '').trim().slice(0, 300),
    amountMinor, currency: data.currency || 'ARS', expenseDate: data.expenseDate || now,
    deductFromProfit: data.deductFromProfit !== false, paymentMethod: data.paymentMethod || 'CASH',
    receiptReference: String(data.receiptReference || '').slice(0, 200), createdAt: now, updatedAt: now, storageMode: 'local',
  };
  if (expense.description.length < 2) throw new Error('Ingresá un detalle para el gasto.');
  const db = await openDatabase();
  const tx = db.transaction('expenses', 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('expenses').add(expense);
  await done;
  return { success: true, expense: presentExpense(expense) };
}

export async function deleteLocalExpense(tripId, expenseId) {
  const db = await openDatabase();
  const tx = db.transaction('expenses', 'readwrite');
  const done = transactionDone(tx);
  const store = tx.objectStore('expenses');
  const request = store.get(expenseId);
  request.onsuccess = () => {
    const expense = request.result;
    if (expense?.tripId === tripId) store.delete(expenseId);
  };
  await done;
  return { success: true, message: 'Gasto eliminado.' };
}

export async function buildLocalBackup() {
  const [profile, trips, expenses] = await Promise.all([getLocalProfile(), getAllFrom('trips'), getAllFrom('expenses')]);
  return {
    app: 'rutas-gastos',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    profile,
    trips,
    expenses,
  };
}

export async function restoreLocalBackup(backup) {
  if (!backup || backup.app !== 'rutas-gastos' || backup.backupVersion !== 1 || !Array.isArray(backup.trips) || !Array.isArray(backup.expenses)) {
    throw new Error('El archivo no es una copia de seguridad válida de Rutas & Gastos.');
  }
  if (backup.trips.length > 100_000 || backup.expenses.length > 1_000_000) throw new Error('La copia supera el límite de registros admitido.');
  const tripIds = new Set();
  const expenseIds = new Set();
  for (const trip of backup.trips) {
    if (!trip?._id || typeof trip._id !== 'string' || tripIds.has(trip._id) || !trip.income || !Number.isSafeInteger(trip.income.amountMinor) || trip.income.amountMinor < 0) {
      throw new Error('La copia contiene viajes o ingresos inválidos.');
    }
    if (!['ARS', 'USD'].includes(trip.income.currency)) throw new Error('La copia contiene una moneda no admitida.');
    if (typeof trip.name !== 'string' || typeof trip.origin !== 'string' || typeof trip.destination !== 'string') throw new Error('La copia contiene datos de viaje incompletos.');
    if (trip.waypoints !== undefined) normalizeWaypoints(trip.waypoints, trip.origin, trip.destination);
    tripIds.add(trip._id);
  }
  for (const expense of backup.expenses) {
    if (!expense?._id || typeof expense._id !== 'string' || expenseIds.has(expense._id) || !expense.tripId || !tripIds.has(expense.tripId)) throw new Error('La copia contiene gastos sin un viaje asociado o identificadores duplicados.');
    if (!Number.isSafeInteger(expense.amountMinor) || expense.amountMinor <= 0) throw new Error('La copia contiene importes inválidos.');
    if (!['ARS', 'USD'].includes(expense.currency)) throw new Error('La copia contiene una moneda de gasto no admitida.');
    expenseIds.add(expense._id);
  }
  const db = await openDatabase();
  const tx = db.transaction(['settings', 'trips', 'expenses'], 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('trips').clear();
  tx.objectStore('expenses').clear();
  for (const trip of backup.trips) tx.objectStore('trips').put(trip);
  for (const expense of backup.expenses) tx.objectStore('expenses').put(expense);
  if (backup.profile) tx.objectStore('settings').put({ key: PROFILE_KEY, value: backup.profile });
  await done;
  return { trips: backup.trips.length, expenses: backup.expenses.length, profile: backup.profile || null };
}

export async function getLocalStorageStats() {
  const [trips, expenses] = await Promise.all([getAllFrom('trips'), getAllFrom('expenses')]);
  let estimate = null;
  try { estimate = await navigator.storage?.estimate?.(); } catch { /* ignore */ }
  return { trips: trips.length, expenses: expenses.length, usage: estimate?.usage || null, quota: estimate?.quota || null };
}

export function createLocalUser(profile) {
  return {
    id: profile.id,
    name: profile.name,
    email: 'Almacenamiento local',
    organizationName: profile.organizationName,
    role: 'local-owner',
    mode: 'local-independent',
  };
}
