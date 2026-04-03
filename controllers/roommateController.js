const User = require('../models/User');
const Booking = require('../models/Booking');

/**
 * @desc    Get potential roommates (Verified students with NO active bookings)
 * @route   GET /api/roommates
 * @access  Private (Middlewares: checkStudentRole, checkVerifiedUser, checkBookingStatus)
 */
exports.getRoommates = async (req, res) => {
  try {
    const { faculty, year, semester, hometown } = req.query;

    // 1. Find all student IDs that have an ACTIVE booking
    // Status can be 'pending', 'approved', or 'confirmed'
    const studentsWithBookings = await Booking.find({
      status: { $in: ['pending', 'approved', 'confirmed'] }
    }).distinct('student');

    // 2. Build Query
    const query = {
      _id: { $ne: req.user._id, $nin: studentsWithBookings },
      role: 'student',
      isVerified: true
    };

    // 3. Apply Filters
    if (faculty) query.faculty = faculty;
    if (year) query.year = year;
    if (semester) query.semester = semester;
    if (hometown) query.hometown = { $regex: hometown, $options: 'i' };

    // 4. Find potential roommates
    const roommates = await User.find(query)
      .select('name username email phonenumber university faculty year semester hometown address age nic isVerified profileImage');

    res.json({
      success: true,
      count: roommates.length,
      roommates
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
