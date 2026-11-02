import { Router } from 'express';
import {
  createTrip, deleteTrip, getTrip, listTrips, saveTripRoutes, updateTrip,
} from '../controllers/tripController.js';
import { createExpense, deleteExpense, updateExpense } from '../controllers/expenseController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(listTrips));
router.post('/', asyncHandler(createTrip));
router.get('/:id', asyncHandler(getTrip));
router.patch('/:id', asyncHandler(updateTrip));
router.delete('/:id', asyncHandler(deleteTrip));
router.put('/:id/routes', asyncHandler(saveTripRoutes));
router.post('/:tripId/expenses', asyncHandler(createExpense));
router.patch('/:tripId/expenses/:expenseId', asyncHandler(updateExpense));
router.delete('/:tripId/expenses/:expenseId', asyncHandler(deleteExpense));
export default router;
