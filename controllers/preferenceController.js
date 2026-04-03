const RoommatePreference = require('../models/RoommatePreference');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const Room = require('../models/Room');

// Adjacency maps for scoring
const ADJACENCY = {
  sleepSchedule: ['early_bird', 'flexible', 'night_owl'],
  cleanliness: ['very_tidy', 'moderate', 'relaxed'],
  noiseLevel: ['quiet', 'moderate', 'lively'],
  studyHabits: ['in_room', 'mixed', 'library'],
  socialLevel: ['introvert', 'ambivert', 'extrovert'],
  smoking: ['no', 'occasionally', 'yes'],
  drinking: ['no', 'occasionally', 'yes'],
  guestPolicy: ['no_guests', 'occasional', 'open'],
  budget: ['low', 'moderate', 'high'],
};

const CATEGORIES = Object.keys(ADJACENCY);
const MAX_SCORE = CATEGORIES.length * 10; // 9 categories × 10 points each = 90

/**
 * Score two values on a scale.
 * Exact match = 10, adjacent = 5, far = 0.
 */
function scoreCategory(scale, a, b) {
  if (a === b) return 10;
  const idxA = scale.indexOf(a);
  const idxB = scale.indexOf(b);
  if (idxA === -1 || idxB === -1) return 0;
  return Math.abs(idxA - idxB) === 1 ? 5 : 0;
}

/**
 * @desc    Save or update roommate preferences
 * @route   POST /api/preferences
 * @access  Private (verified student)
 */
exports.savePreferences = async (req, res) => {
  try {
    const data = {
      user: req.user._id,
      sleepSchedule: req.body.sleepSchedule,
      cleanliness: req.body.cleanliness,
      noiseLevel: req.body.noiseLevel,
      studyHabits: req.body.studyHabits,
      socialLevel: req.body.socialLevel,
      smoking: req.body.smoking,
      drinking: req.body.drinking,
      guestPolicy: req.body.guestPolicy,
      budget: req.body.budget,
      completedAt: new Date(),
    };

    const pref = await RoommatePreference.findOneAndUpdate(
      { user: req.user._id },
      data,
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: pref });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get current user's preferences
 * @route   GET /api/preferences
 * @access  Private (verified student)
 */
exports.getPreferences = async (req, res) => {
  try {
    const pref = await RoommatePreference.findOne({ user: req.user._id });
    res.status(200).json({ success: true, data: pref });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get ranked roommate matches based on preference similarity
 * @route   GET /api/preferences/matches
 * @access  Private (verified student)
 */
exports.getMatches = async (req, res) => {
  try {
    // 1. Get the current user's preferences
    const myPref = await RoommatePreference.findOne({ user: req.user._id });
    if (!myPref) {
      return res.status(400).json({
        success: false,
        message: 'Please complete the questionnaire first.',
      });
    }

    // 2. Get IDs of students with active bookings (exclude them)
    const studentsWithBookings = await Booking.find({
      status: { $in: ['pending', 'approved', 'confirmed'] },
    }).distinct('student');

    // 3. Get all OTHER verified students who also have preferences saved
    const otherPrefs = await RoommatePreference.find({
      user: { $ne: req.user._id },
    }).populate({
      path: 'user',
      select: 'name username email phonenumber university faculty year semester hometown address age isVerified profileImage',
    });

    // 4. Score each candidate
    const matches = [];

    for (const candidate of otherPrefs) {
      // Skip if user doc missing, not verified, or has active booking
      if (!candidate.user) continue;
      if (!candidate.user.isVerified) continue;
      if (studentsWithBookings.some((id) => id.toString() === candidate.user._id.toString())) continue;

      let totalScore = 0;
      const breakdown = {};

      for (const cat of CATEGORIES) {
        const score = scoreCategory(ADJACENCY[cat], myPref[cat], candidate[cat]);
        totalScore += score;
        breakdown[cat] = { mine: myPref[cat], theirs: candidate[cat], score };
      }

      const compatibility = Math.round((totalScore / MAX_SCORE) * 100);

      matches.push({
        student: candidate.user,
        compatibility,
        totalScore,
        breakdown,
      });
    }

    // 5. Sort by compatibility descending
    matches.sort((a, b) => b.compatibility - a.compatibility);

    res.status(200).json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get recommended boardings based on student's budget preference
 * @route   GET /api/preferences/boardings
 * @access  Private (verified student)
 */
exports.getRecommendedBoardings = async (req, res) => {
  try {
    const myPref = await RoommatePreference.findOne({ user: req.user._id });
    if (!myPref) {
      return res.status(400).json({
        success: false,
        message: 'Please complete the questionnaire first.',
      });
    }

    // Budget range mapping (LKR)
    const BUDGET_RANGES = {
      low: { min: 0, max: 15000 },
      moderate: { min: 10000, max: 25000 },
      high: { min: 20000, max: 999999 },
    };

    const range = BUDGET_RANGES[myPref.budget] || BUDGET_RANGES.moderate;

    // Get all active, verified properties
    const properties = await Property.find({
      isActive: true,
      verificationStatus: 'verified',
    }).populate('owner', 'name email phonenumber profileImage');

    const results = [];

    for (const prop of properties) {
      const rooms = await Room.find({ property: prop._id });

      // Filter rooms that fit the budget
      const matchingRooms = rooms.filter(
        (r) => r.monthlyRent >= range.min && r.monthlyRent <= range.max
      );

      if (matchingRooms.length === 0) continue;

      // Calculate availability
      const totalSlots = matchingRooms.reduce((sum, r) => sum + r.totalCapacity, 0);
      const occupied = matchingRooms.reduce((sum, r) => sum + (r.currentOccupants?.length || 0), 0);
      const available = totalSlots - occupied;

      const cheapest = Math.min(...matchingRooms.map((r) => r.monthlyRent));
      const mostExpensive = Math.max(...matchingRooms.map((r) => r.monthlyRent));

      results.push({
        property: {
          _id: prop._id,
          name: prop.name,
          address: prop.address,
          description: prop.description,
          photos: prop.photos,
          trustBadge: prop.trustBadge,
          safetyStatus: prop.safetyStatus,
          owner: prop.owner,
        },
        rooms: matchingRooms.map((r) => ({
          _id: r._id,
          roomType: r.roomType,
          monthlyRent: r.monthlyRent,
          facilities: r.facilities,
          totalCapacity: r.totalCapacity,
          availableSlots: r.totalCapacity - (r.currentOccupants?.length || 0),
        })),
        priceRange: { min: cheapest, max: mostExpensive },
        availableSlots: available,
        totalRooms: matchingRooms.length,
      });
    }

    // Sort by available slots descending
    results.sort((a, b) => b.availableSlots - a.availableSlots);

    res.status(200).json({
      success: true,
      budget: myPref.budget,
      count: results.length,
      boardings: results,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
