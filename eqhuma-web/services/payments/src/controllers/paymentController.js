const stpService = require('../services/stpService');
const Payment = require('../models/Payment');

class PaymentController {
  /**
   * Crear un nuevo pago
   */
  async createPayment(req, res) {
    try {
      const paymentData = {
        clientId: req.body.clientId,
        clientName: req.body.clientName,
        clientEmail: req.body.clientEmail,
        amount: req.body.amount,
        concept: req.body.concept,
        currency: req.body.currency || 'MXN'
      };

      const payment = await stpService.createPayment(paymentData);

      res.status(201).json({
        success: true,
        data: {
          paymentId: payment._id,
          reference: payment.reference,
          clabe: payment.stpClabe,
          amount: payment.amount,
          status: payment.status
        }
      });
    } catch (error) {
      console.error('Error en createPayment:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear el pago'
      });
    }
  }

  /**
   * Obtener detalles de un pago
   */
  async getPayment(req, res) {
    try {
      const payment = await Payment.findById(req.params.id);
      
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Pago no encontrado'
        });
      }

      res.json({
        success: true,
        data: payment
      });
    } catch (error) {
      console.error('Error en getPayment:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener el pago'
      });
    }
  }

  /**
   * Listar pagos con filtros
   */
  async listPayments(req, res) {
    try {
      const { clientId, status, page = 1, limit = 10 } = req.query;
      
      const query = {};
      if (clientId) query.clientId = clientId;
      if (status) query.status = status;

      const payments = await Payment.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Payment.countDocuments(query);

      res.json({
        success: true,
        data: payments,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error en listPayments:', error);
      res.status(500).json({
        success: false,
        error: 'Error al listar los pagos'
      });
    }
  }

  /**
   * Procesar webhook de STP
   */
  async handleWebhook(req, res) {
    try {
      const webhookData = req.body;
      await stpService.processWebhook(webhookData);

      res.json({
        success: true,
        message: 'Webhook procesado correctamente'
      });
    } catch (error) {
      console.error('Error en handleWebhook:', error);
      res.status(500).json({
        success: false,
        error: 'Error al procesar webhook'
      });
    }
  }

  /**
   * Verificar estado de un pago
   */
  async checkPaymentStatus(req, res) {
    try {
      const { reference } = req.params;
      const status = await stpService.checkPaymentStatus(reference);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error en checkPaymentStatus:', error);
      res.status(500).json({
        success: false,
        error: 'Error al verificar estado del pago'
      });
    }
  }
}

module.exports = new PaymentController();
