import mongoose from 'mongoose';

const routeSnapshotSchema = new mongoose.Schema({
  provider: { type: String, default: 'google-routes' },
  description: { type: String, default: '' },
  distanceMeters: { type: Number, required: true, min: 0 },
  durationSeconds: { type: Number, required: true, min: 0 },
  encodedPolyline: { type: String, required: true },
  legs: { type: [mongoose.Schema.Types.Mixed], default: [] },
  calculatedAt: { type: Date, default: Date.now },
  trafficMode: { type: String, default: 'TRAFFIC_AWARE' },
  roadSurfaceStatus: { type: String, enum: ['UNVERIFIED', 'PARTIALLY_VERIFIED', 'VERIFIED'], default: 'UNVERIFIED' },
  closureStatus: { type: String, enum: ['NOT_CHECKED', 'TRAFFIC_ESTIMATE_ONLY', 'OFFICIAL_REPORT'], default: 'TRAFFIC_ESTIMATE_ONLY' },
  optimizedIntermediateWaypointIndex: { type: [Number], default: [] },
}, { _id: false });

const tripSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 140 },
  origin: { type: String, required: true, trim: true, maxlength: 180 },
  destination: { type: String, required: true, trim: true, maxlength: 180 },
  waypoints: { type: [String], default: [] },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  status: { type: String, enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], default: 'PLANNED' },
  income: {
    amountMinor: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    currency: { type: String, enum: ['ARS', 'USD'], default: 'ARS' },
    description: { type: String, default: 'Ganancia inicial', maxlength: 240 },
  },
  routeOptions: { type: [routeSnapshotSchema], default: [] },
  selectedRouteIndex: { type: Number, default: null, min: 0 },
  createdFromPrompt: { type: String, default: '', maxlength: 2000 },
}, { timestamps: true });

tripSchema.index({ tenantId: 1, createdAt: -1 });
tripSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model('Trip', tripSchema);
