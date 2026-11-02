import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  role: { type: String, enum: ['owner', 'member'], default: 'owner' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
