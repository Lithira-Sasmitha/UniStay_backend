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
      enum: ['Open', 'Under Investigation', 'Resolved', 'Rejected'],
      default: 'Open',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    photos: [{
      type: String
    }],
    ownerResponse: {
      type: String,
      default: '',
    },
    safetyActions: {
      investigated: { type: Boolean, default: false },
      fixedIssue: { type: Boolean, default: false },
      installedSecurity: { type: Boolean, default: false },
      monitoring: { type: Boolean, default: false },
    },
    safetyScore: {
      type: Number,
      default: 0,
    },
    ownerRespondedAt: {
      type: Date,
    },
    auditLog: [{
      action: { type: String, required: true },
      performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: { type: String },
      timestamp: { type: Date, default: Date.now },
      details: { type: String }
    }],
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