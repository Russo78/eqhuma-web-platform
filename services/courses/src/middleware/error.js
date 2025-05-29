const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const handleCastErrorDB = err => {
  const message = `Valor inválido ${err.path}: ${err.value}`;
  return new ApiError(message, 400);
};

const handleDuplicateFieldsDB = err => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Valor duplicado: ${value}. Por favor use otro valor`;
  return new ApiError(message, 400);
};

const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Datos inválidos. ${errors.join('. ')}`;
  return new ApiError(message, 400);
};

const handleJWTError = () =>
  new ApiError('Token inválido. Por favor inicie sesión nuevamente', 401);

const handleJWTExpiredError = () =>
  new ApiError('Su token ha expirado. Por favor inicie sesión nuevamente', 401);

const sendErrorDev = (err, res) => {
  logger.error('ERROR 💥', err);
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  // Error operacional, de confianza: enviar mensaje al cliente
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } 
  // Error de programación u otro error desconocido: no filtrar detalles
  else {
    // 1) Log error
    logger.error('ERROR 💥', err);

    // 2) Enviar mensaje genérico
    res.status(500).json({
      status: 'error',
      message: 'Algo salió mal'
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

// Middleware para capturar errores asíncronos no manejados
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  // Cerrar servidor y salir del proceso
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  // Cerrar servidor y salir del proceso
  process.exit(1);
});

// Middleware para manejar errores de validación de MongoDB
exports.handleValidationError = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      status: 'fail',
      message: messages.join('. ')
    });
  }
  next(err);
};

// Middleware para manejar errores de MongoDB
exports.handleMongoError = (err, req, res, next) => {
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    if (err.code === 11000) {
      return res.status(400).json({
        status: 'fail',
        message: 'Valor duplicado en un campo único'
      });
    }
  }
  next(err);
};

// Middleware para manejar errores de red
exports.handleNetworkError = (err, req, res, next) => {
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      status: 'error',
      message: 'Servicio no disponible temporalmente'
    });
  }
  next(err);
};

// Middleware para manejar timeouts
exports.handleTimeout = (err, req, res, next) => {
  if (err.code === 'ETIMEDOUT') {
    return res.status(408).json({
      status: 'error',
      message: 'La solicitud ha excedido el tiempo de espera'
    });
  }
  next(err);
};
