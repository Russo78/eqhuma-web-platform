const axios = require('axios');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

class APIMarketService {
  constructor() {
    this.baseURL = process.env.APIMARKET_URL;
    this.apiKey = process.env.APIMARKET_API_KEY;
    this.secretKey = process.env.APIMARKET_SECRET_KEY;

    if (!this.apiKey || !this.secretKey) {
      throw new Error('Credenciales de APIMarket no configuradas');
    }
  }

  /**
   * Crear headers para peticiones a APIMarket
   * @private
   * @returns {Object} Headers
   */
  _createHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'X-Secret-Key': this.secretKey
    };
  }

  /**
   * Verificar estado de cuenta bancaria
   * @param {Object} accountData - Datos de la cuenta
   * @returns {Promise<Object>} Información de la cuenta
   */
  async verifyBankAccount(accountData) {
    try {
      const data = {
        bank_code: accountData.bankCode,
        account_number: accountData.accountNumber,
        clabe: accountData.clabe
      };

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/mx/bank-accounts/verify`,
        headers: this._createHeaders(),
        data
      });

      logger.info(`Verificación de cuenta bancaria completada: ${accountData.clabe}`);
      return response.data;
    } catch (error) {
      logger.error('Error en verificación de cuenta bancaria:', error);
      throw this._handleAPIMarketError(error);
    }
  }

  /**
   * Consultar información de una institución bancaria
   * @param {string} bankCode - Código del banco
   * @returns {Promise<Object>} Información del banco
   */
  async getBankInfo(bankCode) {
    try {
      const response = await axios({
        method: 'get',
        url: `${this.baseURL}/v1/mx/banks/${bankCode}`,
        headers: this._createHeaders()
      });

      return response.data;
    } catch (error) {
      logger.error(`Error consultando información del banco ${bankCode}:`, error);
      throw this._handleAPIMarketError(error);
    }
  }

  /**
   * Validar información fiscal
   * @param {Object} taxData - Datos fiscales
   * @returns {Promise<Object>} Resultado de validación
   */
  async validateTaxInfo(taxData) {
    try {
      const data = {
        rfc: taxData.rfc,
        business_name: taxData.businessName,
        tax_regime: taxData.taxRegime,
        postal_code: taxData.postalCode
      };

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/mx/tax/validate`,
        headers: this._createHeaders(),
        data
      });

      logger.info(`Validación fiscal completada: ${taxData.rfc}`);
      return response.data;
    } catch (error) {
      logger.error('Error en validación fiscal:', error);
      throw this._handleAPIMarketError(error);
    }
  }

  /**
   * Consultar tipo de cambio
   * @param {Object} params - Parámetros de consulta
   * @returns {Promise<Object>} Tipo de cambio
   */
  async getExchangeRate(params) {
    try {
      const { fromCurrency, toCurrency, amount } = params;
      const response = await axios({
        method: 'get',
        url: `${this.baseURL}/v1/exchange-rates`,
        headers: this._createHeaders(),
        params: {
          from: fromCurrency,
          to: toCurrency,
          amount
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error consultando tipo de cambio:', error);
      throw this._handleAPIMarketError(error);
    }
  }

  /**
   * Validar dirección postal
   * @param {Object} addressData - Datos de la dirección
   * @returns {Promise<Object>} Resultado de validación
   */
  async validateAddress(addressData) {
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/mx/addresses/validate`,
        headers: this._createHeaders(),
        data: addressData
      });

      logger.info(`Validación de dirección completada: ${addressData.postalCode}`);
      return response.data;
    } catch (error) {
      logger.error('Error en validación de dirección:', error);
      throw this._handleAPIMarketError(error);
    }
  }

  /**
   * Consultar información de código postal
   * @param {string} postalCode - Código postal
   * @returns {Promise<Object>} Información del código postal
   */
  async getPostalCodeInfo(postalCode) {
    try {
      const response = await axios({
        method: 'get',
        url: `${this.baseURL}/v1/mx/postal-codes/${postalCode}`,
        headers: this._createHeaders()
      });

      return response.data;
    } catch (error) {
      logger.error(`Error consultando información de CP ${postalCode}:`, error);
      throw this._handleAPIMarketError(error);
    }
  }

  /**
   * Validar número de teléfono
   * @param {Object} phoneData - Datos del teléfono
   * @returns {Promise<Object>} Resultado de validación
   */
  async validatePhone(phoneData) {
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/mx/phones/validate`,
        headers: this._createHeaders(),
        data: phoneData
      });

      logger.info(`Validación de teléfono completada: ${phoneData.phoneNumber}`);
      return response.data;
    } catch (error) {
      logger.error('Error en validación de teléfono:', error);
      throw this._handleAPIMarketError(error);
    }
  }

  /**
   * Manejar errores de APIMarket
   * @private
   * @param {Error} error - Error de APIMarket
   * @throws {ApiError}
   */
  _handleAPIMarketError(error) {
    let message = 'Error en el servicio de APIMarket';
    let statusCode = 500;

    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 400:
          message = 'Solicitud inválida a APIMarket';
          statusCode = 400;
          break;
        case 401:
          message = 'Error de autenticación con APIMarket';
          statusCode = 401;
          break;
        case 403:
          message = 'No autorizado por APIMarket';
          statusCode = 403;
          break;
        case 404:
          message = 'Recurso no encontrado en APIMarket';
          statusCode = 404;
          break;
        case 422:
          message = 'Error de validación en APIMarket';
          statusCode = 422;
          break;
      }

      if (data && data.message) {
        message = data.message;
      }
    }

    throw new ApiError(message, statusCode);
  }
}

module.exports = new APIMarketService();
