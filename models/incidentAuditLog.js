const mongoose = require('mongoose');

const incidentAuditLogSchema = new mongoose.Schema({
    incidentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Incident',
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    oldStatus: {
        type: String,
        required: true
    },
    newStatus: {
        type: String,
        required: true
    },
    changedAt: {
        type: Date,
        default: Date.now
    }
});

const IncidentAuditLog = mongoose.model('IncidentAuditLog', incidentAuditLogSchema);

module.exports = IncidentAuditLog;
