const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const stpController = require('../controllers/stpController');
const { 
  validatePayment, 
  validateRefund,
  validateAccountStatement,
  validateBeneficiaryAccount,
  validateServiceReference
} = require('../middleware/validation');
const { authMiddleware } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);
router.use(rateLimiter);

// Crear un nuevo pago
router.post(
  '/payments',
  validatePayment,
  paymentController.createPayment
);

// Confirmar un pago
router.post(
  '/payments/:paymentId/confirm',
  paymentController.confirmPayment
);

// Obtener estado de un pago
router.get(
  '/payments/:paymentId',
  paymentController.getPaymentStatus
);

// Procesar reembolso
router.post(
  '/payments/:paymentId/refund',
  paymentController.processRefund
);

// Webhooks (sin autenticación)
router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.handleStripeWebhook
);

router.post(
  '/webhooks/paypal',
  express.json(),
  paymentController.handlePayPalWebhook
);

router.post(
  '/webhooks/stp',
  express.json(),
  stpController.handleWebhook
);

// Rutas STP
const stpRouter = express.Router();

// Pagos SPEI
stpRouter.post('/payments', validatePayment, stpController.createPayment);

// Pagos de servicios
stpRouter.post('/utility-payments', validatePayment, stpController.createUtilityPayment);
stpRouter.get('/utility-services', stpController.getAvailableServices);
stpRouter.post(
  '/validate-service-reference', 
  validateServiceReference, 
  stpController.validateServiceReference
);

// Consultas y validaciones
stpRouter.get('/account-balance', stpController.getAccountBalance);
stpRouter.get('/account-statement', validateAccountStatement, stpController.getAccountStatement);
stpRouter.post('/validate-account', validateBeneficiaryAccount, stpController.validateAccount);
stpRouter.get('/banks', stpController.getBanksCatalog);

// Montar rutas STP
router.use('/stp', stpRouter);

module.exports = router;
