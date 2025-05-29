// src/controllers/registrationController.js
const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Webinar = require('../models/Webinar');
const emailService = require('../utils/emailService');
const config = require('../config');

/**
 * Controller for managing webinar registrations
 */
class RegistrationController {
  /**
   * Get all registrations with filtering, sorting and pagination
   * @route GET /api/v1/registrations
   */
  async getRegistrations(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        sort = '-registrationDate', 
        webinarId,
        userId,
        email,
        status,
        organizationId
      } = req.query;
      
      // Build filter object
      const filter = {};
      
      // Apply filters
      if (webinarId) filter.webinar = webinarId;
      if (userId) filter.userId = userId;
      if (email) filter.email = { $regex: email, $options: 'i' }; // Case-insensitive search
      if (status) filter.status = status;
      
      // Filter by organization if provided or use user's organization
      if (organizationId) {
        filter.organizationId = organizationId;
      } else if (!['admin'].includes(req.user.role)) {
        // Non-admin users can only see registrations from their organization
        filter.organizationId = req.user.organizationId;
      }
      
      // Calculate pagination
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // Get registrations with pagination
      const registrations = await Registration.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('webinar', 'title startDate endDate')
        .populate('createdBy', 'name email');
      
      // Get total count for pagination
      const total = await Registration.countDocuments(filter);
      
      res.status(200).json({
        success: true,
        count: registrations.length,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        },
        data: registrations
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get a user's registrations
   * @route GET /api/v1/registrations/my-registrations
   */
  async getMyRegistrations(req, res, next) {
    try {
      const { status, sort = '-registrationDate' } = req.query;
      
      // Build filter for user's registrations
      const filter = {
        userId: req.user.id
      };
      
      // Apply status filter if provided
      if (status) {
        filter.status = status;
      }
      
      // Get registrations
      const registrations = await Registration.find(filter)
        .sort(sort)
        .populate({
          path: 'webinar',
          select: 'title startDate endDate status duration instructorName category tags coverImage'
        });
      
      res.status(200).json({
        success: true,
        count: registrations.length,
        data: registrations
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get a single registration by ID
   * @route GET /api/v1/registrations/:id
   */
  async getRegistration(req, res, next) {
    try {
      const registration = await Registration.findById(req.params.id)
        .populate('webinar')
        .populate('createdBy', 'name email');
      
      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }
      
      // Check if user has access to this registration
      if (
        !['admin', 'instructor'].includes(req.user.role) && 
        registration.userId !== req.user.id &&
        registration.organizationId !== req.user.organizationId
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this registration'
        });
      }
      
      res.status(200).json({
        success: true,
        data: registration
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Register for a webinar
   * @route POST /api/v1/registrations
   */
  async registerForWebinar(req, res, next) {
    try {
      const { webinarId, registrationQuestions } = req.body;
      
      // Check if webinar exists
      const webinar = await Webinar.findById(webinarId);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Check if webinar is already cancelled
      if (webinar.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Cannot register for a cancelled webinar'
        });
      }
      
      // Check if webinar is in the past
      if (new Date(webinar.startDate) < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot register for a webinar that has already started'
        });
      }
      
      // Check if webinar is full
      if (webinar.registrationCount >= webinar.capacity) {
        return res.status(400).json({
          success: false,
          message: 'Webinar is at full capacity'
        });
      }
      
      // Check if user is already registered
      const existingRegistration = await Registration.findOne({
        webinar: webinarId,
        userId: req.user.id
      });
      
      if (existingRegistration) {
        return res.status(400).json({
          success: false,
          message: 'You are already registered for this webinar'
        });
      }
      
      // Create registration
      const registration = await Registration.create({
        webinar: webinarId,
        user: req.user.id,
        userId: req.user.id,
        userName: req.user.name,
        email: req.user.email,
        organizationId: req.user.organizationId,
        organizationName: req.user.organizationName || 'Unknown Organization',
        registrationQuestions: registrationQuestions || [],
        createdBy: req.user.id,
        status: 'registered'
      });
      
      // Update webinar registration count
      await Registration.updateWebinarRegistrationCount(webinarId);
      
      // Send confirmation email
      try {
        await emailService.sendRegistrationConfirmation({
          userName: req.user.name,
          email: req.user.email
        }, webinar);
      } catch (emailError) {
        console.error('Failed to send registration confirmation email:', emailError);
        // Continue without email notification
      }
      
      // Get Socket.IO instance
      const socketService = req.app.get('socketService');
      if (socketService) {
        // Notify webinar room of new registration
        socketService.sendToRoom(`webinar-${webinarId}`, 'registration-new', {
          registrationId: registration._id,
          webinarId,
          userName: req.user.name,
          timestamp: new Date()
        });
      }
      
      res.status(201).json({
        success: true,
        data: registration
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Cancel registration for a webinar
   * @route PUT /api/v1/registrations/:id/cancel
   */
  async cancelRegistration(req, res, next) {
    try {
      const registration = await Registration.findById(req.params.id);
      
      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }
      
      // Check if user is authorized to cancel this registration
      if (
        !['admin', 'instructor'].includes(req.user.role) && 
        registration.userId !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to cancel this registration'
        });
      }
      
      // Get webinar to check if it has already started
      const webinar = await Webinar.findById(registration.webinar);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Associated webinar not found'
        });
      }
      
      // Check if webinar has already started
      const now = new Date();
      const webinarStartDate = new Date(webinar.startDate);
      
      if (webinarStartDate < now) {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel registration for a webinar that has already started'
        });
      }
      
      // Update registration status
      registration.status = 'cancelled';
      await registration.save();
      
      // Update webinar registration count
      await Registration.updateWebinarRegistrationCount(webinar._id);
      
      // Get Socket.IO instance
      const socketService = req.app.get('socketService');
      if (socketService) {
        // Notify webinar room of cancelled registration
        socketService.sendToRoom(`webinar-${webinar._id}`, 'registration-cancelled', {
          registrationId: registration._id,
          webinarId: webinar._id,
          userName: registration.userName,
          timestamp: new Date()
        });
      }
      
      res.status(200).json({
        success: true,
        data: registration
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update registration status (mainly for admins)
   * @route PUT /api/v1/registrations/:id/status
   */
  async updateRegistrationStatus(req, res, next) {
    try {
      const { status } = req.body;
      
      if (!['registered', 'confirmed', 'attended', 'cancelled', 'no-show'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }
      
      const registration = await Registration.findById(req.params.id);
      
      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }
      
      // Only admins and instructors can update status (except for cancellations)
      if (
        !['admin', 'instructor'].includes(req.user.role) &&
        !(status === 'cancelled' && registration.userId === req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update registration status'
        });
      }
      
      // Update status
      registration.status = status;
      
      // If marking as attended, set attendance time
      if (status === 'attended' && !registration.attendanceTime) {
        registration.attendanceTime = new Date();
      }
      
      await registration.save();
      
      // If status is attended, update webinar attendee count
      if (status === 'attended') {
        await Registration.updateWebinarAttendeeCount(registration.webinar);
      }
      
      // Get Socket.IO instance
      const socketService = req.app.get('socketService');
      if (socketService) {
        // Notify about status change
        socketService.sendToRoom(`webinar-${registration.webinar}`, 'registration-status-changed', {
          registrationId: registration._id,
          webinarId: registration.webinar,
          userId: registration.userId,
          userName: registration.userName,
          status,
          timestamp: new Date()
        });
      }
      
      res.status(200).json({
        success: true,
        data: registration
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Submit feedback for a webinar
   * @route POST /api/v1/registrations/:id/feedback
   */
  async submitFeedback(req, res, next) {
    try {
      const { 
        rating, 
        comments, 
        instructorRating, 
        contentRating, 
        technicalRating,
        surveyResponses
      } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating is required and must be between 1 and 5'
        });
      }
      
      const registration = await Registration.findById(req.params.id);
      
      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }
      
      // Only the registered user can submit feedback
      if (registration.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to submit feedback for this registration'
        });
      }
      
      // Check if registration status is attended
      if (registration.status !== 'attended') {
        return res.status(400).json({
          success: false,
          message: 'Can only submit feedback for attended webinars'
        });
      }
      
      // Update feedback
      registration.feedback = {
        rating,
        comments: comments || '',
        instructorRating: instructorRating || rating,
        contentRating: contentRating || rating,
        technicalRating: technicalRating || rating,
        submittedAt: new Date(),
        surveyResponses: surveyResponses || []
      };
      
      await registration.save();
      
      // Update webinar feedback score
      const webinar = await Webinar.findById(registration.webinar);
      
      if (webinar) {
        // Get all feedback for this webinar
        const registrationsWithFeedback = await Registration.find({
          webinar: webinar._id,
          'feedback.rating': { $exists: true }
        });
        
        if (registrationsWithFeedback.length > 0) {
          const totalScore = registrationsWithFeedback.reduce(
            (sum, reg) => sum + reg.feedback.rating, 0
          );
          
          webinar.feedbackScore = totalScore / registrationsWithFeedback.length;
          webinar.feedbackCount = registrationsWithFeedback.length;
          await webinar.save();
        }
      }
      
      // Get Socket.IO instance
      const socketService = req.app.get('socketService');
      if (socketService) {
        // Notify about feedback submission (without details for privacy)
        socketService.sendToRoom(`webinar-${registration.webinar}`, 'feedback-submitted', {
          webinarId: registration.webinar,
          userId: registration.userId,
          timestamp: new Date()
        });
      }
      
      res.status(200).json({
        success: true,
        data: registration
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Record user interactions during webinar
   * @route PUT /api/v1/registrations/:id/interactions
   */
  async updateInteractions(req, res, next) {
    try {
      const { interactionType, increment = 1 } = req.body;
      
      if (!['chatMessages', 'questions', 'pollsAnswered', 'handRaises', 'reactions'].includes(interactionType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid interaction type'
        });
      }
      
      const registration = await Registration.findById(req.params.id);
      
      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }
      
      // Check if user is the owner of this registration
      if (registration.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update interactions for this registration'
        });
      }
      
      // Initialize interactions object if it doesn't exist
      if (!registration.interactions) {
        registration.interactions = {
          chatMessages: 0,
          questions: 0,
          pollsAnswered: 0,
          handRaises: 0,
          reactions: 0
        };
      }
      
      // Update interaction count
      registration.interactions[interactionType] += increment;
      
      await registration.save();
      
      res.status(200).json({
        success: true,
        data: registration.interactions
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Mark user attendance (join/leave)
   * @route PUT /api/v1/registrations/:id/attendance
   */
  async updateAttendance(req, res, next) {
    try {
      const { action, timestamp } = req.body;
      
      if (!['join', 'leave'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid attendance action'
        });
      }
      
      const registration = await Registration.findById(req.params.id);
      
      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }
      
      // Check if user is the owner or an admin/instructor
      const isAuthorized = 
        registration.userId === req.user.id ||
        ['admin', 'instructor'].includes(req.user.role);
      
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update attendance for this registration'
        });
      }
      
      // Update attendance data
      if (action === 'join') {
        registration.attendanceTime = timestamp ? new Date(timestamp) : new Date();
        registration.status = 'attended';
        
        // Update webinar attendee count
        await Registration.updateWebinarAttendeeCount(registration.webinar);
        
        // Get Socket.IO instance
        const socketService = req.app.get('socketService');
        if (socketService) {
          // Notify about user joining
          socketService.sendToRoom(`webinar-${registration.webinar}`, 'user-joined-webinar', {
            registrationId: registration._id,
            webinarId: registration.webinar,
            userId: registration.userId,
            userName: registration.userName,
            timestamp: registration.attendanceTime
          });
        }
      } else if (action === 'leave') {
        if (registration.attendanceTime) {
          registration.leaveTime = timestamp ? new Date(timestamp) : new Date();
          
          // Calculate attendance duration
          const attendanceMs = registration.leaveTime.getTime() - registration.attendanceTime.getTime();
          registration.attendanceDuration = Math.round(attendanceMs / 60000); // Convert ms to minutes
          
          // Get Socket.IO instance
          const socketService = req.app.get('socketService');
          if (socketService) {
            // Notify about user leaving
            socketService.sendToRoom(`webinar-${registration.webinar}`, 'user-left-webinar', {
              registrationId: registration._id,
              webinarId: registration.webinar,
              userId: registration.userId,
              userName: registration.userName,
              attendanceDuration: registration.attendanceDuration,
              timestamp: registration.leaveTime
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            message: 'Cannot record leave time without a join time'
          });
        }
      }
      
      await registration.save();
      
      res.status(200).json({
        success: true,
        data: registration
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get registration certificate
   * @route GET /api/v1/registrations/:id/certificate
   */
  async getCertificate(req, res, next) {
    try {
      const registration = await Registration.findById(req.params.id)
        .populate('webinar', 'title startDate endDate duration');
      
      if (!registration) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }
      
      // Check if user is the owner or an admin
      const isAuthorized = 
        registration.userId === req.user.id ||
        ['admin'].includes(req.user.role);
      
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this certificate'
        });
      }
      
      // Check if certificate is eligible
      if (!registration.isCertificateEligible) {
        return res.status(400).json({
          success: false,
          message: 'Not eligible for a certificate. Requires attendance of at least 70% of the webinar.'
        });
      }
      
      // If certificate already exists, return it
      if (registration.certificate && registration.certificate.url) {
        registration.certificate.downloadCount += 1;
        registration.certificate.lastDownloaded = new Date();
        await registration.save();
        
        return res.status(200).json({
          success: true,
          data: {
            certificateUrl: registration.certificate.url,
            downloadCount: registration.certificate.downloadCount
          }
        });
      }
      
      // Certificate doesn't exist yet, mock the creation process
      // In a real implementation, this would generate a PDF
      const certificateUrl = `/certificates/${registration.webinar}/user_${registration.userId}_${Date.now()}.pdf`;
      
      // Update certificate info
      registration.certificate = {
        generated: true,
        generatedAt: new Date(),
        url: certificateUrl,
        downloadCount: 1,
        lastDownloaded: new Date()
      };
      
      await registration.save();
      
      res.status(200).json({
        success: true,
        data: {
          certificateUrl: registration.certificate.url,
          downloadCount: registration.certificate.downloadCount
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RegistrationController();