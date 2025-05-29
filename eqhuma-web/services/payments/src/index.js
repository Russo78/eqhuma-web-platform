const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config');
const paymentRoutes = require('./routes/paymentRoutes');

// Inicializar express
const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging básico
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Rutas
app.use('/api/payments', paymentRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payments' });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Conectar a MongoDB
mongoose.connect(config.mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Conectado a MongoDB');
  
  // Iniciar el servidor
  const server = app.listen(config.port, () => {
    console.log(`Servidor de pagos ejecutándose en el puerto ${config.port}`);
    console.log(`Ambiente: ${config.nodeEnv}`);
  });

  // Manejo de señales de terminación
  const shutdown = () => {
    console.log('Cerrando servidor...');
    server.close(() => {
      console.log('Servidor cerrado');
      mongoose.connection.close(false, () => {
        console.log('Conexión MongoDB cerrada');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})
.catch(err => {
  console.error('Error conectando a MongoDB:', err);
  process.exit(1);
});
