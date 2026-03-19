const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: true,
        },
        property: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Property',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'confirmed', 'cancelled'],
            default: 'pending',
        },
        rejectionReason: {
            type: String,
            validate: {
                validator: function (v) {
                    // Only required when status is 'rejected'
                    if (this.status === 'rejected') {
                        return v && v.length >= 10;
                    }
                    return true;
                },
                message: 'Rejection reason must be at least 10 characters',
            },
        },
        stripePaymentIntentId: {
            type: String,
            default: '',
        },
        advancePaid: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Booking', bookingSchema);
