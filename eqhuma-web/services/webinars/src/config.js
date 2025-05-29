// src/config.js
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration
 * Using environment variables with fallbacks for development
 */
module.exports = {
  // Server configuration
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB connection
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/eqhuma-webinars',
  
  // JWT Authentication
  jwtSecret: process.env.JWT_SECRET || 'eqhuma-webinars-dev-secret',
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  
  // CORS settings
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Email configuration
  emailFrom: process.env.EMAIL_FROM || 'noreply@eqhuma.com',
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  
  // Frontend URL for links in emails and redirects
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Storage configuration
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '100') * 1024 * 1024, // 100MB default
  
  // Zoom API integration
  zoomApiKey: process.env.ZOOM_API_KEY,
  zoomApiSecret: process.env.ZOOM_API_SECRET,
  zoomRedirectUri: process.env.ZOOM_REDIRECT_URI || 'http://localhost:5001/api/v1/zoom/callback',
  
  // Google Meet integration
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/v1/google/callback',
  
  // Feature flags
  features: {
    zoomEnabled: process.env.FEATURE_ZOOM_ENABLED === 'true' || false,
    googleMeetEnabled: process.env.FEATURE_GOOGLE_MEET_ENABLED === 'true' || false,
    recordingTranscriptionEnabled: process.env.FEATURE_RECORDING_TRANSCRIPTION === 'true' || false,
    certificatesEnabled: process.env.FEATURE_CERTIFICATES_ENABLED === 'true' || true,
    pollsEnabled: process.env.FEATURE_POLLS_ENABLED === 'true' || true,
    chatEnabled: process.env.FEATURE_CHAT_ENABLED === 'true' || true,
    feedbackEnabled: process.env.FEATURE_FEEDBACK_ENABLED === 'true' || true
  },
  
  // API rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000, // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // 100 requests per windowMs
  },
  
  // Logging options
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
  
  // Connection to main EQHuma API
  eqhumaApi: {
    url: process.env.EQHUMA_API_URL || 'http://localhost:3000/api',
    apiKey: process.env.EQHUMA_API_KEY,
  },

  // Stats collection configuration
  statsCollection: {
    enabled: process.env.STATS_COLLECTION_ENABLED === 'true' || true,
    interval: parseInt(process.env.STATS_COLLECTION_INTERVAL || '15') * 60 * 1000, // 15 minutes default
  }
};