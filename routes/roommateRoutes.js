const express = require('express');
const router = express.Router();
const { getRoommates } = require('../controllers/roommateController');
const { protect } = require('../middleware/authMiddleware');
const { checkStudentRole, checkVerifiedUser, checkBookingStatus } = require('../middleware/roommateMiddleware');

// @desc    Get potential roommates (Verified students with no active booking)
// @access  Private (Role: Student, isVerified=true, hasActiveBooking=false)
router.get('/', protect, checkStudentRole, checkVerifiedUser, checkBookingStatus, getRoommates);

module.exports = router;
