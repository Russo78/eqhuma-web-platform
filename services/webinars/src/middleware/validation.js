const Joi = require('joi');
const ApiError = require('../utils/ApiError');

const schemas = {
  create: Joi.object({
    title: Joi.string()
      .required()
      .min(5)
      .max(100)
      .trim()
      .messages({
        'string.empty': 'El título es requerido',
        'string.min': 'El título debe tener al menos 5 caracteres',
        'string.max': 'El título no puede tener más de 100 caracteres'
      }),

    description: Joi.string()
      .required()
      .min(20)
      .trim()
      .messages({
        'string.empty': 'La descripción es requerida',
        'string.min': 'La descripción debe tener al menos 20 caracteres'
      }),

    presenter: Joi.object({
      name: Joi.string().required(),
      bio: Joi.string(),
      avatar: Joi.string().uri(),
      credentials: Joi.string()
    }).required(),

    date: Joi.date()
      .greater('now')
      .required()
      .messages({
        'date.greater': 'La fecha debe ser posterior a la actual'
      }),

    duration: Joi.number()
      .required()
      .min(15)
      .max(240)
      .messages({
        'number.min': 'La duración mínima es de 15 minutos',
        'number.max': 'La duración máxima es de 4 horas'
      }),

    timezone: Joi.string()
      .required()
      .default('America/Mexico_City'),

    category: Joi.string()
      .required()
      .trim(),

    tags: Joi.array()
      .items(Joi.string().trim())
      .min(1)
      .max(5)
      .messages({
        'array.min': 'Debe incluir al menos 1 etiqueta',
        'array.max': 'No puede incluir más de 5 etiquetas'
      }),

    thumbnail: Joi.string()
      .uri()
      .required()
      .messages({
        'string.uri': 'La URL de la imagen no es válida'
      }),

    price: Joi.number()
      .min(0)
      .required()
      .messages({
        'number.min': 'El precio no puede ser negativo'
      }),

    capacity: Joi.number()
      .required()
      .min(1)
      .max(1000)
      .messages({
        'number.min': 'La capacidad mínima es de 1 participante',
        'number.max': 'La capacidad máxima es de 1000 participantes'
      }),

    platform: Joi.string()
      .required()
      .valid('zoom', 'meet', 'teams', 'custom'),

    features: Joi.object({
      qa: Joi.boolean().default(true),
      chat: Joi.boolean().default(true),
      polls: Joi.boolean().default(false),
      breakoutRooms: Joi.boolean().default(false)
    })
  }),

  update: Joi.object({
    title: Joi.string()
      .min(5)
      .max(100)
      .trim(),

    description: Joi.string()
      .min(20)
      .trim(),

    presenter: Joi.object({
      name: Joi.string(),
      bio: Joi.string(),
      avatar: Joi.string().uri(),
      credentials: Joi.string()
    }),

    date: Joi.date()
      .greater('now'),

    duration: Joi.number()
      .min(15)
      .max(240),

    category: Joi.string()
      .trim(),

    tags: Joi.array()
      .items(Joi.string().trim())
      .min(1)
      .max(5),

    thumbnail: Joi.string()
      .uri(),

    price: Joi.number()
      .min(0),

    capacity: Joi.number()
      .min(1)
      .max(1000),

    features: Joi.object({
      qa: Joi.boolean(),
      chat: Joi.boolean(),
      polls: Joi.boolean(),
      breakoutRooms: Joi.boolean()
    })
  }),

  feedback: Joi.object({
    rating: Joi.number()
      .required()
      .min(1)
      .max(5)
      .messages({
        'number.min': 'La calificación mínima es 1',
        'number.max': 'La calificación máxima es 5'
      }),

    comment: Joi.string()
      .min(10)
      .max(500)
      .trim()
      .messages({
        'string.min': 'El comentario debe tener al menos 10 caracteres',
        'string.max': 'El comentario no puede tener más de 500 caracteres'
      })
  }),

  poll: Joi.object({
    question: Joi.string()
      .required()
      .min(10)
      .max(200)
      .trim()
      .messages({
        'string.empty': 'La pregunta es requerida',
        'string.min': 'La pregunta debe tener al menos 10 caracteres',
        'string.max': 'La pregunta no puede tener más de 200 caracteres'
      }),

    options: Joi.array()
      .items(Joi.string().trim())
      .min(2)
      .max(6)
      .required()
      .messages({
        'array.min': 'Debe incluir al menos 2 opciones',
        'array.max': 'No puede incluir más de 6 opciones'
      })
  })
};

exports.validateWebinar = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new ApiError('Schema de validación no encontrado', 500));
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return next(new ApiError(errorMessage, 400));
    }

    // Reemplazar el body con los datos validados
    req.body = value;
    next();
  };
};

// Validación de parámetros de consulta
exports.validateQuery = (req, res, next) => {
  const schema = Joi.object({
    page: Joi.number().min(1),
    limit: Joi.number().min(1).max(100),
    sort: Joi.string(),
    category: Joi.string(),
    status: Joi.string().valid('scheduled', 'live', 'completed', 'cancelled'),
    search: Joi.string().min(3),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}(,\d{4}-\d{2}-\d{2})?$/)
  });

  const { error } = schema.validate(req.query, {
    allowUnknown: true
  });

  if (error) {
    return next(new ApiError(error.details[0].message, 400));
  }

  next();
};

// Validación de parámetros de ruta
exports.validateParams = (req, res, next) => {
  const schema = Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
  });

  const { error } = schema.validate(req.params);

  if (error) {
    return next(new ApiError('ID inválido', 400));
  }

  next();
};
