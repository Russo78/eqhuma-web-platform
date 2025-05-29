const winston = require('winston');
const path = require('path');

// Definir niveles de log personalizados
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
  // Agregar colores
  winston.format.colorize({ all: true }),
  // Definir formato del mensaje
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Definir transportes
const transports = [
  // Consola
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  // Archivo para todos los logs
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/all.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // Archivo específico para errores
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
];

// Crear el logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
  // No salir en caso de error
  exitOnError: false
});

// Si no estamos en producción, log a la consola
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

// Funciones helper
logger.logAndThrow = (error) => {
  logger.error(error);
  throw error;
};

logger.logRequest = (req) => {
  logger.http(`${req.method} ${req.originalUrl}`);
};

logger.logResponse = (req, res) => {
  logger.http(
    `${req.method} ${req.originalUrl} ${res.statusCode} ${res.responseTime}ms`
  );
};

logger.logError = (error, req) => {
  logger.error(`${error.name}: ${error.message}
    Request: ${req.method} ${req.originalUrl}
    Body: ${JSON.stringify(req.body)}
    User: ${req.user ? req.user.id : 'Not authenticated'}
    Stack: ${error.stack}`
  );
};

// Middleware para logging de requests
logger.requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });
  
  next();
};

module.exports = logger;
