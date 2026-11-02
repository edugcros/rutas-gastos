import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { planRoute } from '../controllers/routeController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);
const planLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `tenant:${req.tenantId.toString()}`,
  message: { success: false, message: 'Se alcanzó el límite de planificación por minuto. Intentá nuevamente más tarde.' },
});
router.post('/plan', planLimiter, asyncHandler(planRoute));
export default router;
