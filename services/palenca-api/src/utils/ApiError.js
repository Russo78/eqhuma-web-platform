/**
 * Clase personalizada para manejar errores de la API
 * @extends Error
 */
class ApiError extends Error {
  /**
   * Crear un nuevo error de API
   * @param {string} message - Mensaje de error
   * @param {number} statusCode - Código de estado HTTP
   * @param {Object} [details] - Detalles adicionales del error
   */
  constructor(message, statusCode, details = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;

    // Capturar stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Crear un error de validación
   * @param {string} message - Mensaje de error
   * @param {Object} details - Detalles de la validación
   * @returns {ApiError}
   */
  static validationError(message, details) {
    return new ApiError(message || 'Error de validación', 400, details);
  }

  /**
   * Crear un error de autenticación
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static authenticationError(message) {
    return new ApiError(message || 'No autenticado', 401);
  }

  /**
   * Crear un error de autorización
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static authorizationError(message) {
    return new ApiError(message || 'No autorizado', 403);
  }

  /**
   * Crear un error de recurso no encontrado
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static notFoundError(message) {
    return new ApiError(message || 'Recurso no encontrado', 404);
  }

  /**
   * Crear un error de conflicto
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static conflictError(message) {
    return new ApiError(message || 'Conflicto con el recurso existente', 409);
  }

  /**
   * Crear un error de límite excedido
   * @param {string} message - Mensaje de error
   * @param {Object} details - Detalles del límite
   * @returns {ApiError}
   */
  static rateLimitError(message, details) {
    return new ApiError(
      message || 'Límite de solicitudes excedido',
      429,
      details
    );
  }

  /**
   * Crear un error interno del servidor
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static internalError(message) {
    return new ApiError(
      message || 'Error interno del servidor',
      500
    );
  }

  /**
   * Crear un error de servicio no disponible
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static serviceUnavailableError(message) {
    return new ApiError(
      message || 'Servicio no disponible',
      503
    );
  }

  /**
   * Verificar si el error es operacional
   * @returns {boolean}
   */
  isOperationalError() {
    return this.isOperational;
  }

  /**
   * Obtener objeto de error formateado
   * @returns {Object}
   */
  toJSON() {
    return {
      status: this.status,
      statusCode: this.statusCode,
      message: this.message,
      ...(this.details && { details: this.details }),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ApiError;
