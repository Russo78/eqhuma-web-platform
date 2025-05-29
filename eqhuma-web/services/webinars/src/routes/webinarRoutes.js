// src/routes/webinarRoutes.js
const express = require('express');
const router = express.Router();
const webinarController = require('../controllers/webinarController');
const { protect, authorize, checkOrganizationAccess, checkWebinarAccess } = require('../middleware/authMiddleware');

// Base route: /api/v1/webinars

// Public routes - none for webinars, all require authentication

// Protected routes - require authentication
router.use(protect);

// Get all webinars with filtering and pagination
router.get('/', webinarController.getWebinars);

// Get upcoming webinars
router.get('/upcoming', webinarController.getUpcomingWebinars);

// Create a new webinar - only admins and instructors
router.post(
  '/', 
  authorize('admin', 'instructor'),
  checkOrganizationAccess,
  webinarController.createWebinar
);

// Get a specific webinar by ID
router.get(
  '/:id', 
  checkWebinarAccess,
  webinarController.getWebinar
);

// Update a webinar - only admins, instructors, or creators
router.put(
  '/:id', 
  checkWebinarAccess,
  webinarController.updateWebinar
);

// Delete a webinar - only admins or creators
router.delete(
  '/:id',
  authorize('admin'),
  checkWebinarAccess,
  webinarController.deleteWebinar
);

// Cancel a webinar - admins, instructors, or creators
router.put(
  '/:id/cancel',
  checkWebinarAccess,
  webinarController.cancelWebinar
);

// Update webinar status - admins, instructors, or creators
router.put(
  '/:id/status',
  checkWebinarAccess,
  webinarController.updateWebinarStatus
);

// Get webinar statistics - admins, instructors, creators or organization members
router.get(
  '/:id/statistics',
  checkWebinarAccess,
  webinarController.getWebinarStatistics
);

// Get webinar materials
router.get(
  '/:id/materials',
  checkWebinarAccess,
  webinarController.getWebinarMaterials
);

// Add material to webinar - admins, instructors, or creators
router.post(
  '/:id/materials',
  checkWebinarAccess,
  webinarController.addWebinarMaterial
);

// Remove material from webinar - admins, instructors, or creators
router.delete(
  '/:id/materials/:materialId',
  checkWebinarAccess,
  webinarController.removeWebinarMaterial
);

module.exports = router;