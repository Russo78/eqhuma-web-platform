// src/models/Webinar.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Webinar Schema
 * Represents a live or recorded educational session
 */
const WebinarSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Webinar title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [5000, 'Description cannot be more than 5000 characters']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  duration: {
    type: Number, // Duration in minutes
    required: [true, 'Duration is required'],
    min: [5, 'Duration must be at least 5 minutes']
  },
  timeZone: {
    type: String,
    default: 'America/Mexico_City'
  },
  capacity: {
    type: Number,
    default: 100,
    min: [1, 'Capacity must be at least 1']
  },
  registrationCount: {
    type: Number,
    default: 0
  },
  attendeeCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isRecorded: {
    type: Boolean,
    default: true
  },
  registrationDeadline: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value < this.startDate;
      },
      message: 'Registration deadline must be before start date'
    }
  },
  category: {
    type: String,
    enum: ['professional-development', 'human-resources', 'leadership', 'technology', 'health-safety', 'compliance', 'soft-skills', 'other'],
    default: 'professional-development'
  },
  tags: [{
    type: String,
    trim: true
  }],
  platform: {
    type: String,
    enum: ['zoom', 'google-meet', 'ms-teams', 'custom'],
    default: 'custom'
  },
  instructor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Instructor is required']
  },
  instructorName: {
    type: String,
    required: [true, 'Instructor name is required']
  },
  instructorBio: {
    type: String,
    maxlength: [1000, 'Instructor bio cannot be more than 1000 characters']
  },
  meetingId: {
    type: String
  },
  meetingPassword: {
    type: String
  },
  meetingUrl: {
    type: String
  },
  hostUrl: {
    type: String
  },
  registrationUrl: {
    type: String
  },
  coverImage: {
    type: String
  },
  materials: [{
    title: {
      type: String,
      required: [true, 'Material title is required']
    },
    description: {
      type: String
    },
    type: {
      type: String,
      enum: ['presentation', 'document', 'video', 'link', 'other'],
      default: 'document'
    },
    url: {
      type: String,
      required: [true, 'Material URL is required']
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  recordings: [{
    type: Schema.Types.ObjectId,
    ref: 'Recording'
  }],
  agenda: [{
    title: {
      type: String,
      required: [true, 'Agenda item title is required']
    },
    description: {
      type: String
    },
    startTime: {
      type: Date
    },
    duration: {
      type: Number // Duration in minutes
    }
  }],
  prerequisites: {
    type: String
  },
  learningObjectives: [{
    type: String
  }],
  targetAudience: {
    type: String
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    default: 'es' // Spanish as default
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'all-levels'],
    default: 'all-levels'
  },
  price: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    enum: ['MXN', 'USD', 'EUR'],
    default: 'MXN'
  },
  feedbackScore: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  feedbackCount: {
    type: Number,
    default: 0
  },
  certificationAvailable: {
    type: Boolean,
    default: false
  },
  customFields: {
    type: Map,
    of: String
  },
  // Registration questions are defined as an array of objects
  registrationQuestions: [{
    questionText: {
      type: String,
      required: [true, 'Question text is required']
    },
    questionType: {
      type: String,
      enum: ['text', 'textarea', 'select', 'radio', 'checkbox', 'date'],
      default: 'text'
    },
    options: [{
      type: String
    }],
    isRequired: {
      type: Boolean,
      default: false
    }
  }],
  organizationId: {
    type: String,
    required: [true, 'Organization ID is required']
  },
  organizationName: {
    type: String
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  // Polls that instructors can launch during the webinar
  polls: [{
    question: {
      type: String,
      required: [true, 'Poll question is required']
    },
    options: [{
      text: {
        type: String,
        required: [true, 'Option text is required']
      },
      count: {
        type: Number,
        default: 0
      }
    }],
    isActive: {
      type: Boolean,
      default: false
    },
    totalVotes: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for searching
WebinarSchema.index({
  title: 'text',
  description: 'text',
  instructorName: 'text'
});

// Other useful indices
WebinarSchema.index({ startDate: 1 });
WebinarSchema.index({ status: 1 });
WebinarSchema.index({ organizationId: 1 });
WebinarSchema.index({ category: 1 });
WebinarSchema.index({ instructor: 1 });

// Virtual for time until webinar starts
WebinarSchema.virtual('timeUntilStart').get(function() {
  return this.startDate > new Date() ? this.startDate - new Date() : 0;
});

// Virtual for registration status
WebinarSchema.virtual('registrationStatus').get(function() {
  if (this.status === 'cancelled') return 'closed';
  if (this.registrationCount >= this.capacity) return 'full';
  if (this.registrationDeadline && this.registrationDeadline < new Date()) return 'closed';
  if (this.startDate < new Date()) return 'closed';
  return 'open';
});

// Virtual for webinar duration in human-readable format
WebinarSchema.virtual('durationFormatted').get(function() {
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  
  if (hours > 0) {
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  }
  return `${minutes}m`;
});

// Ensure endDate is calculated if only duration is provided
WebinarSchema.pre('save', function(next) {
  if (this.startDate && this.duration && (!this.endDate || this.isModified('startDate') || this.isModified('duration'))) {
    this.endDate = new Date(this.startDate.getTime() + this.duration * 60000);
  }
  next();
});

// Auto-update status based on dates
WebinarSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.status === 'cancelled') {
    // Don't change cancelled status
    return next();
  }
  
  if (now < this.startDate) {
    this.status = 'scheduled';
  } else if (now >= this.startDate && now <= this.endDate) {
    this.status = 'live';
  } else if (now > this.endDate) {
    this.status = 'completed';
  }
  
  next();
});

module.exports = mongoose.model('Webinar', WebinarSchema);