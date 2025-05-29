const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Una lección debe tener un título'],
    trim: true,
    maxlength: [100, 'El título no puede tener más de 100 caracteres']
  },
  description: {
    type: String,
    required: [true, 'Una lección debe tener una descripción'],
    trim: true
  },
  videoUrl: {
    type: String,
    required: [true, 'Una lección debe tener un video asociado']
  },
  duration: {
    type: Number,
    required: [true, 'Una lección debe tener una duración']
  },
  order: {
    type: Number,
    required: [true, 'Una lección debe tener un orden']
  },
  resources: [{
    title: String,
    type: {
      type: String,
      enum: ['pdf', 'link', 'file'],
      required: true
    },
    url: String
  }]
}, {
  timestamps: true
});

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Un curso debe tener un título'],
    unique: true,
    trim: true,
    maxlength: [100, 'El título no puede tener más de 100 caracteres']
  },
  slug: {
    type: String,
    unique: true
  },
  description: {
    type: String,
    required: [true, 'Un curso debe tener una descripción'],
    trim: true
  },
  instructor: {
    name: {
      type: String,
      required: [true, 'Un curso debe tener un instructor']
    },
    bio: String,
    avatar: String
  },
  price: {
    type: Number,
    required: [true, 'Un curso debe tener un precio']
  },
  originalPrice: {
    type: Number
  },
  level: {
    type: String,
    required: [true, 'Un curso debe tener un nivel'],
    enum: {
      values: ['principiante', 'intermedio', 'avanzado'],
      message: 'El nivel debe ser: principiante, intermedio o avanzado'
    }
  },
  category: {
    type: String,
    required: [true, 'Un curso debe tener una categoría']
  },
  tags: [String],
  thumbnail: {
    type: String,
    required: [true, 'Un curso debe tener una imagen de portada']
  },
  lessons: [lessonSchema],
  duration: {
    type: Number,
    required: [true, 'Un curso debe tener una duración total']
  },
  language: {
    type: String,
    required: [true, 'Un curso debe tener un idioma'],
    default: 'es'
  },
  requirements: [String],
  objectives: [String],
  featured: {
    type: Boolean,
    default: false
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: [0, 'La calificación debe ser al menos 0'],
      max: [5, 'La calificación no puede ser mayor a 5'],
      set: val => Math.round(val * 10) / 10
    },
    count: {
      type: Number,
      default: 0
    }
  },
  enrollments: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: Date,
  certificates: {
    enabled: {
      type: Boolean,
      default: true
    },
    template: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
courseSchema.index({ slug: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ tags: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ 'rating.average': -1 });
courseSchema.index({ price: 1 });
courseSchema.index({ featured: 1 });

// Middleware para generar el slug antes de guardar
courseSchema.pre('save', function(next) {
  if (!this.isModified('title')) return next();
  
  this.slug = this.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  next();
});

// Virtual para calcular el progreso total del curso
courseSchema.virtual('totalProgress').get(function() {
  return this.lessons.length > 0 
    ? Math.round((this.completedLessons || 0) / this.lessons.length * 100)
    : 0;
});

// Virtual para calcular el descuento
courseSchema.virtual('discount').get(function() {
  if (!this.originalPrice || this.originalPrice <= this.price) return 0;
  return Math.round((1 - this.price / this.originalPrice) * 100);
});

// Método para actualizar la calificación promedio
courseSchema.methods.updateRating = async function(newRating) {
  const oldTotal = this.rating.average * this.rating.count;
  this.rating.count += 1;
  this.rating.average = (oldTotal + newRating) / this.rating.count;
  await this.save();
};

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
