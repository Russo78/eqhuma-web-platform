const { body, param, query } = require('express-validator');
const { validateRequest } = require('./error');

const validatePayment = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser mayor a 0'),
  
  body('currency')
    .isIn(['MXN', 'USD'])
    .withMessage('Moneda no soportada'),
  
  body('paymentMethod')
    .isIn(['card', 'oxxo', 'spei', 'paypal', 'stp'])
    .withMessage('Método de pago no soportado'),
  
  body('type')
    .isIn(['course', 'webinar', 'subscription', 'service'])
    .withMessage('Tipo de pago no válido'),
  
  body('itemId')
    .notEmpty()
    .withMessage('ID del item requerido'),
  
  body('billingDetails.name')
    .notEmpty()
    .isLength({ min: 3, max: 100 })
    .withMessage('Nombre inválido'),
  
  body('billingDetails.email')
    .isEmail()
    .withMessage('Email inválido'),
  
  body('billingDetails.phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Teléfono inválido'),
  
  body('billingDetails.address.line1')
    .notEmpty()
    .withMessage('Dirección requerida'),
  
  body('billingDetails.address.city')
    .notEmpty()
    .withMessage('Ciudad requerida'),
  
  body('billingDetails.address.state')
    .notEmpty()
    .withMessage('Estado requerido'),
  
  body('billingDetails.address.postalCode')
    .notEmpty()
    .matches(/^\d{5}$/)
    .withMessage('Código postal inválido'),
  
  // Validaciones específicas para STP
  body('billingDetails.beneficiaryName')
    .if(body('paymentMethod').equals('stp'))
    .notEmpty()
    .withMessage('Nombre del beneficiario requerido para pagos STP'),
  
  body('billingDetails.beneficiaryAccount')
    .if(body('paymentMethod').equals('stp'))
    .notEmpty()
    .matches(/^\d{18}$/)
    .withMessage('CLABE inválida (debe tener 18 dígitos)'),
  
  body('billingDetails.beneficiaryBank.code')
    .if(body('paymentMethod').equals('stp'))
    .notEmpty()
    .matches(/^\d{5}$/)
    .withMessage('Código de banco inválido'),
  
  body('billingDetails.reference')
    .if(body('paymentMethod').equals('stp'))
    .notEmpty()
    .isLength({ max: 30 })
    .withMessage('Referencia inválida'),
  
  // Validaciones para pagos de servicios
  body('serviceType')
    .if(body('type').equals('service'))
    .isIn(['CFE', 'TELMEX', 'AGUA', 'GAS'])
    .withMessage('Tipo de servicio no válido'),
  
  body('billingDetails.agreementCode')
    .if(body('type').equals('service'))
    .notEmpty()
    .matches(/^\d{6,8}$/)
    .withMessage('Código de convenio inválido'),
  
  body('billingDetails.dueDate')
    .if(body('type').equals('service'))
    .optional()
    .isISO8601()
    .withMessage('Fecha de vencimiento inválida'),
  
  validateRequest
];

const validateRefund = [
  param('paymentId')
    .notEmpty()
    .withMessage('ID de pago requerido'),
  
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Monto de reembolso inválido'),
  
  body('reason')
    .notEmpty()
    .isLength({ min: 3, max: 200 })
    .withMessage('Razón de reembolso requerida'),
  
  validateRequest
];

const validateAccountStatement = [
  query('startDate')
    .notEmpty()
    .isISO8601()
    .withMessage('Fecha inicial inválida'),
  
  query('endDate')
    .notEmpty()
    .isISO8601()
    .withMessage('Fecha final inválida')
    .custom((endDate, { req }) => {
      const start = new Date(req.query.startDate);
      const end = new Date(endDate);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      if (diffDays > 31) {
        throw new Error('El rango máximo es de 31 días');
      }
      if (end < start) {
        throw new Error('La fecha final debe ser posterior a la inicial');
      }
      return true;
    }),
  
  validateRequest
];

const validateBeneficiaryAccount = [
  body('accountNumber')
    .notEmpty()
    .matches(/^\d{18}$/)
    .withMessage('CLABE inválida (debe tener 18 dígitos)'),
  
  body('bankCode')
    .notEmpty()
    .matches(/^\d{5}$/)
    .withMessage('Código de banco inválido'),
  
  validateRequest
];

const validateServiceReference = [
  body('serviceType')
    .isIn(['CFE', 'TELMEX', 'AGUA', 'GAS'])
    .withMessage('Tipo de servicio no válido'),
  
  body('reference')
    .notEmpty()
    .isLength({ min: 5, max: 30 })
    .withMessage('Referencia inválida'),
  
  validateRequest
];

module.exports = {
  validatePayment,
  validateRefund,
  validateAccountStatement,
  validateBeneficiaryAccount,
  validateServiceReference
};
