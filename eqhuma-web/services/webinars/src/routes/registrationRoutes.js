// src/routes/registrationRoutes.js
const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const { protect, authorize, checkOrganizationAccess } = require('../middleware/authMiddleware');

// Base route: /api/v1/registrations

// Protected routes - all registration endpoints require authentication
router.use(protect);

// Get all registrations with filtering and pagination - admins and instructors only
router.get(
  '/',
  authorize('admin', 'instructor'),
  registrationController.getRegistrations
);

// Get user's own registrations
router.get(
  '/my-registrations',
  registrationController.getMyRegistrations
);

// Register for a webinar
router.post(
  '/',
  registrationController.registerForWebinar
);

// Get a specific registration by ID
router.get(
  '/:id',
  registrationController.getRegistration
);

// Cancel registration for a webinar
router.put(
  '/:id/cancel',
  registrationController.cancelRegistration
);

// Update registration status - admins and instructors only
router.put(
  '/:id/status',
  authorize('admin', 'instructor'),
  registrationController.updateRegistrationStatus
);

// Submit feedback for a webinar
router.post(
  '/:id/feedback',
  registrationController.submitFeedback
);

// Update user interactions during webinar
router.put(
  '/:id/interactions',
  registrationController.updateInteractions
);

// Update attendance (join/leave)
router.put(
  '/:id/attendance',
  registrationController.updateAttendance
);

// Get registration certificate
router.get(
  '/:id/certificate',
  registrationController.getCertificate
);

module.exports = router;