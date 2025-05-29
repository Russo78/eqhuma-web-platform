const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Información del cliente
  clientId: {
    type: String,
    required: true
  },
  clientName: {
    type: String,
    required: true
  },
  clientEmail: {
    type: String,
    required: true
  },

  // Información del pago
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'MXN'
  },
  concept: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },

  // Información de STP
  stpTrackingKey: {
    type: String,
    unique: true,
    sparse: true
  },
  stpClabe: {
    type: String
  },
  stpStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },

  // Metadatos
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['stp', 'card', 'cash'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices
paymentSchema.index({ clientId: 1 });
paymentSchema.index({ reference: 1 }, { unique: true });
paymentSchema.index({ stpTrackingKey: 1 }, { sparse: true, unique: true });

module.exports = mongoose.model('Payment', paymentSchema);
