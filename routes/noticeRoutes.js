const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    createNotice,
    getOwnerNotices,
    updateNotice,
    deleteNotice,
    getStudentNotices,
} = require('../controllers/noticeController');

// ── Student ──────────────────────────────────────────────────────────────────
// GET /api/notices/my  — notices for the student's confirmed boarding house
router.get('/my', protect, authorize(['student']), getStudentNotices);

// ── Owner ────────────────────────────────────────────────────────────────────
// POST /api/notices                           — create notice
// GET  /api/notices/property/:propertyId      — list notices for a property
// PUT  /api/notices/:noticeId                 — update notice
// DELETE /api/notices/:noticeId               — delete notice
router.post('/', protect, authorize(['boardingowner']), createNotice);
router.get('/property/:propertyId', protect, authorize(['boardingowner']), getOwnerNotices);
router.put('/:noticeId', protect, authorize(['boardingowner']), updateNotice);
router.delete('/:noticeId', protect, authorize(['boardingowner']), deleteNotice);

module.exports = router;
