const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    default: () => `pay_${uuidv4()}`,
    unique: true,
    required: true
  },
  userId: {
    type: String,
    required: [true, 'El ID del usuario es requerido']
  },
  amount: {
    type: Number,
    required: [true, 'El monto es requerido'],
    min: [0, 'El monto no puede ser negativo']
  },
  currency: {
    type: String,
    required: [true, 'La moneda es requerida'],
    enum: {
      values: ['MXN', 'USD'],
      message: 'Moneda no soportada'
    },
    default: 'MXN'
  },
  status: {
    type: String,
    required: true,
    enum: {
      values: [
        'pending',
        'processing',
        'completed',
        'failed',
        'refunded',
        'cancelled'
      ],
      message: 'Estado de pago no válido'
    },
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    required: [true, 'El método de pago es requerido'],
    enum: {
      values: ['card', 'oxxo', 'spei', 'paypal', 'stp'],
      message: 'Método de pago no soportado'
    }
  },
  type: {
    type: String,
    required: [true, 'El tipo de pago es requerido'],
    enum: {
      values: ['course', 'webinar', 'subscription', 'service'],
      message: 'Tipo de pago no válido'
    }
  },
  itemId: {
    type: String,
    required: [true, 'El ID del item es requerido']
  },
  provider: {
    name: {
      type: String,
      required: true,
      enum: ['stripe', 'paypal', 'stp']
    },
    paymentId: String,
    chargeId: String,
    refundId: String,
    trackingKey: String,    // Para STP
    operationId: String,    // Para STP
    bankReference: String   // Para STP
  },
  billingDetails: {
    name: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
      minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
      maxlength: [100, 'El nombre no puede exceder 100 caracteres']
    },
    email: {
      type: String,
      required: [true, 'El email es requerido'],
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Email inválido'
      ]
    },
    phone: String,
    address: {
      line1: {
        type: String,
        required: [true, 'La dirección es requerida']
      },
      line2: String,
      city: {
        type: String,
        required: [true, 'La ciudad es requerida']
      },
      state: {
        type: String,
        required: [true, 'El estado es requerido']
      },
      postalCode: {
        type: String,
        required: [true, 'El código postal es requerido']
      },
      country: {
        type: String,
        default: 'MX'
      }
    },
    taxId: {
      type: String,
      match: [
        /^[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/,
        'RFC inválido'
      ]
    },
    // Campos específicos para STP
    beneficiaryName: String,
    beneficiaryAccount: String,
    beneficiaryBank: {
      code: String,
      name: String
    },
    reference: String,
    agreementCode: String,  // Para pagos de servicios
    dueDate: Date          // Para pagos de servicios
  },
  // Campo para tipo de servicio (cuando type es 'service')
  serviceType: {
    type: String,
    enum: {
      values: ['CFE', 'TELMEX', 'AGUA', 'GAS', null],
      message: 'Tipo de servicio no válido'
    },
    default: null
  },
  metadata: {
    type: Map,
    of: String
  },
  invoice: {
    required: {
      type: Boolean,
      default: false
    },
    number: String,
    url: String,
    issuedAt: Date
  },
  refunds: [{
    amount: Number,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed']
    },
    processedAt: Date,
    refundId: String
  }],
  error: {
    code: String,
    message: String,
    detail: mongoose.Schema.Types.Mixed
  },
  attempts: [{
    timestamp: Date,
    status: String,
    error: mongoose.Schema.Types.Mixed
  }],
  webhookEvents: [{
    type: String,
    receivedAt: Date,
    data: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: 1 });
paymentSchema.index({ 'provider.paymentId': 1 });
paymentSchema.index({ 'provider.trackingKey': 1 });
paymentSchema.index({ 'billingDetails.email': 1 });
paymentSchema.index({ paymentId: 1 }, { unique: true });

// Virtuals
paymentSchema.virtual('isRefundable').get(function() {
  const refundableStatuses = ['completed'];
  const refundableWindow = 30 * 24 * 60 * 60 * 1000; // 30 días
  return (
    refundableStatuses.includes(this.status) &&
    Date.now() - this.createdAt <= refundableWindow &&
    ['card', 'stp'].includes(this.paymentMethod)
  );
});

// Middleware pre-save
paymentSchema.pre('save', function(next) {
  if (this.isNew) {
    this.attempts = [{
      timestamp: new Date(),
      status: this.status
    }];
  } else if (this.isModified('status')) {
    this.attempts.push({
      timestamp: new Date(),
      status: this.status
    });
  }
  next();
});

// Métodos estáticos
paymentSchema.statics.findByPaymentId = function(paymentId) {
  return this.findOne({ paymentId });
};

// Métodos de instancia
paymentSchema.methods.updateStatus = async function(status, error = null) {
  this.status = status;
  if (error) {
    this.error = {
      code: error.code,
      message: error.message,
      detail: error
    };
  }
  return this.save();
};

paymentSchema.methods.addWebhookEvent = async function(type, data) {
  this.webhookEvents.push({
    type,
    receivedAt: new Date(),
    data
  });
  return this.save();
};

paymentSchema.methods.processRefund = async function(amount, reason) {
  if (!this.isRefundable) {
    throw new Error('Este pago no es reembolsable');
  }
  
  const refund = {
    amount: amount || this.amount,
    reason,
    status: 'pending',
    processedAt: new Date(),
    refundId: `ref_${uuidv4()}`
  };
  
  this.refunds.push(refund);
  if (amount === this.amount) {
    this.status = 'refunded';
  }
  
  return this.save();
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
