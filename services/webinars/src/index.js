const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const routes = require('./routes');
const { errorHandler } = require('./middleware/error');
const logger = require('./config/logger');
const { apiUsageTracker, blockMaliciousIps } = require('./middleware/rateLimiter');
const agendaService = require('./services/agendaService');

require('dotenv').config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

// Middleware de seguridad y optimización
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
app.use(compression());
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
    message: 'Webinars service is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Rutas API
app.use('/api/v1', routes);

// Socket.IO eventos
io.on('connection', (socket) => {
  logger.info(`Cliente conectado: ${socket.id}`);

  socket.on('join-webinar', async (webinarId) => {
    try {
      socket.join(`webinar:${webinarId}`);
      logger.info(`Cliente ${socket.id} se unió al webinar ${webinarId}`);
    } catch (error) {
      logger.error(`Error al unirse al webinar: ${error}`);
    }
  });

  socket.on('leave-webinar', (webinarId) => {
    socket.leave(`webinar:${webinarId}`);
    logger.info(`Cliente ${socket.id} abandonó el webinar ${webinarId}`);
  });

  socket.on('send-question', async (data) => {
    try {
      // Emitir la pregunta a todos los participantes del webinar
      io.to(`webinar:${data.webinarId}`).emit('new-question', {
        id: Date.now(),
        text: data.question,
        userId: data.userId,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error(`Error al enviar pregunta: ${error}`);
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Cliente desconectado: ${socket.id}`);
  });
});

// Manejo de errores
app.use(errorHandler);

// Conexión a MongoDB
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
  httpServer.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  // Cerrar servidor y salir del proceso
  httpServer.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    logger.info('Iniciando shutdown graceful...');

    // Cerrar conexiones de Socket.IO
    io.close(() => {
      logger.info('Socket.IO cerrado');
    });

    // Detener agenda
    await agendaService.gracefulShutdown();

    // Cerrar conexión a MongoDB
    await mongoose.connection.close();
    logger.info('Conexión a MongoDB cerrada');

    // Cerrar servidor HTTP
    httpServer.close(() => {
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
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    httpServer.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();

// Exportar app para testing
module.exports = app;
