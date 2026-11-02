import { z } from 'zod';
import { interpretRoutePrompt } from '../services/aiRoutePlanner.js';
import { computeGoogleRoutes } from '../services/googleRoutesService.js';
import { analyzeRoutes, findAvoidedRoadMatches } from '../services/roadAnalysis.js';
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
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// El frontend espera hasta 60 s. Este es el tiempo total del pedido; el análisis usa lo que sobre.
const REQUEST_BUDGET_MS = Number(process.env.ROUTE_REQUEST_BUDGET_MS || 48_000);

export async function planRoute(req, res) {
  const startedAt = Date.now();
  const { prompt, route } = schema.parse(req.body);
  if (route) {
    const locations = [route.origin, ...route.waypoints, route.destination].map(normalizeLocation);
    if (new Set(locations).size !== locations.length) {
      throw new HttpError(422, 'El origen, el destino y las paradas deben ser ubicaciones diferentes. Revisá el orden del recorrido.');
    }
  }
  const intent = await interpretRoutePrompt(prompt, route);
  const routes = await computeGoogleRoutes(intent);

  // Complemento: tipo de camino y cortes. Si falla, la ruta se entrega igual.
  const analysis = await analyzeRoutes({ intent, userPrompt: prompt, routes, budgetMs: REQUEST_BUDGET_MS - (Date.now() - startedAt) });
  const avoidWarnings = routes
    .map((candidate, routeIndex) => ({ routeIndex, matches: findAvoidedRoadMatches(intent.avoidAreas, candidate) }))
    .filter((entry) => entry.matches.length > 0)
    .map((entry) => ({ routeIndex: entry.routeIndex, message: `Esta alternativa pasa por lo que pediste evitar: ${entry.matches.join(', ')}.` }));
  const roadAnalysis = { available: Boolean(analysis), ...(analysis || { routes: [], sources: [], generatedAt: new Date().toISOString(), grounded: false }), avoidWarnings };

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
  if (intent.avoidAreas.length > 0) {
    caveats.push('Google Routes no permite excluir caminos puntuales: se revisó si la ruta pasa por lo que pediste evitar y se indica en el análisis. Si hace falta, agregá una parada intermedia para forzar otro camino.');
  }
  if (intent.allowUnpaved) {
    caveats.push('Aceptaste caminos de tierra o ripio. Su estado cambia con el clima: consultá información local actualizada antes de salir.');
  }
  if (!analysis) {
    caveats.push('No fue posible analizar el tipo de camino ni los cortes en esta consulta. Verificá el estado de las rutas con Vialidad antes de salir.');
  }
  if (intent.preferPavedRoads) {
    caveats.push('Se detectó preferencia por pavimento, pero Google Routes no permite garantizar que toda la alternativa sea asfaltada.');
  }

  res.json({ success: true, intent, routes, roadAnalysis, caveats, generatedAt: new Date().toISOString() });
}
