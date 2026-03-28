const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
    {
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
            unique: true,
        },
        property: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Property',
            required: true,
            index: true,
        },
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        reviewText: {
            type: String,
            required: true,
            trim: true,
            minlength: 20,
        },
    },
    {
        timestamps: true,
    }
);

reviewSchema.index({ student: 1, booking: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);