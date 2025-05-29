// Importación de dependencias
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Configuración de variables de entorno
dotenv.config();

const app = express();

// Middleware básico
app.use(cors());
app.use(express.json());

// Middleware de autenticación
const autenticarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ mensaje: 'Token no proporcionado' });
  }

  try {
    const usuario = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = usuario;
    next();
  } catch (error) {
    return res.status(403).json({ mensaje: 'Token inválido o expirado' });
  }
};

// Importación de rutas
const cursosRouter = require('./routes/cursos');
const webinarsRouter = require('./routes/webinars');
const pagosRouter = require('./routes/pagos');
const authRouter = require('./routes/auth');

// Configuración de rutas
app.use('/auth', authRouter);
app.use('/cursos', autenticarToken, cursosRouter);
app.use('/webinars', autenticarToken, webinarsRouter);
app.use('/pagos', autenticarToken, pagosRouter);

// Ruta de prueba de salud
app.get('/health', (req, res) => {
  res.json({ estado: 'OK', mensaje: 'API Manager funcionando correctamente' });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    mensaje: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API Manager ejecutándose en el puerto ${PORT}`);
  console.log('Microservicios conectados:');
  console.log('- Cursos: http://courses:5000');
  console.log('- Webinars: http://webinars:5001');
  console.log('- API Market: http://apimarket-api:5002');
  console.log('- Palenca API: http://palenca-api:5003');
});
