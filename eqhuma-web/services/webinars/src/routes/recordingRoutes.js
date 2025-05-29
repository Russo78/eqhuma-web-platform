// src/routes/recordingRoutes.js
const express = require('express');
const router = express.Router();
const recordingController = require('../controllers/recordingController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure uploads directory exists
const subtitlesDir = path.join(config.localStoragePath, 'subtitles');
if (!fs.existsSync(subtitlesDir)) {
  fs.mkdirSync(subtitlesDir, { recursive: true });
}

// Configure multer for subtitle file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, subtitlesDir);
  },
  filename: (req, file, cb) => {
    const recordingId = req.params.id;
    const language = req.body.language || 'unknown';
    const fileType = req.body.fileType || path.extname(file.originalname).slice(1) || 'vtt';
    const timestamp = Date.now();
    cb(null, `${recordingId}_${language}_${timestamp}.${fileType}`);
  }
});

const upload = multer({ storage });

/**
 * Recording routes
 * Base path: /api/v1/recordings
 */

// Get all recordings with optional filtering
router.get('/', recordingController.getAllRecordings);

// Get recording statistics
router.get('/stats', recordingController.getRecordingStats);

// Create a new recording
router.post('/', recordingController.createRecording);

// Get a specific recording
router.get('/:id', recordingController.getRecordingById);

// Update a recording
router.patch('/:id', recordingController.updateRecording);

// Delete a recording
router.delete('/:id', recordingController.deleteRecording);

// Get recordings for a specific webinar
router.get('/webinar/:webinarId', recordingController.getRecordingsByWebinar);

// Update viewer statistics for a recording
router.post('/:id/view-stats', recordingController.updateViewerStats);

// Add subtitles to a recording
router.post('/:id/subtitles', upload.single('subtitleFile'), recordingController.addSubtitles);

// Add chapter markers to a recording
router.post('/:id/chapters', recordingController.addChapters);

module.exports = router;