const axios = require('axios');
const crypto = require('crypto');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const stpConfig = require('../config/stp');

class STPUtilityService {
  constructor() {
    const config = stpConfig.getUtilityConfig();
    this.axios = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey
      }
    });
  }

  /**
   * Obtener servicios disponibles para pago
   */
  async getAvailableServices() {
    try {
      const response = await this.axios.get('/servicios');
      return response.data.servicios.map(service => ({
        id: service.id,
        type: service.tipo,
        name: service.nombre,
        description: service.descripcion,
        minAmount: parseFloat(service.montoMinimo),
        maxAmount: parseFloat(service.montoMaximo),
        commission: parseFloat(service.comision),
        schedule: {
          start: service.horarioInicio,
          end: service.horarioFin,
          timezone: 'America/Mexico_City'
        },
        validationRules: service.reglasValidacion
      }));
    } catch (error) {
      logger.error('Error obteniendo servicios disponibles:', error);
      throw new ApiError(
        'Error al obtener servicios disponibles',
        error.response?.status || 500
      );
    }
  }

  /**
   * Validar referencia de servicio
   */
  async validateServiceReference(serviceType, reference) {
    try {
      const data = {
        tipoServicio: serviceType,
        referencia: reference
      };

      const response = await this.axios.post('/validar-referencia', data);

      return {
        isValid: response.data.esValida,
        details: {
          customerName: response.data.nombreCliente,
          amount: parseFloat(response.data.monto),
          dueDate: response.data.fechaVencimiento,
          additionalInfo: response.data.informacionAdicional
        }
      };
    } catch (error) {
      logger.error('Error validando referencia de servicio:', error);
      throw new ApiError(
        'Error al validar referencia de servicio',
        error.response?.status || 500
      );
    }
  }

  /**
   * Realizar pago de servicio
   */
  async payUtilityService({
    serviceType,
    agreementCode,
    reference,
    amount,
    dueDate
  }) {
    try {
      const data = {
        tipoServicio: serviceType,
        codigoConvenio: agreementCode,
        referencia: reference,
        monto: amount.toFixed(2),
        fechaVencimiento: dueDate,
        claveRastreo: crypto.randomBytes(16).toString('hex')
      };

      const response = await this.axios.post('/pagar-servicio', data);

      if (!response.data.exitoso) {
        throw new ApiError(response.data.mensaje, 400);
      }

      return {
        paymentId: response.data.idPago,
        trackingKey: data.claveRastreo,
        operationId: response.data.idOperacion,
        status: response.data.estado,
        processedAt: response.data.fechaProceso
      };
    } catch (error) {
      logger.error('Error procesando pago de servicio:', error);
      throw new ApiError(
        'Error al procesar pago de servicio',
        error.response?.status || 500
      );
    }
  }

  /**
   * Verificar estado de pago de servicio
   */
  async checkUtilityPaymentStatus(paymentId) {
    try {
      const response = await this.axios.get(`/estado-pago/${paymentId}`);

      return {
        status: response.data.estado,
        statusDetail: response.data.detalleEstado,
        processedAt: response.data.fechaProceso,
        confirmedAt: response.data.fechaConfirmacion,
        receiptUrl: response.data.urlRecibo,
        additionalInfo: response.data.informacionAdicional
      };
    } catch (error) {
      logger.error('Error verificando estado de pago de servicio:', error);
      throw new ApiError(
        'Error al verificar estado del pago',
        error.response?.status || 500
      );
    }
  }

  /**
   * Obtener recibo de pago
   */
  async getUtilityPaymentReceipt(paymentId) {
    try {
      const response = await this.axios.get(`/recibo/${paymentId}`, {
        responseType: 'arraybuffer'
      });

      return {
        content: response.data,
        contentType: response.headers['content-type'],
        filename: `recibo-${paymentId}.pdf`
      };
    } catch (error) {
      logger.error('Error obteniendo recibo de pago:', error);
      throw new ApiError(
        'Error al obtener recibo de pago',
        error.response?.status || 500
      );
    }
  }

  /**
   * Obtener historial de pagos de servicio
   */
  async getUtilityPaymentHistory(serviceType, reference, startDate, endDate) {
    try {
      const params = {
        tipoServicio: serviceType,
        referencia: reference,
        fechaInicio: startDate,
        fechaFin: endDate
      };

      const response = await this.axios.get('/historial-pagos', { params });

      return response.data.pagos.map(payment => ({
        paymentId: payment.idPago,
        amount: parseFloat(payment.monto),
        status: payment.estado,
        processedAt: payment.fechaProceso,
        receiptUrl: payment.urlRecibo
      }));
    } catch (error) {
      logger.error('Error obteniendo historial de pagos:', error);
      throw new ApiError(
        'Error al obtener historial de pagos',
        error.response?.status || 500
      );
    }
  }

  /**
   * Obtener convenios disponibles por tipo de servicio
   */
  async getServiceAgreements(serviceType) {
    try {
      const response = await this.axios.get(`/convenios/${serviceType}`);

      return response.data.convenios.map(agreement => ({
        code: agreement.codigo,
        name: agreement.nombre,
        description: agreement.descripcion,
        validationFormat: agreement.formatoValidacion,
        paymentInstructions: agreement.instruccionesPago
      }));
    } catch (error) {
      logger.error('Error obteniendo convenios de servicio:', error);
      throw new ApiError(
        'Error al obtener convenios de servicio',
        error.response?.status || 500
      );
    }
  }
}

module.exports = new STPUtilityService();
