import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/db.js';

const port = Number(process.env.PORT || 5000);

try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  }
  await connectDatabase();
  const server = app.listen(port, () => console.info(`API escuchando en http://localhost:${port}`));

  const shutdown = (signal) => {
    console.info(`${signal}: cerrando servidor...`);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  console.error('No se pudo iniciar la API:', error);
  process.exit(1);
}
