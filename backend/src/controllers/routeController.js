import { z } from 'zod';
import { interpretRoutePrompt } from '../services/aiRoutePlanner.js';
import { computeGoogleRoutes } from '../services/googleRoutesService.js';
import { HttpError } from '../utils/httpError.js';

const routeSchema = z.object({
  origin: z.string().trim().min(2).max(180),
  destination: z.string().trim().min(2).max(180),
  waypoints: z.array(z.string().trim().min(2).max(180)).max(10).default([]),
});

const schema = z.object({
  prompt: z.string().trim().min(10).max(2000),
  route: routeSchema.optional(),
});

function normalizeLocation(value) {
  return value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().replace(/\\s+/g, ' ').toLowerCase();
}

export async function planRoute(req, res) {
  const { prompt, route } = schema.parse(req.body);
  if (route) {
    const locations = [route.origin, ...route.waypoints, route.destination].map(normalizeLocation);
    if (new Set(locations).size !== locations.length) {
      throw new HttpError(422, 'El origen, el destino y las paradas deben ser ubicaciones diferentes. Revisá el orden del recorrido.');
    }
  }
  const intent = await interpretRoutePrompt(prompt, route);
  const routes = await computeGoogleRoutes(intent);

  const caveats = [
    'La distancia y duración proceden de Google Routes; son estimaciones y pueden variar.',
    'La condición de pavimentación no está verificada por esta consulta. No se presume que un tramo sin datos sea asfaltado.',
    'El tráfico en tiempo real no equivale a un listado oficial de cortes. Confirmá restricciones con Vialidad y autoridades locales antes de salir.',
  ];
  if (intent.userNotes.length > 0) {
    caveats.push(...intent.userNotes);
  }
  if (intent.waypoints.length > 0) {
    caveats.push('Google Routes no devuelve alternativas adicionales cuando la solicitud contiene paradas intermedias; se muestra el recorrido que respeta esas paradas.');
  }
  if (intent.preferPavedRoads) {
    caveats.push('Se detectó preferencia por pavimento, pero Google Routes no permite garantizar que toda la alternativa sea asfaltada.');
  }

  res.json({ success: true, intent, routes, caveats, generatedAt: new Date().toISOString() });
}
