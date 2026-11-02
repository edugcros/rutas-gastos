import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import { HttpError } from '../utils/httpError.js';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(180),
  password: z.string().min(10).max(128),
  organizationName: z.string().trim().min(2).max(100),
});
const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(128) });

function createToken(user) {
  return jwt.sign(
    { tenantId: user.tenantId.toString(), role: user.role },
    process.env.JWT_SECRET,
    { subject: user._id.toString(), expiresIn: process.env.JWT_EXPIRES_IN || '12h' },
  );
}

export async function register(req, res) {
  const data = registerSchema.parse(req.body);
  const email = data.email.trim().toLowerCase();
  if (await User.exists({ email })) throw new HttpError(409, 'Ya existe una cuenta con ese correo.');

  const tenant = await Tenant.create({ name: data.organizationName });
  try {
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({ name: data.name, email, passwordHash, tenantId: tenant._id, role: 'owner' });
    res.status(201).json({
      success: true,
      token: createToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
    });
  } catch (error) {
    await Tenant.findByIdAndDelete(tenant._id);
    throw error;
  }
}

export async function login(req, res) {
  const data = loginSchema.parse(req.body);
  const user = await User.findOne({ email: data.email.trim().toLowerCase() }).select('+passwordHash');
  if (!user || !user.active || !(await bcrypt.compare(data.password, user.passwordHash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos.');
  }
  res.json({
    success: true,
    token: createToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
  });
}

export async function me(req, res) {
  res.json({ success: true, user: req.user });
}
