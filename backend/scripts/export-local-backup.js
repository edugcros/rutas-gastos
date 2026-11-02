import 'dotenv/config';
import mongoose from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import User from '../src/models/User.js';
import Tenant from '../src/models/Tenant.js';
import Trip from '../src/models/Trip.js';
import Expense from '../src/models/Expense.js';

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Uso: node scripts/export-local-backup.js correo@ejemplo.com');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('Falta MONGODB_URI. Este script solo se ejecuta en el equipo donde está disponible la base anterior.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
try {
  const user = await User.findOne({ email }).select('name email tenantId role').lean();
  if (!user) throw new Error(`No se encontró el usuario ${email} en la base anterior.`);
  const tenant = await Tenant.findById(user.tenantId).lean();
  if (!tenant) throw new Error('No se encontró la organización asociada al usuario.');

  const [trips, expenses] = await Promise.all([
    Trip.find({ tenantId: user.tenantId }).sort({ createdAt: 1 }).lean(),
    Expense.find({ tenantId: user.tenantId }).sort({ createdAt: 1 }).lean(),
  ]);
  const profile = {
    id: `migration-${String(user._id)}`,
    name: user.name,
    organizationName: tenant.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mode: 'local-independent',
  };
  const backup = {
    app: 'rutas-gastos',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    source: 'mongodb-legacy-migration',
    profile,
    trips: trips.map((item) => ({ ...item, _id: String(item._id), tenantId: String(item.tenantId), createdBy: String(item.createdBy) })),
    expenses: expenses.map((item) => ({ ...item, _id: String(item._id), tenantId: String(item.tenantId), tripId: String(item.tripId), createdBy: String(item.createdBy) })),
  };

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.resolve(scriptDir, '../exports');
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `rutas-gastos-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(outputPath, JSON.stringify(backup, null, 2), { mode: 0o600 });
  console.info(`Exportación completada: ${trips.length} viajes y ${expenses.length} gastos.`);
  console.info(`Archivo: ${outputPath}`);
} finally {
  await mongoose.disconnect();
}
