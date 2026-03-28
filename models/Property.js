const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a property name'],
            trim: true,
        },
        address: {
            type: String,
            required: [true, 'Please add an address'],
            minlength: [10, 'Address must be at least 10 characters'],
        },
        description: {
            type: String,
            required: [true, 'Please add a description'],
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        photos: [
            {
                url: { type: String, required: true },
                publicId: { type: String, required: true },
            },
        ],
        verificationDocs: {
            nicPhoto: {
                url: { type: String, default: '' },
                publicId: { type: String, default: '' },
            },
            utilityBill: {
                url: { type: String, default: '' },
                publicId: { type: String, default: '' },
            },
            policeReport: {
                url: { type: String, default: '' },
                publicId: { type: String, default: '' },
            },
        },
        verificationStatus: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'pending',
        },
        rejectionReason: {
            type: String,
            default: '',
        },
        trustBadge: {
            type: String,
            enum: ['gold', 'silver', 'bronze', 'unverified'],
            default: 'unverified',
        },
        badgeMessage: {
            type: String,
            default: '',
        },
        riskTrend: {
            type: String,
            enum: ['Low Risk', 'Stable Risk', 'Increasing'],
            default: 'Low Risk',
        },
        riskPattern: {
            type: String,
            default: '',
        },
        lastRiskEvaluation: {
            type: Date,
            default: Date.now,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for search queries
propertySchema.index({ name: 'text', address: 'text', description: 'text' });

module.exports = mongoose.model('Property', propertySchema);
