// src/middleware/errorMiddleware.js
const config = require('../config');

/**
 * 404 error handler middleware
 * Handles routes that don't exist
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Error handler middleware
 * Centralized error handling for all application errors
 */
const errorHandler = (err, req, res, next) => {
  // Default error status is 500 (Server Error) if not specified
  const statusCode = err.statusCode || 500;
  
  // Prepare error response
  const errorResponse = {
    success: false,
    status: statusCode,
    message: err.message,
    // Only include stack trace in development environment
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  };

  // Handle validation errors from Mongoose
  if (err.name === 'ValidationError') {
    errorResponse.statusCode = 400;
    
    // Extract validation errors into a clean format
    errorResponse.errors = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message
    }));
  }

  // Handle MongoDB duplicate key errors
  if (err.code === 11000) {
    errorResponse.statusCode = 409;
    errorResponse.message = 'Duplicate resource found';
    
    // Extract the duplicate key field
    const field = Object.keys(err.keyValue)[0];
    errorResponse.errors = [{ 
      field, 
      message: `${field} already exists` 
    }];
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    errorResponse.statusCode = 401;
    errorResponse.message = 'Invalid authentication token';
  }

  if (err.name === 'TokenExpiredError') {
    errorResponse.statusCode = 401;
    errorResponse.message = 'Authentication token expired';
  }

  // Log server errors
  if (statusCode >= 500) {
    console.error('Server error:', err);
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

module.exports = { notFound, errorHandler };