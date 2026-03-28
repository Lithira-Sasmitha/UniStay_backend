const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['Theft', 'Harassment', 'Infrastructure', 'Other'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'rejected'],
      default: 'open',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    photoUrl: {
      type: String,
      default: '',
    },
    ownerResponse: {
      type: String,
      default: '',
    },
    ownerRespondedAt: {
      type: Date,
    },
    investigationStartedAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Incident', incidentSchema);