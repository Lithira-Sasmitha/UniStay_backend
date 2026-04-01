const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload, uploadDocs } = require('../config/cloudinary');
const {
    createProperty,
    getOwnerListings,
    addRoom,
    updateRoom,
    deleteRoom,
    addPhoto,
    deletePhoto,
    toggleActive,
    getBoardingArrangeView,
    getOwnerBoardingManagement,
    getPublicListings,
    getListingById,
    getVerificationQueue,
    getAllProperties,
    setTrustBadge,
    debugAllProperties,
    updateProperty,
    deleteProperty,
    rejectProperty,
    removeOccupant,
} = require('../controllers/propertyController');
const { getPropertySafetyStatus } = require('../controllers/incidentController');
// ── Public Routes ────────────────────────────────────────────────────
router.get('/public', getPublicListings);

// ── Admin Routes (must be before :propertyId to avoid collision) ─────
router.get(
    '/admin/verification-queue',
    protect,
    authorize(['superadmin']),
    getVerificationQueue
);
router.get(
    '/admin/all',
    protect,
    authorize(['superadmin']),
    getAllProperties
);
router.patch(
    '/admin/:propertyId/badge',
    protect,
    authorize(['superadmin']),
    setTrustBadge
);
router.patch(
    '/admin/:propertyId/reject',
    protect,
    authorize(['superadmin']),
    rejectProperty
);

// ── Debug Route ──────────────────────────────────────────────────────
router.get(
    '/debug/all-with-owners',
    protect,
    authorize(['superadmin']),
    debugAllProperties
);

// ── Owner Routes ─────────────────────────────────────────────────────
router.post(
    '/',
    protect,
    authorize(['boardingowner']),
    uploadDocs.fields([
        { name: 'photos', maxCount: 10 },
        { name: 'nicPhoto', maxCount: 1 },
        { name: 'utilityBill', maxCount: 1 },
        { name: 'policeReport', maxCount: 1 },
    ]),
    createProperty
);
router.get('/my-listings', protect, authorize(['boardingowner']), getOwnerListings);
router.get('/my-boarding', protect, authorize(['boardingowner']), getOwnerBoardingManagement);

// ── Property CRUD ───────────────────────────────────────────────────
router.put(
    '/:propertyId',
    protect,
    authorize(['boardingowner', 'superadmin']),
    uploadDocs.fields([
        { name: 'nicPhoto', maxCount: 1 },
        { name: 'utilityBill', maxCount: 1 },
        { name: 'policeReport', maxCount: 1 },
    ]),
    updateProperty
);
router.delete(
    '/:propertyId',
    protect,
    authorize(['boardingowner', 'superadmin']),
    deleteProperty
);

// ── Room Routes ──────────────────────────────────────────────────────
router.post(
    '/:propertyId/rooms',
    protect,
    authorize(['boardingowner']),
    addRoom
);
router.put(
    '/rooms/:roomId',
    protect,
    authorize(['boardingowner']),
    updateRoom
);
router.delete(
    '/rooms/:roomId',
    protect,
    authorize(['boardingowner']),
    deleteRoom
);
router.patch(
    '/rooms/:roomId/remove-occupant',
    protect,
    authorize(['boardingowner']),
    removeOccupant
);

// ── Photo Routes ─────────────────────────────────────────────────────
router.post(
    '/:propertyId/photos',
    protect,
    authorize(['boardingowner']),
    upload.single('photo'),
    addPhoto
);
router.delete(
    '/:propertyId/photos/:publicId',
    protect,
    authorize(['boardingowner']),
    deletePhoto
);

// ── Toggle Active ────────────────────────────────────────────────────
router.patch(
    '/:propertyId/toggle-active',
    protect,
    authorize(['boardingowner', 'superadmin']),
    toggleActive
);

// ── Boarding Arrange View ────────────────────────────────────────────
router.get(
    '/:propertyId/boarding-arrange',
    protect,
    authorize(['boardingowner']),
    getBoardingArrangeView
);
// ── Property Safety ─────────────────────────────────────────────────────
router.get('/:propertyId/safety', getPropertySafetyStatus);
// ── Public: Detail by ID (last to avoid conflicts) ───────────────────
router.get('/:propertyId', getListingById);

module.exports = router;
