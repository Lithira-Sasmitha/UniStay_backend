const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Property = require('../models/Property');
const Review = require('../models/Review');
const stripe = require('../config/stripe');
const { sendBookingEmail } = require('../config/emailService');

const REVIEW_ELIGIBLE_STATUSES = ['approved', 'confirmed', 'completed'];

// ──────────────────────────────────────────────────────────────────────
// STUDENT ENDPOINTS
// ──────────────────────────────────────────────────────────────────────

/**
 * @desc    Request a booking (student)
 * @route   POST /api/bookings
 * @access  Private/Student
 */
const requestBooking = async (req, res) => {
    try {
        const { roomId } = req.body;

        const room = await Room.findById(roomId).populate('property');
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

        // Check availability
        if (room.currentOccupants.length >= room.totalCapacity) {
            return res.status(400).json({ success: false, message: 'Room is fully occupied' });
        }

        const property = room.property;
        if (!property.isActive || property.verificationStatus !== 'verified') {
            return res.status(400).json({ success: false, message: 'Property is not available for booking' });
        }

        // Check for existing pending/approved/confirmed booking by this student for this room
        const existingBooking = await Booking.findOne({
            student: req.user._id,
            room: roomId,
            status: { $in: ['pending', 'approved', 'confirmed'] },
        });
        if (existingBooking) {
            return res.status(400).json({ success: false, message: 'You already have an active booking for this room' });
        }

        const booking = await Booking.create({
            student: req.user._id,
            room: roomId,
            property: property._id,
            status: 'pending',
        });

        // Email the property owner
        const ownerProperty = await Property.findById(property._id).populate('owner', 'email name');
        if (ownerProperty?.owner?.email) {
            await sendBookingEmail(
                ownerProperty.owner.email,
                '📬 New Booking Request – UniStay',
                `<p>Hello <strong>${ownerProperty.owner.name}</strong>,</p>
                 <p>You have a new booking request for <strong>${ownerProperty.name}</strong>.</p>
                 <p>Student: <strong>${req.user.name}</strong> (${req.user.email})</p>
                 <p>Please log in to your dashboard to approve or reject.</p>`
            );
        }

        // Email the student
        await sendBookingEmail(
            req.user.email,
            '✅ Booking Request Sent – UniStay',
            `<p>Hello <strong>${req.user.name}</strong>,</p>
             <p>Your booking request for <strong>${ownerProperty?.name}</strong> has been sent.</p>
             <p>You will be notified once the owner reviews your request.</p>`
        );

        res.status(201).json({ success: true, message: 'Booking requested successfully', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get student's own bookings
 * @route   GET /api/bookings/my-bookings
 * @access  Private/Student
 */
const getStudentBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ student: req.user._id })
            .populate('room', 'roomType monthlyRent advanceAmount advanceType totalCapacity')
            .populate('property', 'name address photos trustBadge owner')
            .sort('-createdAt');

        const bookingIds = bookings.map((b) => b._id);
        const reviews = await Review.find({ booking: { $in: bookingIds } })
            .select('booking rating reviewText createdAt');

        const reviewMap = new Map(
            reviews.map((r) => [r.booking.toString(), r.toObject()])
        );

        const enrichedBookings = bookings.map((booking) => {
            const bookingObj = booking.toObject();
            const review = reviewMap.get(booking._id.toString()) || null;
            const hasReviewed = Boolean(review);
            const canReview = REVIEW_ELIGIBLE_STATUSES.includes(booking.status) && !hasReviewed;

            return {
                ...bookingObj,
                review,
                hasReviewed,
                canReview,
            };
        });

        res.json({ success: true, bookings: enrichedBookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Submit a review for a booking
 * @route   POST /api/bookings/:bookingId/review
 * @access  Private/Student
 */
const createBookingReview = async (req, res) => {
    try {
        const { rating, reviewText } = req.body;
        const numericRating = Number(rating);
        const cleanedText = typeof reviewText === 'string' ? reviewText.trim() : '';

        if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
        }
        if (cleanedText.length < 20) {
            return res.status(400).json({ success: false, message: 'Review text must be at least 20 characters' });
        }

        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        if ((booking.student._id || booking.student).toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (!REVIEW_ELIGIBLE_STATUSES.includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: 'Reviews are allowed only for approved/completed bookings',
            });
        }

        const existingReview = await Review.findOne({ booking: booking._id });
        if (existingReview) {
            return res.status(400).json({ success: false, message: 'You already submitted a review for this booking' });
        }

        const review = await Review.create({
            booking: booking._id,
            property: booking.property,
            student: req.user._id,
            rating: numericRating,
            reviewText: cleanedText,
        });

        const populatedReview = await Review.findById(review._id)
            .populate('student', 'name');

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            review: populatedReview,
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(400).json({ success: false, message: 'You already submitted a review for this booking' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Create Stripe PaymentIntent for advance payment
 * @route   POST /api/bookings/:bookingId/payment-intent
 * @access  Private/Student
 */
const createPaymentIntent = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
            .populate('room')
            .populate('student');

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if (booking.student._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        if (booking.status !== 'approved') {
            return res.status(400).json({ success: false, message: 'Booking must be approved before payment' });
        }
        if (booking.advancePaid) {
            return res.status(400).json({ success: false, message: 'Advance already paid' });
        }

        const room = booking.room;
        let amountInCents;
        if (room.advanceType === 'half-month') {
            amountInCents = Math.round((room.monthlyRent / 2) * 100);
        } else {
            amountInCents = Math.round(room.advanceAmount * 100);
        }

        // Create Stripe PaymentIntent in LKR (minimum charge: LKR 100)
        if (!stripe) {
            return res.status(503).json({ success: false, message: 'Payment service not configured. Please add STRIPE_SECRET_KEY to .env' });
        }
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'lkr',
            metadata: { bookingId: booking._id.toString() },
        });

        booking.stripePaymentIntentId = paymentIntent.id;
        await booking.save();

        res.json({ success: true, clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Confirm payment and finalize booking
 * @route   PATCH /api/bookings/:bookingId/confirm-payment
 * @access  Private/Student
 */
const confirmPayment = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
            .populate('room')
            .populate({ path: 'property', populate: { path: 'owner', select: 'email name' } });

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if ((booking.student._id || booking.student).toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        if (booking.status !== 'approved') {
            return res.status(400).json({ success: false, message: 'Booking is not in approved state' });
        }

        // Update booking
        booking.status = 'confirmed';
        booking.advancePaid = true;
        await booking.save();

        // Add student to room occupants
        const room = await Room.findById(booking.room._id);
        room.currentOccupants.push({
            student: req.user._id,
            bookingDate: new Date(),
            bookingId: booking._id,
        });

        // Auto-hide property if all rooms are full
        const allRooms = await Room.find({ property: booking.property._id });
        const allFull = allRooms.every(r => {
            if (r._id.toString() === room._id.toString()) {
                return room.currentOccupants.length >= room.totalCapacity;
            }
            return r.currentOccupants.length >= r.totalCapacity;
        });

        await room.save();

        if (allFull) {
            await Property.findByIdAndUpdate(booking.property._id, { isActive: false });
        }

        // Send confirmation emails
        const property = booking.property;
        if (property?.owner?.email) {
            await sendBookingEmail(
                property.owner.email,
                '💰 Advance Payment Received – UniStay',
                `<p>Hello <strong>${property.owner.name}</strong>,</p>
                 <p>The advance payment for <strong>${property.name}</strong> has been received from <strong>${req.user.name}</strong>.</p>
                 <p>The booking is now confirmed.</p>`
            );
        }

        await sendBookingEmail(
            req.user.email,
            '🎉 Booking Confirmed – UniStay',
            `<p>Hello <strong>${req.user.name}</strong>,</p>
             <p>Your booking for <strong>${property?.name}</strong> is confirmed!</p>
             <p>Welcome to your new home. 🏠</p>`
        );

        res.json({ success: true, message: 'Booking confirmed and payment recorded', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Cancel own booking
 * @route   PATCH /api/bookings/:bookingId/cancel
 * @access  Private/Student
 */
const cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if ((booking.student._id || booking.student).toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        if (!['pending', 'approved', 'confirmed'].includes(booking.status)) {
            return res.status(400).json({ success: false, message: 'Booking cannot be cancelled' });
        }

        const wasConfirmed = booking.status === 'confirmed';
        booking.status = 'cancelled';
        await booking.save();

        // If confirmed – remove from occupants and restore capacity/visibility
        if (wasConfirmed) {
            const room = await Room.findById(booking.room);
            room.currentOccupants = room.currentOccupants.filter(
                o => o.bookingId.toString() !== booking._id.toString()
            );
            await room.save();

            // Auto-show property if it was hidden due to full capacity
            await Property.findByIdAndUpdate(booking.property, { isActive: true });
        }

        res.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────────────
// OWNER ENDPOINTS
// ──────────────────────────────────────────────────────────────────────

/**
 * @desc    Get all booking requests for owner's properties
 * @route   GET /api/bookings/owner-bookings
 * @access  Private/Owner
 */
const getOwnerBookings = async (req, res) => {
    try {
        // Get owner's properties
        const properties = await Property.find({ owner: req.user._id }).select('_id');
        const propertyIds = properties.map(p => p._id);

        const bookings = await Booking.find({ property: { $in: propertyIds } })
            .populate('student', 'name email phonenumber university address age nic')
            .populate('room', 'roomType monthlyRent totalCapacity currentOccupants')
            .populate('property', 'name address')
            .sort('-createdAt');

        res.json({ success: true, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Approve booking request
 * @route   PATCH /api/bookings/:bookingId/approve
 * @access  Private/Owner
 */
const approveBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
            .populate('room')
            .populate('student', 'email name')
            .populate({ path: 'property', populate: { path: 'owner' } });

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if (booking.property.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        if (booking.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Booking is not pending' });
        }

        // Check capacity still available
        const room = await Room.findById(booking.room._id);
        if (room.currentOccupants.length >= room.totalCapacity) {
            return res.status(400).json({ success: false, message: 'Room is now full — cannot approve' });
        }

        booking.status = 'approved';
        await booking.save();

        // Email student
        await sendBookingEmail(
            booking.student.email,
            '✅ Booking Approved – UniStay',
            `<p>Hello <strong>${booking.student.name}</strong>,</p>
             <p>Your booking request for <strong>${booking.property.name}</strong> has been <strong>approved</strong>!</p>
             <p>Please log in and complete your advance payment to confirm your spot.</p>`
        );

        res.json({ success: true, message: 'Booking approved', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Reject booking request
 * @route   PATCH /api/bookings/:bookingId/reject
 * @access  Private/Owner
 */
const rejectBooking = async (req, res) => {
    try {
        const { rejectionReason } = req.body;

        if (!rejectionReason || rejectionReason.length < 10) {
            return res.status(400).json({ success: false, message: 'Rejection reason must be at least 10 characters' });
        }

        const booking = await Booking.findById(req.params.bookingId)
            .populate('student', 'email name')
            .populate({ path: 'property', populate: { path: 'owner' } });

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if (booking.property.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        if (booking.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Booking is not pending' });
        }

        booking.status = 'rejected';
        booking.rejectionReason = rejectionReason;
        await booking.save();

        // Email student
        await sendBookingEmail(
            booking.student.email,
            '❌ Booking Rejected – UniStay',
            `<p>Hello <strong>${booking.student.name}</strong>,</p>
             <p>Your booking request for <strong>${booking.property.name}</strong> was <strong>rejected</strong>.</p>
             <p><strong>Reason:</strong> ${rejectionReason}</p>
             <p>Feel free to browse other available listings.</p>`
        );

        res.json({ success: true, message: 'Booking rejected', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    requestBooking,
    getStudentBookings,
    createBookingReview,
    createPaymentIntent,
    confirmPayment,
    cancelBooking,
    getOwnerBookings,
    approveBooking,
    rejectBooking,
};
