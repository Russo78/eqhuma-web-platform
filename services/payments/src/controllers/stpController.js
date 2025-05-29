const stpService = require('../services/stpService');
const stpUtilityService = require('../services/stpUtilityService');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Controlador para operaciones con STP
 */
class STPController {
  /**
   * Crear un pago SPEI
   */
  async createPayment(req, res, next) {
    try {
      const { amount, billingDetails, type, itemId } = req.body;

      // Crear orden de pago en STP
      const stpPayment = await stpService.createPaymentOrder({
        concept: `Pago ${type} - ${itemId}`,
        amount,
        beneficiaryName: billingDetails.beneficiaryName,
        beneficiaryAccount: billingDetails.beneficiaryAccount,
        beneficiaryBank: billingDetails.beneficiaryBank,
        reference: billingDetails.reference
      });

      // Crear registro en base de datos
      const payment = await Payment.create({
        userId: req.user.id,
        amount,
        currency: 'MXN',
        status: 'processing',
        paymentMethod: 'stp',
        type,
        itemId,
        provider: {
          name: 'stp',
          paymentId: stpPayment.paymentId,
          trackingKey: stpPayment.trackingKey,
          bankReference: stpPayment.bankReference
        },
        billingDetails
      });

      logger.info('Pago STP creado:', {
        paymentId: payment.paymentId,
        trackingKey: stpPayment.trackingKey,
        amount
      });

      res.status(201).json({
        status: 'success',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Crear pago de servicio
   */
  async createUtilityPayment(req, res, next) {
    try {
      const { amount, serviceType, billingDetails } = req.body;

      // Validar referencia del servicio
      const validation = await stpUtilityService.validateServiceReference(
        serviceType,
        billingDetails.reference
      );

      if (!validation.isValid) {
        throw new ApiError('Referencia de servicio inválida', 400, validation.details);
      }

      // Crear pago de servicio
      const stpPayment = await stpUtilityService.payUtilityService({
        serviceType,
        agreementCode: billingDetails.agreementCode,
        reference: billingDetails.reference,
        amount,
        dueDate: billingDetails.dueDate
      });

      // Crear registro en base de datos
      const payment = await Payment.create({
        userId: req.user.id,
        amount,
        currency: 'MXN',
        status: 'processing',
        paymentMethod: 'stp',
        type: 'service',
        serviceType,
        provider: {
          name: 'stp',
          paymentId: stpPayment.paymentId,
          trackingKey: stpPayment.trackingKey,
          operationId: stpPayment.operationId
        },
        billingDetails
      });

      logger.info('Pago de servicio creado:', {
        paymentId: payment.paymentId,
        serviceType,
        amount
      });

      res.status(201).json({
        status: 'success',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validar cuenta beneficiaria
   */
  async validateAccount(req, res, next) {
    try {
      const { accountNumber, bankCode } = req.body;
      const result = await stpService.validateBeneficiaryAccount(
        accountNumber,
        bankCode
      );

      res.json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener catálogo de bancos
   */
  async getBanksCatalog(req, res, next) {
    try {
      const banks = await stpService.getBanksCatalog();

      res.json({
        status: 'success',
        data: banks
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Consultar saldo
   */
  async getAccountBalance(req, res, next) {
    try {
      const balance = await stpService.getAccountBalance();

      res.json({
        status: 'success',
        data: balance
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Consultar estado de cuenta
   */
  async getAccountStatement(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const statement = await stpService.getAccountStatement(startDate, endDate);

      res.json({
        status: 'success',
        data: statement
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Procesar webhook de STP
   */
  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['stp-signature'];
      const payload = req.body;

      // Verificar firma del webhook
      if (!stpService.verifyWebhook(req.headers, payload)) {
        throw new ApiError('Firma del webhook inválida', 400);
      }

      // Obtener el pago
      const payment = await Payment.findOne({
        'provider.trackingKey': payload.claveRastreo
      });

      if (!payment) {
        throw new ApiError('Pago no encontrado', 404);
      }

      // Actualizar estado del pago
      const status = await stpService.getPaymentStatus(payload.id);
      await payment.updateStatus(status.status, status.statusDetail);

      // Si es un pago de servicio, verificar estado adicional
      if (payment.type === 'service') {
        const utilityStatus = await stpUtilityService.checkUtilityPaymentStatus(
          payment.provider.paymentId
        );
        
        if (utilityStatus.receiptUrl) {
          payment.invoice = {
            required: true,
            url: utilityStatus.receiptUrl,
            issuedAt: utilityStatus.confirmedAt
          };
          await payment.save();
        }
      }

      logger.info('Webhook STP procesado:', {
        paymentId: payment.paymentId,
        status: status.status
      });

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new STPController();
