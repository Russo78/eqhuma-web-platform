// src/utils/oauth.js
const axios = require('axios');
const crypto = require('crypto');
const { google } = require('googleapis');
const querystring = require('querystring');
const config = require('../config');

/**
 * OAuth utility for handling authentication with video conferencing platforms
 * Supports Zoom and Google Meet integrations
 */
class OAuthService {
  constructor() {
    this.zoomTokens = new Map(); // In-memory store of Zoom tokens by user ID
    this.googleTokens = new Map(); // In-memory store of Google tokens by user ID
    
    // Initialize Google OAuth client
    if (config.googleClientId && config.googleClientSecret) {
      this.googleOAuth2Client = new google.auth.OAuth2(
        config.googleClientId,
        config.googleClientSecret,
        config.googleRedirectUri
      );
      
      this.calendar = google.calendar({
        version: 'v3',
        auth: this.googleOAuth2Client
      });
    }
  }

  /**
   * Get Zoom authorization URL
   * @param {string} userId - User ID for state tracking
   * @param {string} redirectPath - Optional path to redirect after authorization
   * @returns {string} - Authorization URL
   */
  getZoomAuthUrl(userId, redirectPath = '/dashboard') {
    if (!config.zoomApiKey) {
      throw new Error('Zoom API credentials not configured');
    }
    
    // Create state parameter to prevent CSRF attacks and track the user
    const state = Buffer.from(JSON.stringify({
      userId,
      redirectPath,
      nonce: crypto.randomBytes(16).toString('hex')
    })).toString('base64');
    
    const queryParams = querystring.stringify({
      response_type: 'code',
      client_id: config.zoomApiKey,
      redirect_uri: config.zoomRedirectUri,
      state
    });
    
    return `https://zoom.us/oauth/authorize?${queryParams}`;
  }

  /**
   * Exchange Zoom authorization code for access token
   * @param {string} code - Authorization code from Zoom
   * @returns {Object} - Zoom tokens
   */
  async exchangeZoomCode(code) {
    if (!config.zoomApiKey || !config.zoomApiSecret) {
      throw new Error('Zoom API credentials not configured');
    }
    
    try {
      const tokenUrl = 'https://zoom.us/oauth/token';
      
      // Create Basic Auth header
      const auth = Buffer.from(`${config.zoomApiKey}:${config.zoomApiSecret}`).toString('base64');
      
      const response = await axios.post(
        tokenUrl,
        querystring.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.zoomRedirectUri
        }),
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      const tokenData = response.data;
      
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        tokenType: tokenData.token_type,
        scope: tokenData.scope
      };
    } catch (error) {
      console.error('Error exchanging Zoom code:', error.response?.data || error.message);
      throw new Error('Failed to exchange Zoom authorization code');
    }
  }

  /**
   * Refresh Zoom access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} - Updated tokens
   */
  async refreshZoomToken(refreshToken) {
    if (!config.zoomApiKey || !config.zoomApiSecret) {
      throw new Error('Zoom API credentials not configured');
    }
    
    try {
      const tokenUrl = 'https://zoom.us/oauth/token';
      
      // Create Basic Auth header
      const auth = Buffer.from(`${config.zoomApiKey}:${config.zoomApiSecret}`).toString('base64');
      
      const response = await axios.post(
        tokenUrl,
        querystring.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      const tokenData = response.data;
      
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        tokenType: tokenData.token_type,
        scope: tokenData.scope
      };
    } catch (error) {
      console.error('Error refreshing Zoom token:', error.response?.data || error.message);
      throw new Error('Failed to refresh Zoom token');
    }
  }

  /**
   * Store Zoom token for a user
   * @param {string} userId - User ID
   * @param {Object} tokens - Token data
   */
  storeZoomTokens(userId, tokens) {
    // In production, this should store tokens securely in a database
    this.zoomTokens.set(userId, tokens);
    console.log(`Stored Zoom tokens for user ${userId}`);
  }

  /**
   * Get Zoom token for a user, refreshing if necessary
   * @param {string} userId - User ID
   * @returns {Object} - Zoom tokens
   */
  async getZoomTokens(userId) {
    let tokens = this.zoomTokens.get(userId);
    
    if (!tokens) {
      throw new Error('No Zoom tokens found for user');
    }
    
    // Refresh token if expired or expiring soon (within 5 minutes)
    if (tokens.expiresAt - 300000 < Date.now()) {
      tokens = await this.refreshZoomToken(tokens.refreshToken);
      this.storeZoomTokens(userId, tokens);
    }
    
    return tokens;
  }

  /**
   * Create a Zoom meeting
   * @param {string} userId - User ID 
   * @param {Object} meetingDetails - Meeting details
   * @returns {Object} - Created meeting data
   */
  async createZoomMeeting(userId, meetingDetails) {
    try {
      const tokens = await this.getZoomTokens(userId);
      
      const response = await axios.post(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          topic: meetingDetails.title,
          type: 2, // Scheduled meeting
          start_time: meetingDetails.startTime,
          duration: meetingDetails.duration,
          timezone: meetingDetails.timeZone || 'America/Mexico_City',
          password: meetingDetails.password || this.generateRandomPassword(),
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            mute_upon_entry: true,
            auto_recording: meetingDetails.autoRecord ? 'cloud' : 'none',
            waiting_room: true
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error creating Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to create Zoom meeting');
    }
  }

  /**
   * Get Google authorization URL
   * @param {string} userId - User ID for state tracking
   * @param {string} redirectPath - Optional path to redirect after authorization
   * @returns {string} - Authorization URL
   */
  getGoogleAuthUrl(userId, redirectPath = '/dashboard') {
    if (!this.googleOAuth2Client) {
      throw new Error('Google API credentials not configured');
    }
    
    // Create state parameter to prevent CSRF attacks and track the user
    const state = Buffer.from(JSON.stringify({
      userId,
      redirectPath,
      nonce: crypto.randomBytes(16).toString('hex')
    })).toString('base64');
    
    const authUrl = this.googleOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      state,
      prompt: 'consent' // Force consent screen to ensure refresh token is returned
    });
    
    return authUrl;
  }

  /**
   * Exchange Google authorization code for access token
   * @param {string} code - Authorization code from Google
   * @returns {Object} - Google tokens
   */
  async exchangeGoogleCode(code) {
    if (!this.googleOAuth2Client) {
      throw new Error('Google API credentials not configured');
    }
    
    try {
      const { tokens } = await this.googleOAuth2Client.getToken(code);
      
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        tokenType: tokens.token_type,
        scope: tokens.scope
      };
    } catch (error) {
      console.error('Error exchanging Google code:', error);
      throw new Error('Failed to exchange Google authorization code');
    }
  }

  /**
   * Store Google token for a user
   * @param {string} userId - User ID
   * @param {Object} tokens - Token data
   */
  storeGoogleTokens(userId, tokens) {
    // In production, this should store tokens securely in a database
    this.googleTokens.set(userId, tokens);
    console.log(`Stored Google tokens for user ${userId}`);
  }

  /**
   * Get Google token for a user, refreshing if necessary
   * @param {string} userId - User ID
   * @returns {Object} - Google tokens
   */
  async getGoogleTokens(userId) {
    let tokens = this.googleTokens.get(userId);
    
    if (!tokens) {
      throw new Error('No Google tokens found for user');
    }
    
    // Refresh token if expired or expiring soon (within 5 minutes)
    if (tokens.expiresAt - 300000 < Date.now()) {
      this.googleOAuth2Client.setCredentials({
        refresh_token: tokens.refreshToken
      });
      
      const refreshedTokens = await this.googleOAuth2Client.refreshAccessToken();
      
      tokens = {
        ...tokens,
        accessToken: refreshedTokens.credentials.access_token,
        expiresIn: refreshedTokens.credentials.expires_in,
        expiresAt: Date.now() + refreshedTokens.credentials.expires_in * 1000
      };
      
      this.storeGoogleTokens(userId, tokens);
    }
    
    return tokens;
  }

  /**
   * Create a Google Meet event
   * @param {string} userId - User ID
   * @param {Object} eventDetails - Meeting/event details
   * @returns {Object} - Created event data
   */
  async createGoogleMeetEvent(userId, eventDetails) {
    try {
      const tokens = await this.getGoogleTokens(userId);
      
      // Set credentials for this request
      this.googleOAuth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken
      });
      
      // Parse start and end times
      const startDateTime = new Date(eventDetails.startTime);
      const endDateTime = new Date(startDateTime.getTime() + eventDetails.duration * 60000);
      
      // Create event with Google Meet conferencing
      const event = {
        summary: eventDetails.title,
        description: eventDetails.description || '',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: eventDetails.timeZone || 'America/Mexico_City'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: eventDetails.timeZone || 'America/Mexico_City'
        },
        conferenceData: {
          createRequest: {
            requestId: crypto.randomBytes(16).toString('hex'),
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 10 }
          ]
        }
      };
      
      // Create the event
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1
      });
      
      return response.data;
    } catch (error) {
      console.error('Error creating Google Meet event:', error);
      throw new Error('Failed to create Google Meet event');
    }
  }
  
  /**
   * Generate random password for Zoom meetings
   * @returns {string} - Random password
   */
  generateRandomPassword() {
    return Math.random().toString(36).substring(2, 10);
  }
}

// Create and export a singleton instance
const oauthService = new OAuthService();
module.exports = oauthService;