const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        required: true
    },
    category: {
        type: String,
        enum: ['Theft', 'Harassment', 'Infrastructure'],
        required: true
    },
    severity: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    photos: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['Open', 'Under Investigation', 'Resolved', 'Rejected'],
        default: 'Open'
    },
    adminNotes: {
        type: String
    }
}, { timestamps: true });

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = Incident;
