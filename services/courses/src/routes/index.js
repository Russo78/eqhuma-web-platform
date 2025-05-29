const express = require('express');
const courseController = require('../controllers/courseController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Rutas públicas
router.get('/courses', courseController.getCourses);
router.get('/courses/:id', courseController.getCourse);

// Rutas protegidas (requieren autenticación)
router.use(protect);

// Rutas para estudiantes
router.get('/courses/:id/lessons', courseController.getCourseLessons);
router.post('/courses/:id/rating', courseController.rateCourse);

// Rutas para administradores
router.use(restrictTo('admin', 'instructor'));

router
  .route('/courses')
  .post(courseController.createCourse);

router
  .route('/courses/:id')
  .put(courseController.updateCourse)
  .delete(courseController.deleteCourse);

router
  .route('/courses/:id/lessons')
  .post(courseController.addLesson);

router
  .route('/courses/:id/lessons/:lessonId')
  .put(courseController.updateLesson)
  .delete(courseController.deleteLesson);

// Manejo de errores para rutas no encontradas
router.all('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `No se encontró la ruta ${req.originalUrl} en este servidor`
  });
});

module.exports = router;
