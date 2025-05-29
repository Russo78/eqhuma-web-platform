require('dotenv').config();

module.exports = {
  // Configuración del servidor
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // MongoDB
  mongoUri: process.env.MONGO_URI || 'mongodb://mongodb:27017/eqhuma-payments',

  // STP Configuration
  stp: {
    apiUrl: process.env.STP_API_URL,
    apiKey: process.env.STP_API_KEY,
    accountId: process.env.STP_ACCOUNT_ID,
    privateKey: process.env.STP_PRIVATE_KEY,
    publicKey: process.env.STP_PUBLIC_KEY,
    sandbox: process.env.STP_SANDBOX === 'true'
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
};
