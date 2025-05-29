// src/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Webinar = require('../models/Webinar');
const Registration = require('../models/Registration');
const Recording = require('../models/Recording');
const config = require('../config');

/**
 * Webhook routes for handling callbacks from Zoom and Google Meet
 * Base path: /api/v1/webhooks
 */

// Verify Zoom webhook
const verifyZoomWebhook = (req, res, next) => {
  // Skip verification in development
  if (config.nodeEnv === 'development' && !config.zoomWebhookSecret) {
    return next();
  }
  
  // Verify Zoom webhook signature
  if (config.zoomWebhookSecret) {
    const signature = req.headers['x-zm-signature'];
    const timestamp = req.headers['x-zm-request-timestamp'];
    const requestBody = JSON.stringify(req.body);
    
    if (!signature || !timestamp) {
      return res.status(401).json({
        status: 'error',
        message: 'Missing Zoom webhook signature headers'
      });
    }
    
    // Create HMAC SHA256 hash
    const message = `v0:${timestamp}:${requestBody}`;
    const hashForVerify = `v0=${crypto
      .createHmac('sha256', config.zoomWebhookSecret)
      .update(message)
      .digest('hex')}`;
    
    if (hashForVerify !== signature) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid webhook signature'
      });
    }
  }
  
  next();
};

// Handle Zoom webhooks
router.post('/zoom', verifyZoomWebhook, async (req, res) => {
  try {
    // Immediately respond to Zoom to acknowledge receipt
    res.status(200).json({ status: 'success' });
    
    const { event, payload } = req.body;
    console.log(`Received Zoom webhook: ${event}`);
    
    // Process different event types
    switch(event) {
      case 'meeting.started':
        await handleMeetingStarted(payload);
        break;
      case 'meeting.ended':
        await handleMeetingEnded(payload);
        break;
      case 'meeting.participant_joined':
        await handleParticipantJoined(payload);
        break;
      case 'meeting.participant_left':
        await handleParticipantLeft(payload);
        break;
      case 'recording.completed':
        await handleRecordingCompleted(payload);
        break;
      default:
        console.log(`Unhandled Zoom event: ${event}`);
    }
  } catch (error) {
    console.error('Error processing Zoom webhook:', error);
    // We already sent a 200 response, so just log the error
  }
});

// Handle Google webhooks
router.post('/google', async (req, res) => {
  try {
    // Immediately respond to Google to acknowledge receipt
    res.status(200).json({ status: 'success' });
    
    const { event, payload } = req.body;
    console.log(`Received Google webhook: ${event}`);
    
    // Process different event types
    switch(event) {
      case 'calendar.event.updated':
        await handleCalendarEventUpdated(payload);
        break;
      default:
        console.log(`Unhandled Google event: ${event}`);
    }
  } catch (error) {
    console.error('Error processing Google webhook:', error);
    // We already sent a 200 response, so just log the error
  }
});

// Handle Zoom meeting started event
async function handleMeetingStarted(payload) {
  try {
    const { id, host_id, topic } = payload.object;
    
    // Find the webinar by Zoom meeting ID
    const webinar = await Webinar.findOne({
      'platformData.meetingId': id.toString(),
      platform: 'zoom'
    });
    
    if (webinar) {
      // Update webinar status to live
      webinar.status = 'live';
      await webinar.save();
      
      console.log(`Webinar started: ${webinar._id} - ${topic}`);
    } else {
      console.log(`No matching webinar found for Zoom meeting ID: ${id}`);
    }
  } catch (error) {
    console.error('Error processing meeting.started event:', error);
  }
}

// Handle Zoom meeting ended event
async function handleMeetingEnded(payload) {
  try {
    const { id, host_id, topic } = payload.object;
    
    // Find the webinar by Zoom meeting ID
    const webinar = await Webinar.findOne({
      'platformData.meetingId': id.toString(),
      platform: 'zoom'
    });
    
    if (webinar) {
      // Update webinar status to completed
      webinar.status = 'completed';
      await webinar.save();
      
      console.log(`Webinar ended: ${webinar._id} - ${topic}`);
      
      // Update registrations that didn't attend to no_show
      await Registration.updateMany(
        { 
          webinarId: webinar._id,
          status: 'registered',  // Only update those still in registered status
          attendanceTime: { $exists: false }  // No attendance record
        },
        { $set: { status: 'no_show' } }
      );
    } else {
      console.log(`No matching webinar found for Zoom meeting ID: ${id}`);
    }
  } catch (error) {
    console.error('Error processing meeting.ended event:', error);
  }
}

// Handle Zoom participant joined event
async function handleParticipantJoined(payload) {
  try {
    const { id, participant } = payload.object;
    
    // Find the webinar by Zoom meeting ID
    const webinar = await Webinar.findOne({
      'platformData.meetingId': id.toString(),
      platform: 'zoom'
    });
    
    if (webinar && participant.email) {
      // Find the registration by email
      const registration = await Registration.findOne({
        webinarId: webinar._id,
        userEmail: participant.email
      });
      
      if (registration && registration.status !== 'attended') {
        // Mark attendance
        registration.status = 'attended';
        registration.attendanceTime = new Date();
        await registration.save();
        
        // Update webinar attendee count
        await webinar.incrementAttendees();
        
        console.log(`Participant joined: ${participant.email} - ${webinar._id}`);
      }
    } else {
      console.log(`No matching webinar found for Zoom meeting ID: ${id} or missing participant email`);
    }
  } catch (error) {
    console.error('Error processing participant_joined event:', error);
  }
}

// Handle Zoom participant left event
async function handleParticipantLeft(payload) {
  try {
    const { id, participant } = payload.object;
    
    // Find the webinar by Zoom meeting ID
    const webinar = await Webinar.findOne({
      'platformData.meetingId': id.toString(),
      platform: 'zoom'
    });
    
    if (webinar && participant.email) {
      // Find the registration by email
      const registration = await Registration.findOne({
        webinarId: webinar._id,
        userEmail: participant.email
      });
      
      if (registration && registration.attendanceTime) {
        // Mark exit time and calculate total attendance
        registration.exitTime = new Date();
        const attendanceMs = registration.exitTime.getTime() - registration.attendanceTime.getTime();
        registration.totalAttendanceMinutes = Math.round(attendanceMs / 60000); // Convert to minutes
        await registration.save();
        
        console.log(`Participant left: ${participant.email} - ${webinar._id} - Attended for ${registration.totalAttendanceMinutes} minutes`);
      }
    } else {
      console.log(`No matching webinar found for Zoom meeting ID: ${id} or missing participant email`);
    }
  } catch (error) {
    console.error('Error processing participant_left event:', error);
  }
}

// Handle Zoom recording completed event
async function handleRecordingCompleted(payload) {
  try {
    const { id, host_id, recording_files = [] } = payload.object;
    
    if (recording_files.length === 0) {
      console.log('No recording files in payload');
      return;
    }
    
    // Find the webinar by Zoom meeting ID
    const webinar = await Webinar.findOne({
      'platformData.meetingId': id.toString(),
      platform: 'zoom'
    });
    
    if (webinar) {
      // Process each recording file
      for (const file of recording_files) {
        if (file.status !== 'completed') continue;
        
        // Create recording entry
        const recording = new Recording({
          webinarId: webinar._id,
          title: webinar.title,
          description: webinar.description,
          recordingDate: new Date(file.recording_start),
          duration: file.duration_ms ? Math.floor(file.duration_ms / 1000) : 0,
          fileUrl: file.download_url,
          fileSize: file.file_size || 0,
          fileType: file.file_extension.toLowerCase().replace('.', '') || 'mp4',
          status: 'ready',
          thumbnailUrl: file.thumbnail_url || webinar.thumbnail,
          accessType: 'registered',
          platformData: {
            recordingId: file.id,
            downloadUrl: file.download_url,
            playbackUrl: file.play_url
          }
        });
        
        await recording.save();
        
        // Update webinar to indicate recording is available
        webinar.recording = {
          isAvailable: true,
          url: file.play_url || file.download_url,
          duration: Math.floor(file.duration_ms / 1000),
          dateProcessed: new Date(),
          size: file.file_size || 0,
          format: file.file_extension.toLowerCase().replace('.', '') || 'mp4',
          thumbnailUrl: file.thumbnail_url || webinar.thumbnail
        };
        
        console.log(`Recording completed for webinar: ${webinar._id} - Recording ID: ${recording._id}`);
      }
      
      await webinar.save();
    } else {
      console.log(`No matching webinar found for Zoom meeting ID: ${id}`);
    }
  } catch (error) {
    console.error('Error processing recording.completed event:', error);
  }
}

// Handle Google Calendar event updated
async function handleCalendarEventUpdated(payload) {
  try {
    const { id, status, summary, description, start, end } = payload;
    
    // Find the webinar by Google event ID
    const webinar = await Webinar.findOne({
      'platformData.eventId': id,
      platform: 'google_meet'
    });
    
    if (webinar) {
      // Update webinar with new information
      if (summary) webinar.title = summary;
      if (description) webinar.description = description;
      if (start && start.dateTime) webinar.startTime = new Date(start.dateTime);
      if (end && end.dateTime) webinar.endTime = new Date(end.dateTime);
      
      // Update status if needed
      if (status === 'cancelled') {
        webinar.status = 'cancelled';
      }
      
      await webinar.save();
      
      console.log(`Google Calendar event updated for webinar: ${webinar._id}`);
    } else {
      console.log(`No matching webinar found for Google event ID: ${id}`);
    }
  } catch (error) {
    console.error('Error processing calendar.event.updated event:', error);
  }
}

module.exports = router;