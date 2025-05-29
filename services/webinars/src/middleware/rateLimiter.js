const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../config/logger');

// Crear cliente Redis
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redisClient.on('error', (err) => {
  logger.error('Redis error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis connected successfully');
});

// Configuración base del rate limiter
const defaultConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutos por defecto
  max: 100, // límite de 100 solicitudes por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Demasiadas solicitudes, por favor intente más tarde'
  },
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Demasiadas solicitudes, por favor intente más tarde',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => {
    // Saltar límite para healthchecks
    return req.path === '/health';
  },
  keyGenerator: (req) => {
    // Usar IP y ruta como clave
    return `${req.ip}-${req.path}`;
  }
};

// Store de Redis para rate limiting
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'rl:',
  // Tiempo de expiración automática en Redis
  expiry: defaultConfig.windowMs / 1000
});

// Crear middleware de rate limiting
const createRateLimiter = (config = {}) => {
  // Si Redis no está disponible, usar store en memoria
  const store = redisClient.status === 'ready' ? redisStore : undefined;

  return rateLimit({
    ...defaultConfig,
    ...config,
    store
  });
};

// Rate limiters específicos
exports.rateLimiter = createRateLimiter;

// Rate limiter para autenticación
exports.authLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 intentos
  message: {
    status: 'error',
    message: 'Demasiados intentos de autenticación, por favor intente más tarde'
  }
});

// Rate limiter para registro de usuarios
exports.registrationLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 3, // 3 registros por IP
  message: {
    status: 'error',
    message: 'Demasiados intentos de registro, por favor intente más tarde'
  }
});

// Rate limiter para endpoints de API
exports.apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // 100 solicitudes
});

// Rate limiter para webhooks
exports.webhookLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60 // 60 solicitudes por minuto
});

// Rate limiter para búsquedas
exports.searchLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 30 // 30 búsquedas
});

// Middleware para tracking de uso de API
exports.apiUsageTracker = async (req, res, next) => {
  try {
    const key = `api:usage:${req.ip}:${new Date().toISOString().split('T')[0]}`;
    await redisClient.hincrby(key, req.path, 1);
    // Expirar después de 30 días
    await redisClient.expire(key, 60 * 60 * 24 * 30);
    next();
  } catch (error) {
    logger.error('Error tracking API usage:', error);
    next();
  }
};

// Función para obtener estadísticas de uso
exports.getApiUsageStats = async (ip, date) => {
  try {
    const key = `api:usage:${ip}:${date}`;
    return await redisClient.hgetall(key);
  } catch (error) {
    logger.error('Error getting API usage stats:', error);
    return {};
  }
};

// Middleware para bloquear IPs maliciosas
exports.blockMaliciousIps = async (req, res, next) => {
  try {
    const isBlocked = await redisClient.sismember('blocked:ips', req.ip);
    if (isBlocked) {
      return res.status(403).json({
        status: 'error',
        message: 'Acceso denegado'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking blocked IPs:', error);
    next();
  }
};

// Función para bloquear una IP
exports.blockIp = async (ip, reason) => {
  try {
    await redisClient.sadd('blocked:ips', ip);
    await redisClient.hset(`blocked:ip:${ip}`, 'reason', reason, 'timestamp', Date.now());
    logger.info(`IP ${ip} blocked: ${reason}`);
  } catch (error) {
    logger.error('Error blocking IP:', error);
  }
};

// Función para desbloquear una IP
exports.unblockIp = async (ip) => {
  try {
    await redisClient.srem('blocked:ips', ip);
    await redisClient.del(`blocked:ip:${ip}`);
    logger.info(`IP ${ip} unblocked`);
  } catch (error) {
    logger.error('Error unblocking IP:', error);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    await redisClient.quit();
    logger.info('Redis client disconnected through app termination');
  } catch (error) {
    logger.error('Error during Redis client shutdown:', error);
  }
});
