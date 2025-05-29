const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');

// Proteger rutas - verificar token
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1) Obtener token del header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(
      'No estás autorizado para acceder a esta ruta. Por favor, inicia sesión.',
      401
    );
  }

  try {
    // 2) Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Agregar información del usuario al request
    req.usuario = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    throw new ApiError('Token inválido o expirado', 401);
  }
});

// Restringir acceso por roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.role)) {
      throw new ApiError(
        'No tienes permiso para realizar esta acción',
        403
      );
    }
    next();
  };
};

// Verificar propiedad del recurso
exports.checkOwnership = asyncHandler(async (req, res, next) => {
  // Si el usuario es admin, permitir acceso
  if (req.usuario.role === 'admin') {
    return next();
  }

  // Si el recurso pertenece al usuario, permitir acceso
  if (req.recurso && req.recurso.usuarioId === req.usuario.id) {
    return next();
  }

  throw new ApiError(
    'No tienes permiso para acceder a este recurso',
    403
  );
});

// Validar suscripción activa
exports.checkSubscription = asyncHandler(async (req, res, next) => {
  // Verificar si el usuario tiene una suscripción activa
  if (!req.usuario.subscription || !req.usuario.subscription.active) {
    throw new ApiError(
      'Necesitas una suscripción activa para acceder a este contenido',
      403
    );
  }

  next();
});

// Verificar límites de uso
exports.rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de 100 solicitudes por ventana por IP
};

// Validar permisos específicos
exports.hasPermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.usuario.permissions || !req.usuario.permissions.includes(permission)) {
      throw new ApiError(
        'No tienes el permiso necesario para realizar esta acción',
        403
      );
    }
    next();
  });
};

// Middleware para registrar actividad del usuario
exports.logActivity = asyncHandler(async (req, res, next) => {
  // Registrar la actividad del usuario si es necesario
  if (req.usuario) {
    // Aquí podrías implementar el registro de actividad
    // Por ejemplo, guardar en una colección de MongoDB
    console.log(`Usuario ${req.usuario.id} accedió a ${req.originalUrl}`);
  }
  next();
});

// Middleware para validar el estado de la cuenta
exports.checkAccountStatus = asyncHandler(async (req, res, next) => {
  if (req.usuario.status !== 'active') {
    throw new ApiError(
      'Tu cuenta no está activa. Por favor, contacta con soporte.',
      403
    );
  }
  next();
});

// Middleware para verificar límites de la cuenta
exports.checkAccountLimits = asyncHandler(async (req, res, next) => {
  // Aquí podrías implementar la lógica para verificar límites
  // Por ejemplo, número máximo de cursos creados, etc.
  next();
});

// Middleware para validar IP
exports.validateIP = asyncHandler(async (req, res, next) => {
  const clientIP = req.ip;
  // Aquí podrías implementar la lógica para validar IPs
  // Por ejemplo, lista negra de IPs, geolocalización, etc.
  next();
});
