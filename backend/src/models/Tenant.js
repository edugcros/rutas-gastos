import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
}, { timestamps: true });

tenantSchema.index({ name: 1 });
export default mongoose.model('Tenant', tenantSchema);
