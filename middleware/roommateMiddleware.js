const Booking = require('../models/Booking');

/**
 * @desc    Check if user role is student
 */
const checkStudentRole = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Access denied. Only students can use this feature.' });
  }
  next();
};

/**
 * @desc    Check if user is a verified student
 */
const checkVerifiedUser = (req, res, next) => {
  if (!req.user || !req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You must verify your email to use this feature.'
    });
  }
  next();
};

/**
 * @desc    Check if student has an active booking.
 *          An active booking is defined as status 'pending', 'approved', or 'confirmed'.
 */
const checkBookingStatus = async (req, res, next) => {
  try {
    const activeBooking = await Booking.findOne({
      student: req.user._id,
      status: { $in: ['pending', 'approved', 'confirmed'] }
    });

    if (activeBooking) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You already have an active or pending boarding booking.'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while checking booking status' });
  }
};

module.exports = { checkStudentRole, checkVerifiedUser, checkBookingStatus };
