const express = require('express');
const axios = require('axios');
const router = express.Router();

// URL base del servicio de cursos (definido en docker-compose.yml)
const COURSES_SERVICE_URL = 'http://courses:5000';

// Obtener todos los cursos
router.get('/', async (req, res) => {
  try {
    const response = await axios.get(`${COURSES_SERVICE_URL}/cursos`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener cursos:', error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al obtener los cursos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener un curso específico por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${COURSES_SERVICE_URL}/cursos/${id}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener curso ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al obtener el curso',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Crear un nuevo curso (requiere autenticación de admin)
router.post('/', async (req, res) => {
  try {
    // Verificar si el usuario es admin (implementar lógica según necesidades)
    if (!req.usuario.isAdmin) {
      return res.status(403).json({
        mensaje: 'No tienes permisos para crear cursos'
      });
    }

    const response = await axios.post(`${COURSES_SERVICE_URL}/cursos`, req.body);
    res.status(201).json(response.data);
  } catch (error) {
    console.error('Error al crear curso:', error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al crear el curso',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Actualizar un curso existente
router.put('/:id', async (req, res) => {
  try {
    // Verificar si el usuario es admin
    if (!req.usuario.isAdmin) {
      return res.status(403).json({
        mensaje: 'No tienes permisos para actualizar cursos'
      });
    }

    const { id } = req.params;
    const response = await axios.put(`${COURSES_SERVICE_URL}/cursos/${id}`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al actualizar curso ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al actualizar el curso',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Eliminar un curso
router.delete('/:id', async (req, res) => {
  try {
    // Verificar si el usuario es admin
    if (!req.usuario.isAdmin) {
      return res.status(403).json({
        mensaje: 'No tienes permisos para eliminar cursos'
      });
    }

    const { id } = req.params;
    await axios.delete(`${COURSES_SERVICE_URL}/cursos/${id}`);
    res.json({ mensaje: 'Curso eliminado exitosamente' });
  } catch (error) {
    console.error(`Error al eliminar curso ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al eliminar el curso',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Inscribir usuario a un curso
router.post('/:id/inscripcion', async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id; // Obtenido del token JWT

    const response = await axios.post(`${COURSES_SERVICE_URL}/cursos/${id}/inscripcion`, {
      usuarioId,
      ...req.body
    });

    res.status(201).json(response.data);
  } catch (error) {
    console.error(`Error al inscribir en curso ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al procesar la inscripción',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener progreso del usuario en un curso
router.get('/:id/progreso', async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const response = await axios.get(`${COURSES_SERVICE_URL}/cursos/${id}/progreso/${usuarioId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener progreso del curso ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      mensaje: 'Error al obtener el progreso del curso',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
