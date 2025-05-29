const express = require('express');
const router = express.Router();
const { verificationLimiter } = require('../middleware/rateLimiter');
const palencaService = require('../services/palencaService');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

// Middleware para validar archivos de imagen
const validateImages = (req, res, next) => {
  const { frontImage, backImage, selfieImage } = req.body;
  
  if (!frontImage || !backImage || !selfieImage) {
    throw new ApiError('Se requieren todas las imágenes', 400);
  }

  // Validar formato base64 de las imágenes
  const isBase64 = (str) => {
    try {
      return Buffer.from(str, 'base64').toString('base64') === str;
    } catch (err) {
      return false;
    }
  };

  if (!isBase64(frontImage) || !isBase64(backImage) || !isBase64(selfieImage)) {
    throw new ApiError('Las imágenes deben estar en formato base64', 400);
  }

  next();
};

// Verificar identidad con INE/IFE
router.post('/verify', verificationLimiter, validateImages, async (req, res, next) => {
  try {
    const result = await palencaService.verifyIdentity(req.body);
    logger.info(`Verificación de identidad completada: ${result.verification_id}`);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Verificar CURP
router.post('/verify/curp', verificationLimiter, async (req, res, next) => {
  try {
    const { curp } = req.body;
    
    if (!curp) {
      throw new ApiError('Se requiere el CURP', 400);
    }

    const result = await palencaService.verifyCURP(curp);
    logger.info(`Verificación de CURP completada: ${curp}`);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Verificar RFC
router.post('/verify/rfc', verificationLimiter, async (req, res, next) => {
  try {
    const { rfc } = req.body;
    
    if (!rfc) {
      throw new ApiError('Se requiere el RFC', 400);
    }

    const result = await palencaService.verifyRFC(rfc);
    logger.info(`Verificación de RFC completada: ${rfc}`);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Verificar comprobante de domicilio
router.post('/verify/address', verificationLimiter, async (req, res, next) => {
  try {
    const result = await palencaService.verifyAddressProof(req.body);
    logger.info(`Verificación de comprobante completada: ${result.verification_id}`);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Obtener estado de una verificación
router.get('/verifications/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await palencaService.getVerificationStatus(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Obtener historial de verificaciones
router.get('/verifications', async (req, res, next) => {
  try {
    const result = await palencaService.getVerificationHistory(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
