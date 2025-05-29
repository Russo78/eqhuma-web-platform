const express = require('express');
const webinarController = require('../controllers/webinarController');
const { protect, restrictTo } = require('../middleware/auth');
const { validateWebinar } = require('../middleware/validation');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Rutas públicas
router.get('/webinars', webinarController.getWebinars);
router.get('/webinars/:id', webinarController.getWebinar);
router.get('/webinars/category/:category', webinarController.getWebinarsByCategory);
router.get('/webinars/upcoming', webinarController.getUpcomingWebinars);

// Rutas protegidas (requieren autenticación)
router.use(protect);

// Rutas para participantes
router.post(
  '/webinars/:id/register',
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5 // límite de 5 registros por ventana
  }),
  webinarController.registerForWebinar
);

router.post(
  '/webinars/:id/questions',
  rateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 3 // límite de 3 preguntas por minuto
  }),
  webinarController.submitQuestion
);

router.post(
  '/webinars/:id/feedback',
  validateWebinar('feedback'),
  webinarController.submitFeedback
);

router.get(
  '/webinars/:id/materials',
  webinarController.getWebinarMaterials
);

// Rutas para instructores
router.use(restrictTo('admin', 'instructor'));

router
  .route('/webinars')
  .post(validateWebinar('create'), webinarController.createWebinar);

router
  .route('/webinars/:id')
  .put(validateWebinar('update'), webinarController.updateWebinar)
  .delete(webinarController.deleteWebinar);

router.post(
  '/webinars/:id/start',
  webinarController.startWebinar
);

router.post(
  '/webinars/:id/end',
  webinarController.endWebinar
);

router.post(
  '/webinars/:id/materials',
  webinarController.addWebinarMaterials
);

router.delete(
  '/webinars/:id/materials/:materialId',
  webinarController.removeWebinarMaterial
);

// Rutas para administradores
router.use(restrictTo('admin'));

router.post(
  '/webinars/:id/cancel',
  webinarController.cancelWebinar
);

router.get(
  '/webinars/:id/analytics',
  webinarController.getWebinarAnalytics
);

router.get(
  '/webinars/analytics/overview',
  webinarController.getWebinarsOverview
);

// Webhooks
router.post(
  '/webhooks/zoom',
  webinarController.handleZoomWebhook
);

router.post(
  '/webhooks/meet',
  webinarController.handleGoogleMeetWebhook
);

// Rutas de gestión de asistencia
router.post(
  '/webinars/:id/attendance/start',
  webinarController.startAttendanceTracking
);

router.post(
  '/webinars/:id/attendance/end',
  webinarController.endAttendanceTracking
);

router.get(
  '/webinars/:id/attendance/report',
  webinarController.getAttendanceReport
);

// Rutas de gestión de polls
router.post(
  '/webinars/:id/polls',
  validateWebinar('poll'),
  webinarController.createPoll
);

router.put(
  '/webinars/:id/polls/:pollId',
  validateWebinar('poll'),
  webinarController.updatePoll
);

router.delete(
  '/webinars/:id/polls/:pollId',
  webinarController.deletePoll
);

router.post(
  '/webinars/:id/polls/:pollId/start',
  webinarController.startPoll
);

router.post(
  '/webinars/:id/polls/:pollId/end',
  webinarController.endPoll
);

router.get(
  '/webinars/:id/polls/:pollId/results',
  webinarController.getPollResults
);

// Rutas de gestión de grabaciones
router.post(
  '/webinars/:id/recordings/start',
  webinarController.startRecording
);

router.post(
  '/webinars/:id/recordings/stop',
  webinarController.stopRecording
);

router.get(
  '/webinars/:id/recordings',
  webinarController.getRecordings
);

router.delete(
  '/webinars/:id/recordings/:recordingId',
  webinarController.deleteRecording
);

// Manejo de errores para rutas no encontradas
router.all('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `No se encontró la ruta ${req.originalUrl} en este servidor`
  });
});

module.exports = router;
