const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Middleware para proteger rutas que requieren autenticación
 */
exports.protect = async (req, res, next) => {
  try {
    // 1) Obtener el token
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(ApiError.authenticationError('No has iniciado sesión'));
    }

    // 2) Verificar el token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Verificar si el usuario aún existe
    // Esto se haría normalmente con una llamada al servicio de autenticación
    // Por ahora solo verificamos que el token tenga la información necesaria
    if (!decoded.id) {
      return next(ApiError.authenticationError('El usuario ya no existe'));
    }

    // 4) Verificar si el usuario cambió su contraseña después de que el token fue emitido
    if (decoded.iat < decoded.passwordChangedAt) {
      return next(
        ApiError.authenticationError('Usuario cambió recientemente su contraseña. Por favor inicie sesión nuevamente')
      );
    }

    // 5) Agregar la información del usuario al request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    // Log de acceso
    logger.info(`Usuario ${decoded.id} accedió a ${req.originalUrl}`);

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(ApiError.authenticationError('Token inválido'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(ApiError.authenticationError('Tu sesión ha expirado. Por favor inicia sesión nuevamente'));
    }
    next(error);
  }
};

/**
 * Middleware para restringir acceso basado en roles
 * @param  {...string} roles - Roles permitidos
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.authorizationError('No tienes permiso para realizar esta acción')
      );
    }
    next();
  };
};

/**
 * Middleware para verificar la propiedad del recurso
 * @param {string} model - Nombre del modelo
 * @param {string} paramName - Nombre del parámetro que contiene el ID del recurso
 */
exports.checkOwnership = (model, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      const userId = req.user.id;

      // Si es admin, permitir acceso
      if (req.user.role === 'admin') {
        return next();
      }

      const resource = await model.findById(resourceId);

      if (!resource) {
        return next(ApiError.notFoundError('Recurso no encontrado'));
      }

      // Verificar si el usuario es dueño del recurso
      if (resource.userId.toString() !== userId) {
        return next(
          ApiError.authorizationError('No tienes permiso para acceder a este recurso')
        );
      }

      // Agregar el recurso al request para evitar buscarlo nuevamente
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar límites de acceso
 * @param {Object} options - Opciones de límites
 */
exports.checkLimits = (options = {}) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { maxDaily = 1000, maxMonthly = 20000 } = options;

      // Aquí iría la lógica para verificar los límites de transacciones
      // Por ejemplo, consultando la base de datos para las transacciones del usuario

      // Si excede los límites, rechazar
      if (dailyTotal > maxDaily) {
        return next(
          ApiError.paymentError('Has excedido el límite diario de transacciones')
        );
      }

      if (monthlyTotal > maxMonthly) {
        return next(
          ApiError.paymentError('Has excedido el límite mensual de transacciones')
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar el estado de la cuenta
 */
exports.checkAccountStatus = async (req, res, next) => {
  try {
    // Aquí iría la lógica para verificar el estado de la cuenta del usuario
    // Por ejemplo, consultando el servicio de autenticación

    const accountStatus = 'active'; // Esto vendría de la consulta real

    if (accountStatus !== 'active') {
      return next(
        ApiError.authorizationError('Tu cuenta está suspendida o inactiva')
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware para verificar la firma de la solicitud
 */
exports.verifySignature = async (req, res, next) => {
  try {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];

    if (!signature || !timestamp) {
      return next(ApiError.authenticationError('Firma no proporcionada'));
    }

    // Verificar que la solicitud no sea muy antigua
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    const fiveMinutes = 5 * 60 * 1000;

    if (now - requestTime > fiveMinutes) {
      return next(ApiError.authenticationError('Solicitud expirada'));
    }

    // Aquí iría la lógica para verificar la firma
    // Por ejemplo, usando crypto para comparar la firma con el contenido de la solicitud

    next();
  } catch (error) {
    next(error);
  }
};
