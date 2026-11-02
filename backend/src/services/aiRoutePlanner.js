import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';

const intentSchema = z.object({
  origin: z.string().min(2).max(180),
  destination: z.string().min(2).max(180),
  waypoints: z.array(z.string().min(2).max(180)).max(10).default([]),
  avoidTolls: z.boolean().default(false),
  avoidHighways: z.boolean().default(false),
  preferPavedRoads: z.boolean().default(false),
  optimizeWaypointOrder: z.boolean().default(false),
  userNotes: z.array(z.string().max(240)).max(8).default([]),
});

const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 800;
const RETRYABLE_PROVIDER_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function getProviderStatus(error) {
  const value = Number(error?.status ?? error?.code);
  return Number.isInteger(value) ? value : 0;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(ai, request) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      lastError = error;
      const providerStatus = getProviderStatus(error);
      const canRetry = RETRYABLE_PROVIDER_STATUSES.has(providerStatus);

      if (!canRetry || attempt === MAX_ATTEMPTS) break;

      // Backoff exponencial acotado + jitter para no reintentar todos juntos.
      const exponentialDelay = BASE_RETRY_DELAY_MS * (2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 300);
      const delayMs = Math.min(exponentialDelay + jitter, 4_000);

      console.warn('[GEMINI_RETRY]', {
        providerStatus,
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
      });
      await wait(delayMs);
    }
  }

  const providerStatus = getProviderStatus(lastError);
  if (providerStatus === 429) {
    throw new HttpError(
      429,
      'Gemini alcanzó temporalmente el límite de solicitudes. Esperá unos segundos antes de volver a planificar.',
      undefined,
      { code: 'AI_PROVIDER_RATE_LIMIT', retryable: true, retryAfterSeconds: 5, expose: true },
    );
  }

  if (providerStatus === 503 || providerStatus === 500 || providerStatus === 502) {
    throw new HttpError(
      503,
      'El servicio de Gemini está temporalmente saturado. La solicitud se reintentó automáticamente y no pudo completarse. Volvé a intentar en unos momentos.',
      undefined,
      { code: 'AI_PROVIDER_UNAVAILABLE', retryable: true, retryAfterSeconds: 5, expose: true },
    );
  }

  if (providerStatus === 408 || providerStatus === 504) {
    throw new HttpError(
      504,
      'Gemini tardó demasiado en responder. Volvé a intentar la planificación.',
      undefined,
      { code: 'AI_PROVIDER_TIMEOUT', retryable: true, retryAfterSeconds: 3, expose: true },
    );
  }

  console.error('[GEMINI_REQUEST_FAILED]', {
    providerStatus: providerStatus || 'unknown',
    errorName: lastError?.name || 'Error',
  });
  throw new HttpError(
    502,
    'No se pudo interpretar la solicitud con Gemini. Verificá la configuración del proveedor e intentá nuevamente.',
    undefined,
    { code: 'AI_PROVIDER_ERROR', retryable: false, expose: true },
  );
}

export async function interpretRoutePrompt(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new HttpError(503, 'La planificación con IA no está configurada. Configure GEMINI_API_KEY.');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await generateWithRetry(ai, {
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    contents: [
      'Interpretá la solicitud de viaje y devolvé únicamente los campos del esquema JSON.',
      'No inventes ubicaciones ni agregues paradas que el usuario no haya pedido.',
      'Si el origen o destino no están claros, explicitalo en userNotes usando el texto disponible; no adivines.',
      'preferPavedRoads expresa una preferencia que luego debe verificarse con fuentes viales, no una capacidad que Google Routes garantice.',
      `Solicitud del usuario: ${prompt}`,
    ].join('\n\n'),
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          origin: { type: 'STRING' },
          destination: { type: 'STRING' },
          waypoints: { type: 'ARRAY', items: { type: 'STRING' } },
          avoidTolls: { type: 'BOOLEAN' },
          avoidHighways: { type: 'BOOLEAN' },
          preferPavedRoads: { type: 'BOOLEAN' },
          optimizeWaypointOrder: { type: 'BOOLEAN' },
          userNotes: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['origin', 'destination', 'waypoints', 'avoidTolls', 'avoidHighways', 'preferPavedRoads', 'optimizeWaypointOrder', 'userNotes'],
      },
    },
  });

  let parsed;
  try {
    parsed = JSON.parse(response.text || '{}');
  } catch {
    throw new HttpError(502, 'La IA devolvió una respuesta que no se pudo interpretar.');
  }

  const result = intentSchema.safeParse(parsed);
  if (!result.success) {
    throw new HttpError(422, 'La solicitud no permitió identificar origen y destino con precisión.', result.error.issues);
  }
  if (result.data.origin.toLowerCase() === result.data.destination.toLowerCase()) {
    throw new HttpError(422, 'El origen y el destino no pueden ser iguales.');
  }
  return result.data;
}
