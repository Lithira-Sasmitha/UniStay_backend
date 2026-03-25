const express = require('express');
const {
  createIncident,
  getMyIncidents,
  getIncidents,
  updateIncidentStatus
} = require('../controllers/incidentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public/Private Routes depending on use-cases
// Students reporting or getting their own
router.post('/', protect, authorize('student'), upload.single('photo'), createIncident);
router.get('/me', protect, authorize('student'), getMyIncidents);

// Admin/Owner routes
router.get('/', protect, authorize('super_admin', 'boarding_owner'), getIncidents);
router.patch('/:id/status', protect, authorize('super_admin', 'boarding_owner'), updateIncidentStatus);

module.exports = router;