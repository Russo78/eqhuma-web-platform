const express = require('express');
const router = express.Router();
const {
  bankQueryLimiter,
  taxValidationLimiter,
  addressValidationLimiter,
  exchangeRateLimiter,
  usageMonitor,
  dynamicBlocker
} = require('../middleware/rateLimiter');
const apimarketService = require('../services/apimarketService');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

// Middleware para validar API key
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    throw new ApiError('Se requiere API key', 401);
  }
  next();
};

// Aplicar middleware global
router.use(validateApiKey);
router.use(usageMonitor);
router.use(dynamicBlocker);

// Verificar cuenta bancaria
router.post('/bank-accounts/verify', bankQueryLimiter, async (req, res, next) => {
  try {
    const result = await apimarketService.verifyBankAccount(req.body);
    logger.logApiCall('bank-verification', 'POST', 'success', 'Cuenta bancaria verificada', {
      bankCode: req.body.bankCode
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Obtener información de banco
router.get('/banks/:bankCode', bankQueryLimiter, async (req, res, next) => {
  try {
    const { bankCode } = req.params;
    const result = await apimarketService.getBankInfo(bankCode);
    logger.logApiCall('bank-info', 'GET', 'success', 'Información de banco obtenida', {
      bankCode
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Validar información fiscal
router.post('/tax/validate', taxValidationLimiter, async (req, res, next) => {
  try {
    const startTime = Date.now();
    const result = await apimarketService.validateTaxInfo(req.body);
    logger.logPerformance('tax-validation', Date.now() - startTime, {
      rfc: req.body.rfc
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Consultar tipo de cambio
router.get('/exchange-rates', exchangeRateLimiter, async (req, res, next) => {
  try {
    const result = await apimarketService.getExchangeRate(req.query);
    logger.logApiCall('exchange-rate', 'GET', 'success', 'Tipo de cambio consultado', {
      from: req.query.fromCurrency,
      to: req.query.toCurrency
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Validar dirección
router.post('/addresses/validate', addressValidationLimiter, async (req, res, next) => {
  try {
    const result = await apimarketService.validateAddress(req.body);
    logger.logApiCall('address-validation', 'POST', 'success', 'Dirección validada', {
      postalCode: req.body.postalCode
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Consultar información de código postal
router.get('/postal-codes/:code', addressValidationLimiter, async (req, res, next) => {
  try {
    const { code } = req.params;
    const result = await apimarketService.getPostalCodeInfo(code);
    logger.logApiCall('postal-code-info', 'GET', 'success', 'Información de CP obtenida', {
      postalCode: code
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Validar número de teléfono
router.post('/phones/validate', async (req, res, next) => {
  try {
    const result = await apimarketService.validatePhone(req.body);
    logger.logApiCall('phone-validation', 'POST', 'success', 'Teléfono validado', {
      phoneNumber: req.body.phoneNumber?.substring(0, 6) + '****'
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Endpoint de métricas y uso
router.get('/metrics', async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const today = new Date().toISOString().split('T')[0];
    const key = `usage:${apiKey}:${today}`;
    
    const usage = await router.redisClient.hgetall(key);
    const metrics = {
      date: today,
      endpoints: usage || {},
      totalCalls: Object.values(usage || {}).reduce((sum, val) => sum + parseInt(val), 0)
    };
    
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
});

// Manejo de errores específicos de las rutas
router.use((err, req, res, next) => {
  logger.logApiCall(
    req.path.split('/')[1],
    req.method,
    'error',
    err.message,
    { errorCode: err.errorCode }
  );
  next(err);
});

module.exports = router;
