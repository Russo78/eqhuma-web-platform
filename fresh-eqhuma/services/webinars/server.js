// server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');

// Import configuration and utilities
const config = require('./src/config');
const dbConnection = require('./src/utils/db');
const socketService = require('./src/utils/socketService');
const { notFound, errorHandler } = require('./src/middleware/errorMiddleware');

// Import routes
const webinarRoutes = require('./src/routes/webinarRoutes');
const registrationRoutes = require('./src/routes/registrationRoutes');
const recordingRoutes = require('./src/routes/recordingRoutes');
const oauthRoutes = require('./src/routes/oauthRoutes');
const webhookRoutes = require('./src/routes/webhookRoutes');

/**
 * Initialize Express application
 */
const app = express();

// Create HTTP server (needed for Socket.IO)
const server = http.createServer(app);

// Connect to MongoDB database
dbConnection.connect()
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Initialize Socket.IO
socketService.initialize(server);
app.set('socketService', socketService);

// Middleware setup
if (config.nodeEnv === 'development') {
  app.use(morgan('dev')); // Logging in development
} else {
  app.use(morgan('combined')); // More detailed logging in production
}

// Security middleware
app.use(helmet()); // Set security headers
app.use(mongoSanitize()); // Prevent MongoDB operator injection
app.use(xss()); // Sanitize inputs to prevent XSS
app.use(hpp()); // Protect against HTTP Parameter Pollution
app.use(compression()); // Compress responses

// Enable CORS
app.use(cors({
  origin: config.corsOrigin || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later'
  }
});

// Apply rate limiting to all requests
app.use(limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Set static folder for uploaded files
app.use('/uploads', express.static('uploads'));

// API health check route
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EQHuma Webinars Service is running',
    timestamp: new Date(),
    environment: config.nodeEnv,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Mount API routes
app.use('/api/v1/webinars', webinarRoutes);
app.use('/api/v1/registrations', registrationRoutes);
app.use('/api/v1/recordings', recordingRoutes);
app.use('/api/v1/oauth', oauthRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // In production, we might want to exit and let a process manager restart
  if (config.nodeEnv === 'production') {
    server.close(() => {
      process.exit(1);
    });
  }
});

module.exports = { app, server };