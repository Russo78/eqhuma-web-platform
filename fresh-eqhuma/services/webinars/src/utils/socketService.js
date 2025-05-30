// src/utils/socketService.js
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Socket.IO service for real-time communication in webinars
 */
class SocketService {
  constructor() {
    this.io = null;
    this.onlineUsers = new Map(); // Map of userId -> socketId
    this.webinarRooms = new Map(); // Map of webinarId -> Set of socketIds
    this.instructorSockets = new Map(); // Map of webinarId -> instructorSocketId
  }

  /**
   * Initialize Socket.IO server
   * @param {Object} server - HTTP server instance
   */
  initialize(server) {
    if (this.io) {
      console.warn('Socket.IO already initialized');
      return;
    }

    this.io = socketIo(server, {
      cors: {
        origin: config.corsOrigin || '*',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // Authentication middleware
    this.io.use(this.authenticateSocket);

    // Set up connection handling
    this.io.on('connection', this.handleConnection.bind(this));

    console.log('Socket.IO initialized');
  }

  /**
   * Authentication middleware for Socket.IO
   * @param {Object} socket - Socket instance
   * @param {Function} next - Next function
   */
  authenticateSocket = async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || 
                    socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication token is required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwtSecret);

      // Add user data to socket
      socket.user = {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
        organizationId: decoded.organizationId
      };

      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  };

  /**
   * Handle new socket connection
   * @param {Object} socket - Socket instance
   */
  handleConnection(socket) {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user.id} - ${socket.user.name})`);

    // Track user online status
    this.onlineUsers.set(socket.user.id, socket.id);
    this.emitUserStatusChange(socket.user.id, true);
    
    // Join organization room
    if (socket.user.organizationId) {
      socket.join(`org-${socket.user.organizationId}`);
    }

    // Join role-based room
    if (socket.user.role) {
      socket.join(`role-${socket.user.role}`);
    }

    // Handle webinar-specific events
    socket.on('join-webinar', (webinarId) => this.handleJoinWebinar(socket, webinarId));
    socket.on('leave-webinar', (webinarId) => this.handleLeaveWebinar(socket, webinarId));
    socket.on('send-message', (data) => this.handleSendMessage(socket, data));
    socket.on('send-question', (data) => this.handleSendQuestion(socket, data));
    socket.on('instructor-action', (data) => this.handleInstructorAction(socket, data));
    socket.on('poll-submit', (data) => this.handlePollSubmission(socket, data));
    socket.on('reaction', (data) => this.handleReaction(socket, data));
    socket.on('typing', (data) => this.handleTyping(socket, data));

    // Handle disconnection
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket instance
   */
  handleDisconnect(socket) {
    console.log(`Socket disconnected: ${socket.id} (User: ${socket.user.id} - ${socket.user.name})`);

    // Remove from online users
    if (this.onlineUsers.get(socket.user.id) === socket.id) {
      this.onlineUsers.delete(socket.user.id);
      this.emitUserStatusChange(socket.user.id, false);
    }

    // Remove from webinar rooms
    for (const [webinarId, socketIds] of this.webinarRooms.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);

        // Notify others in the room
        this.io.to(`webinar-${webinarId}`).emit('user-left', {
          userId: socket.user.id,
          userName: socket.user.name,
          timestamp: new Date()
        });

        // Remove instructor socket if needed
        if (this.instructorSockets.get(webinarId) === socket.id) {
          this.instructorSockets.delete(webinarId);
          this.io.to(`webinar-${webinarId}`).emit('instructor-status', {
            webinarId,
            isOnline: false,
            timestamp: new Date()
          });
        }
      }
    }
  }

  /**
   * Handle joining a webinar room
   * @param {Object} socket - Socket instance
   * @param {string} webinarId - Webinar ID
   */
  handleJoinWebinar(socket, webinarId) {
    if (!webinarId) return;

    // Join the webinar room
    socket.join(`webinar-${webinarId}`);

    // Track the socket in this webinar
    if (!this.webinarRooms.has(webinarId)) {
      this.webinarRooms.set(webinarId, new Set());
    }
    this.webinarRooms.get(webinarId).add(socket.id);

    // If user is instructor, track their socket
    if (socket.user.role === 'admin' || socket.user.role === 'instructor') {
      // Optionally mark them as instructor for this webinar
      socket.join(`webinar-${webinarId}-instructors`);

      // Instructors can control the webinar
      this.instructorSockets.set(webinarId, socket.id);

      // Notify participants that instructor is online
      this.io.to(`webinar-${webinarId}`).emit('instructor-status', {
        webinarId,
        isOnline: true,
        instructorName: socket.user.name,
        timestamp: new Date()
      });
    }

    // Notify others in the room
    socket.to(`webinar-${webinarId}`).emit('user-joined', {
      userId: socket.user.id,
      userName: socket.user.name,
      role: socket.user.role,
      timestamp: new Date()
    });

    // Send current participants count
    const participantsCount = this.webinarRooms.get(webinarId).size;
    this.io.to(`webinar-${webinarId}`).emit('participants-count', {
      webinarId,
      count: participantsCount
    });
  }

  /**
   * Handle leaving a webinar room
   * @param {Object} socket - Socket instance
   * @param {string} webinarId - Webinar ID
   */
  handleLeaveWebinar(socket, webinarId) {
    if (!webinarId) return;

    // Leave the room
    socket.leave(`webinar-${webinarId}`);
    socket.leave(`webinar-${webinarId}-instructors`);

    // Remove from tracking
    if (this.webinarRooms.has(webinarId)) {
      this.webinarRooms.get(webinarId).delete(socket.id);
    }

    // If user was instructor, update instructor status
    if (this.instructorSockets.get(webinarId) === socket.id) {
      this.instructorSockets.delete(webinarId);
      this.io.to(`webinar-${webinarId}`).emit('instructor-status', {
        webinarId,
        isOnline: false,
        timestamp: new Date()
      });
    }

    // Notify others
    socket.to(`webinar-${webinarId}`).emit('user-left', {
      userId: socket.user.id,
      userName: socket.user.name,
      timestamp: new Date()
    });

    // Update participants count
    const participantsCount = this.webinarRooms.has(webinarId) 
      ? this.webinarRooms.get(webinarId).size 
      : 0;
      
    this.io.to(`webinar-${webinarId}`).emit('participants-count', {
      webinarId,
      count: participantsCount
    });
  }

  /**
   * Handle chat messages in webinar
   * @param {Object} socket - Socket instance
   * @param {Object} data - Message data
   */
  handleSendMessage(socket, data) {
    const { webinarId, message, isPrivate, recipientId } = data;

    if (!webinarId || !message) return;

    const messageData = {
      id: Date.now().toString(), // Simple unique ID
      webinarId,
      senderId: socket.user.id,
      senderName: socket.user.name,
      senderRole: socket.user.role,
      message,
      timestamp: new Date()
    };

    if (isPrivate && recipientId) {
      // Private message to specific user
      const recipientSocketId = this.onlineUsers.get(recipientId);
      if (recipientSocketId) {
        this.io.to(recipientSocketId).emit('private-message', messageData);
        socket.emit('private-message', messageData); // Send to sender as well
      }

      // Also send to instructors if sender is not an instructor
      if (!['admin', 'instructor'].includes(socket.user.role)) {
        socket.to(`webinar-${webinarId}-instructors`).emit('private-message', {
          ...messageData,
          isFromStudent: true
        });
      }
    } else {
      // Public message to all in webinar
      this.io.to(`webinar-${webinarId}`).emit('new-message', messageData);
    }
  }

  /**
   * Handle questions in webinar
   * @param {Object} socket - Socket instance
   * @param {Object} data - Question data
   */
  handleSendQuestion(socket, data) {
    const { webinarId, question, isAnonymous } = data;

    if (!webinarId || !question) return;

    const questionData = {
      id: Date.now().toString(),
      webinarId,
      senderId: isAnonymous ? null : socket.user.id,
      senderName: isAnonymous ? 'Anonymous Attendee' : socket.user.name,
      question,
      upvotes: 0,
      isAnswered: false,
      timestamp: new Date()
    };

    // Send to all in webinar
    this.io.to(`webinar-${webinarId}`).emit('new-question', questionData);
  }

  /**
   * Handle instructor actions in webinar
   * @param {Object} socket - Socket instance
   * @param {Object} data - Action data
   */
  handleInstructorAction(socket, data) {
    const { webinarId, action, payload } = data;

    if (!webinarId || !action) return;

    // Check if user is instructor or admin
    if (!['admin', 'instructor'].includes(socket.user.role)) {
      socket.emit('error', { message: 'Not authorized to perform instructor actions' });
      return;
    }

    const actionData = {
      webinarId,
      action,
      payload,
      instructorId: socket.user.id,
      instructorName: socket.user.name,
      timestamp: new Date()
    };

    switch (action) {
      case 'start-webinar':
        this.io.to(`webinar-${webinarId}`).emit('webinar-started', actionData);
        break;
      case 'end-webinar':
        this.io.to(`webinar-${webinarId}`).emit('webinar-ended', actionData);
        break;
      case 'mute-all':
        this.io.to(`webinar-${webinarId}`).emit('all-muted', actionData);
        break;
      case 'screen-share':
        this.io.to(`webinar-${webinarId}`).emit('screen-share-changed', actionData);
        break;
      case 'start-poll':
        this.io.to(`webinar-${webinarId}`).emit('poll-started', actionData);
        break;
      case 'end-poll':
        this.io.to(`webinar-${webinarId}`).emit('poll-ended', actionData);
        break;
      case 'answer-question':
        this.io.to(`webinar-${webinarId}`).emit('question-answered', actionData);
        break;
      case 'highlight-question':
        this.io.to(`webinar-${webinarId}`).emit('question-highlighted', actionData);
        break;
      case 'spotlight-user':
        this.io.to(`webinar-${webinarId}`).emit('user-spotlighted', actionData);
        break;
      default:
        this.io.to(`webinar-${webinarId}`).emit('instructor-action', actionData);
    }
  }

  /**
   * Handle poll submissions
   * @param {Object} socket - Socket instance
   * @param {Object} data - Poll data
   */
  handlePollSubmission(socket, data) {
    const { webinarId, pollId, answer } = data;

    if (!webinarId || !pollId || answer === undefined) return;

    const submissionData = {
      webinarId,
      pollId,
      userId: socket.user.id,
      userName: socket.user.name,
      answer,
      timestamp: new Date()
    };

    // Send to instructors only
    socket.to(`webinar-${webinarId}-instructors`).emit('poll-submission', submissionData);
    
    // Confirm receipt to the user
    socket.emit('poll-submission-confirmed', {
      pollId,
      timestamp: new Date()
    });
  }

  /**
   * Handle reactions (like emoji reactions)
   * @param {Object} socket - Socket instance
   * @param {Object} data - Reaction data
   */
  handleReaction(socket, data) {
    const { webinarId, reaction } = data;

    if (!webinarId || !reaction) return;

    const reactionData = {
      webinarId,
      userId: socket.user.id,
      userName: socket.user.name,
      reaction,
      timestamp: new Date()
    };

    // Send to all in webinar
    this.io.to(`webinar-${webinarId}`).emit('new-reaction', reactionData);
  }

  /**
   * Handle typing indicator
   * @param {Object} socket - Socket instance
   * @param {Object} data - Typing data
   */
  handleTyping(socket, data) {
    const { webinarId, isTyping } = data;

    if (!webinarId) return;

    const typingData = {
      webinarId,
      userId: socket.user.id,
      userName: socket.user.name,
      isTyping,
      timestamp: new Date()
    };

    // Send to all except sender
    socket.to(`webinar-${webinarId}`).emit('user-typing', typingData);
  }

  /**
   * Emit user status change to interested parties
   * @param {string} userId - User ID
   * @param {boolean} isOnline - Whether user is online
   */
  emitUserStatusChange(userId, isOnline) {
    // This could be more targeted based on your application's needs
    this.io.emit('user-status-change', {
      userId,
      isOnline,
      timestamp: new Date()
    });
  }

  /**
   * Send message to specific room
   * @param {string} room - Room name
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   */
  sendToRoom(room, eventName, data) {
    if (!this.io) {
      console.warn('Socket.IO not initialized');
      return;
    }

    this.io.to(room).emit(eventName, data);
  }

  /**
   * Broadcast message to all connected clients
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   */
  broadcastToAll(eventName, data) {
    if (!this.io) {
      console.warn('Socket.IO not initialized');
      return;
    }

    this.io.emit(eventName, data);
  }

  /**
   * Send message to specific user
   * @param {string} userId - User ID
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   * @returns {boolean} - Whether message was sent
   */
  sendToUser(userId, eventName, data) {
    if (!this.io) {
      console.warn('Socket.IO not initialized');
      return false;
    }

    const socketId = this.onlineUsers.get(userId);
    if (!socketId) {
      return false;
    }

    this.io.to(socketId).emit(eventName, data);
    return true;
  }

  /**
   * Get online users count in a webinar
   * @param {string} webinarId - Webinar ID
   * @returns {number} - Number of online users
   */
  getWebinarParticipantCount(webinarId) {
    if (!this.webinarRooms.has(webinarId)) {
      return 0;
    }
    return this.webinarRooms.get(webinarId).size;
  }

  /**
   * Check if user is online
   * @param {string} userId - User ID
   * @returns {boolean} - Whether user is online
   */
  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }

  /**
   * Check if instructor is online for a webinar
   * @param {string} webinarId - Webinar ID
   * @returns {boolean} - Whether instructor is online
   */
  isInstructorOnline(webinarId) {
    return this.instructorSockets.has(webinarId);
  }
}

// Create and export singleton instance
const socketService = new SocketService();
module.exports = socketService;