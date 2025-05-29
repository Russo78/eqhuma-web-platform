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
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Manejar eventos de Redis
redisClient.on('error', (err) => {
  logger.error('Error en conexión Redis:', err);
});

redisClient.on('connect', () => {
  logger.info('Conectado a Redis exitosamente');
});

redisClient.on('ready', () => {
  logger.info('Redis listo para recibir comandos');
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
      prefix: 'rl:apimarket:',
      sendCommand: (...args) => redisClient.call(...args)
    }),
    keyGenerator: (req) => {
      // Usar una combinación de IP y API key si está disponible
      return req.headers['x-api-key'] 
        ? `${req.ip}:${req.headers['x-api-key']}`
        : req.ip;
    },
    skip: (req) => {
      // Permitir health checks sin límite
      return req.path === '/health';
    }
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
          limit: options.max || defaultOptions.max,
          retryAfter: Math.ceil(options.windowMs / 1000)
        },
        'RATE_LIMIT_EXCEEDED'
      );
      next(error);
    }
  });
};

// Rate limiter general para todas las rutas
const rateLimiter = createLimiter();

// Rate limiter para validaciones fiscales
const taxValidationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100, // 100 validaciones por hora
  message: 'Límite de validaciones fiscales excedido'
});

// Rate limiter para consultas bancarias
const bankQueryLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 150, // 150 consultas por 5 minutos
  message: 'Límite de consultas bancarias excedido'
});

// Rate limiter para validaciones de dirección
const addressValidationLimiter = createLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 200, // 200 validaciones por 10 minutos
  message: 'Límite de validaciones de dirección excedido'
});

// Rate limiter para consultas de tipo de cambio
const exchangeRateLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 consultas por minuto
  message: 'Límite de consultas de tipo de cambio excedido'
});

// Middleware para monitoreo de uso
const usageMonitor = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    try {
      const key = `usage:${apiKey}:${new Date().toISOString().split('T')[0]}`;
      await redisClient.hincrby(key, req.path, 1);
      await redisClient.expire(key, 60 * 60 * 24 * 30); // Mantener por 30 días
    } catch (error) {
      logger.error('Error registrando uso de API:', error);
    }
  }
  next();
};

// Middleware para bloqueo dinámico basado en comportamiento
const dynamicBlocker = async (req, res, next) => {
  const ip = req.ip;
  const key = `blocked:${ip}`;
  
  try {
    const isBlocked = await redisClient.get(key);
    if (isBlocked) {
      throw new ApiError(
        'IP temporalmente bloqueada por comportamiento sospechoso',
        403,
        { blockedUntil: await redisClient.ttl(key) },
        'IP_BLOCKED'
      );
    }

    const violations = await redisClient.incr(`violations:${ip}`);
    await redisClient.expire(`violations:${ip}`, 60 * 60); // Expira en 1 hora

    if (violations > 100) { // Umbral de violaciones
      await redisClient.setex(key, 60 * 60, 'blocked'); // Bloquear por 1 hora
      throw new ApiError(
        'IP bloqueada por exceso de violaciones',
        403,
        { blockedFor: '1 hora' },
        'IP_BLOCKED'
      );
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.error('Error en dynamic blocker:', error);
      next(new ApiError('Error en sistema de seguridad', 500));
    }
  }
};

module.exports = {
  rateLimiter,
  taxValidationLimiter,
  bankQueryLimiter,
  addressValidationLimiter,
  exchangeRateLimiter,
  usageMonitor,
  dynamicBlocker,
  redisClient
};
