/**
 * Clase personalizada para errores de API
 * @extends Error
 */
class ApiError extends Error {
  /**
   * Crear un error de API
   * @param {string} message - Mensaje de error
   * @param {number} statusCode - Código de estado HTTP
   * @param {string} [code] - Código de error interno
   * @param {boolean} [isOperational=true] - Indica si es un error operacional
   * @param {string} [stack] - Stack trace
   */
  constructor(message, statusCode, code = undefined, isOperational = true, stack = '') {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.code = code;
    this.isOperational = isOperational;

    // Agregar información adicional para debugging
    this.timestamp = new Date().toISOString();
    this.path = '';  // Se establece en el middleware
    this.method = ''; // Se establece en el middleware

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Crear un error de validación
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static validationError(message) {
    return new ApiError(message, 400, 'VALIDATION_ERROR');
  }

  /**
   * Crear un error de autenticación
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static authenticationError(message = 'No autenticado') {
    return new ApiError(message, 401, 'AUTHENTICATION_ERROR');
  }

  /**
   * Crear un error de autorización
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static authorizationError(message = 'No autorizado') {
    return new ApiError(message, 403, 'AUTHORIZATION_ERROR');
  }

  /**
   * Crear un error de recurso no encontrado
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static notFoundError(message = 'Recurso no encontrado') {
    return new ApiError(message, 404, 'NOT_FOUND_ERROR');
  }

  /**
   * Crear un error de conflicto
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static conflictError(message) {
    return new ApiError(message, 409, 'CONFLICT_ERROR');
  }

  /**
   * Crear un error de límite excedido
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static tooManyRequestsError(message = 'Demasiadas solicitudes') {
    return new ApiError(message, 429, 'TOO_MANY_REQUESTS');
  }

  /**
   * Crear un error de servicio no disponible
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static serviceUnavailableError(message = 'Servicio no disponible') {
    return new ApiError(message, 503, 'SERVICE_UNAVAILABLE');
  }

  /**
   * Crear un error de pago
   * @param {string} message - Mensaje de error
   * @param {string} [code] - Código de error específico del pago
   * @returns {ApiError}
   */
  static paymentError(message, code = 'PAYMENT_ERROR') {
    return new ApiError(message, 400, code);
  }

  /**
   * Crear un error de timeout
   * @param {string} message - Mensaje de error
   * @returns {ApiError}
   */
  static timeoutError(message = 'La operación ha excedido el tiempo límite') {
    return new ApiError(message, 408, 'TIMEOUT_ERROR');
  }

  /**
   * Crear un error interno del servidor
   * @param {string} message - Mensaje de error
   * @param {boolean} [isOperational=false] - Indica si es un error operacional
   * @returns {ApiError}
   */
  static internalError(message = 'Error interno del servidor', isOperational = false) {
    return new ApiError(message, 500, 'INTERNAL_ERROR', isOperational);
  }

  /**
   * Crear un error de dependencia externa
   * @param {string} message - Mensaje de error
   * @param {string} service - Nombre del servicio externo
   * @returns {ApiError}
   */
  static externalServiceError(message, service) {
    return new ApiError(
      message,
      503,
      `EXTERNAL_SERVICE_ERROR_${service.toUpperCase()}`,
      true
    );
  }

  /**
   * Agregar información de contexto al error
   * @param {Object} context - Información adicional
   * @returns {ApiError}
   */
  addContext(context) {
    this.context = {
      ...this.context,
      ...context
    };
    return this;
  }

  /**
   * Obtener el objeto de respuesta para el cliente
   * @param {boolean} [includeStack=false] - Incluir stack trace en la respuesta
   * @returns {Object}
   */
  toJSON(includeStack = false) {
    const response = {
      status: this.status,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp
    };

    if (this.path) response.path = this.path;
    if (this.method) response.method = this.method;
    if (this.context) response.context = this.context;
    if (includeStack && this.stack) response.stack = this.stack;

    return response;
  }
}

module.exports = ApiError;
