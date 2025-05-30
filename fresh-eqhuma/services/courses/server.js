// eqhuma-courses-service/server.js
const app = require('./app');
const config = require('./src/config');
const http = require('http');

// Create HTTP server
const server = http.createServer(app);

// Define port
const PORT = config.port || 4000;

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});