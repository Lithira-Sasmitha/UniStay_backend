const express = require('express');
const router = express.Router();
const { getAllUsers, createUser } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// Only super_admin can list all users
router
  .route('/')
  .get(protect, authorize('super_admin'), getAllUsers)
  .post(createUser);

module.exports = router;
