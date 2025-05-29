const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

class StripeService {
  constructor() {
    this.stripe = stripe;
  }

  /**
   * Crear una intención de pago con Stripe
   * @param {Object} paymentData - Datos del pago
   * @returns {Promise<Object>} Intención de pago
   */
  async createPaymentIntent(paymentData) {
    try {
      const {
        amount,
        currency = 'MXN',
        paymentMethod,
        description,
        metadata = {},
        customer = null,
        billingDetails
      } = paymentData;

      // Convertir el monto a centavos para Stripe
      const amountInCents = Math.round(amount * 100);

      const paymentIntentData = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        payment_method_types: this._getPaymentMethodTypes(paymentMethod),
        description,
        metadata: {
          ...metadata,
          integration_check: 'payments_api'
        },
        receipt_email: billingDetails.email
      };

      // Agregar customer si existe
      if (customer) {
        paymentIntentData.customer = customer;
      }

      // Configurar opciones específicas según el método de pago
      if (paymentMethod === 'oxxo') {
        paymentIntentData.payment_method_options = {
          oxxo: {
            expires_after_days: 2
          }
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      logger.info(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw this._handleStripeError(error);
    }
  }

  /**
   * Confirmar una intención de pago
   * @param {string} paymentIntentId - ID de la intención de pago
   * @param {Object} paymentMethod - Método de pago
   * @returns {Promise<Object>} Intención de pago confirmada
   */
  async confirmPaymentIntent(paymentIntentId, paymentMethod) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethod
        }
      );

      logger.info(`Payment intent confirmed: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Error confirming payment intent:', error);
      throw this._handleStripeError(error);
    }
  }

  /**
   * Procesar un reembolso
   * @param {string} paymentIntentId - ID de la intención de pago
   * @param {number} amount - Monto a reembolsar
   * @param {string} reason - Razón del reembolso
   * @returns {Promise<Object>} Reembolso procesado
   */
  async processRefund(paymentIntentId, amount, reason) {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(amount * 100),
        reason
      });

      logger.info(`Refund processed: ${refund.id}`);
      return refund;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw this._handleStripeError(error);
    }
  }

  /**
   * Crear o actualizar un cliente en Stripe
   * @param {Object} customerData - Datos del cliente
   * @returns {Promise<Object>} Cliente creado o actualizado
   */
  async createOrUpdateCustomer(customerData) {
    try {
      const {
        email,
        name,
        phone,
        metadata = {},
        stripeCustomerId
      } = customerData;

      const customerParams = {
        email,
        name,
        phone,
        metadata
      };

      let customer;
      if (stripeCustomerId) {
        customer = await this.stripe.customers.update(
          stripeCustomerId,
          customerParams
        );
        logger.info(`Customer updated: ${customer.id}`);
      } else {
        customer = await this.stripe.customers.create(customerParams);
        logger.info(`Customer created: ${customer.id}`);
      }

      return customer;
    } catch (error) {
      logger.error('Error creating/updating customer:', error);
      throw this._handleStripeError(error);
    }
  }

  /**
   * Verificar la firma de un webhook
   * @param {string} payload - Payload del webhook
   * @param {string} signature - Firma del webhook
   * @returns {Object} Evento verificado
   */
  verifyWebhookSignature(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      logger.info(`Webhook verified: ${event.type}`);
      return event;
    } catch (error) {
      logger.error('Error verifying webhook:', error);
      throw new ApiError('Invalid webhook signature', 400);
    }
  }

  /**
   * Obtener los tipos de método de pago según el método seleccionado
   * @private
   * @param {string} paymentMethod - Método de pago
   * @returns {string[]} Tipos de método de pago
   */
  _getPaymentMethodTypes(paymentMethod) {
    switch (paymentMethod) {
      case 'card':
        return ['card'];
      case 'oxxo':
        return ['oxxo'];
      case 'spei':
        return ['spei'];
      default:
        return ['card'];
    }
  }

  /**
   * Manejar errores de Stripe
   * @private
   * @param {Error} error - Error de Stripe
   * @throws {ApiError}
   */
  _handleStripeError(error) {
    let message = 'Error procesando el pago';
    let statusCode = 500;

    switch (error.type) {
      case 'StripeCardError':
        message = error.message;
        statusCode = 400;
        break;
      case 'StripeInvalidRequestError':
        message = 'Solicitud inválida a Stripe';
        statusCode = 400;
        break;
      case 'StripeAPIError':
        message = 'Error en el servicio de Stripe';
        statusCode = 503;
        break;
      case 'StripeConnectionError':
        message = 'Error de conexión con Stripe';
        statusCode = 503;
        break;
      case 'StripeAuthenticationError':
        message = 'Error de autenticación con Stripe';
        statusCode = 401;
        break;
    }

    throw new ApiError(message, statusCode);
  }
}

module.exports = new StripeService();
