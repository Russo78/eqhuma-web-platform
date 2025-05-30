// src/utils/db.js
const mongoose = require('mongoose');
const config = require('../config');

/**
 * Database utility for connecting to MongoDB
 */
class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
  }

  /**
   * Connect to MongoDB
   * @returns {Promise} - MongoDB connection
   */
  async connect() {
    if (this.isConnected) {
      console.log('Using existing database connection');
      return;
    }

    try {
      // Check if connection URI is provided
      if (!config.mongoUri) {
        throw new Error('MongoDB connection URI is not provided in configuration');
      }

      console.log('Connecting to MongoDB...');
      const connection = await mongoose.connect(config.mongoUri, this.connectionOptions);
      
      this.isConnected = true;
      console.log('MongoDB connected successfully');

      // Handle connection events
      mongoose.connection.on('error', err => {
        console.error('MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      // Handle process termination
      process.on('SIGINT', this.gracefulShutdown.bind(this, 'SIGINT'));
      process.on('SIGTERM', this.gracefulShutdown.bind(this, 'SIGTERM'));
      process.on('SIGUSR2', this.gracefulShutdown.bind(this, 'SIGUSR2')); // For nodemon restarts

      return connection;
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown database connection
   * @param {string} signal - Signal that triggered shutdown
   */
  async gracefulShutdown(signal) {
    try {
      console.log(`Received ${signal}, closing MongoDB connection`);
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('MongoDB connection closed');
      process.exit(0);
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
      process.exit(1);
    }
  }

  /**
   * Get current connection status
   * @returns {boolean} - Whether connected to database
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('MongoDB disconnected');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const dbConnection = new DatabaseConnection();
module.exports = dbConnection;