const express = require('express');
const router = express.Router();
const { savePreferences, getPreferences, getMatches, getRecommendedBoardings } = require('../controllers/preferenceController');
const { protect } = require('../middleware/authMiddleware');
const { checkStudentRole, checkVerifiedUser } = require('../middleware/roommateMiddleware');

// All routes require: logged in + student role
router.use(protect, checkStudentRole);

// @desc    Save / update questionnaire answers (any student can save)
// @route   POST /api/preferences
router.post('/', savePreferences);

// @desc    Get current user's saved preferences (any student can get)
// @route   GET /api/preferences
router.get('/', getPreferences);

// @desc    Get ranked roommate matches (verified only)
// @route   GET /api/preferences/matches
router.get('/matches', checkVerifiedUser, getMatches);

// @desc    Get recommended boardings based on budget (verified only)
// @route   GET /api/preferences/boardings
router.get('/boardings', checkVerifiedUser, getRecommendedBoardings);

module.exports = router;

