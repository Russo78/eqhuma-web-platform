const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const stpConfig = require('../config/stp');

class STPService {
  constructor() {
    this.config = stpConfig.getConfig();
    this.axios = axios.create({
      baseURL: this.config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Firmar petición con certificado
   */
  signRequest(data) {
    const privateKey = fs.readFileSync(this.config.privateKey);
    const sign = crypto.createSign('RSA-SHA256');
    sign.write(JSON.stringify(data));
    sign.end();
    return sign.sign(privateKey, 'base64');
  }

  /**
   * Verificar firma de webhook
   */
  verifyWebhook(headers, payload) {
    try {
      const signature = headers['stp-signature'];
      const timestamp = headers['stp-timestamp'];
      const webhookSecret = this.config.webhookSecret;

      const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Error verificando webhook STP:', error);
      return false;
    }
  }

  /**
   * Crear orden de pago SPEI
   */
  async createPaymentOrder({
    concept,
    amount,
    beneficiaryName,
    beneficiaryAccount,
    beneficiaryBank,
    reference
  }) {
    try {
      const data = {
        institucionOperante: this.config.institution,
        claveRastreo: crypto.randomBytes(16).toString('hex'),
        conceptoPago: concept,
        monto: amount.toFixed(2),
        nombreBeneficiario: beneficiaryName,
        cuentaBeneficiario: beneficiaryAccount,
        institucionContraparte: beneficiaryBank.code,
        referenciaNumerica: reference,
        tipoCuentaBeneficiario: '40', // CLABE
        tipoPago: 1 // Normal
      };

      const signature = this.signRequest(data);
      const response = await this.axios.post('/ordenPago', data, {
        headers: {
          'X-Signature': signature
        }
      });

      if (response.data.resultado.id === 0) {
        throw new ApiError(response.data.resultado.descripcion, 400);
      }

      return {
        paymentId: response.data.resultado.id,
        trackingKey: data.claveRastreo,
        bankReference: response.data.resultado.referencia
      };
    } catch (error) {
      logger.error('Error creando orden de pago STP:', error);
      throw new ApiError(
        'Error al procesar el pago con STP',
        error.response?.status || 500
      );
    }
  }

  /**
   * Validar cuenta beneficiaria
   */
  async validateBeneficiaryAccount(accountNumber, bankCode) {
    try {
      const data = {
        cuenta: accountNumber,
        institucionContraparte: bankCode,
        empresa: this.config.institution
      };

      const signature = this.signRequest(data);
      const response = await this.axios.post('/validaCuenta', data, {
        headers: {
          'X-Signature': signature
        }
      });

      return {
        isValid: response.data.resultado.id === 1,
        details: response.data.resultado.descripcion
      };
    } catch (error) {
      logger.error('Error validando cuenta STP:', error);
      throw new ApiError(
        'Error al validar la cuenta',
        error.response?.status || 500
      );
    }
  }

  /**
   * Obtener catálogo de bancos
   */
  async getBanksCatalog() {
    try {
      const response = await this.axios.get('/catalogoBancos');
      return response.data.resultado;
    } catch (error) {
      logger.error('Error obteniendo catálogo de bancos STP:', error);
      throw new ApiError(
        'Error al obtener catálogo de bancos',
        error.response?.status || 500
      );
    }
  }

  /**
   * Consultar saldo
   */
  async getAccountBalance() {
    try {
      const data = {
        cuenta: this.config.accountNumber,
        empresa: this.config.institution
      };

      const signature = this.signRequest(data);
      const response = await this.axios.post('/consultaSaldo', data, {
        headers: {
          'X-Signature': signature
        }
      });

      return {
        balance: parseFloat(response.data.resultado.saldo),
        currency: 'MXN',
        updatedAt: new Date(response.data.resultado.fechaConsulta)
      };
    } catch (error) {
      logger.error('Error consultando saldo STP:', error);
      throw new ApiError(
        'Error al consultar saldo',
        error.response?.status || 500
      );
    }
  }

  /**
   * Consultar estado de cuenta
   */
  async getAccountStatement(startDate, endDate) {
    try {
      const data = {
        cuenta: this.config.accountNumber,
        empresa: this.config.institution,
        fechaInicial: startDate,
        fechaFinal: endDate
      };

      const signature = this.signRequest(data);
      const response = await this.axios.post('/estadoCuenta', data, {
        headers: {
          'X-Signature': signature
        }
      });

      return {
        movements: response.data.resultado.movimientos,
        period: {
          startDate,
          endDate
        },
        summary: {
          initialBalance: parseFloat(response.data.resultado.saldoInicial),
          finalBalance: parseFloat(response.data.resultado.saldoFinal),
          totalCredits: parseFloat(response.data.resultado.totalAbonos),
          totalDebits: parseFloat(response.data.resultado.totalCargos)
        }
      };
    } catch (error) {
      logger.error('Error consultando estado de cuenta STP:', error);
      throw new ApiError(
        'Error al consultar estado de cuenta',
        error.response?.status || 500
      );
    }
  }

  /**
   * Obtener estado de un pago
   */
  async getPaymentStatus(paymentId) {
    try {
      const data = {
        claveRastreo: paymentId,
        empresa: this.config.institution
      };

      const signature = this.signRequest(data);
      const response = await this.axios.post('/consultaOrden', data, {
        headers: {
          'X-Signature': signature
        }
      });

      const result = response.data.resultado;
      let status;
      let statusDetail;

      switch (result.estado) {
        case 'LIQUIDADO':
          status = 'completed';
          break;
        case 'DEVOLUCION':
          status = 'refunded';
          break;
        case 'CANCELADO':
          status = 'cancelled';
          break;
        case 'ERROR':
          status = 'failed';
          break;
        default:
          status = 'processing';
      }

      statusDetail = {
        code: result.id,
        description: result.descripcion,
        processedAt: result.fechaOperacion
      };

      return { status, statusDetail };
    } catch (error) {
      logger.error('Error consultando estado de pago STP:', error);
      throw new ApiError(
        'Error al consultar estado del pago',
        error.response?.status || 500
      );
    }
  }
}

module.exports = new STPService();
