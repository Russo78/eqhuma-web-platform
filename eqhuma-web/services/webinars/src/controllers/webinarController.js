// src/controllers/webinarController.js
const mongoose = require('mongoose');
const Webinar = require('../models/Webinar');
const Registration = require('../models/Registration');
const Recording = require('../models/Recording');
const emailService = require('../utils/emailService');
const oauthService = require('../utils/oauth');
const config = require('../config');

/**
 * Controller for managing webinars
 */
class WebinarController {
  /**
   * Get all webinars with filtering, sorting and pagination
   * @route GET /api/v1/webinars
   */
  async getWebinars(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        sort = '-startDate', 
        status,
        search,
        category,
        instructor,
        startDate,
        endDate,
        isPublic,
        organizationId
      } = req.query;
      
      // Build filter object
      const filter = {};
      
      // Filter by organization if provided or use user's organization
      if (organizationId) {
        filter.organizationId = organizationId;
      } else if (!['admin'].includes(req.user.role)) {
        // Non-admin users can only see webinars from their organization
        filter.organizationId = req.user.organizationId;
      }
      
      // Apply other filters
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (instructor) filter.instructor = instructor;
      if (isPublic !== undefined) filter.isPublic = isPublic === 'true';
      
      // Date range filter
      if (startDate || endDate) {
        filter.startDate = {};
        if (startDate) filter.startDate.$gte = new Date(startDate);
        if (endDate) filter.startDate.$lte = new Date(endDate);
      }
      
      // Text search
      if (search) {
        filter.$text = { $search: search };
      }
      
      // Calculate pagination
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // Get webinars with pagination
      const webinars = await Webinar.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('instructor', 'name email')
        .populate('recordings', 'title fileUrl duration viewCount');
      
      // Get total count for pagination
      const total = await Webinar.countDocuments(filter);
      
      res.status(200).json({
        success: true,
        count: webinars.length,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        },
        data: webinars
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get upcoming webinars
   * @route GET /api/v1/webinars/upcoming
   */
  async getUpcomingWebinars(req, res, next) {
    try {
      const { limit = 5, organizationId } = req.query;
      
      // Build filter for upcoming webinars
      const filter = {
        startDate: { $gte: new Date() },
        status: 'scheduled'
      };
      
      // Filter by organization if provided or use user's organization
      if (organizationId) {
        filter.organizationId = organizationId;
      } else if (!['admin'].includes(req.user.role)) {
        filter.organizationId = req.user.organizationId;
      }
      
      // For non-admin users, only show public webinars
      if (!['admin', 'instructor'].includes(req.user.role)) {
        filter.isPublic = true;
      }
      
      const webinars = await Webinar.find(filter)
        .sort('startDate')
        .limit(parseInt(limit, 10))
        .populate('instructor', 'name email')
        .populate('recordings', 'title fileUrl duration viewCount');
      
      res.status(200).json({
        success: true,
        count: webinars.length,
        data: webinars
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get a single webinar by ID
   * @route GET /api/v1/webinars/:id
   */
  async getWebinar(req, res, next) {
    try {
      const webinar = await Webinar.findById(req.params.id)
        .populate('instructor', 'name email')
        .populate('recordings', 'title fileUrl duration viewCount')
        .populate({
          path: 'createdBy',
          select: 'name email'
        });
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Check if user has access to this webinar
      if (
        !['admin', 'instructor'].includes(req.user.role) && 
        webinar.organizationId !== req.user.organizationId &&
        !webinar.isPublic
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this webinar'
        });
      }
      
      // Get registration count and user's registration status
      const registrationCount = await Registration.countDocuments({
        webinar: webinar._id,
        status: { $ne: 'cancelled' }
      });
      
      const userRegistration = await Registration.findOne({
        webinar: webinar._id,
        userId: req.user.id
      });
      
      // Add registration info to response
      const webinarResponse = webinar.toObject();
      webinarResponse.registrationCount = registrationCount;
      webinarResponse.isRegistered = !!userRegistration;
      if (userRegistration) {
        webinarResponse.registrationStatus = userRegistration.status;
        webinarResponse.registrationId = userRegistration._id;
      }
      
      res.status(200).json({
        success: true,
        data: webinarResponse
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Create a new webinar
   * @route POST /api/v1/webinars
   */
  async createWebinar(req, res, next) {
    try {
      // Only admins and instructors can create webinars
      if (!['admin', 'instructor'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create webinars'
        });
      }
      
      // Set creator and organization
      req.body.createdBy = req.user.id;
      
      // If not admin, force organizationId to user's organization
      if (req.user.role !== 'admin') {
        req.body.organizationId = req.user.organizationId;
      }
      
      // Create webinar
      const webinar = await Webinar.create(req.body);
      
      // If platform integration is requested, create meeting
      if (webinar.platform === 'zoom' && config.features.zoomEnabled) {
        try {
          // Check if user has connected Zoom account
          const meetingDetails = {
            title: webinar.title,
            startTime: webinar.startDate,
            duration: webinar.duration,
            timeZone: webinar.timeZone,
            autoRecord: webinar.isRecorded
          };
          
          const meeting = await oauthService.createZoomMeeting(
            req.user.id, 
            meetingDetails
          );
          
          // Update webinar with meeting details
          webinar.meetingId = meeting.id;
          webinar.meetingPassword = meeting.password;
          webinar.meetingUrl = meeting.join_url;
          webinar.hostUrl = meeting.start_url;
          
          await webinar.save();
        } catch (zoomError) {
          console.error('Failed to create Zoom meeting:', zoomError);
          // Continue without Zoom integration
        }
      } else if (webinar.platform === 'google-meet' && config.features.googleMeetEnabled) {
        try {
          // Create Google Meet event
          const eventDetails = {
            title: webinar.title,
            description: webinar.description,
            startTime: webinar.startDate,
            duration: webinar.duration,
            timeZone: webinar.timeZone
          };
          
          const event = await oauthService.createGoogleMeetEvent(
            req.user.id, 
            eventDetails
          );
          
          // Update webinar with event details
          webinar.meetingId = event.id;
          webinar.meetingUrl = event.hangoutLink;
          
          await webinar.save();
        } catch (googleError) {
          console.error('Failed to create Google Meet event:', googleError);
          // Continue without Google Meet integration
        }
      }
      
      // Get Socket.IO instance
      const socketService = req.app.get('socketService');
      if (socketService) {
        // Broadcast new webinar to organization members
        socketService.broadcastToAll('webinar-created', {
          webinarId: webinar._id,
          title: webinar.title,
          organizationId: webinar.organizationId,
          startDate: webinar.startDate,
          instructor: webinar.instructorName
        });
      }
      
      res.status(201).json({
        success: true,
        data: webinar
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update a webinar
   * @route PUT /api/v1/webinars/:id
   */
  async updateWebinar(req, res, next) {
    try {
      let webinar = await Webinar.findById(req.params.id);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Check user permissions
      if (
        req.user.role !== 'admin' && 
        webinar.instructor.toString() !== req.user.id &&
        webinar.createdBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this webinar'
        });
      }
      
      // Store original start date to check if rescheduled
      const originalStartDate = new Date(webinar.startDate);
      
      // Update webinar
      webinar = await Webinar.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      
      // Check if webinar was rescheduled (start date changed)
      const newStartDate = new Date(webinar.startDate);
      if (newStartDate.getTime() !== originalStartDate.getTime()) {
        // Send rescheduling notifications to registered users
        const registrations = await Registration.find({
          webinar: webinar._id,
          status: { $ne: 'cancelled' }
        });
        
        for (const registration of registrations) {
          try {
            await emailService.sendReschedulingNotice(
              registration,
              webinar,
              originalStartDate
            );
          } catch (emailError) {
            console.error('Failed to send rescheduling notice:', emailError);
          }
        }
        
        // Get Socket.IO instance
        const socketService = req.app.get('socketService');
        if (socketService) {
          // Broadcast webinar rescheduled event
          socketService.broadcastToAll('webinar-rescheduled', {
            webinarId: webinar._id,
            title: webinar.title,
            originalStartDate,
            newStartDate: webinar.startDate
          });
        }
      }
      
      res.status(200).json({
        success: true,
        data: webinar
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Delete a webinar
   * @route DELETE /api/v1/webinars/:id
   */
  async deleteWebinar(req, res, next) {
    try {
      const webinar = await Webinar.findById(req.params.id);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Only admins or the creator can delete webinars
      if (
        req.user.role !== 'admin' && 
        webinar.createdBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this webinar'
        });
      }
      
      // Start a transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Delete related registrations
        await Registration.deleteMany({ webinar: webinar._id }, { session });
        
        // Delete the webinar
        await Webinar.findByIdAndDelete(webinar._id, { session });
        
        // Commit the transaction
        await session.commitTransaction();
        
        // Get Socket.IO instance
        const socketService = req.app.get('socketService');
        if (socketService) {
          // Broadcast webinar cancellation
          socketService.broadcastToAll('webinar-cancelled', {
            webinarId: webinar._id,
            title: webinar.title,
            organizationId: webinar.organizationId
          });
        }
        
        res.status(200).json({
          success: true,
          data: {}
        });
      } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        throw error;
      } finally {
        // End session
        session.endSession();
      }
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Cancel a webinar
   * @route PUT /api/v1/webinars/:id/cancel
   */
  async cancelWebinar(req, res, next) {
    try {
      const { reason } = req.body;
      const webinar = await Webinar.findById(req.params.id);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Only admins or the creator/instructor can cancel webinars
      if (
        req.user.role !== 'admin' && 
        webinar.createdBy.toString() !== req.user.id &&
        webinar.instructor.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to cancel this webinar'
        });
      }
      
      // Update status to cancelled
      webinar.status = 'cancelled';
      await webinar.save();
      
      // Send cancellation notices to registered users
      const registrations = await Registration.find({
        webinar: webinar._id,
        status: { $ne: 'cancelled' }
      });
      
      for (const registration of registrations) {
        try {
          await emailService.sendCancellationNotice(registration, webinar, reason);
          
          // Update registration status
          registration.status = 'cancelled';
          await registration.save();
        } catch (emailError) {
          console.error('Failed to send cancellation notice:', emailError);
        }
      }
      
      // Get Socket.IO instance
      const socketService = req.app.get('socketService');
      if (socketService) {
        // Broadcast webinar cancellation
        socketService.broadcastToAll('webinar-cancelled', {
          webinarId: webinar._id,
          title: webinar.title,
          organizationId: webinar.organizationId,
          reason
        });
      }
      
      res.status(200).json({
        success: true,
        data: webinar
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get webinar statistics
   * @route GET /api/v1/webinars/:id/statistics
   */
  async getWebinarStatistics(req, res, next) {
    try {
      const webinar = await Webinar.findById(req.params.id);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Check user permissions
      if (
        req.user.role !== 'admin' && 
        webinar.instructor.toString() !== req.user.id &&
        webinar.createdBy.toString() !== req.user.id &&
        webinar.organizationId !== req.user.organizationId
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this webinar statistics'
        });
      }
      
      // Get registrations
      const registrations = await Registration.find({
        webinar: webinar._id
      }).lean();
      
      // Get recordings
      const recordings = await Recording.find({
        webinar: webinar._id
      }).lean();
      
      // Calculate statistics
      const statistics = {
        registrationCount: registrations.length,
        attendeeCount: registrations.filter(r => r.status === 'attended').length,
        noShowCount: registrations.filter(r => r.status === 'no-show').length,
        cancellationCount: registrations.filter(r => r.status === 'cancelled').length,
        attendanceRate: 0,
        averageAttendanceDuration: 0,
        feedback: {
          responseCount: 0,
          averageRating: 0,
          averageInstructorRating: 0,
          averageContentRating: 0,
          averageTechnicalRating: 0
        },
        recordings: {
          count: recordings.length,
          totalViews: recordings.reduce((sum, rec) => sum + rec.viewCount, 0),
          uniqueViewers: recordings.reduce((sum, rec) => sum + rec.uniqueViewers, 0),
          averageRating: 0
        }
      };
      
      // Calculate attendance rate
      if (statistics.registrationCount > 0) {
        statistics.attendanceRate = (statistics.attendeeCount / statistics.registrationCount) * 100;
      }
      
      // Calculate average attendance duration
      const attendedRegistrations = registrations.filter(r => r.status === 'attended');
      if (attendedRegistrations.length > 0) {
        const totalDuration = attendedRegistrations.reduce((sum, r) => sum + (r.attendanceDuration || 0), 0);
        statistics.averageAttendanceDuration = totalDuration / attendedRegistrations.length;
      }
      
      // Calculate feedback statistics
      const feedbackRegistrations = registrations.filter(r => r.feedback && r.feedback.rating);
      if (feedbackRegistrations.length > 0) {
        statistics.feedback.responseCount = feedbackRegistrations.length;
        
        const totalRating = feedbackRegistrations.reduce((sum, r) => sum + r.feedback.rating, 0);
        statistics.feedback.averageRating = totalRating / feedbackRegistrations.length;
        
        const totalInstructorRating = feedbackRegistrations.reduce((sum, r) => sum + (r.feedback.instructorRating || 0), 0);
        statistics.feedback.averageInstructorRating = totalInstructorRating / feedbackRegistrations.length;
        
        const totalContentRating = feedbackRegistrations.reduce((sum, r) => sum + (r.feedback.contentRating || 0), 0);
        statistics.feedback.averageContentRating = totalContentRating / feedbackRegistrations.length;
        
        const totalTechnicalRating = feedbackRegistrations.reduce((sum, r) => sum + (r.feedback.technicalRating || 0), 0);
        statistics.feedback.averageTechnicalRating = totalTechnicalRating / feedbackRegistrations.length;
      }
      
      // Calculate recordings average rating
      if (recordings.length > 0) {
        const totalRating = recordings.reduce((sum, rec) => sum + rec.averageRating, 0);
        statistics.recordings.averageRating = totalRating / recordings.length;
      }
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get webinar materials
   * @route GET /api/v1/webinars/:id/materials
   */
  async getWebinarMaterials(req, res, next) {
    try {
      const webinar = await Webinar.findById(req.params.id);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Check if user is registered for webinar
      const isRegistered = await Registration.exists({
        webinar: webinar._id,
        userId: req.user.id,
        status: { $ne: 'cancelled' }
      });
      
      // Check access permissions
      const hasAccess = 
        req.user.role === 'admin' || 
        webinar.instructor.toString() === req.user.id ||
        webinar.createdBy.toString() === req.user.id ||
        (webinar.organizationId === req.user.organizationId && isRegistered);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access these materials'
        });
      }
      
      // Filter materials by access level
      let materials = webinar.materials;
      
      // If not admin or instructor, only show public materials
      if (!['admin', 'instructor'].includes(req.user.role) && 
          webinar.instructor.toString() !== req.user.id) {
        materials = materials.filter(material => material.isPublic);
      }
      
      res.status(200).json({
        success: true,
        count: materials.length,
        data: materials
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Add material to webinar
   * @route POST /api/v1/webinars/:id/materials
   */
  async addWebinarMaterial(req, res, next) {
    try {
      const webinar = await Webinar.findById(req.params.id);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Check permissions
      if (
        req.user.role !== 'admin' && 
        webinar.instructor.toString() !== req.user.id &&
        webinar.createdBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to add materials to this webinar'
        });
      }
      
      // Add material
      webinar.materials.push(req.body);
      await webinar.save();
      
      res.status(201).json({
        success: true,
        data: webinar.materials[webinar.materials.length - 1]
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Remove material from webinar
   * @route DELETE /api/v1/webinars/:id/materials/:materialId
   */
  async removeWebinarMaterial(req, res, next) {
    try {
      const webinar = await Webinar.findById(req.params.id);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Check permissions
      if (
        req.user.role !== 'admin' && 
        webinar.instructor.toString() !== req.user.id &&
        webinar.createdBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to remove materials from this webinar'
        });
      }
      
      // Find material index
      const materialIndex = webinar.materials.findIndex(
        material => material._id.toString() === req.params.materialId
      );
      
      if (materialIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Material not found'
        });
      }
      
      // Remove material
      webinar.materials.splice(materialIndex, 1);
      await webinar.save();
      
      res.status(200).json({
        success: true,
        data: {}
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update webinar status
   * @route PUT /api/v1/webinars/:id/status
   */
  async updateWebinarStatus(req, res, next) {
    try {
      const { status } = req.body;
      
      if (!['scheduled', 'live', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }
      
      const webinar = await Webinar.findById(req.params.id);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Check permissions
      if (
        req.user.role !== 'admin' && 
        webinar.instructor.toString() !== req.user.id &&
        webinar.createdBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this webinar status'
        });
      }
      
      // Update status
      webinar.status = status;
      await webinar.save();
      
      // Get Socket.IO instance
      const socketService = req.app.get('socketService');
      if (socketService) {
        // Broadcast status change
        socketService.broadcastToAll('webinar-status-changed', {
          webinarId: webinar._id,
          title: webinar.title,
          status: webinar.status,
          organizationId: webinar.organizationId
        });
      }
      
      res.status(200).json({
        success: true,
        data: webinar
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WebinarController();