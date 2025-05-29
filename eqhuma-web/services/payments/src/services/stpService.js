const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const Payment = require('../models/Payment');

class STPService {
  constructor() {
    this.apiUrl = config.stp.apiUrl;
    this.apiKey = config.stp.apiKey;
    this.accountId = config.stp.accountId;
    this.privateKey = config.stp.privateKey;
    this.sandbox = config.stp.sandbox;

    // Configurar cliente axios
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Genera una referencia única para el pago
   */
  generateReference() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `EQH${timestamp}${random}`.toUpperCase();
  }

  /**
   * Genera una CLABE para recibir el pago
   */
  async generateClabe(payment) {
    try {
      const response = await this.client.post('/cuentasCLABE', {
        monto: payment.amount,
        conceptoPago: payment.concept,
        referenciaNumerica: payment.reference,
        cuentaOrdenante: this.accountId,
        nombreOrdenante: payment.clientName,
        institucionContraparte: '999', // STP
      });

      if (response.data && response.data.clabe) {
        return response.data.clabe;
      }
      throw new Error('No se pudo generar la CLABE');
    } catch (error) {
      console.error('Error generando CLABE:', error);
      throw error;
    }
  }

  /**
   * Crea un nuevo pago con STP
   */
  async createPayment(paymentData) {
    try {
      // Generar referencia única
      const reference = this.generateReference();

      // Crear el pago en la base de datos
      const payment = await Payment.create({
        ...paymentData,
        reference,
        paymentMethod: 'stp',
        status: 'pending'
      });

      // Generar CLABE para el pago
      const clabe = await this.generateClabe(payment);

      // Actualizar el pago con la CLABE
      payment.stpClabe = clabe;
      await payment.save();

      return payment;
    } catch (error) {
      console.error('Error creando pago:', error);
      throw error;
    }
  }

  /**
   * Procesa el webhook de STP
   */
  async processWebhook(webhookData) {
    try {
      // Verificar firma del webhook
      if (!this.verifyWebhookSignature(webhookData)) {
        throw new Error('Firma del webhook inválida');
      }

      const { referencia, estado, tracking_key } = webhookData;

      // Buscar el pago por referencia
      const payment = await Payment.findOne({ reference: referencia });
      if (!payment) {
        throw new Error('Pago no encontrado');
      }

      // Actualizar estado del pago
      payment.stpStatus = this.mapSTPStatus(estado);
      payment.stpTrackingKey = tracking_key;
      payment.status = payment.stpStatus === 'completed' ? 'completed' : 'processing';
      
      await payment.save();

      return payment;
    } catch (error) {
      console.error('Error procesando webhook:', error);
      throw error;
    }
  }

  /**
   * Verifica la firma del webhook de STP
   */
  verifyWebhookSignature(webhookData) {
    try {
      const signature = webhookData.signature;
      delete webhookData.signature;

      const dataString = JSON.stringify(webhookData);
      const expectedSignature = crypto
        .createHmac('sha256', this.privateKey)
        .update(dataString)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      console.error('Error verificando firma:', error);
      return false;
    }
  }

  /**
   * Mapea los estados de STP a estados internos
   */
  mapSTPStatus(stpStatus) {
    const statusMap = {
      'PENDIENTE': 'pending',
      'EN_PROCESO': 'processing',
      'LIQUIDADO': 'completed',
      'DEVUELTO': 'failed',
      'CANCELADO': 'failed'
    };
    return statusMap[stpStatus] || 'pending';
  }

  /**
   * Consulta el estado de un pago
   */
  async checkPaymentStatus(reference) {
    try {
      const response = await this.client.get(`/pagos/${reference}`);
      return response.data;
    } catch (error) {
      console.error('Error consultando estado:', error);
      throw error;
    }
  }
}

module.exports = new STPService();
