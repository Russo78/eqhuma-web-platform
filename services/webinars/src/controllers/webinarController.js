const asyncHandler = require('express-async-handler');
const Webinar = require('../models/Webinar');
const ApiError = require('../utils/ApiError');
const { getPagination } = require('../utils/pagination');
const { sendWebinarEmail } = require('../utils/email');
const { createMeeting, updateMeeting, deleteMeeting } = require('../services/meetingService');

// @desc    Obtener todos los webinars
// @route   GET /api/v1/webinars
// @access  Public
exports.getWebinars = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  
  // Construir query
  const query = {};
  
  // Filtros
  if (req.query.category) query.category = req.query.category;
  if (req.query.status) query.status = req.query.status;
  if (req.query.date) {
    const [start, end] = req.query.date.split(',');
    query.date = {
      $gte: new Date(start),
      $lte: end ? new Date(end) : new Date(start).setHours(23, 59, 59)
    };
  }

  // Búsqueda
  if (req.query.search) {
    query.$or = [
      { title: { $regex: req.query.search, $options: 'i' } },
      { description: { $regex: req.query.search, $options: 'i' } },
      { 'presenter.name': { $regex: req.query.search, $options: 'i' } }
    ];
  }

  // Ordenamiento
  const sort = {};
  if (req.query.sort) {
    const [field, order] = req.query.sort.split(':');
    sort[field] = order === 'desc' ? -1 : 1;
  } else {
    sort.date = 1; // Por defecto ordenar por fecha ascendente
  }

  const webinars = await Webinar.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select('-registrants -polls -feedback');

  const total = await Webinar.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: webinars.length,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: webinars
  });
});

// @desc    Obtener un webinar por ID o slug
// @route   GET /api/v1/webinars/:id
// @access  Public
exports.getWebinar = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findOne({
    $or: [
      { _id: req.params.id },
      { slug: req.params.id }
    ]
  });

  if (!webinar) {
    throw new ApiError('Webinar no encontrado', 404);
  }

  res.status(200).json({
    status: 'success',
    data: webinar
  });
});

// @desc    Crear un nuevo webinar
// @route   POST /api/v1/webinars
// @access  Private/Admin
exports.createWebinar = asyncHandler(async (req, res) => {
  // Crear reunión en la plataforma seleccionada
  const meetingDetails = await createMeeting({
    topic: req.body.title,
    start_time: req.body.date,
    duration: req.body.duration,
    platform: req.body.platform
  });

  // Agregar detalles de la reunión al webinar
  const webinarData = {
    ...req.body,
    meetingUrl: meetingDetails.join_url,
    meetingId: meetingDetails.id,
    meetingPassword: meetingDetails.password
  };

  const webinar = await Webinar.create(webinarData);

  res.status(201).json({
    status: 'success',
    data: webinar
  });
});

// @desc    Actualizar un webinar
// @route   PUT /api/v1/webinars/:id
// @access  Private/Admin
exports.updateWebinar = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id);

  if (!webinar) {
    throw new ApiError('Webinar no encontrado', 404);
  }

  // Actualizar reunión en la plataforma si cambió la fecha o duración
  if (req.body.date || req.body.duration) {
    await updateMeeting(webinar.meetingId, {
      topic: req.body.title || webinar.title,
      start_time: req.body.date || webinar.date,
      duration: req.body.duration || webinar.duration
    });
  }

  const updatedWebinar = await Webinar.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    status: 'success',
    data: updatedWebinar
  });
});

// @desc    Eliminar un webinar
// @route   DELETE /api/v1/webinars/:id
// @access  Private/Admin
exports.deleteWebinar = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id);

  if (!webinar) {
    throw new ApiError('Webinar no encontrado', 404);
  }

  // Eliminar reunión en la plataforma
  await deleteMeeting(webinar.meetingId);

  await webinar.remove();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Registrar participante en webinar
// @route   POST /api/v1/webinars/:id/register
// @access  Private
exports.registerForWebinar = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id);

  if (!webinar) {
    throw new ApiError('Webinar no encontrado', 404);
  }

  if (webinar.isFull) {
    throw new ApiError('El webinar está lleno', 400);
  }

  // Verificar si el usuario ya está registrado
  const isRegistered = webinar.registrants.some(
    r => r.userId.toString() === req.user.id
  );

  if (isRegistered) {
    throw new ApiError('Ya estás registrado en este webinar', 400);
  }

  await webinar.registerParticipant({
    userId: req.user.id,
    name: req.user.name,
    email: req.user.email
  });

  // Enviar email de confirmación
  await sendWebinarEmail({
    to: req.user.email,
    webinar,
    type: 'registration'
  });

  res.status(200).json({
    status: 'success',
    message: 'Registro exitoso'
  });
});

// @desc    Actualizar asistencia a webinar
// @route   POST /api/v1/webinars/:id/attendance
// @access  Private
exports.updateAttendance = asyncHandler(async (req, res) => {
  const { userId, joinTime, leftTime } = req.body;

  const webinar = await Webinar.findById(req.params.id);

  if (!webinar) {
    throw new ApiError('Webinar no encontrado', 404);
  }

  await webinar.updateAttendance(userId, joinTime, leftTime);

  res.status(200).json({
    status: 'success',
    message: 'Asistencia actualizada'
  });
});

// @desc    Enviar pregunta en webinar
// @route   POST /api/v1/webinars/:id/questions
// @access  Private
exports.submitQuestion = asyncHandler(async (req, res) => {
  const { question } = req.body;

  const webinar = await Webinar.findById(req.params.id);

  if (!webinar) {
    throw new ApiError('Webinar no encontrado', 404);
  }

  const registrant = webinar.registrants.find(
    r => r.userId.toString() === req.user.id
  );

  if (!registrant) {
    throw new ApiError('No estás registrado en este webinar', 400);
  }

  registrant.questions.push({
    text: question,
    askedAt: new Date()
  });

  webinar.analytics.questionCount += 1;
  await webinar.save();

  res.status(200).json({
    status: 'success',
    message: 'Pregunta enviada'
  });
});

// @desc    Enviar feedback del webinar
// @route   POST /api/v1/webinars/:id/feedback
// @access  Private
exports.submitFeedback = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  const webinar = await Webinar.findById(req.params.id);

  if (!webinar) {
    throw new ApiError('Webinar no encontrado', 404);
  }

  const registrant = webinar.registrants.find(
    r => r.userId.toString() === req.user.id
  );

  if (!registrant || !registrant.attended) {
    throw new ApiError('No asististe a este webinar', 400);
  }

  webinar.feedback.push({
    userId: req.user.id,
    rating,
    comment
  });

  await webinar.save();

  res.status(200).json({
    status: 'success',
    message: 'Feedback enviado'
  });
});
