import jwt from 'jsonwebtoken';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import User from '../models/User.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Autenticación requerida.');

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'La sesión es inválida o expiró.');
  }

  const user = await User.findById(payload.sub).select('_id name email tenantId role active');
  if (!user || !user.active) throw new HttpError(401, 'Usuario no disponible.');

  req.user = user;
  req.tenantId = user.tenantId;
  next();
});
