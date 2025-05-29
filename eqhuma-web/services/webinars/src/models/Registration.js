// src/models/Registration.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Registration Schema
 * Represents a user registration for a webinar
 */
const RegistrationSchema = new Schema({
  webinar: {
    type: Schema.Types.ObjectId,
    ref: 'Webinar',
    required: [true, 'Webinar ID is required']
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  userId: {
    type: String,
    required: [true, 'User ID is required']
  },
  userName: {
    type: String,
    required: [true, 'User name is required']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  phoneNumber: {
    type: String
  },
  organizationId: {
    type: String,
    required: [true, 'Organization ID is required']
  },
  organizationName: {
    type: String
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['registered', 'confirmed', 'attended', 'cancelled', 'no-show'],
    default: 'registered'
  },
  attendanceTime: {
    type: Date
  },
  leaveTime: {
    type: Date
  },
  attendanceDuration: {
    type: Number // Duration in minutes
  },
  // Answers to registration questions
  registrationQuestions: [{
    questionId: {
      type: Schema.Types.ObjectId
    },
    questionText: {
      type: String
    },
    answer: {
      type: Schema.Types.Mixed
    }
  }],
  // Feedback submitted after webinar
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    instructorRating: {
      type: Number,
      min: 1,
      max: 5
    },
    contentRating: {
      type: Number,
      min: 1,
      max: 5
    },
    technicalRating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: {
      type: String
    },
    submittedAt: {
      type: Date
    },
    surveyResponses: [{
      questionId: {
        type: String
      },
      questionText: {
        type: String
      },
      answer: {
        type: Schema.Types.Mixed
      }
    }]
  },
  // Certificate information
  certificate: {
    generated: {
      type: Boolean,
      default: false
    },
    generatedAt: {
      type: Date
    },
    url: {
      type: String
    },
    downloadCount: {
      type: Number,
      default: 0
    },
    lastDownloaded: {
      type: Date
    }
  },
  // Tracking engagement during webinar
  interactions: {
    chatMessages: {
      type: Number,
      default: 0
    },
    questions: {
      type: Number,
      default: 0
    },
    pollsAnswered: {
      type: Number,
      default: 0
    },
    handRaises: {
      type: Number,
      default: 0
    },
    reactions: {
      type: Number,
      default: 0
    }
  },
  notes: {
    type: String
  },
  // Payment information if webinar is paid
  payment: {
    amount: {
      type: Number
    },
    currency: {
      type: String,
      enum: ['MXN', 'USD', 'EUR']
    },
    paymentMethod: {
      type: String
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded']
    },
    transactionId: {
      type: String
    },
    paymentDate: {
      type: Date
    }
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
RegistrationSchema.index({ webinar: 1, userId: 1 }, { unique: true });
RegistrationSchema.index({ userId: 1 });
RegistrationSchema.index({ email: 1 });
RegistrationSchema.index({ status: 1 });
RegistrationSchema.index({ organizationId: 1 });
RegistrationSchema.index({ registrationDate: 1 });

// Virtual for determining if eligible for certificate
RegistrationSchema.virtual('isCertificateEligible').get(function() {
  // Must have attended and participated for at least 70% of the time
  if (this.status !== 'attended' || !this.attendanceDuration) {
    return false;
  }

  // Get the webinar document (if populated)
  const webinar = this._webinarDuration || 0;
  
  if (webinar && webinar.duration) {
    return (this.attendanceDuration / webinar.duration) >= 0.7;
  }
  
  // If webinar isn't populated, can't determine eligibility
  return false;
});

// Virtual for participation score (0-100)
RegistrationSchema.virtual('participationScore').get(function() {
  if (!this.interactions) return 0;
  
  // Calculate score based on interactions
  const { chatMessages, questions, pollsAnswered, handRaises, reactions } = this.interactions;
  
  // Base score is 20 for attending
  let score = this.status === 'attended' ? 20 : 0;
  
  // Add points for each type of interaction
  if (chatMessages > 0) score += Math.min(chatMessages * 2, 20); // Max 20 points
  if (questions > 0) score += Math.min(questions * 5, 25); // Max 25 points
  if (pollsAnswered > 0) score += Math.min(pollsAnswered * 3, 15); // Max 15 points
  if (handRaises > 0) score += Math.min(handRaises, 10); // Max 10 points
  if (reactions > 0) score += Math.min(reactions, 10); // Max 10 points
  
  return Math.min(score, 100); // Cap at 100
});

// Static method to update registration count on webinar
RegistrationSchema.statics.updateWebinarRegistrationCount = async function(webinarId) {
  const Webinar = mongoose.model('Webinar');
  
  const count = await this.countDocuments({
    webinar: webinarId,
    status: { $ne: 'cancelled' }
  });
  
  await Webinar.findByIdAndUpdate(webinarId, {
    registrationCount: count
  });
  
  return count;
};

// Static method to update attendee count on webinar
RegistrationSchema.statics.updateWebinarAttendeeCount = async function(webinarId) {
  const Webinar = mongoose.model('Webinar');
  
  const count = await this.countDocuments({
    webinar: webinarId,
    status: 'attended'
  });
  
  await Webinar.findByIdAndUpdate(webinarId, {
    attendeeCount: count
  });
  
  return count;
};

module.exports = mongoose.model('Registration', RegistrationSchema);