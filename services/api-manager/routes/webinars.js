const express = require('express');
const axios = require('axios');
const router = express.Router();

// URL base del servicio de webinars (definido en docker-compose.yml)
const WEBINARS_SERVICE_URL = 'http://webinars:5001';

// Obtener todos los webinars
router.get('/', async (req, res) => {
  try {
    const response = await axios.get(`${WEBINARS_SERVICE_URL}/webinars`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener webinars:', error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al obtener los webinars',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener webinars próximos
router.get('/proximos', async (req, res) => {
  try {
    const response = await axios.get(`${WEBINARS_SERVICE_URL}/webinars/proximos`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener webinars próximos:', error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al obtener los webinars próximos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener un webinar específico por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${WEBINARS_SERVICE_URL}/webinars/${id}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener webinar ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al obtener el webinar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Crear un nuevo webinar (solo admin)
router.post('/', async (req, res) => {
  try {
    // Verificar si el usuario es admin
    if (!req.usuario.isAdmin) {
      return res.status(403).json({
        mensaje: 'No tienes permisos para crear webinars'
      });
    }

    const response = await axios.post(`${WEBINARS_SERVICE_URL}/webinars`, req.body);
    res.status(201).json(response.data);
  } catch (error) {
    console.error('Error al crear webinar:', error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al crear el webinar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Actualizar un webinar existente
router.put('/:id', async (req, res) => {
  try {
    // Verificar si el usuario es admin
    if (!req.usuario.isAdmin) {
      return res.status(403).json({
        mensaje: 'No tienes permisos para actualizar webinars'
      });
    }

    const { id } = req.params;
    const response = await axios.put(`${WEBINARS_SERVICE_URL}/webinars/${id}`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al actualizar webinar ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al actualizar el webinar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Registrar asistente a un webinar
router.post('/:id/registro', async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id; // Obtenido del token JWT

    const response = await axios.post(`${WEBINARS_SERVICE_URL}/webinars/${id}/registro`, {
      usuarioId,
      ...req.body
    });

    res.status(201).json(response.data);
  } catch (error) {
    console.error(`Error al registrar en webinar ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al procesar el registro al webinar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener enlace de acceso al webinar
router.get('/:id/acceso', async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    // Verificar si el usuario está registrado en el webinar
    const response = await axios.get(`${WEBINARS_SERVICE_URL}/webinars/${id}/acceso/${usuarioId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener acceso al webinar ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al obtener el enlace de acceso',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Marcar asistencia a un webinar
router.post('/:id/asistencia', async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const response = await axios.post(`${WEBINARS_SERVICE_URL}/webinars/${id}/asistencia`, {
      usuarioId,
      timestamp: new Date(),
      ...req.body
    });

    res.json(response.data);
  } catch (error) {
    console.error(`Error al marcar asistencia en webinar ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al registrar la asistencia',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
