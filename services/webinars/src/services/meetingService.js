const axios = require('axios');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

class MeetingService {
  constructor() {
    this.zoomConfig = {
      baseURL: 'https://api.zoom.us/v2',
      headers: {
        'Authorization': `Bearer ${process.env.ZOOM_JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    this.googleConfig = {
      baseURL: 'https://www.googleapis.com/calendar/v3',
      headers: {
        'Authorization': `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
  }

  async createMeeting(data) {
    try {
      switch (data.platform) {
        case 'zoom':
          return await this.createZoomMeeting(data);
        case 'meet':
          return await this.createGoogleMeet(data);
        case 'teams':
          return await this.createMicrosoftTeams(data);
        case 'custom':
          return await this.createCustomMeeting(data);
        default:
          throw new ApiError('Plataforma no soportada', 400);
      }
    } catch (error) {
      logger.error('Error creating meeting:', error);
      throw new ApiError('Error al crear la reunión', 500);
    }
  }

  async createZoomMeeting(data) {
    try {
      const response = await axios.post('/meetings', {
        topic: data.topic,
        type: 2, // Scheduled meeting
        start_time: data.start_time,
        duration: data.duration,
        timezone: 'America/Mexico_City',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          watermark: false,
          use_pmi: false,
          approval_type: 0,
          registration_type: 2,
          audio: 'both',
          auto_recording: 'cloud'
        }
      }, this.zoomConfig);

      return {
        id: response.data.id,
        join_url: response.data.join_url,
        password: response.data.password,
        platform: 'zoom'
      };
    } catch (error) {
      logger.error('Error creating Zoom meeting:', error);
      throw new ApiError('Error al crear reunión en Zoom', 500);
    }
  }

  async createGoogleMeet(data) {
    try {
      const response = await axios.post('/calendar/v3/calendars/primary/events', {
        summary: data.topic,
        description: 'Webinar via Google Meet',
        start: {
          dateTime: data.start_time,
          timeZone: 'America/Mexico_City'
        },
        end: {
          dateTime: new Date(new Date(data.start_time).getTime() + data.duration * 60000),
          timeZone: 'America/Mexico_City'
        },
        conferenceData: {
          createRequest: {
            requestId: `webinar-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      }, {
        ...this.googleConfig,
        params: {
          conferenceDataVersion: 1
        }
      });

      return {
        id: response.data.id,
        join_url: response.data.hangoutLink,
        platform: 'meet'
      };
    } catch (error) {
      logger.error('Error creating Google Meet:', error);
      throw new ApiError('Error al crear reunión en Google Meet', 500);
    }
  }

  async createMicrosoftTeams(data) {
    // Implementar integración con Microsoft Teams
    throw new ApiError('Microsoft Teams no implementado aún', 501);
  }

  async createCustomMeeting(data) {
    // Para reuniones personalizadas, simplemente devolver los datos proporcionados
    return {
      id: `custom-${Date.now()}`,
      join_url: data.join_url,
      platform: 'custom'
    };
  }

  async updateMeeting(meetingId, data) {
    try {
      switch (data.platform) {
        case 'zoom':
          return await this.updateZoomMeeting(meetingId, data);
        case 'meet':
          return await this.updateGoogleMeet(meetingId, data);
        case 'teams':
          return await this.updateMicrosoftTeams(meetingId, data);
        case 'custom':
          return await this.updateCustomMeeting(meetingId, data);
        default:
          throw new ApiError('Plataforma no soportada', 400);
      }
    } catch (error) {
      logger.error('Error updating meeting:', error);
      throw new ApiError('Error al actualizar la reunión', 500);
    }
  }

  async deleteMeeting(meetingId, platform) {
    try {
      switch (platform) {
        case 'zoom':
          return await this.deleteZoomMeeting(meetingId);
        case 'meet':
          return await this.deleteGoogleMeet(meetingId);
        case 'teams':
          return await this.deleteMicrosoftTeams(meetingId);
        case 'custom':
          return await this.deleteCustomMeeting(meetingId);
        default:
          throw new ApiError('Plataforma no soportada', 400);
      }
    } catch (error) {
      logger.error('Error deleting meeting:', error);
      throw new ApiError('Error al eliminar la reunión', 500);
    }
  }

  async getMeetingRecording(meetingId, platform) {
    try {
      switch (platform) {
        case 'zoom':
          return await this.getZoomRecording(meetingId);
        case 'meet':
          return await this.getGoogleMeetRecording(meetingId);
        case 'teams':
          return await this.getTeamsRecording(meetingId);
        default:
          throw new ApiError('Plataforma no soportada', 400);
      }
    } catch (error) {
      logger.error('Error getting meeting recording:', error);
      throw new ApiError('Error al obtener la grabación', 500);
    }
  }
}

module.exports = new MeetingService();
