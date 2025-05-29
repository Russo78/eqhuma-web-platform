const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Simulación de base de datos de usuarios (en producción usar una base de datos real)
const usuarios = [
  {
    id: 1,
    email: 'usuario@ejemplo.com',
    password: 'password123' // En producción usar hash
  }
];

// Ruta de login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario (en producción usar una consulta a base de datos)
    const usuario = usuarios.find(u => u.email === email);

    if (!usuario || usuario.password !== password) {
      return res.status(401).json({
        mensaje: 'Credenciales inválidas'
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      { 
        id: usuario.id, 
        email: usuario.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      mensaje: 'Error al procesar el login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ruta para verificar token
router.get('/verificar', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      mensaje: 'Token no proporcionado'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      mensaje: 'Token válido',
      usuario: decoded
    });
  } catch (error) {
    res.status(403).json({
      mensaje: 'Token inválido o expirado'
    });
  }
});

// Ruta de registro (opcional, implementar según necesidades)
router.post('/registro', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verificar si el usuario ya existe
    if (usuarios.some(u => u.email === email)) {
      return res.status(400).json({
        mensaje: 'El usuario ya existe'
      });
    }

    // En producción: Hashear password y guardar en base de datos
    const nuevoUsuario = {
      id: usuarios.length + 1,
      email,
      password
    };

    usuarios.push(nuevoUsuario);

    // Generar token para el nuevo usuario
    const token = jwt.sign(
      { 
        id: nuevoUsuario.id, 
        email: nuevoUsuario.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      token,
      usuario: {
        id: nuevoUsuario.id,
        email: nuevoUsuario.email
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      mensaje: 'Error al procesar el registro',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
