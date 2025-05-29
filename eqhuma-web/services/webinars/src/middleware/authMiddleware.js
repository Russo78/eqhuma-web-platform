// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Authentication middleware
 * Verify JWT token and add user data to request object
 */
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Allow token from cookies for browser-based clients
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      status: 401,
      message: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Attach user info to request object
    req.user = {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId,
      organizationName: decoded.organizationName
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      status: 401,
      message: 'Invalid authentication token'
    });
  }
};

/**
 * Role-based authorization middleware
 * Restricts access to specified roles
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: 'User not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }

    next();
  };
};

/**
 * Organization access middleware
 * Ensures users can only access resources from their organization
 * Admins bypass this restriction
 */
const checkOrganizationAccess = (req, res, next) => {
  // Check if user is authenticated
  if (!req.user || !req.user.organizationId) {
    return res.status(401).json({
      success: false,
      status: 401,
      message: 'User not authenticated'
    });
  }

  // Admin users bypass organization check
  if (req.user.role === 'admin') {
    return next();
  }

  // Check resource organizationId against user's organizationId
  const resourceOrgId = req.body.organizationId || req.query.organizationId;
  
  if (resourceOrgId && resourceOrgId !== req.user.organizationId) {
    return res.status(403).json({
      success: false,
      status: 403,
      message: 'Not authorized to access resources from another organization'
    });
  }

  next();
};

/**
 * Webinar access middleware
 * Ensures users can only access webinars they are registered for
 * or webinars from their organization that are public
 * Instructors/Admins bypass this restriction
 */
const checkWebinarAccess = async (req, res, next) => {
  try {
    // If user is admin or instructor, allow access
    if (['admin', 'instructor'].includes(req.user.role)) {
      return next();
    }

    const webinarId = req.params.id || req.body.webinarId || req.query.webinarId;
    
    if (!webinarId) {
      return next();
    }

    const mongoose = require('mongoose');
    const Webinar = mongoose.model('Webinar');
    const Registration = mongoose.model('Registration');

    // Get webinar details
    const webinar = await Webinar.findById(webinarId);
    
    if (!webinar) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Webinar not found'
      });
    }

    // Check if webinar belongs to user's organization and is public
    const isOrgWebinar = webinar.organizationId === req.user.organizationId && webinar.isPublic;
    
    // Check if user is registered for this webinar
    const isRegistered = await Registration.findOne({
      webinar: webinarId,
      user: req.user.id,
      status: { $ne: 'cancelled' }
    }).lean();

    // Allow access if user is registered or if the webinar is public and from their org
    if (isRegistered || isOrgWebinar) {
      return next();
    }

    return res.status(403).json({
      success: false,
      status: 403,
      message: 'You do not have access to this webinar'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Recording access middleware
 * Ensures users can only access recordings they are allowed to view
 */
const checkRecordingAccess = async (req, res, next) => {
  try {
    // If user is admin or instructor, allow access
    if (['admin', 'instructor'].includes(req.user.role)) {
      return next();
    }

    const recordingId = req.params.id || req.body.recordingId || req.query.recordingId;
    
    if (!recordingId) {
      return next();
    }

    const mongoose = require('mongoose');
    const Recording = mongoose.model('Recording');
    const Registration = mongoose.model('Registration');

    // Get recording details
    const recording = await Recording.findById(recordingId);
    
    if (!recording) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'Recording not found'
      });
    }

    // Check if recording is public and belongs to user's organization
    const isOrgRecording = recording.organizationId === req.user.organizationId && recording.isPublic;
    
    // Check if user was registered for the associated webinar
    const isRegistered = await Registration.findOne({
      webinar: recording.webinar,
      user: req.user.id,
      status: { $ne: 'cancelled' }
    }).lean();

    // Allow access if user was registered or if the recording is public and from their org
    if (isRegistered || isOrgRecording) {
      return next();
    }

    return res.status(403).json({
      success: false,
      status: 403,
      message: 'You do not have access to this recording'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protect,
  authorize,
  checkOrganizationAccess,
  checkWebinarAccess,
  checkRecordingAccess
};