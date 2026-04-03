const express = require('express');
const {
  createIncident,
  getMyIncidents,
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  addOwnerResponse,
  getAuditLog,
  getAnalytics
} = require('../controllers/incidentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public/Private Routes depending on use-cases
// Students reporting or getting their own
router.post('/', protect, authorize(['student']), upload.single('photo'), createIncident);
router.get('/me', protect, authorize(['student']), getMyIncidents);
router.get('/audit-log', protect, authorize(['superadmin']), getAuditLog);
router.get('/analytics', protect, authorize(['superadmin']), getAnalytics);
router.get('/:id', protect, getIncidentById);

// Admin/Owner routes
router.get('/', protect, authorize(['superadmin', 'boardingowner']), getIncidents);
router.patch('/:id/status', protect, authorize(['superadmin']), updateIncidentStatus);
router.patch('/:id/owner-response', protect, authorize(['boardingowner']), addOwnerResponse);

module.exports = router;