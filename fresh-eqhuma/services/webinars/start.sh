#!/bin/bash

# Check if environment file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create an .env file based on .env.example"
  exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Check for required environment variables
REQUIRED_VARS=("PORT" "MONGO_URI" "JWT_SECRET" "FRONTEND_URL")
MISSING_VARS=0

for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    echo "Error: Required environment variable $VAR is not set"
    MISSING_VARS=1
  fi
done

if [ $MISSING_VARS -eq 1 ]; then
  echo "Please set all required environment variables in .env file"
  exit 1
fi

# Create necessary directories
mkdir -p ./uploads/subtitles

# Check MongoDB connection
echo "Checking MongoDB connection..."
node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(() => { console.log('MongoDB connected successfully'); process.exit(0); }).catch(err => { console.error('MongoDB connection failed:', err); process.exit(1); });"

if [ $? -ne 0 ]; then
  echo "Error: Could not connect to MongoDB. Please check your MONGO_URI"
  exit 1
fi

# Start the service based on NODE_ENV
if [ "$NODE_ENV" = "production" ]; then
  echo "Starting server in production mode..."
  node server.js
else
  echo "Starting server in development mode..."
  npx nodemon server.js
fi
