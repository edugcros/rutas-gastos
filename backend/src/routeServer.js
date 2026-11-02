import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import publicRouteRoutes from './routes/publicRouteRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

dotenv.config({ path: process.env.ROUTE_ENV_FILE || '.env.routes' });

const app = express();
const port = Number(process.env.PORT || 5100);
const allowedOrigins = (process.env.APP_ORIGINS || '')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

// En Render se configura TRUST_PROXY_HOPS=1. En desarrollo, mantener 0.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(Object.assign(new Error('Origen no autorizado para el servicio de rutas.'), { statusCode: 403, expose: true }));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 600,
}));
app.use(express.json({ limit: '4kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => res.json({
  success: true,
  service: 'rutas-gastos-route-service',
  storage: 'none',
  timestamp: new Date().toISOString(),
}));
app.use('/api/routes', publicRouteRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

if (!process.env.GEMINI_API_KEY) console.warn('[CONFIG] GEMINI_API_KEY no está configurada.');
if (!process.env.GOOGLE_MAPS_API_KEY) console.warn('[CONFIG] GOOGLE_MAPS_API_KEY no está configurada.');

app.listen(port, () => console.info(`Servicio de planificación escuchando en ${port}`));
