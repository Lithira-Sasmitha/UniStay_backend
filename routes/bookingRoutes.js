const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    requestBooking,
    getStudentBookings,
    createPaymentIntent,
    confirmPayment,
    cancelBooking,
    getOwnerBookings,
    approveBooking,
    rejectBooking,
} = require('../controllers/bookingController');

// ── Student Routes ───────────────────────────────────────────────────
router.post('/', protect, authorize(['student']), requestBooking);
router.get('/my-bookings', protect, authorize(['student']), getStudentBookings);
router.post('/:bookingId/payment-intent', protect, authorize(['student']), createPaymentIntent);
router.patch('/:bookingId/confirm-payment', protect, authorize(['student']), confirmPayment);
router.patch('/:bookingId/cancel', protect, authorize(['student']), cancelBooking);

// ── Owner Routes ─────────────────────────────────────────────────────
router.get('/owner-bookings', protect, authorize(['boardingowner']), getOwnerBookings);
router.patch('/:bookingId/approve', protect, authorize(['boardingowner']), approveBooking);
router.patch('/:bookingId/reject', protect, authorize(['boardingowner']), rejectBooking);

module.exports = router;
