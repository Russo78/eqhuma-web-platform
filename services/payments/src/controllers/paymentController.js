const Payment = require('../models/Payment');
const stripeService = require('../services/stripeService');
const paypalService = require('../services/paypalService');
const stpService = require('../services/stpService');
const stpUtilityService = require('../services/stpUtilityService');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { asyncErrorHandler } = require('../middleware/error');

/**
 * Controlador para las operaciones de pago
 */
class PaymentController {
  /**
   * Iniciar un nuevo pago
   */
  createPayment = asyncErrorHandler(async (req, res) => {
    const { amount, currency, paymentMethod, type, itemId, billingDetails, serviceType } = req.body;

    // Crear registro de pago en la base de datos
    const payment = await Payment.create({
      userId: req.user.id,
      amount,
      currency,
      paymentMethod,
      type,
      itemId,
      billingDetails,
      serviceType,
      status: 'pending'
    });

    let paymentIntent;
    try {
      // Procesar el pago según el método seleccionado
      if (paymentMethod === 'paypal') {
        const orderData = {
          amount,
          currency,
          description: `Pago por ${type} - ${itemId}`,
          items: [{
            name: `${type} - ${itemId}`,
            description: `Pago por ${type}`,
            price: amount
          }],
          billingDetails
        };
        paymentIntent = await paypalService.createOrder(orderData);
        
        await payment.updateStatus('processing', {
          provider: {
            name: 'paypal',
            paymentId: paymentIntent.id
          }
        });
      } else if (paymentMethod === 'stp') {
        // Procesar pago con STP
        let stpPaymentIntent;
        
        if (type === 'service') {
          // Pago de servicios
          stpPaymentIntent = await stpUtilityService.payUtilityService({
            serviceType,
            agreementCode: billingDetails.agreementCode,
            reference: billingDetails.reference,
            amount,
            dueDate: billingDetails.dueDate
          });
        } else {
          // Transferencia SPEI normal
          stpPaymentIntent = await stpService.createPaymentOrder({
            concept: `Pago por ${type} - ${itemId}`,
            amount,
            beneficiaryName: billingDetails.beneficiaryName,
            beneficiaryAccount: billingDetails.beneficiaryAccount,
            beneficiaryBank: billingDetails.beneficiaryBank,
            reference: billingDetails.reference
          });
        }

        await payment.updateStatus('processing', {
          provider: {
            name: 'stp',
            paymentId: stpPaymentIntent.paymentId,
            trackingKey: stpPaymentIntent.trackingKey
          }
        });

        paymentIntent = stpPaymentIntent;
      } else {
        // Stripe (card, oxxo, spei)
        const paymentData = {
          amount,
          currency,
          paymentMethod,
          description: `Pago por ${type} - ${itemId}`,
          metadata: {
            paymentId: payment.paymentId,
            type,
            itemId
          },
          billingDetails
        };
        paymentIntent = await stripeService.createPaymentIntent(paymentData);
        
        await payment.updateStatus('processing', {
          provider: {
            name: 'stripe',
            paymentId: paymentIntent.id
          }
        });
      }

      res.status(201).json({
        status: 'success',
        data: {
          paymentId: payment.paymentId,
          clientSecret: paymentIntent.client_secret,
          provider: payment.provider.name,
          trackingKey: paymentIntent.trackingKey
        }
      });
    } catch (error) {
      // Si hay error, actualizar el estado del pago
      await payment.updateStatus('failed', error);
      throw error;
    }
  });

  /**
   * Confirmar un pago
   */
  confirmPayment = asyncErrorHandler(async (req, res) => {
    const { paymentId } = req.params;
    const payment = await Payment.findByPaymentId(paymentId);

    if (!payment) {
      throw new ApiError('Pago no encontrado', 404);
    }

    if (payment.status === 'completed') {
      return res.json({
        status: 'success',
        data: { payment }
      });
    }

    try {
      if (payment.provider.name === 'paypal') {
        const capture = await paypalService.captureOrder(payment.provider.paymentId);
        await payment.updateStatus('completed', {
          provider: {
            ...payment.provider,
            chargeId: capture.purchase_units[0].payments.captures[0].id
          }
        });
      } else if (payment.provider.name === 'stp') {
        const status = payment.type === 'service' 
          ? await stpUtilityService.checkUtilityPaymentStatus(payment.provider.paymentId)
          : await stpService.getPaymentStatus(payment.provider.paymentId);

        if (status.status === 'completed' || status.status === 'success') {
          await payment.updateStatus('completed', {
            provider: {
              ...payment.provider,
              chargeId: status.operationId || status.paymentId
            }
          });
        } else if (status.status === 'failed' || status.status === 'rejected') {
          await payment.updateStatus('failed', {
            message: status.statusDetail || 'Pago rechazado por STP'
          });
        }
      } else {
        const paymentIntent = await stripeService.confirmPaymentIntent(
          payment.provider.paymentId,
          req.body.paymentMethod
        );
        await payment.updateStatus('completed', {
          provider: {
            ...payment.provider,
            chargeId: paymentIntent.charges.data[0].id
          }
        });
      }

      res.json({
        status: 'success',
        data: { payment }
      });
    } catch (error) {
      await payment.updateStatus('failed', error);
      throw error;
    }
  });

  /**
   * Procesar un reembolso
   */
  processRefund = asyncErrorHandler(async (req, res) => {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    const payment = await Payment.findByPaymentId(paymentId);
    if (!payment) {
      throw new ApiError('Pago no encontrado', 404);
    }

    if (!payment.isRefundable) {
      throw new ApiError('Este pago no es reembolsable', 400);
    }

    try {
      let refund;
      if (payment.provider.name === 'paypal') {
        refund = await paypalService.processRefund(
          payment.provider.chargeId,
          amount || payment.amount,
          reason
        );
      } else if (payment.provider.name === 'stp') {
        refund = await stpService.createRefund({
          originalPaymentId: payment.provider.paymentId,
          amount: amount || payment.amount,
          reason,
          beneficiaryAccount: payment.billingDetails.beneficiaryAccount,
          beneficiaryName: payment.billingDetails.beneficiaryName
        });
      } else {
        refund = await stripeService.processRefund(
          payment.provider.paymentId,
          amount || payment.amount,
          reason
        );
      }

      await payment.processRefund(amount, reason);

      res.json({
        status: 'success',
        data: { refund }
      });
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw new ApiError('Error al procesar el reembolso', 500);
    }
  });

  /**
   * Obtener el estado de un pago
   */
  getPaymentStatus = asyncErrorHandler(async (req, res) => {
    const { paymentId } = req.params;
    const payment = await Payment.findByPaymentId(paymentId);

    if (!payment) {
      throw new ApiError('Pago no encontrado', 404);
    }

    // Si el pago está en proceso, verificar con el proveedor
    if (payment.status === 'processing') {
      try {
        if (payment.provider.name === 'paypal') {
          const orderDetails = await paypalService.getOrderDetails(payment.provider.paymentId);
          if (orderDetails.status === 'COMPLETED') {
            await payment.updateStatus('completed');
          }
        } else if (payment.provider.name === 'stp') {
          const status = payment.type === 'service'
            ? await stpUtilityService.checkUtilityPaymentStatus(payment.provider.paymentId)
            : await stpService.getPaymentStatus(payment.provider.paymentId);

          if (status.status === 'completed' || status.status === 'success') {
            await payment.updateStatus('completed');
          } else if (status.status === 'failed' || status.status === 'rejected') {
            await payment.updateStatus('failed', {
              message: status.statusDetail || 'Pago rechazado por STP'
            });
          }
        } else {
          const paymentIntent = await stripeService.retrievePaymentIntent(payment.provider.paymentId);
          if (paymentIntent.status === 'succeeded') {
            await payment.updateStatus('completed');
          }
        }
      } catch (error) {
        logger.error('Error checking payment status:', error);
      }
    }

    res.json({
      status: 'success',
      data: { payment }
    });
  });

  /**
   * Manejar webhook de Stripe
   */
  handleStripeWebhook = asyncErrorHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const event = stripeService.verifyWebhookSignature(req.rawBody, sig);

    const paymentIntent = event.data.object;
    const payment = await Payment.findOne({
      'provider.name': 'stripe',
      'provider.paymentId': paymentIntent.id
    });

    if (!payment) {
      throw new ApiError('Pago no encontrado', 404);
    }

    await payment.addWebhookEvent(event.type, event.data.object);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await payment.updateStatus('completed');
        break;
      case 'payment_intent.payment_failed':
        await payment.updateStatus('failed', paymentIntent.last_payment_error);
        break;
    }

    res.json({ received: true });
  });

  /**
   * Manejar webhook de PayPal
   */
  handlePayPalWebhook = asyncErrorHandler(async (req, res) => {
    const isValid = await paypalService.verifyWebhook(req.headers, req.body);
    if (!isValid) {
      throw new ApiError('Invalid webhook signature', 400);
    }

    const event = req.body;
    const payment = await Payment.findOne({
      'provider.name': 'paypal',
      'provider.paymentId': event.resource.id
    });

    if (!payment) {
      throw new ApiError('Pago no encontrado', 404);
    }

    await payment.addWebhookEvent(event.event_type, event.resource);

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await payment.updateStatus('completed');
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await payment.updateStatus('failed', { message: 'Payment denied by PayPal' });
        break;
    }

    res.json({ received: true });
  });

  /**
   * Manejar webhook de STP
   */
  handleSTPWebhook = asyncErrorHandler(async (req, res) => {
    const isValid = await stpService.verifyWebhook(req.headers, req.body);
    if (!isValid) {
      throw new ApiError('Invalid webhook signature', 400);
    }

    const event = req.body;
    const payment = await Payment.findOne({
      'provider.name': 'stp',
      'provider.trackingKey': event.trackingKey
    });

    if (!payment) {
      throw new ApiError('Pago no encontrado', 404);
    }

    await payment.addWebhookEvent(event.type, event);

    switch (event.type) {
      case 'payment.succeeded':
        await payment.updateStatus('completed', {
          provider: {
            ...payment.provider,
            chargeId: event.operationId
          }
        });
        break;
      case 'payment.failed':
        await payment.updateStatus('failed', {
          message: event.failureReason || 'Pago fallido en STP'
        });
        break;
    }

    res.json({ received: true });
  });
}

module.exports = new PaymentController();
