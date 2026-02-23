const express = require('express');
const router = express.Router();
const { getAllUsers, createUser } = require('../controllers/userController');

// Map endpoints to controller functions
router.route('/').get(getAllUsers).post(createUser);

module.exports = router;
