const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

// Convertir errores de Mongoose a errores de API personalizados
const handleMongooseError = (err) => {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => error.message);
    return new ApiError(`Error de validación: ${errors.join(', ')}`, 400);
  }
  
  if (err.name === 'CastError') {
    return new ApiError(`ID inválido: ${err.value}`, 400);
  }
  
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return new ApiError(`Valor duplicado para el campo ${field}`, 400);
  }

  return err;
};

// Convertir errores de Stripe a errores de API personalizados
const handleStripeError = (err) => {
  switch (err.type) {
    case 'StripeCardError':
      return new ApiError(err.message, 400);
    case 'StripeInvalidRequestError':
      return new ApiError('Solicitud inválida a Stripe', 400);
    case 'StripeAPIError':
      return new ApiError('Error en el servicio de Stripe', 503);
    case 'StripeConnectionError':
      return new ApiError('Error de conexión con Stripe', 503);
    case 'StripeAuthenticationError':
      return new ApiError('Error de autenticación con Stripe', 401);
    default:
      return new ApiError('Error procesando el pago', 500);
  }
};

// Convertir errores de PayPal a errores de API personalizados
const handlePayPalError = (err) => {
  if (err.response && err.response.data) {
    const { message, name } = err.response.data;
    switch (name) {
      case 'INVALID_REQUEST':
        return new ApiError(message || 'Solicitud inválida a PayPal', 400);
      case 'AUTHENTICATION_FAILURE':
        return new ApiError('Error de autenticación con PayPal', 401);
      case 'INSUFFICIENT_FUNDS':
        return new ApiError('Fondos insuficientes', 400);
      case 'INTERNAL_SERVICE_ERROR':
        return new ApiError('Error en el servicio de PayPal', 503);
      default:
        return new ApiError(message || 'Error procesando el pago con PayPal', 500);
    }
  }
  return err;
};

// Middleware de manejo de errores global
exports.errorHandler = (err, req, res, next) => {
  // Log del error
  logger.error('Error:', {
    error: err,
    request: {
      method: req.method,
      url: req.url,
      body: req.body,
      user: req.user ? req.user.id : 'no auth'
    }
  });

  // Convertir error según su tipo
  if (err.name && ['ValidationError', 'CastError'].includes(err.name) || err.code === 11000) {
    err = handleMongooseError(err);
  } else if (err.type && err.type.startsWith('Stripe')) {
    err = handleStripeError(err);
  } else if (err.isAxiosError && err.config && err.config.url.includes('paypal')) {
    err = handlePayPalError(err);
  }

  // Si el error ya es un ApiError, usarlo directamente
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      code: err.code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Para errores de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token inválido'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token expirado'
    });
  }

  // Error por defecto para producción
  if (process.env.NODE_ENV === 'production') {
    // Errores operacionales conocidos
    if (err.isOperational) {
      return res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message
      });
    }
    // Errores de programación o desconocidos
    return res.status(500).json({
      status: 'error',
      message: 'Algo salió mal'
    });
  }

  // Error detallado para desarrollo
  return res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message,
    stack: err.stack,
    error: err
  });
};

// Middleware para manejar errores asíncronos
exports.asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware para errores 404
exports.notFound = (req, res, next) => {
  next(new ApiError(`No se encontró la ruta ${req.originalUrl}`, 404));
};

// Middleware para validar IDs de MongoDB
exports.validateMongoId = (req, res, next) => {
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new ApiError('ID inválido', 400));
  }
  next();
};

// Middleware para manejar errores de timeout
exports.timeoutHandler = (req, res, next) => {
  res.setTimeout(30000, () => {
    next(new ApiError('La solicitud ha excedido el tiempo límite', 408));
  });
  next();
};

// Middleware para capturar errores de body parser
exports.bodyParserErrorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return next(new ApiError('JSON inválido', 400));
  }
  next(err);
};

// Middleware para manejar errores de límite de tamaño
exports.payloadTooLarge = (err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return next(new ApiError('Payload demasiado grande', 413));
  }
  next(err);
};
