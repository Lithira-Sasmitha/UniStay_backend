const mongoose = require('mongoose');

const roommatePreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    sleepSchedule: {
      type: String,
      enum: ['early_bird', 'night_owl', 'flexible'],
      required: true,
    },
    cleanliness: {
      type: String,
      enum: ['very_tidy', 'moderate', 'relaxed'],
      required: true,
    },
    noiseLevel: {
      type: String,
      enum: ['quiet', 'moderate', 'lively'],
      required: true,
    },
    studyHabits: {
      type: String,
      enum: ['in_room', 'library', 'mixed'],
      required: true,
    },
    socialLevel: {
      type: String,
      enum: ['introvert', 'ambivert', 'extrovert'],
      required: true,
    },
    smoking: {
      type: String,
      enum: ['no', 'occasionally', 'yes'],
      required: true,
    },
    drinking: {
      type: String,
      enum: ['no', 'occasionally', 'yes'],
      required: true,
    },
    guestPolicy: {
      type: String,
      enum: ['no_guests', 'occasional', 'open'],
      required: true,
    },
    budget: {
      type: String,
      enum: ['low', 'moderate', 'high'],
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RoommatePreference', roommatePreferenceSchema);
