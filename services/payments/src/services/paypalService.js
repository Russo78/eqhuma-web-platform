const axios = require('axios');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

class PayPalService {
  constructor() {
    this.baseURL = process.env.PAYPAL_API_URL;
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal credentials no están configuradas');
    }
  }

  async getAccessToken() {
    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/oauth2/token`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: 'grant_type=client_credentials'
      });

      return response.data.access_token;
    } catch (error) {
      logger.error('Error obteniendo token de PayPal:', error);
      throw new ApiError('Error de autenticación con PayPal', 500);
    }
  }

  async createOrder(data) {
    try {
      const accessToken = await this.getAccessToken();
      
      const order = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: data.currency.toUpperCase(),
            value: data.amount.toString(),
            breakdown: {
              item_total: {
                currency_code: data.currency.toUpperCase(),
                value: data.amount.toString()
              }
            }
          },
          description: data.description,
          custom_id: data.metadata.orderId,
          items: [{
            name: data.metadata.itemName,
            description: data.metadata.itemDescription,
            quantity: '1',
            unit_amount: {
              currency_code: data.currency.toUpperCase(),
              value: data.amount.toString()
            }
          }]
        }],
        application_context: {
          brand_name: 'Eqhuma Web',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: process.env.PAYPAL_RETURN_URL,
          cancel_url: process.env.PAYPAL_CANCEL_URL
        }
      };

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v2/checkout/orders`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: order
      });

      return response.data;
    } catch (error) {
      logger.error('Error creando orden en PayPal:', error);
      throw new ApiError('Error al crear orden de PayPal', 500);
    }
  }

  async captureOrder(orderId) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v2/checkout/orders/${orderId}/capture`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error capturando orden de PayPal:', error);
      throw new ApiError('Error al procesar el pago con PayPal', 500);
    }
  }

  async getOrder(orderId) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios({
        method: 'get',
        url: `${this.baseURL}/v2/checkout/orders/${orderId}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error obteniendo orden de PayPal:', error);
      throw new ApiError('Error al obtener información del pago', 500);
    }
  }

  async refundOrder(captureId, data) {
    try {
      const accessToken = await this.getAccessToken();

      const refund = {
        amount: {
          currency_code: data.currency.toUpperCase(),
          value: data.amount.toString()
        },
        note_to_payer: data.reason || 'Reembolso solicitado'
      };

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v2/payments/captures/${captureId}/refund`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: refund
      });

      return response.data;
    } catch (error) {
      logger.error('Error procesando reembolso en PayPal:', error);
      throw new ApiError('Error al procesar el reembolso', 500);
    }
  }

  async createSubscription(data) {
    try {
      const accessToken = await this.getAccessToken();

      const subscription = {
        plan_id: data.planId,
        subscriber: {
          name: {
            given_name: data.firstName,
            surname: data.lastName
          },
          email_address: data.email
        },
        application_context: {
          brand_name: 'Eqhuma Web',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
          },
          return_url: process.env.PAYPAL_SUBSCRIPTION_RETURN_URL,
          cancel_url: process.env.PAYPAL_SUBSCRIPTION_CANCEL_URL
        }
      };

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/billing/subscriptions`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: subscription
      });

      return response.data;
    } catch (error) {
      logger.error('Error creando suscripción en PayPal:', error);
      throw new ApiError('Error al crear suscripción', 500);
    }
  }

  async cancelSubscription(subscriptionId, reason) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/billing/subscriptions/${subscriptionId}/cancel`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          reason: reason || 'Cancelación solicitada por el usuario'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error cancelando suscripción en PayPal:', error);
      throw new ApiError('Error al cancelar suscripción', 500);
    }
  }

  async handleWebhookEvent(event) {
    try {
      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePaymentSuccess(event.resource);
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          await this.handlePaymentFailure(event.resource);
          break;
        case 'PAYMENT.CAPTURE.REFUNDED':
          await this.handleRefund(event.resource);
          break;
        default:
          logger.info(`Evento de PayPal no manejado: ${event.event_type}`);
      }
    } catch (error) {
      logger.error('Error procesando webhook de PayPal:', error);
      throw error;
    }
  }

  async handlePaymentSuccess(resource) {
    // Implementar lógica de éxito
    logger.info(`Pago exitoso: ${resource.id}`);
  }

  async handlePaymentFailure(resource) {
    // Implementar lógica de fallo
    logger.error(`Pago fallido: ${resource.id}`);
  }

  async handleRefund(resource) {
    // Implementar lógica de reembolso
    logger.info(`Reembolso procesado: ${resource.id}`);
  }
}

module.exports = new PayPalService();
