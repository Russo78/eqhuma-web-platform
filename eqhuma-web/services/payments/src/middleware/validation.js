const Joi = require('joi');

const paymentSchema = Joi.object({
  clientId: Joi.string().required(),
  clientName: Joi.string().required(),
  clientEmail: Joi.string().email().required(),
  amount: Joi.number().positive().required(),
  concept: Joi.string().required(),
  currency: Joi.string().default('MXN')
});

exports.validatePayment = async (req, res, next) => {
  try {
    await paymentSchema.validateAsync(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }
};
