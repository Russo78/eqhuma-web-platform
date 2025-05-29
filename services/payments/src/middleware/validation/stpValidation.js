const { body, query, param } = require('express-validator');
const { validateRequest } = require('./validateRequest');

/**
 * Validación para crear pago SPEI
 */
const validateSTPPayment = [
  body('amount')
    .isFloat({ min: 1, max: 999999.99 })
    .withMessage('El monto debe estar entre 1 y 999,999.99'),
  
  body('billingDetails.beneficiaryName')
    .isString()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre del beneficiario debe tener entre 3 y 100 caracteres')
    .matches(/^[A-ZÑ\s]+$/)
    .withMessage('El nombre debe estar en mayúsculas y sin caracteres especiales'),
  
  body('billingDetails.beneficiaryAccount')
    .isString()
    .trim()
    .matches(/^\d{18}$/)
    .withMessage('La CLABE debe tener 18 dígitos'),
  
  body('billingDetails.beneficiaryBank.code')
    .isString()
    .trim()
    .matches(/^\d{5}$/)
    .withMessage('El código de banco debe tener 5 dígitos'),
  
  body('billingDetails.beneficiaryBank.name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre del banco debe tener entre 2 y 50 caracteres'),
  
  body('billingDetails.reference')
    .isString()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('La referencia debe tener entre 1 y 30 caracteres'),
  
  validateRequest
];

/**
 * Validación para pago de servicios
 */
const validateUtilityPayment = [
  body('amount')
    .isFloat({ min: 1, max: 999999.99 })
    .withMessage('El monto debe estar entre 1 y 999,999.99'),
  
  body('serviceType')
    .isIn(['CFE', 'TELMEX', 'AGUA', 'GAS'])
    .withMessage('Tipo de servicio no válido'),
  
  body('billingDetails.agreementCode')
    .isString()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('El código de convenio debe tener entre 1 y 20 caracteres'),
  
  body('billingDetails.reference')
    .isString()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('La referencia debe tener entre 1 y 30 caracteres'),
  
  body('billingDetails.dueDate')
    .optional()
    .isISO8601()
    .withMessage('La fecha de vencimiento debe estar en formato ISO8601'),
  
  validateRequest
];

/**
 * Validación para consulta de estado de cuenta
 */
const validateAccountStatement = [
  query('startDate')
    .isISO8601()
    .withMessage('La fecha inicial debe estar en formato ISO8601'),
  
  query('endDate')
    .isISO8601()
    .withMessage('La fecha final debe estar en formato ISO8601')
    .custom((endDate, { req }) => {
      const start = new Date(req.query.startDate);
      const end = new Date(endDate);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      if (diffDays > 31) {
        throw new Error('El rango de fechas no puede ser mayor a 31 días');
      }
      if (diffDays < 0) {
        throw new Error('La fecha final debe ser posterior a la fecha inicial');
      }
      return true;
    }),
  
  validateRequest
];

/**
 * Validación para validar cuenta beneficiaria
 */
const validateBeneficiaryAccount = [
  body('accountNumber')
    .isString()
    .trim()
    .matches(/^\d{18}$/)
    .withMessage('La CLABE debe tener 18 dígitos'),
  
  body('bankCode')
    .isString()
    .trim()
    .matches(/^\d{5}$/)
    .withMessage('El código de banco debe tener 5 dígitos'),
  
  validateRequest
];

/**
 * Validación para validar referencia de servicio
 */
const validateServiceReference = [
  body('serviceType')
    .isIn(['CFE', 'TELMEX', 'AGUA', 'GAS'])
    .withMessage('Tipo de servicio no válido'),
  
  body('reference')
    .isString()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('La referencia debe tener entre 1 y 30 caracteres'),
  
  validateRequest
];

/**
 * Validación para historial de pagos de servicio
 */
const validatePaymentHistory = [
  query('serviceType')
    .isIn(['CFE', 'TELMEX', 'AGUA', 'GAS'])
    .withMessage('Tipo de servicio no válido'),
  
  query('reference')
    .isString()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('La referencia debe tener entre 1 y 30 caracteres'),
  
  query('startDate')
    .isISO8601()
    .withMessage('La fecha inicial debe estar en formato ISO8601'),
  
  query('endDate')
    .isISO8601()
    .withMessage('La fecha final debe estar en formato ISO8601')
    .custom((endDate, { req }) => {
      const start = new Date(req.query.startDate);
      const end = new Date(endDate);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      if (diffDays > 90) {
        throw new Error('El rango de fechas no puede ser mayor a 90 días');
      }
      if (diffDays < 0) {
        throw new Error('La fecha final debe ser posterior a la fecha inicial');
      }
      return true;
    }),
  
  validateRequest
];

module.exports = {
  validateSTPPayment,
  validateUtilityPayment,
  validateAccountStatement,
  validateBeneficiaryAccount,
  validateServiceReference,
  validatePaymentHistory
};
