const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoose = require('mongoose');
const routes = require('./routes');
const { errorHandler } = require('./middleware/error');
const logger = require('./config/logger');
const { apiUsageTracker, blockMaliciousIps } = require('./middleware/rateLimiter');

require('dotenv').config();

const app = express();

// Middleware de seguridad y optimización
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
app.use(compression());

// Configuración especial para webhooks de Stripe y STP
app.use([
  '/api/v1/payments/webhook/stripe',
  '/api/v1/payments/webhook/stp'
], express.raw({ type: 'application/json' }));

// Middleware para parsear JSON para otras rutas
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
}

// Middleware de seguridad personalizado
app.use(blockMaliciousIps);
app.use(apiUsageTracker);

// Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Payments service is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Rutas API
app.use('/api/v1/payments', routes);

// Manejo de errores
app.use(errorHandler);

// Conexión a MongoDB
// Validar configuración de STP
const stpConfig = require('./config/stp');
try {
  stpConfig.validate();
  logger.info('STP configuration validated successfully');
} catch (error) {
  logger.error('STP configuration validation failed:', error);
  process.exit(1);
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  // Cerrar servidor y salir del proceso
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  // Cerrar servidor y salir del proceso
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    logger.info('Iniciando shutdown graceful...');

    // Cerrar conexión a MongoDB
    await mongoose.connection.close();
    logger.info('Conexión a MongoDB cerrada');

    // Cerrar servidor HTTP
    server.close(() => {
      logger.info('Servidor HTTP cerrado');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error durante el shutdown:', error);
    process.exit(1);
  }
};

// Manejar señales de terminación
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Iniciar servidor
const PORT = process.env.PORT || 5002;
const server = app.listen(PORT, async () => {
  await connectDB();
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Configurar timeout del servidor
server.timeout = 30000; // 30 segundos

// Manejar errores del servidor
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  switch (error.code) {
    case 'EACCES':
      logger.error(`Port ${PORT} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`Port ${PORT} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Exportar app para testing
module.exports = app;
