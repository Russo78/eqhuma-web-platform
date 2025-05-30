# EQHuma Webinars Microservice

## Overview
The EQHuma Webinars Microservice is a dedicated service for managing online webinars and live training sessions within the EQHuma platform. This microservice handles webinar scheduling, registration, live session management, and recording storage.

## Features
- Schedule webinars with Zoom or Google Meet integration
- Manage user registrations and attendance tracking
- Handle webinar recordings and post-webinar content
- Real-time engagement analytics
- Email notifications for registrations and reminders
- Socket.io integration for real-time webinar engagement

## Architecture
This microservice is built using a Node.js/Express backend with MongoDB for data storage. It communicates with the main EQHuma platform through REST APIs and webhook integrations with Zoom and Google Meet for live webinar functionality.

## Prerequisites
- Node.js v14+ 
- MongoDB 4.4+
- Zoom Developer account (for Zoom integration)
- Google Developer account (for Google Meet integration)
- SMTP server access (for email notifications)

## Setup and Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd eqhuma-webinars-service
```

### 2. Install dependencies
```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Environment configuration
Copy the example environment file and configure it:
```bash
cp .env.example .env
```

Edit the `.env` file with your configuration details:

```env
# Server configuration
NODE_ENV=development
PORT=5002
API_PREFIX=/api/v1

# MongoDB configuration
MONGO_URI=mongodb://localhost:27017/eqhuma-webinars

# JWT configuration
JWT_SECRET=your-jwt-secret
JWT_EXPIRE=24h

# Zoom API credentials
ZOOM_API_KEY=your-zoom-api-key
ZOOM_API_SECRET=your-zoom-api-secret
ZOOM_REDIRECT_URI=http://localhost:5002/api/v1/oauth/zoom/callback

# Google Meet API credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5002/api/v1/oauth/google/callback

# Email configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=no-reply@eqhuma.com

# Frontend URL
FRONTEND_URL=https://eqhuma-plataforma-xtxtid-ip54bd-02ea88.mgx.dev
```

### 4. Start the service
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

## API Documentation

### Authentication
This service uses JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Webinars

#### Get all webinars
```
GET /api/v1/webinars
```

#### Get webinar by ID
```
GET /api/v1/webinars/:id
```

#### Create webinar
```
POST /api/v1/webinars
```

#### Update webinar
```
PATCH /api/v1/webinars/:id
```

#### Delete webinar
```
DELETE /api/v1/webinars/:id
```

#### Get webinar statistics
```
GET /api/v1/webinars/stats
```

### Registrations

#### Register for webinar
```
POST /api/v1/registrations/webinar/:webinarId
```

#### Get registrations by webinar
```
GET /api/v1/registrations/webinar/:webinarId
```

#### Get registrations by user
```
GET /api/v1/registrations/user/:userId
```

#### Cancel registration
```
PATCH /api/v1/registrations/:id/cancel
```

#### Mark attendance
```
PATCH /api/v1/registrations/:id/attendance
```

#### Submit feedback
```
POST /api/v1/registrations/:id/feedback
```

### Recordings

#### Get all recordings
```
GET /api/v1/recordings
```

#### Get recording by ID
```
GET /api/v1/recordings/:id
```

#### Create recording
```
POST /api/v1/recordings
```

#### Update recording
```
PATCH /api/v1/recordings/:id
```

#### Get recordings by webinar
```
GET /api/v1/recordings/webinar/:webinarId
```

### OAuth

#### Initiate Zoom OAuth
```
GET /api/v1/oauth/zoom?userId=<userId>
```

#### Initiate Google OAuth
```
GET /api/v1/oauth/google?userId=<userId>
```

## Webhooks

The service handles webhooks from Zoom and Google for real-time updates:

```
POST /api/v1/webhooks/zoom
POST /api/v1/webhooks/google
```

## Real-time Features

This service implements Socket.IO for real-time features during webinars:

- Chat messages
- Q&A
- Polls
- Hand raising
- Live attendance tracking

## Integration with Main EQHuma Platform

Integrate this microservice with the main EQHuma platform by:

1. Configuring the `FRONTEND_URL` environment variable to point to the main platform
2. Using the provided API endpoints to interact with webinar functionality
3. Setting up cross-origin resource sharing (CORS) between the main platform and this microservice

## Deployment

### Docker
A Dockerfile is provided for containerized deployment:

```bash
# Build the Docker image
docker build -t eqhuma-webinars .

# Run the container
docker run -p 5002:5002 --env-file .env eqhuma-webinars
```

### Environment Variables for Production
For production deployment, ensure you set these additional variables:
```
NODE_ENV=production
MONGO_URI=<production-mongodb-uri>
JWT_SECRET=<strong-production-secret>
```

## License
MIT