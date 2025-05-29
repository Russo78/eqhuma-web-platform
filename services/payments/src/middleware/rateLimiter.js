const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

// Crear conexión a Redis
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  enableOfflineQueue: false
});

// Manejar errores de Redis
redisClient.on('error', (error) => {
  logger.error('Error de conexión con Redis:', error);
});

/**
 * Configuración base para el rate limiter
 * @param {Object} options - Opciones de configuración
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutos por defecto
    max = 100, // límite de solicitudes por ventana
    message = 'Demasiadas solicitudes, por favor intente más tarde',
    statusCode = 429,
    keyPrefix = 'rl'
  } = options;

  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: keyPrefix
    }),
    windowMs,
    max,
    handler: (req, res) => {
      throw ApiError.tooManyRequestsError(message);
    },
    keyGenerator: (req) => {
      // Usar IP y ID de usuario si está disponible
      return req.user ? `${req.ip}-${req.user.id}` : req.ip;
    },
    skip: (req) => {
      // No aplicar límites a webhooks
      return req.path.includes('/webhook');
    }
  });
};

// Rate limiter general para todas las rutas
exports.globalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 solicitudes por ventana
  message: 'Demasiadas solicitudes desde esta IP',
  keyPrefix: 'global'
});

// Rate limiter más estricto para intentos de pago
exports.paymentLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // límite de 10 intentos de pago por hora
  message: 'Demasiados intentos de pago, por favor intente más tarde',
  keyPrefix: 'payment'
});

// Rate limiter para webhooks
exports.webhookLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // límite de 60 webhooks por minuto
  message: 'Demasiadas solicitudes webhook',
  keyPrefix: 'webhook'
});

// Rate limiter para consultas de estado
exports.statusCheckLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 30, // límite de 30 consultas por 5 minutos
  message: 'Demasiadas consultas de estado',
  keyPrefix: 'status'
});

// Rate limiter para reembolsos
exports.refundLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 5, // límite de 5 solicitudes de reembolso por día
  message: 'Demasiadas solicitudes de reembolso',
  keyPrefix: 'refund'
});

// Middleware para bloquear IPs maliciosas
exports.blockMaliciousIps = async (req, res, next) => {
  try {
    const key = `blocked:${req.ip}`;
    const isBlocked = await redisClient.get(key);

    if (isBlocked) {
      throw ApiError.tooManyRequestsError('IP bloqueada por actividad sospechosa');
    }

    // Verificar patrones de abuso
    const requestCount = await redisClient.incr(`requests:${req.ip}`);
    await redisClient.expire(`requests:${req.ip}`, 60); // TTL de 1 minuto

    if (requestCount > 100) { // Más de 100 solicitudes por minuto
      await redisClient.setex(key, 3600, 'blocked'); // Bloquear por 1 hora
      throw ApiError.tooManyRequestsError('IP bloqueada por exceso de solicitudes');
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware para rastrear uso de API por usuario
exports.apiUsageTracker = async (req, res, next) => {
  try {
    if (req.user) {
      const today = new Date().toISOString().split('T')[0];
      const key = `usage:${req.user.id}:${today}`;

      await redisClient.hincrby(key, req.path, 1);
      await redisClient.expire(key, 86400); // TTL de 24 horas
    }
    next();
  } catch (error) {
    logger.error('Error tracking API usage:', error);
    next(); // Continuar incluso si hay error en el tracking
  }
};

// Función para obtener el uso de API de un usuario
exports.getApiUsage = async (userId, date = new Date().toISOString().split('T')[0]) => {
  try {
    const key = `usage:${userId}:${date}`;
    return await redisClient.hgetall(key);
  } catch (error) {
    logger.error('Error getting API usage:', error);
    return {};
  }
};

// Middleware configurable para rate limiting
exports.rateLimiter = (options = {}) => {
  return createRateLimiter(options);
};

// Exportar cliente Redis para uso en otros módulos
exports.redisClient = redisClient;
