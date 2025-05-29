const asyncHandler = require('express-async-handler');
const Course = require('../models/Course');
const ApiError = require('../utils/ApiError');
const { getPagination } = require('../utils/pagination');

// @desc    Obtener todos los cursos
// @route   GET /api/v1/courses
// @access  Public
exports.getCourses = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  
  // Construir query
  const query = { status: 'published' };
  
  // Filtros
  if (req.query.category) query.category = req.query.category;
  if (req.query.level) query.level = req.query.level;
  if (req.query.price) {
    const [min, max] = req.query.price.split('-');
    query.price = { $gte: min || 0, $lte: max || Infinity };
  }
  if (req.query.tags) {
    query.tags = { $in: req.query.tags.split(',') };
  }

  // Búsqueda
  if (req.query.search) {
    query.$or = [
      { title: { $regex: req.query.search, $options: 'i' } },
      { description: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  // Ordenamiento
  const sort = {};
  if (req.query.sort) {
    const [field, order] = req.query.sort.split(':');
    sort[field] = order === 'desc' ? -1 : 1;
  } else {
    sort.createdAt = -1;
  }

  const courses = await Course.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select('-lessons');

  const total = await Course.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: courses.length,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: courses
  });
});

// @desc    Obtener un curso por ID o slug
// @route   GET /api/v1/courses/:id
// @access  Public
exports.getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findOne({
    $or: [
      { _id: req.params.id },
      { slug: req.params.id }
    ]
  });

  if (!course) {
    throw new ApiError('Curso no encontrado', 404);
  }

  res.status(200).json({
    status: 'success',
    data: course
  });
});

// @desc    Crear un nuevo curso
// @route   POST /api/v1/courses
// @access  Private/Admin
exports.createCourse = asyncHandler(async (req, res) => {
  const course = await Course.create(req.body);

  res.status(201).json({
    status: 'success',
    data: course
  });
});

// @desc    Actualizar un curso
// @route   PUT /api/v1/courses/:id
// @access  Private/Admin
exports.updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!course) {
    throw new ApiError('Curso no encontrado', 404);
  }

  res.status(200).json({
    status: 'success',
    data: course
  });
});

// @desc    Eliminar un curso
// @route   DELETE /api/v1/courses/:id
// @access  Private/Admin
exports.deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndDelete(req.params.id);

  if (!course) {
    throw new ApiError('Curso no encontrado', 404);
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Obtener lecciones de un curso
// @route   GET /api/v1/courses/:id/lessons
// @access  Private
exports.getCourseLessons = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
    .select('lessons');

  if (!course) {
    throw new ApiError('Curso no encontrado', 404);
  }

  res.status(200).json({
    status: 'success',
    data: course.lessons
  });
});

// @desc    Agregar una lección a un curso
// @route   POST /api/v1/courses/:id/lessons
// @access  Private/Admin
exports.addLesson = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    throw new ApiError('Curso no encontrado', 404);
  }

  course.lessons.push(req.body);
  await course.save();

  res.status(201).json({
    status: 'success',
    data: course.lessons[course.lessons.length - 1]
  });
});

// @desc    Actualizar una lección
// @route   PUT /api/v1/courses/:id/lessons/:lessonId
// @access  Private/Admin
exports.updateLesson = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    throw new ApiError('Curso no encontrado', 404);
  }

  const lesson = course.lessons.id(req.params.lessonId);

  if (!lesson) {
    throw new ApiError('Lección no encontrada', 404);
  }

  Object.assign(lesson, req.body);
  await course.save();

  res.status(200).json({
    status: 'success',
    data: lesson
  });
});

// @desc    Eliminar una lección
// @route   DELETE /api/v1/courses/:id/lessons/:lessonId
// @access  Private/Admin
exports.deleteLesson = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    throw new ApiError('Curso no encontrado', 404);
  }

  course.lessons.id(req.params.lessonId).remove();
  await course.save();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Actualizar calificación de un curso
// @route   POST /api/v1/courses/:id/rating
// @access  Private
exports.rateCourse = asyncHandler(async (req, res) => {
  const { rating } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError('La calificación debe estar entre 1 y 5', 400);
  }

  const course = await Course.findById(req.params.id);

  if (!course) {
    throw new ApiError('Curso no encontrado', 404);
  }

  await course.updateRating(rating);

  res.status(200).json({
    status: 'success',
    data: {
      rating: course.rating
    }
  });
});
