const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

// Crear cliente Redis
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  enableOfflineQueue: false
});

// Manejar eventos de Redis
redisClient.on('error', (err) => {
  logger.error('Error en conexión Redis:', err);
});

redisClient.on('connect', () => {
  logger.info('Conectado a Redis exitosamente');
});

// Configuración base del rate limiter
const createLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutos por defecto
    max: 100, // límite de 100 solicitudes por ventana
    message: 'Demasiadas solicitudes desde esta IP, por favor intente nuevamente más tarde',
    statusCode: 429,
    headers: true,
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:palenca:',
      sendCommand: (...args) => redisClient.call(...args)
    })
  };

  return rateLimit({
    ...defaultOptions,
    ...options,
    handler: (req, res, next) => {
      const error = new ApiError(
        options.message || defaultOptions.message,
        429,
        {
          timeWindow: options.windowMs || defaultOptions.windowMs,
          limit: options.max || defaultOptions.max
        }
      );
      next(error);
    }
  });
};

// Rate limiter general para todas las rutas
const rateLimiter = createLimiter();

// Rate limiter más estricto para rutas de verificación
const verificationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // 50 solicitudes por hora
  message: 'Límite de verificaciones excedido'
});

// Rate limiter para rutas de consulta
const queryLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 200, // 200 solicitudes por 5 minutos
  message: 'Límite de consultas excedido'
});

// Rate limiter para rutas de autenticación
const authLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 intentos por hora
  message: 'Demasiados intentos de autenticación'
});

// Middleware para bloquear IPs maliciosas
const blockMaliciousIps = async (req, res, next) => {
  const ip = req.ip;
  try {
    const blocked = await redisClient.sismember('blocked_ips', ip);
    if (blocked) {
      throw new ApiError('IP bloqueada por actividad sospechosa', 403);
    }
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.error('Error verificando IP bloqueada:', error);
      next(new ApiError('Error en verificación de seguridad', 500));
    }
  }
};

// Función para bloquear una IP
const blockIp = async (ip, reason) => {
  try {
    await redisClient.sadd('blocked_ips', ip);
    logger.warn(`IP ${ip} bloqueada. Razón: ${reason}`);
  } catch (error) {
    logger.error('Error bloqueando IP:', error);
  }
};

// Función para desbloquear una IP
const unblockIp = async (ip) => {
  try {
    await redisClient.srem('blocked_ips', ip);
    logger.info(`IP ${ip} desbloqueada`);
  } catch (error) {
    logger.error('Error desbloqueando IP:', error);
  }
};

module.exports = {
  rateLimiter,
  verificationLimiter,
  queryLimiter,
  authLimiter,
  blockMaliciousIps,
  blockIp,
  unblockIp,
  redisClient
};
