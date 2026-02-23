const express = require('express');
const router = express.Router();

// Import controllers
const {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  updateUserRole,
} = require('../controllers/userController');

// Import middlewares
const { protect, authorize } = require('../middleware/authMiddleware');

// Public auth routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/refresh', refreshToken);
router.post('/logout', logoutUser);

// Admin / SuperAdmin routes
router.patch('/:id/role', protect, authorize(['superadmin']), updateUserRole);

/**
 * 🧪 Test RBAC Routes
 */

// Route for Students Only
router.get(
  '/student-data',
  protect,
  authorize(['student']), // RBAC: Student only
  (req, res) => {
    res.json({
      success: true,
      data: '🎓 Sensitive student academic and boarding data accessed.',
    });
  }
);

// Route for Superadmin Only
router.get(
  '/superadmin-dashboard',
  protect,
  authorize(['superadmin']), // RBAC: Superadmin only
  (req, res) => {
    res.json({
      success: true,
      data: '👑 Central management dashboard access granted. Welcome, Super Admin.',
    });
  }
);

module.exports = router;
