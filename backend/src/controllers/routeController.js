import { z } from 'zod';
import { interpretRoutePrompt } from '../services/aiRoutePlanner.js';
import { computeGoogleRoutes } from '../services/googleRoutesService.js';

const schema = z.object({ prompt: z.string().trim().min(10).max(2000) });

export async function planRoute(req, res) {
  const { prompt } = schema.parse(req.body);
  const intent = await interpretRoutePrompt(prompt);
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
