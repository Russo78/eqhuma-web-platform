// src/models/Recording.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Recording Schema
 * Represents a recorded webinar session that can be viewed later
 */
const RecordingSchema = new Schema({
  webinar: {
    type: Schema.Types.ObjectId,
    ref: 'Webinar',
    required: [true, 'Webinar ID is required']
  },
  title: {
    type: String,
    required: [true, 'Recording title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  fileUrl: {
    type: String,
    required: [true, 'File URL is required']
  },
  fileType: {
    type: String,
    enum: ['mp4', 'webm', 'other'],
    default: 'mp4'
  },
  fileSize: {
    type: Number, // Size in bytes
    required: [true, 'File size is required']
  },
  duration: {
    type: Number, // Duration in seconds
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 second']
  },
  thumbnailUrl: {
    type: String
  },
  quality: {
    type: String,
    enum: ['low', 'medium', 'high', 'hd'],
    default: 'high'
  },
  resolution: {
    width: {
      type: Number
    },
    height: {
      type: Number
    }
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isProcessed: {
    type: Boolean,
    default: false
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingError: {
    type: String
  },
  recordingDate: {
    type: Date,
    required: [true, 'Recording date is required']
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date
  },
  storageLocation: {
    type: String,
    enum: ['local', 's3', 'azure', 'gcs', 'zoom-cloud'],
    default: 'local'
  },
  storageDetails: {
    bucket: {
      type: String
    },
    path: {
      type: String
    },
    region: {
      type: String
    }
  },
  playerType: {
    type: String,
    enum: ['html5', 'zoom', 'vimeo', 'youtube', 'custom'],
    default: 'html5'
  },
  transcriptionUrl: {
    type: String
  },
  transcriptionStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'not-requested'],
    default: 'not-requested'
  },
  chaptersTimestamps: [{
    title: {
      type: String,
      required: true
    },
    timestamp: {
      type: Number, // Seconds from start
      required: true
    },
    description: {
      type: String
    }
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  uniqueViewers: {
    type: Number,
    default: 0
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  viewHistory: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    userId: {
      type: String
    },
    userName: {
      type: String
    },
    viewDate: {
      type: Date,
      default: Date.now
    },
    watchDuration: {
      type: Number // Seconds watched
    },
    watchPercentage: {
      type: Number // Percentage of total duration watched
    },
    completedView: {
      type: Boolean,
      default: false
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown'
    }
  }],
  feedback: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    userId: {
      type: String
    },
    userName: {
      type: String
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    comment: {
      type: String
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  organizationId: {
    type: String,
    required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // For tracking origin if this is an edited/processed version
  parentRecording: {
    type: Schema.Types.ObjectId,
    ref: 'Recording'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted duration
RecordingSchema.virtual('durationFormatted').get(function() {
  const seconds = this.duration;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
});

// Virtual for formatted file size
RecordingSchema.virtual('fileSizeFormatted').get(function() {
  const bytes = this.fileSize;
  if (bytes < 1024) return `${bytes} bytes`;
  else if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB`;
  else if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  else return `${(bytes / 1073741824).toFixed(2)} GB`;
});

// Index for querying
RecordingSchema.index({ webinar: 1 });
RecordingSchema.index({ organizationId: 1 });
RecordingSchema.index({ isPublic: 1 });
RecordingSchema.index({ recordingDate: 1 });
RecordingSchema.index({ viewCount: 1 });
RecordingSchema.index({ averageRating: 1 });

// Text index for searching
RecordingSchema.index({
  title: 'text',
  description: 'text'
});

// Calculate average rating when feedback is updated
RecordingSchema.pre('save', function(next) {
  if (this.feedback && this.feedback.length > 0) {
    const totalRating = this.feedback.reduce((sum, item) => sum + item.rating, 0);
    this.averageRating = Math.round((totalRating / this.feedback.length) * 10) / 10;
    this.ratingCount = this.feedback.length;
  }
  next();
});

// Update view count when view history is updated
RecordingSchema.pre('save', function(next) {
  if (this.isModified('viewHistory')) {
    // Count unique viewers
    const uniqueUserIds = new Set(this.viewHistory.map(view => view.userId));
    this.uniqueViewers = uniqueUserIds.size;
    this.viewCount = this.viewHistory.length;
  }
  next();
});

module.exports = mongoose.model('Recording', RecordingSchema);