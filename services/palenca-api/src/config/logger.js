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
    level: 'error'
  }),
  
  // Escribir todos los logs en combined.log
  new winston.transports.File({
    filename: path.join('logs', 'combined.log')
  })
];

// Crear el logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports
});

// Stream para morgan
logger.stream = {
  write: (message) => logger.http(message.trim())
};

module.exports = logger;
