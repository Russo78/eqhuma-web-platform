const winston = require('winston');
const path = require('path');

// Definir niveles personalizados de logging
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Definir colores para cada nivel
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Agregar colores a winston
winston.addColors(colors);

// Definir formato común para todos los transportes
const format = winston.format.combine(
  // Agregar timestamp
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  // Agregar información de errores si existe
  winston.format.errors({ stack: true }),
  // Agregar colores al output
  winston.format.colorize({ all: true }),
  // Definir formato del mensaje
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Definir transportes
const transports = [
  // Consola para desarrollo
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  // Archivo para todos los logs
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // Archivo separado para errores
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // Archivo separado para pagos exitosos
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/payments.log'),
    level: 'info',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
];

// Crear el logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  // No salir en caso de error no manejado
  exitOnError: false
});

// Si no estamos en producción, log a la consola con formato colorizado
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Crear stream para Morgan
logger.stream = {
  write: (message) => logger.http(message.trim())
};

// Manejar excepciones no capturadas
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/exceptions.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
);

// Manejar rechazos de promesas no manejados
logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/rejections.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
);

// Función auxiliar para loggear pagos
logger.payment = (paymentId, status, details) => {
  logger.info(`Payment ${paymentId} ${status}`, {
    paymentId,
    status,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Función auxiliar para loggear errores de pago
logger.paymentError = (paymentId, error, details) => {
  logger.error(`Payment ${paymentId} failed: ${error.message}`, {
    paymentId,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Función auxiliar para loggear webhooks
logger.webhook = (provider, event, status) => {
  logger.info(`Webhook ${provider} ${event} ${status}`, {
    provider,
    event,
    status,
    timestamp: new Date().toISOString()
  });
};

// Función auxiliar para loggear métricas
logger.metric = (name, value, tags = {}) => {
  logger.info(`Metric ${name}: ${value}`, {
    metric: name,
    value,
    tags,
    timestamp: new Date().toISOString()
  });
};

// Función auxiliar para loggear auditoría
logger.audit = (userId, action, details) => {
  logger.info(`Audit: User ${userId} performed ${action}`, {
    userId,
    action,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Asegurar que el directorio de logs existe
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

module.exports = logger;
