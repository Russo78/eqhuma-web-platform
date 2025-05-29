const mongoose = require('mongoose');

const registrantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  attended: {
    type: Boolean,
    default: false
  },
  joinedAt: Date,
  leftAt: Date,
  questions: [{
    text: String,
    askedAt: {
      type: Date,
      default: Date.now
    },
    answered: {
      type: Boolean,
      default: false
    }
  }]
});

const webinarSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Un webinar debe tener un título'],
    trim: true,
    maxlength: [100, 'El título no puede tener más de 100 caracteres']
  },
  slug: {
    type: String,
    unique: true
  },
  description: {
    type: String,
    required: [true, 'Un webinar debe tener una descripción'],
    trim: true
  },
  presenter: {
    name: {
      type: String,
      required: [true, 'Un webinar debe tener un presentador']
    },
    bio: String,
    avatar: String,
    credentials: String
  },
  date: {
    type: Date,
    required: [true, 'Un webinar debe tener una fecha programada']
  },
  duration: {
    type: Number,
    required: [true, 'Un webinar debe tener una duración en minutos']
  },
  timezone: {
    type: String,
    required: [true, 'Un webinar debe tener una zona horaria'],
    default: 'America/Mexico_City'
  },
  category: {
    type: String,
    required: [true, 'Un webinar debe tener una categoría']
  },
  tags: [String],
  thumbnail: {
    type: String,
    required: [true, 'Un webinar debe tener una imagen de portada']
  },
  price: {
    type: Number,
    required: [true, 'Un webinar debe tener un precio'],
    default: 0
  },
  capacity: {
    type: Number,
    required: [true, 'Un webinar debe tener una capacidad máxima']
  },
  platform: {
    type: String,
    enum: ['zoom', 'meet', 'teams', 'custom'],
    required: [true, 'Un webinar debe especificar la plataforma']
  },
  meetingUrl: String,
  meetingId: String,
  meetingPassword: String,
  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  isRecorded: {
    type: Boolean,
    default: true
  },
  recordingUrl: String,
  materials: [{
    title: String,
    type: {
      type: String,
      enum: ['pdf', 'presentation', 'document', 'link'],
      required: true
    },
    url: String
  }],
  registrants: [registrantSchema],
  features: {
    qa: {
      type: Boolean,
      default: true
    },
    chat: {
      type: Boolean,
      default: true
    },
    polls: {
      type: Boolean,
      default: false
    },
    breakoutRooms: {
      type: Boolean,
      default: false
    }
  },
  polls: [{
    question: String,
    options: [String],
    responses: [{
      userId: mongoose.Schema.Types.ObjectId,
      answer: String,
      submittedAt: Date
    }]
  }],
  feedback: [{
    userId: mongoose.Schema.Types.ObjectId,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }],
  analytics: {
    registrationCount: {
      type: Number,
      default: 0
    },
    attendanceCount: {
      type: Number,
      default: 0
    },
    averageAttendanceTime: {
      type: Number,
      default: 0
    },
    questionCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
webinarSchema.index({ slug: 1 });
webinarSchema.index({ date: 1 });
webinarSchema.index({ category: 1 });
webinarSchema.index({ status: 1 });
webinarSchema.index({ 'registrants.email': 1 });

// Middleware para generar el slug antes de guardar
webinarSchema.pre('save', function(next) {
  if (!this.isModified('title')) return next();
  
  this.slug = this.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  next();
});

// Virtual para verificar si el webinar está lleno
webinarSchema.virtual('isFull').get(function() {
  return this.registrants.length >= this.capacity;
});

// Virtual para obtener el tiempo restante hasta el webinar
webinarSchema.virtual('timeUntilStart').get(function() {
  return this.date.getTime() - Date.now();
});

// Método para registrar un participante
webinarSchema.methods.registerParticipant = async function(userData) {
  if (this.isFull) {
    throw new Error('El webinar está lleno');
  }

  this.registrants.push(userData);
  this.analytics.registrationCount += 1;
  await this.save();
};

// Método para actualizar la asistencia
webinarSchema.methods.updateAttendance = async function(userId, joinTime) {
  const registrant = this.registrants.find(r => r.userId.equals(userId));
  if (registrant) {
    registrant.attended = true;
    registrant.joinedAt = joinTime;
    this.analytics.attendanceCount += 1;
    await this.save();
  }
};

const Webinar = mongoose.model('Webinar', webinarSchema);

module.exports = Webinar;
