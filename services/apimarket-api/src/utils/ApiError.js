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
   * @param {string} [errorCode] - Código de error personalizado
   */
  constructor(message, statusCode, details = null, errorCode = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;
    this.errorCode = errorCode;
    this.timestamp = new Date().toISOString();

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
    return new ApiError(
      message || 'Error de validación',
      400,
      details,
      'VALIDATION_ERROR'
    );
  }

  /**
   * Crear un error de autenticación
   * @param {string} message - Mensaje de error
   * @param {Object} [details] - Detalles adicionales
   * @returns {ApiError}
   */
  static authenticationError(message, details = null) {
    return new ApiError(
      message || 'No autenticado',
      401,
      details,
      'AUTHENTICATION_ERROR'
    );
  }

  /**
   * Crear un error de autorización
   * @param {string} message - Mensaje de error
   * @param {Object} [details] - Detalles adicionales
   * @returns {ApiError}
   */
  static authorizationError(message, details = null) {
    return new ApiError(
      message || 'No autorizado',
      403,
      details,
      'AUTHORIZATION_ERROR'
    );
  }

  /**
   * Crear un error de recurso no encontrado
   * @param {string} message - Mensaje de error
   * @param {Object} [details] - Detalles adicionales
   * @returns {ApiError}
   */
  static notFoundError(message, details = null) {
    return new ApiError(
      message || 'Recurso no encontrado',
      404,
      details,
      'NOT_FOUND_ERROR'
    );
  }

  /**
   * Crear un error de conflicto
   * @param {string} message - Mensaje de error
   * @param {Object} [details] - Detalles adicionales
   * @returns {ApiError}
   */
  static conflictError(message, details = null) {
    return new ApiError(
      message || 'Conflicto con el recurso existente',
      409,
      details,
      'CONFLICT_ERROR'
    );
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
      details,
      'RATE_LIMIT_ERROR'
    );
  }

  /**
   * Crear un error de servicio externo
   * @param {string} message - Mensaje de error
   * @param {Object} details - Detalles del error
   * @returns {ApiError}
   */
  static externalServiceError(message, details) {
    return new ApiError(
      message || 'Error en servicio externo',
      502,
      details,
      'EXTERNAL_SERVICE_ERROR'
    );
  }

  /**
   * Crear un error de timeout
   * @param {string} message - Mensaje de error
   * @param {Object} [details] - Detalles adicionales
   * @returns {ApiError}
   */
  static timeoutError(message, details = null) {
    return new ApiError(
      message || 'Tiempo de espera excedido',
      408,
      details,
      'TIMEOUT_ERROR'
    );
  }

  /**
   * Crear un error interno del servidor
   * @param {string} message - Mensaje de error
   * @param {Object} [details] - Detalles adicionales
   * @returns {ApiError}
   */
  static internalError(message, details = null) {
    return new ApiError(
      message || 'Error interno del servidor',
      500,
      details,
      'INTERNAL_SERVER_ERROR'
    );
  }

  /**
   * Crear un error de servicio no disponible
   * @param {string} message - Mensaje de error
   * @param {Object} [details] - Detalles adicionales
   * @returns {ApiError}
   */
  static serviceUnavailableError(message, details = null) {
    return new ApiError(
      message || 'Servicio no disponible',
      503,
      details,
      'SERVICE_UNAVAILABLE'
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
   * @param {boolean} [includeStack=false] - Incluir stack trace
   * @returns {Object}
   */
  toJSON(includeStack = false) {
    const error = {
      status: this.status,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      message: this.message,
      timestamp: this.timestamp
    };

    if (this.details) {
      error.details = this.details;
    }

    if (includeStack && process.env.NODE_ENV === 'development') {
      error.stack = this.stack;
    }

    return error;
  }
}

module.exports = ApiError;
