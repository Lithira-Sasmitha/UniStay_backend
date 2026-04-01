const express = require('express');
const router = express.Router();

// Import controllers
const {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  updateUserRole,
  getUserProfile,
  updateUserProfile,
  deleteUser,
  getAllUsers,
  updateUserByAdmin,
  sendVerificationOTP,
  verifyEmailOTP,
} = require('../controllers/userController');

// Import middlewares
const { protect, authorize } = require('../middleware/authMiddleware');

// Public auth routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/refresh', refreshToken);
router.post('/logout', logoutUser);

// Verification routes
router.post('/send-otp', protect, sendVerificationOTP);
router.post('/verify-otp', protect, verifyEmailOTP);

// Private profile routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// Admin / SuperAdmin routes
router.get('/', protect, authorize(['superadmin']), getAllUsers);
router.put('/:id', protect, authorize(['superadmin']), updateUserByAdmin);
router.patch('/:id/role', protect, authorize(['superadmin']), updateUserRole);
router.delete('/:id', protect, authorize(['superadmin']), deleteUser);

// RBAC test routes
router.get('/student-data', protect, authorize(['student']), (req, res) => {
  res.json({ message: 'Student data accessed', user: req.user });
});

router.get('/superadmin-dashboard', protect, authorize(['superadmin']), (req, res) => {
  res.json({ message: 'Super Admin Dashboard accessed', user: req.user });
});

module.exports = router;
