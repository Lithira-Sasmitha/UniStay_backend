const express = require('express');
const router = express.Router();
const { savePreferences, getPreferences, getMatches, getRecommendedBoardings } = require('../controllers/preferenceController');
const { protect } = require('../middleware/authMiddleware');
const { checkStudentRole, checkVerifiedUser } = require('../middleware/roommateMiddleware');

// All routes require: logged in + student role + verified email
router.use(protect, checkStudentRole, checkVerifiedUser);

// @desc    Save / update questionnaire answers
// @route   POST /api/preferences
router.post('/', savePreferences);

// @desc    Get current user's saved preferences
// @route   GET /api/preferences
router.get('/', getPreferences);

// @desc    Get ranked roommate matches
// @route   GET /api/preferences/matches
router.get('/matches', getMatches);

// @desc    Get recommended boardings based on budget
// @route   GET /api/preferences/boardings
router.get('/boardings', getRecommendedBoardings);

module.exports = router;
