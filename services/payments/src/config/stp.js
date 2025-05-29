const logger = require('./logger');

/**
 * Configuración para el servicio de STP (Sistema de Transferencias y Pagos)
 */
const stpConfig = {
  // URL base de la API de STP
  apiUrl: process.env.STP_API_URL || 'https://demo.stpmex.com/speiws/rest',
  
  // Credenciales y certificados
  privateKey: process.env.STP_PRIVATE_KEY,
  certificate: process.env.STP_CERTIFICATE,
  accountNumber: process.env.STP_ACCOUNT_NUMBER,
  institution: process.env.STP_INSTITUTION,
  webhookSecret: process.env.STP_WEBHOOK_SECRET,

  // Configuración para el servicio de pagos de servicios
  utility: {
    apiUrl: process.env.STP_UTILITY_API_URL || 'https://demo.stpmex.com/servicios/rest',
    apiKey: process.env.STP_UTILITY_API_KEY
  },

  // Validar la configuración requerida
  validate() {
    const requiredVars = [
      'STP_PRIVATE_KEY',
      'STP_CERTIFICATE',
      'STP_ACCOUNT_NUMBER',
      'STP_INSTITUTION',
      'STP_WEBHOOK_SECRET',
      'STP_UTILITY_API_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      const error = new Error(`Variables de entorno faltantes para STP: ${missingVars.join(', ')}`);
      logger.error('Error de configuración STP:', error);
      throw error;
    }

    // Validar formato de variables críticas
    if (!/^\d{10}$/.test(process.env.STP_ACCOUNT_NUMBER)) {
      throw new Error('STP_ACCOUNT_NUMBER debe ser un número de 10 dígitos');
    }

    if (!/^\d{5}$/.test(process.env.STP_INSTITUTION)) {
      throw new Error('STP_INSTITUTION debe ser un número de 5 dígitos');
    }

    return true;
  },

  // Obtener la configuración completa
  getConfig() {
    this.validate();
    return {
      apiUrl: this.apiUrl,
      privateKey: this.privateKey,
      certificate: this.certificate,
      accountNumber: this.accountNumber,
      institution: this.institution,
      webhookSecret: this.webhookSecret,
      utility: this.utility
    };
  },

  // Obtener la configuración para servicios
  getUtilityConfig() {
    this.validate();
    return this.utility;
  },

  // Constantes del servicio
  constants: {
    // Tipos de servicios soportados
    serviceTypes: {
      CFE: 'CFE',
      TELMEX: 'TELMEX',
      AGUA: 'AGUA',
      GAS: 'GAS'
    },

    // Estados de pago
    paymentStatus: {
      PENDING: 'pending',
      PROCESSING: 'processing',
      COMPLETED: 'completed',
      FAILED: 'failed',
      REJECTED: 'rejected'
    },

    // Tipos de cuenta
    accountTypes: {
      CLABE: '40',
      CARD: '03',
      MOBILE: '01'
    },

    // Prioridades de pago
    priorities: {
      NORMAL: 1,
      HIGH: 2
    },

    // Medios de entrega
    deliveryMethods: {
      SPEI: 3,
      INTERNAL: 1
    }
  }
};

module.exports = stpConfig;
