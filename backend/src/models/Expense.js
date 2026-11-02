import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: {
    type: String,
    enum: ['FUEL', 'FOOD', 'LODGING', 'TOLLS', 'REPAIRS', 'TRANSPORT', 'VETERINARY', 'OTHER'],
    default: 'OTHER',
  },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  amountMinor: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  currency: { type: String, enum: ['ARS', 'USD'], default: 'ARS' },
  expenseDate: { type: Date, default: Date.now },
  deductFromProfit: { type: Boolean, default: true },
  paymentMethod: { type: String, enum: ['CASH', 'TRANSFER', 'CARD', 'OTHER'], default: 'CASH' },
  receiptReference: { type: String, default: '', maxlength: 120 },
}, { timestamps: true });

expenseSchema.index({ tenantId: 1, tripId: 1, expenseDate: -1 });
export default mongoose.model('Expense', expenseSchema);
