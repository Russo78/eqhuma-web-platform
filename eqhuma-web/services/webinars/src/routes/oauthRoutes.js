// src/routes/oauthRoutes.js
const express = require('express');
const router = express.Router();
const oauthService = require('../utils/oauth');

/**
 * OAuth routes for handling authentication with Zoom and Google Meet
 * Base path: /api/v1/oauth
 */

// Redirect to Zoom OAuth authorization page
router.get('/zoom', (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required'
      });
    }
    
    const authUrl = oauthService.getZoomAuthorizationUrl(userId);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error redirecting to Zoom OAuth:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initiate Zoom OAuth',
      error: error.message
    });
  }
});

// Handle Zoom OAuth callback
router.get('/zoom/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid OAuth callback'
      });
    }
    
    const result = await oauthService.handleZoomCallback(code, state);
    
    if (result.success) {
      // Redirect to frontend with success token
      res.redirect(`${process.env.FRONTEND_URL}/oauth/success?provider=zoom&userId=${result.userId}`);
    } else {
      // Redirect to frontend with error
      res.redirect(`${process.env.FRONTEND_URL}/oauth/error?provider=zoom&error=${encodeURIComponent(result.error)}`);
    }
  } catch (error) {
    console.error('Error handling Zoom OAuth callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/oauth/error?provider=zoom&error=${encodeURIComponent(error.message)}`);
  }
});

// Redirect to Google OAuth authorization page
router.get('/google', (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required'
      });
    }
    
    const authUrl = oauthService.getGoogleAuthorizationUrl(userId);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error redirecting to Google OAuth:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initiate Google OAuth',
      error: error.message
    });
  }
});

// Handle Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid OAuth callback'
      });
    }
    
    const result = await oauthService.handleGoogleCallback(code, state);
    
    if (result.success) {
      // Redirect to frontend with success token
      res.redirect(`${process.env.FRONTEND_URL}/oauth/success?provider=google&userId=${result.userId}`);
    } else {
      // Redirect to frontend with error
      res.redirect(`${process.env.FRONTEND_URL}/oauth/error?provider=google&error=${encodeURIComponent(result.error)}`);
    }
  } catch (error) {
    console.error('Error handling Google OAuth callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/oauth/error?provider=google&error=${encodeURIComponent(error.message)}`);
  }
});

// Refresh Zoom token
router.post('/zoom/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token is required'
      });
    }
    
    const result = await oauthService.refreshZoomToken(refreshToken);
    
    if (result.success) {
      res.status(200).json({
        status: 'success',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt
        }
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Failed to refresh token',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error refreshing Zoom token:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to refresh token',
      error: error.message
    });
  }
});

// Refresh Google token
router.post('/google/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token is required'
      });
    }
    
    const result = await oauthService.refreshGoogleToken(refreshToken);
    
    if (result.success) {
      res.status(200).json({
        status: 'success',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt
        }
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Failed to refresh token',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error refreshing Google token:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to refresh token',
      error: error.message
    });
  }
});

module.exports = router;