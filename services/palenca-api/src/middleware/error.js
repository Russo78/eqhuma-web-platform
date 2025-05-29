const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Si el error no es una instancia de ApiError, lo convertimos
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Error interno del servidor';
    error = new ApiError(message, statusCode);
  }

  // Log del error
  logger.error(`${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  if (error.stack) {
    logger.error(error.stack);
  }

  // Respuesta al cliente
  res.status(error.statusCode).json({
    status: 'error',
    statusCode: error.statusCode,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
};

// Middleware para rutas no encontradas
const notFound = (req, res, next) => {
  const error = new ApiError(`No se encontró la ruta ${req.originalUrl}`, 404);
  next(error);
};

// Middleware para validación de datos
const validationError = (err, req, res, next) => {
  if (err && err.error && err.error.isJoi) {
    const error = new ApiError('Error de validación', 400, err.error.details);
    next(error);
  } else {
    next(err);
  }
};

// Middleware para errores de MongoDB
const mongoError = (err, req, res, next) => {
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    let message = 'Error en la base de datos';
    let statusCode = 500;

    // Manejar errores específicos de MongoDB
    switch (err.code) {
      case 11000:
        message = 'Registro duplicado';
        statusCode = 409;
        break;
      case 121:
        message = 'Error de validación en la base de datos';
        statusCode = 400;
        break;
      default:
        message = 'Error en la base de datos';
        statusCode = 500;
    }

    const error = new ApiError(message, statusCode);
    next(error);
  } else {
    next(err);
  }
};

// Middleware para errores de autenticación
const authError = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    const error = new ApiError('No autorizado', 401);
    next(error);
  } else {
    next(err);
  }
};

// Middleware para errores de límite de tamaño
const payloadError = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 413) {
    const error = new ApiError('Tamaño de payload excedido', 413);
    next(error);
  } else {
    next(err);
  }
};

module.exports = {
  errorHandler,
  notFound,
  validationError,
  mongoError,
  authError,
  payloadError
};
