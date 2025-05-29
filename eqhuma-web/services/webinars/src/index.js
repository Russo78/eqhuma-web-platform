// src/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');

// Create Express app
const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: [
    config.frontendUrl,
    config.mainServiceUrl,
    config.coursesServiceUrl
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes here (will be defined in subsequent files)
const webinarRoutes = require('./routes/webinarRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const recordingRoutes = require('./routes/recordingRoutes');
const oauthRoutes = require('./routes/oauthRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

// API routes
app.use(`${config.apiPrefix}/webinars`, webinarRoutes);
app.use(`${config.apiPrefix}/registrations`, registrationRoutes);
app.use(`${config.apiPrefix}/recordings`, recordingRoutes);
app.use(`${config.apiPrefix}/oauth`, oauthRoutes);
app.use(`${config.apiPrefix}/webhooks`, webhookRoutes);

// Root route for health check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'EQHuma Webinars Service API',
    version: '1.0.0',
    environment: config.nodeEnv
  });
});

// Error handling middleware
app.use((req, res, next) => {
  const error = new Error('Not Found');
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.json({
    status: 'error',
    message: error.message,
    stack: config.nodeEnv === 'development' ? error.stack : undefined
  });
});

module.exports = app;