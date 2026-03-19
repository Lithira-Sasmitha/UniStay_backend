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
    getFilmHallView,
    getOwnerBoardingManagement,
    getPublicListings,
    getListingById,
    getVerificationQueue,
    getAllProperties,
    setTrustBadge,
    debugAllProperties,
} = require('../controllers/propertyController');

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

// ── Film Hall View ────────────────────────────────────────────────────
router.get(
    '/:propertyId/film-hall',
    protect,
    authorize(['boardingowner']),
    getFilmHallView
);

// ── Public: Detail by ID (last to avoid conflicts) ───────────────────
router.get('/:propertyId', getListingById);

module.exports = router;
