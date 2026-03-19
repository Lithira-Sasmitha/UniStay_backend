const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
    {
        property: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Property',
            required: true,
        },
        roomType: {
            type: String,
            required: [true, 'Please add a room type'],
            trim: true,
        },
        monthlyRent: {
            type: Number,
            required: [true, 'Please add the monthly rent'],
            min: [1, 'Monthly rent must be greater than 0'],
        },
        keyMoney: {
            type: Number,
            default: 0,
        },
        advanceAmount: {
            type: Number,
            required: [true, 'Please add the advance amount'],
        },
        advanceType: {
            type: String,
            enum: ['fixed', 'half-month'],
            default: 'fixed',
        },
        totalCapacity: {
            type: Number,
            required: [true, 'Please add the total capacity'],
            min: [1, 'Capacity must be greater than 0'],
        },
        facilities: [
            {
                type: String,
                trim: true,
            },
        ],
        currentOccupants: [
            {
                student: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                bookingDate: {
                    type: Date,
                    default: Date.now,
                },
                bookingId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Booking',
                },
            },
        ],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual: available slots
roomSchema.virtual('availableSlots').get(function () {
    // Safe check in case currentOccupants is not populated
    const occupants = this.currentOccupants || [];
    return this.totalCapacity - occupants.length;
});

module.exports = mongoose.model('Room', roomSchema);
