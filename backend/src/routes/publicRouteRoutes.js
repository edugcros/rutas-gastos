import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { planRoute } from '../controllers/routeController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const perMinute = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.ROUTE_LIMIT_PER_MINUTE || 5),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, code: 'ROUTE_RATE_LIMIT', retryable: true, message: 'Se alcanzó el límite de planificación. Intentá nuevamente en un minuto.' },
});

const dailyUsage = new Map();
const dailyLimit = Number(process.env.ROUTE_LIMIT_PER_DAY || 25);
function enforceDailyLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const current = dailyUsage.get(key);
  const record = current?.day === day ? current : { day, count: 0 };
  if (record.count >= dailyLimit) {
    return res.status(429).json({
      success: false,
      code: 'ROUTE_DAILY_LIMIT',
      retryable: false,
      message: 'Se alcanzó el límite diario de planificación para esta conexión.',
    });
  }
  record.count += 1;
  dailyUsage.set(key, record);
  if (dailyUsage.size > 10_000) {
    for (const [storedKey, storedValue] of dailyUsage) {
      if (storedValue.day !== day) dailyUsage.delete(storedKey);
    }
  }
  return next();
}

// El servicio no recibe ni persiste viajes, usuarios, ingresos o gastos.
// Solo recibe un prompt para consultar Gemini y Google Routes.
router.post('/plan', perMinute, enforceDailyLimit, asyncHandler(planRoute));

export default router;
