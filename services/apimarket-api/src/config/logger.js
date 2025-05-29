const winston = require('winston');
const path = require('path');

// Configuración de niveles de log personalizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Configuración de colores para los niveles
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Agregar colores a winston
winston.addColors(colors);

// Formato personalizado
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Configuración de transports (destinos de los logs)
const transports = [
  // Escribir todos los logs en consola
  new winston.transports.Console(),
  
  // Escribir todos los logs de error en error.log
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  
  // Escribir todos los logs en combined.log
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }),

  // Logs específicos para APIMarket
  new winston.transports.File({
    filename: path.join('logs', 'apimarket.log'),
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
];

// Crear el logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  // Manejo de excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join('logs', 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  // Manejo de rechazos de promesas no manejados
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join('logs', 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Stream para morgan
logger.stream = {
  write: (message) => logger.http(message.trim())
};

// Función auxiliar para logs estructurados
logger.logApiCall = (service, method, status, message, data = {}) => {
  logger.info({
    service,
    method,
    status,
    message,
    timestamp: new Date().toISOString(),
    ...data
  });
};

// Función para logs de rendimiento
logger.logPerformance = (operation, duration, metadata = {}) => {
  logger.info({
    type: 'performance',
    operation,
    duration,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

module.exports = logger;
