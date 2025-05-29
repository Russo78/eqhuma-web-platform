const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { validatePayment } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

// Rutas públicas
router.post('/webhook', paymentController.handleWebhook);

// Rutas protegidas
router.use(authenticate);

// Crear nuevo pago
router.post('/', validatePayment, paymentController.createPayment);

// Obtener un pago específico
router.get('/:id', paymentController.getPayment);

// Listar pagos
router.get('/', paymentController.listPayments);

// Verificar estado de pago
router.get('/status/:reference', paymentController.checkPaymentStatus);

module.exports = router;
