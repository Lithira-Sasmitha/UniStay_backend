const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
    {
        property: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Property',
            required: true,
            index: true,
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        title: {
            type: String,
            required: [true, 'Notice title is required'],
            trim: true,
            maxlength: [150, 'Title cannot exceed 150 characters'],
        },
        content: {
            type: String,
            required: [true, 'Notice content is required'],
            trim: true,
        },
        // urgent = pinned at top + red highlight for students
        isUrgent: {
            type: Boolean,
            default: false,
        },
        // Optional: when the notice event / deadline occurs (shown on calendar)
        eventDate: {
            type: Date,
            default: null,
        },
        // Optional: notice stops showing after this date
        expiresAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Notice', noticeSchema);
