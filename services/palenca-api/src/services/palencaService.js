const axios = require('axios');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

class PalencaService {
  constructor() {
    this.baseURL = process.env.PALENCA_API_URL;
    this.apiKey = process.env.PALENCA_API_KEY;

    if (!this.apiKey) {
      throw new Error('Credenciales de Palenca no configuradas');
    }
  }

  /**
   * Crear headers para peticiones a Palenca
   * @private
   * @returns {Object} Headers
   */
  _createHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey
    };
  }

  /**
   * Verificar identidad mediante INE/IFE
   * @param {Object} documentData - Datos del documento
   * @returns {Promise<Object>} Resultado de verificación
   */
  async verifyIdentity(documentData) {
    try {
      const data = {
        document_type: 'INE',
        front_image: documentData.frontImage,
        back_image: documentData.backImage,
        selfie_image: documentData.selfieImage,
        user_data: {
          name: documentData.name,
          curp: documentData.curp,
          electoral_key: documentData.electoralKey
        }
      };

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/mx/verify/identity`,
        headers: this._createHeaders(),
        data
      });

      logger.info(`Verificación de identidad completada: ${response.data.verification_id}`);
      return response.data;
    } catch (error) {
      logger.error('Error en verificación de identidad:', error);
      throw this._handlePalencaError(error);
    }
  }

  /**
   * Verificar CURP
   * @param {string} curp - CURP a verificar
   * @returns {Promise<Object>} Resultado de verificación
   */
  async verifyCURP(curp) {
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/mx/verify/curp`,
        headers: this._createHeaders(),
        data: { curp }
      });

      logger.info(`Verificación de CURP completada: ${curp}`);
      return response.data;
    } catch (error) {
      logger.error('Error en verificación de CURP:', error);
      throw this._handlePalencaError(error);
    }
  }

  /**
   * Verificar RFC
   * @param {string} rfc - RFC a verificar
   * @returns {Promise<Object>} Resultado de verificación
   */
  async verifyRFC(rfc) {
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/mx/verify/rfc`,
        headers: this._createHeaders(),
        data: { rfc }
      });

      logger.info(`Verificación de RFC completada: ${rfc}`);
      return response.data;
    } catch (error) {
      logger.error('Error en verificación de RFC:', error);
      throw this._handlePalencaError(error);
    }
  }

  /**
   * Verificar comprobante de domicilio
   * @param {Object} proofData - Datos del comprobante
   * @returns {Promise<Object>} Resultado de verificación
   */
  async verifyAddressProof(proofData) {
    try {
      const data = {
        document_image: proofData.documentImage,
        document_type: proofData.documentType, // CFE, TELMEX, etc.
        address_data: {
          street: proofData.street,
          exterior_number: proofData.exteriorNumber,
          interior_number: proofData.interiorNumber,
          neighborhood: proofData.neighborhood,
          city: proofData.city,
          state: proofData.state,
          zip_code: proofData.zipCode
        }
      };

      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/v1/mx/verify/address`,
        headers: this._createHeaders(),
        data
      });

      logger.info(`Verificación de comprobante completada: ${response.data.verification_id}`);
      return response.data;
    } catch (error) {
      logger.error('Error en verificación de comprobante:', error);
      throw this._handlePalencaError(error);
    }
  }

  /**
   * Obtener estado de una verificación
   * @param {string} verificationId - ID de la verificación
   * @returns {Promise<Object>} Estado de la verificación
   */
  async getVerificationStatus(verificationId) {
    try {
      const response = await axios({
        method: 'get',
        url: `${this.baseURL}/v1/verifications/${verificationId}`,
        headers: this._createHeaders()
      });

      return response.data;
    } catch (error) {
      logger.error(`Error obteniendo estado de verificación ${verificationId}:`, error);
      throw this._handlePalencaError(error);
    }
  }

  /**
   * Obtener historial de verificaciones
   * @param {Object} params - Parámetros de consulta
   * @returns {Promise<Array>} Lista de verificaciones
   */
  async getVerificationHistory(params = {}) {
    try {
      const { startDate, endDate, status, type } = params;
      const response = await axios({
        method: 'get',
        url: `${this.baseURL}/v1/verifications`,
        headers: this._createHeaders(),
        params: {
          start_date: startDate,
          end_date: endDate,
          status,
          type
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error obteniendo historial de verificaciones:', error);
      throw this._handlePalencaError(error);
    }
  }

  /**
   * Manejar errores de Palenca
   * @private
   * @param {Error} error - Error de Palenca
   * @throws {ApiError}
   */
  _handlePalencaError(error) {
    let message = 'Error en el servicio de Palenca';
    let statusCode = 500;

    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 400:
          message = 'Solicitud inválida a Palenca';
          statusCode = 400;
          break;
        case 401:
          message = 'Error de autenticación con Palenca';
          statusCode = 401;
          break;
        case 403:
          message = 'No autorizado por Palenca';
          statusCode = 403;
          break;
        case 404:
          message = 'Recurso no encontrado en Palenca';
          statusCode = 404;
          break;
        case 422:
          message = 'Error de validación en Palenca';
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

module.exports = new PalencaService();
