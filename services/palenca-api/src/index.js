require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const routes = require('./routes');
const logger = require('./config/logger');
const { errorHandler } = require('./middleware/error');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();

// Middleware de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Middleware de logging
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting
app.use(rateLimiter);

// Parseo de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas
app.use('/api/v1/identity', routes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Palenca API service is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Manejo de errores
app.use(errorHandler);

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  logger.info('Connected to MongoDB');
})
.catch((err) => {
  logger.error('MongoDB connection error:', err);
  process.exit(1);
});

// Manejo de señales de terminación
const gracefulShutdown = async (signal) => {
  try {
    logger.info(`${signal} signal received: closing HTTP server...`);
    
    // Cerrar conexión con MongoDB
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    
    // Cerrar servidor HTTP
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Si el servidor no se cierra en 5 segundos, forzar el cierre
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 5000);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// Escuchar señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  gracefulShutdown('Uncaught Exception');
});

// Manejar promesas rechazadas no manejadas
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('Unhandled Rejection');
});

// Iniciar servidor
const PORT = process.env.PORT || 5003;
const server = app.listen(PORT, () => {
  logger.info(`Palenca API service listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Configurar timeout del servidor
server.timeout = 30000; // 30 segundos

module.exports = app;
