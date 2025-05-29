// src/controllers/recordingController.js
const mongoose = require('mongoose');
const Recording = require('../models/Recording');
const Webinar = require('../models/Webinar');
const Registration = require('../models/Registration');
const config = require('../config');
const path = require('path');
const fs = require('fs').promises;

/**
 * Controller for managing webinar recordings
 */
class RecordingController {
  /**
   * Get all recordings with filtering, sorting and pagination
   * @route GET /api/v1/recordings
   */
  async getRecordings(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        sort = '-uploadDate', 
        webinarId,
        isPublic,
        organizationId,
        search,
        minDuration,
        maxDuration,
        startDate,
        endDate
      } = req.query;
      
      // Build filter object
      const filter = {};
      
      // Apply filters
      if (webinarId) filter.webinar = webinarId;
      if (isPublic !== undefined) filter.isPublic = isPublic === 'true';
      
      // Filter by organization if provided or use user's organization
      if (organizationId) {
        filter.organizationId = organizationId;
      } else if (!['admin'].includes(req.user.role)) {
        // Non-admin users can only see recordings from their organization
        filter.organizationId = req.user.organizationId;
      }
      
      // Duration filters
      if (minDuration || maxDuration) {
        filter.duration = {};
        if (minDuration) filter.duration.$gte = parseInt(minDuration, 10);
        if (maxDuration) filter.duration.$lte = parseInt(maxDuration, 10);
      }
      
      // Date range filter
      if (startDate || endDate) {
        filter.recordingDate = {};
        if (startDate) filter.recordingDate.$gte = new Date(startDate);
        if (endDate) filter.recordingDate.$lte = new Date(endDate);
      }
      
      // Text search
      if (search) {
        filter.$text = { $search: search };
      }
      
      // Calculate pagination
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // Get recordings with pagination
      const recordings = await Recording.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('webinar', 'title startDate category tags')
        .populate('createdBy', 'name email');
      
      // Get total count for pagination
      const total = await Recording.countDocuments(filter);
      
      res.status(200).json({
        success: true,
        count: recordings.length,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        },
        data: recordings
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get a single recording by ID
   * @route GET /api/v1/recordings/:id
   */
  async getRecording(req, res, next) {
    try {
      const recording = await Recording.findById(req.params.id)
        .populate('webinar', 'title startDate endDate duration instructorName category tags')
        .populate('createdBy', 'name email');
      
      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found'
        });
      }
      
      // Check if user has access to this recording
      if (
        !['admin', 'instructor'].includes(req.user.role) && 
        recording.organizationId !== req.user.organizationId &&
        !recording.isPublic
      ) {
        // Check if user was registered for the webinar
        const wasRegistered = await Registration.exists({
          webinar: recording.webinar,
          userId: req.user.id,
          status: 'attended'
        });
        
        if (!wasRegistered) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to access this recording'
          });
        }
      }
      
      // Increment view count
      if (req.query.track !== 'false') {
        const userViewEntry = {
          userId: req.user.id,
          userName: req.user.name,
          viewDate: new Date(),
          device: req.headers['user-agent'].includes('Mobile') ? 'mobile' : 'desktop'
        };
        
        // Check if user has viewed before
        const userViewIndex = recording.viewHistory.findIndex(v => v.userId === req.user.id);
        
        if (userViewIndex >= 0) {
          // Update existing view entry
          recording.viewHistory[userViewIndex].viewDate = new Date();
          recording.viewHistory[userViewIndex].device = userViewEntry.device;
        } else {
          // Add new view entry
          recording.viewHistory.push(userViewEntry);
        }
        
        await recording.save();
      }
      
      res.status(200).json({
        success: true,
        data: recording
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Create a new recording
   * @route POST /api/v1/recordings
   */
  async createRecording(req, res, next) {
    try {
      const { webinarId } = req.body;
      
      // Get webinar to verify access and populate data
      const webinar = await Webinar.findById(webinarId);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Check if user is authorized (admin, instructor, or creator of webinar)
      if (
        !['admin', 'instructor'].includes(req.user.role) && 
        webinar.instructor.toString() !== req.user.id &&
        webinar.createdBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create recordings for this webinar'
        });
      }
      
      // Set creator and organization
      req.body.createdBy = req.user.id;
      req.body.organizationId = webinar.organizationId;
      
      // If no recording date specified, use webinar date
      if (!req.body.recordingDate) {
        req.body.recordingDate = webinar.startDate;
      }
      
      // Create recording
      const recording = await Recording.create({
        ...req.body,
        webinar: webinarId
      });
      
      // Add recording to webinar
      webinar.recordings.push(recording._id);
      await webinar.save();
      
      // Get Socket.IO instance
      const socketService = req.app.get('socketService');
      if (socketService) {
        socketService.broadcastToAll('recording-new', {
          webinarId: webinar._id,
          recordingId: recording._id,
          title: recording.title,
          organizationId: webinar.organizationId
        });
      }
      
      res.status(201).json({
        success: true,
        data: recording
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update a recording
   * @route PUT /api/v1/recordings/:id
   */
  async updateRecording(req, res, next) {
    try {
      let recording = await Recording.findById(req.params.id);
      
      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found'
        });
      }
      
      // Check if user is authorized
      if (
        !['admin'].includes(req.user.role) && 
        recording.createdBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this recording'
        });
      }
      
      // Update recording
      recording = await Recording.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      
      res.status(200).json({
        success: true,
        data: recording
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Delete a recording
   * @route DELETE /api/v1/recordings/:id
   */
  async deleteRecording(req, res, next) {
    try {
      const recording = await Recording.findById(req.params.id);
      
      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found'
        });
      }
      
      // Check if user is authorized
      if (
        !['admin'].includes(req.user.role) && 
        recording.createdBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this recording'
        });
      }
      
      // If there's a physical file, attempt to delete it
      if (recording.storageLocation === 'local' && recording.fileUrl) {
        try {
          const filePath = path.join(process.cwd(), 'uploads', path.basename(recording.fileUrl));
          await fs.unlink(filePath);
        } catch (fileError) {
          console.error('Error deleting recording file:', fileError);
          // Continue with deletion even if file can't be deleted
        }
      }
      
      // Remove recording from webinar
      await Webinar.updateOne(
        { _id: recording.webinar },
        { $pull: { recordings: recording._id } }
      );
      
      // Delete the recording
      await recording.remove();
      
      res.status(200).json({
        success: true,
        data: {}
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update viewing progress for a recording
   * @route PUT /api/v1/recordings/:id/progress
   */
  async updateViewingProgress(req, res, next) {
    try {
      const { watchDuration, watchPercentage, completedView } = req.body;
      
      const recording = await Recording.findById(req.params.id);
      
      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found'
        });
      }
      
      // Find user's view history entry
      const userViewIndex = recording.viewHistory.findIndex(v => v.userId === req.user.id);
      
      if (userViewIndex === -1) {
        // Add new view entry if not found
        recording.viewHistory.push({
          userId: req.user.id,
          userName: req.user.name,
          viewDate: new Date(),
          watchDuration: watchDuration || 0,
          watchPercentage: watchPercentage || 0,
          completedView: completedView || false,
          device: req.headers['user-agent'].includes('Mobile') ? 'mobile' : 'desktop'
        });
      } else {
        // Update existing view entry
        const viewEntry = recording.viewHistory[userViewIndex];
        
        viewEntry.viewDate = new Date();
        
        if (watchDuration !== undefined) {
          viewEntry.watchDuration = watchDuration;
        }
        
        if (watchPercentage !== undefined) {
          viewEntry.watchPercentage = watchPercentage;
        }
        
        if (completedView !== undefined) {
          viewEntry.completedView = completedView;
        }
        
        recording.viewHistory[userViewIndex] = viewEntry;
      }
      
      await recording.save();
      
      res.status(200).json({
        success: true,
        data: {
          recordingId: recording._id,
          userId: req.user.id,
          viewDate: new Date(),
          watchDuration: watchDuration,
          watchPercentage: watchPercentage,
          completedView: completedView
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Submit feedback for a recording
   * @route POST /api/v1/recordings/:id/feedback
   */
  async submitFeedback(req, res, next) {
    try {
      const { rating, comment } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating is required and must be between 1 and 5'
        });
      }
      
      const recording = await Recording.findById(req.params.id);
      
      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found'
        });
      }
      
      // Check if user has already submitted feedback
      const existingFeedbackIndex = recording.feedback.findIndex(f => f.userId === req.user.id);
      
      if (existingFeedbackIndex !== -1) {
        // Update existing feedback
        recording.feedback[existingFeedbackIndex] = {
          ...recording.feedback[existingFeedbackIndex],
          rating,
          comment: comment || recording.feedback[existingFeedbackIndex].comment,
          submittedAt: new Date()
        };
      } else {
        // Add new feedback
        recording.feedback.push({
          userId: req.user.id,
          userName: req.user.name,
          rating,
          comment: comment || '',
          submittedAt: new Date()
        });
      }
      
      // Calculate average rating
      if (recording.feedback.length > 0) {
        const totalRating = recording.feedback.reduce((sum, item) => sum + item.rating, 0);
        recording.averageRating = Math.round((totalRating / recording.feedback.length) * 10) / 10;
        recording.ratingCount = recording.feedback.length;
      }
      
      await recording.save();
      
      res.status(200).json({
        success: true,
        data: {
          recordingId: recording._id,
          averageRating: recording.averageRating,
          ratingCount: recording.ratingCount,
          userRating: rating
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Upload a recording file
   * @route POST /api/v1/recordings/upload
   */
  async uploadRecording(req, res, next) {
    try {
      // This endpoint would typically be used with a file upload middleware
      // such as multer, but we'll mock it for now
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }
      
      const { webinarId } = req.body;
      
      // Get webinar to verify access
      const webinar = await Webinar.findById(webinarId);
      
      if (!webinar) {
        return res.status(404).json({
          success: false,
          message: 'Webinar not found'
        });
      }
      
      // Check if user is authorized
      if (
        !['admin', 'instructor'].includes(req.user.role) && 
        webinar.instructor.toString() !== req.user.id &&
        webinar.createdBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to upload recordings for this webinar'
        });
      }
      
      // Mock file details
      const fileDetails = {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      };
      
      // Extract duration (would typically be done with a library like ffmpeg)
      const duration = 3600; // Mock 1 hour duration
      
      // Create recording entry
      const recording = await Recording.create({
        webinar: webinarId,
        title: req.body.title || webinar.title,
        description: req.body.description || webinar.description,
        fileUrl: `/uploads/${fileDetails.filename}`,
        fileType: fileDetails.mimetype.includes('webm') ? 'webm' : 'mp4',
        fileSize: fileDetails.size,
        duration,
        thumbnailUrl: req.body.thumbnailUrl || webinar.coverImage,
        recordingDate: req.body.recordingDate || webinar.startDate,
        isPublic: req.body.isPublic !== undefined ? req.body.isPublic : true,
        isProcessed: true,
        processingStatus: 'completed',
        storageLocation: 'local',
        organizationId: webinar.organizationId,
        createdBy: req.user.id
      });
      
      // Add recording to webinar
      webinar.recordings.push(recording._id);
      await webinar.save();
      
      // Get Socket.IO instance
      const socketService = req.app.get('socketService');
      if (socketService) {
        socketService.broadcastToAll('recording-uploaded', {
          webinarId: webinar._id,
          recordingId: recording._id,
          title: recording.title,
          organizationId: webinar.organizationId
        });
      }
      
      res.status(201).json({
        success: true,
        data: recording
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get recording statistics
   * @route GET /api/v1/recordings/:id/statistics
   */
  async getRecordingStatistics(req, res, next) {
    try {
      const recording = await Recording.findById(req.params.id);
      
      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found'
        });
      }
      
      // Check if user has access
      if (
        !['admin', 'instructor'].includes(req.user.role) && 
        recording.createdBy.toString() !== req.user.id &&
        recording.organizationId !== req.user.organizationId
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view these statistics'
        });
      }
      
      // Calculate statistics
      const viewHistory = recording.viewHistory || [];
      
      // Get unique viewers
      const uniqueViewers = new Set(viewHistory.map(v => v.userId)).size;
      
      // Calculate average watch time
      let totalWatchTime = 0;
      let validWatchTimeEntries = 0;
      
      viewHistory.forEach(view => {
        if (view.watchDuration && view.watchDuration > 0) {
          totalWatchTime += view.watchDuration;
          validWatchTimeEntries++;
        }
      });
      
      const averageWatchTime = validWatchTimeEntries > 0 ? 
        totalWatchTime / validWatchTimeEntries : 0;
      
      // Calculate completion rate
      const completedViews = viewHistory.filter(v => v.completedView).length;
      const completionRate = viewHistory.length > 0 ? 
        (completedViews / viewHistory.length) * 100 : 0;
      
      // Calculate device breakdown
      const deviceCounts = viewHistory.reduce((acc, view) => {
        const device = view.device || 'unknown';
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {});
      
      // Calculate feedback stats
      const feedback = recording.feedback || [];
      let feedbackStats = {
        count: feedback.length,
        averageRating: recording.averageRating || 0,
        distribution: {
          5: 0, 4: 0, 3: 0, 2: 0, 1: 0
        }
      };
      
      feedback.forEach(item => {
        feedbackStats.distribution[item.rating] = 
          (feedbackStats.distribution[item.rating] || 0) + 1;
      });
      
      // Return statistics
      res.status(200).json({
        success: true,
        data: {
          viewCount: recording.viewCount,
          uniqueViewers,
          averageWatchTime,
          completionRate,
          devices: deviceCounts,
          feedback: feedbackStats,
          downloadCount: recording.downloadCount || 0,
          totalDuration: recording.duration,
          recordingDate: recording.recordingDate
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get recording chapter markers
   * @route GET /api/v1/recordings/:id/chapters
   */
  async getChapters(req, res, next) {
    try {
      const recording = await Recording.findById(req.params.id);
      
      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found'
        });
      }
      
      // Return chapter timestamps
      res.status(200).json({
        success: true,
        data: recording.chaptersTimestamps || []
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update recording chapter markers
   * @route PUT /api/v1/recordings/:id/chapters
   */
  async updateChapters(req, res, next) {
    try {
      const { chapters } = req.body;
      
      if (!Array.isArray(chapters)) {
        return res.status(400).json({
          success: false,
          message: 'Chapters must be an array'
        });
      }
      
      const recording = await Recording.findById(req.params.id);
      
      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found'
        });
      }
      
      // Check if user is authorized
      if (
        !['admin', 'instructor'].includes(req.user.role) && 
        recording.createdBy.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update chapters for this recording'
        });
      }
      
      // Update chapters
      recording.chaptersTimestamps = chapters;
      await recording.save();
      
      res.status(200).json({
        success: true,
        data: recording.chaptersTimestamps
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Track recording download
   * @route PUT /api/v1/recordings/:id/download
   */
  async trackDownload(req, res, next) {
    try {
      const recording = await Recording.findById(req.params.id);
      
      if (!recording) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found'
        });
      }
      
      // Increment download count
      recording.downloadCount = (recording.downloadCount || 0) + 1;
      await recording.save();
      
      res.status(200).json({
        success: true,
        data: {
          downloadCount: recording.downloadCount
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RecordingController();