import axios from 'axios';
import { ROUTE_API_URL } from '../config/services.js';
import {
  createLocalExpense,
  createLocalTrip,
  deleteLocalExpense,
  deleteLocalTrip,
  getLocalTrip,
  listLocalTrips,
  saveLocalTripRoutes,
  updateLocalTrip,
} from '../data/localStore.js';

const routeClient = ROUTE_API_URL
  ? axios.create({ baseURL: ROUTE_API_URL, timeout: 60_000, headers: { 'Content-Type': 'application/json' } })
  : null;

function response(data) { return { data, status: 200, headers: {}, config: {} }; }
function routeUnavailable(message, code = 'ROUTE_SERVICE_UNAVAILABLE') {
  const error = new Error(message);
  error.code = code;
  error.userMessage = message;
  error.retryable = true;
  return error;
}

function parseTripId(path) {
  return path.match(/^\/trips\/([^/]+)$/)?.[1];
}
function parseExpensePath(path) {
  const match = path.match(/^\/trips\/([^/]+)\/expenses(?:\/([^/]+))?$/);
  return match ? { tripId: match[1], expenseId: match[2] || null } : null;
}

const http = {
  async get(path) {
    if (path === '/trips') return response(await listLocalTrips());
    const tripId = parseTripId(path);
    if (tripId) return response(await getLocalTrip(tripId));
    throw new Error(`GET ${path} no está disponible en el almacenamiento local.`);
  },
  async post(path, payload) {
    if (path === '/trips') return response(await createLocalTrip(payload));
    const expensePath = parseExpensePath(path);
    if (expensePath?.tripId && !expensePath.expenseId) {
      return response(await createLocalExpense(expensePath.tripId, payload));
    }
    if (path === '/routes/plan') {
      if (!navigator.onLine) throw routeUnavailable('Estás sin Internet. Podés seguir registrando gastos y consultar rutas guardadas, pero Gemini y Google Routes necesitan conexión.');
      if (!routeClient) throw routeUnavailable('La planificación online todavía no está configurada. La gestión de viajes y gastos sigue funcionando localmente.');
      try {
        const { data } = await routeClient.post('/routes/plan', payload);
        return response(data);
      } catch (error) {
        const providerMessage = error.response?.data?.message;
        error.userMessage = providerMessage || (error.code === 'ECONNABORTED'
          ? 'El servicio de rutas tardó demasiado. Intentá nuevamente.'
          : 'No se pudo conectar con el servicio de planificación. Tus datos locales están seguros.');
        throw error;
      }
    }
    throw new Error(`POST ${path} no está disponible en el almacenamiento local.`);
  },
  async put(path, payload) {
    const match = path.match(/^\/trips\/([^/]+)\/routes$/);
    if (match) return response(await saveLocalTripRoutes(match[1], payload));
    throw new Error(`PUT ${path} no está disponible en el almacenamiento local.`);
  },
  async patch(path, payload) {
    const tripId = parseTripId(path);
    if (tripId) return response(await updateLocalTrip(tripId, payload));
    throw new Error(`PATCH ${path} no está disponible en el almacenamiento local.`);
  },
  async delete(path) {
    const tripId = parseTripId(path);
    if (tripId) return response(await deleteLocalTrip(tripId));
    const expensePath = parseExpensePath(path);
    if (expensePath?.tripId && expensePath.expenseId) {
      return response(await deleteLocalExpense(expensePath.tripId, expensePath.expenseId));
    }
    throw new Error(`DELETE ${path} no está disponible en el almacenamiento local.`);
  },
};

export default http;
