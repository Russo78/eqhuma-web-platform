# Base image
FROM node:16-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Create directory for uploaded files
RUN mkdir -p ./uploads/subtitles

# Expose the port the app runs on
EXPOSE 5002

# Command to run the app
CMD ["node", "server.js"]