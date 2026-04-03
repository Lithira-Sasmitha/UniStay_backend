const Property = require('../models/Property');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const { uploadFile } = require('../config/cloudinary');
const { deleteFromSupabase } = require('../config/supabase');
const { sendBookingEmail } = require('../config/emailService');

// ──────────────────────────────────────────────────────────────────────
// OWNER ENDPOINTS
// ──────────────────────────────────────────────────────────────────────

/**
 * @desc    Create a new property (with multiple rooms)
 * @route   POST /api/properties
 * @access  Private/Owner
 */
const createProperty = async (req, res) => {
    try {
        const {
            name, address, description,
            // Support both single room (legacy) and multiple rooms
            rooms: roomsJson,
            // Legacy single room fields (for backwards compatibility)
            roomType, monthlyRent, keyMoney, advanceAmount, advanceType,
            totalCapacity, facilities,
        } = req.body;

        // Build photos array — upload each buffer to Firebase
        const photos = [];
        if (req.files?.photos?.length > 0) {
            for (const file of req.files.photos) {
                const result = await uploadFile(file, 'unistay_properties');
                photos.push({ url: result.url, publicId: result.filePath });
            }
        }

        // Verification docs — upload to Firebase
        const verificationDocs = { nicPhoto: { url: '', publicId: '' }, utilityBill: { url: '', publicId: '' }, policeReport: { url: '', publicId: '' } };
        for (const docKey of ['nicPhoto', 'utilityBill', 'policeReport']) {
            if (req.files?.[docKey]?.[0]) {
                const result = await uploadFile(req.files[docKey][0], 'unistay_docs');
                verificationDocs[docKey] = { url: result.url, publicId: result.filePath };
            }
        }

        // Create Property
        const property = await Property.create({
            name,
            address,
            description,
            owner: req.user._id,
            photos,
            verificationDocs,
            verificationStatus: 'pending',
            trustBadge: 'unverified',
        });

        // Parse rooms - support both JSON array and legacy single room
        let roomsToCreate = [];
        
        if (roomsJson) {
            // New format: multiple rooms as JSON array
            try {
                roomsToCreate = JSON.parse(roomsJson);
            } catch (e) {
                return res.status(400).json({ success: false, message: 'Invalid rooms data format' });
            }
        } else if (roomType && monthlyRent) {
            // Legacy format: single room with individual fields
            roomsToCreate = [{
                roomType,
                monthlyRent,
                keyMoney: keyMoney || 0,
                advanceAmount,
                advanceType: advanceType || 'fixed',
                totalCapacity,
                facilities: facilities ? (Array.isArray(facilities) ? facilities : facilities.split(',').map(f => f.trim())) : [],
            }];
        }

        if (roomsToCreate.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one room is required' });
        }

        // Create all rooms
        const createdRooms = await Promise.all(
            roomsToCreate.map(async (roomData) => {
                return await Room.create({
                    property: property._id,
                    roomType: roomData.roomType,
                    monthlyRent: roomData.monthlyRent,
                    keyMoney: roomData.keyMoney || 0,
                    advanceAmount: roomData.advanceAmount || 0,
                    advanceType: roomData.advanceType || 'fixed',
                    totalCapacity: roomData.totalCapacity || 1,
                    facilities: Array.isArray(roomData.facilities) ? roomData.facilities : [],
                });
            })
        );

        res.status(201).json({
            success: true,
            message: `Property created with ${createdRooms.length} room(s)`,
            property,
            rooms: createdRooms,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get owner's own properties
 * @route   GET /api/properties/my-listings
 * @access  Private/Owner
 */
const getOwnerListings = async (req, res) => {
    try {
        const properties = await Property.find({ owner: req.user._id }).sort('-createdAt');

        // Attach rooms to each property
        const results = await Promise.all(
            properties.map(async (prop) => {
                const rooms = await Room.find({ property: prop._id }).populate('currentOccupants.student', 'name email profileImage');
                return { ...prop.toObject(), rooms };
            })
        );

        res.json({ success: true, properties: results });
    } catch (error) {
        console.error('getOwnerListings Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Add a new room to an existing property
 * @route   POST /api/properties/:propertyId/rooms
 * @access  Private/Owner
 */
const addRoom = async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId);
        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
        if (property.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { roomType, monthlyRent, keyMoney, advanceAmount, advanceType, totalCapacity, facilities } = req.body;

        const room = await Room.create({
            property: property._id,
            roomType,
            monthlyRent,
            keyMoney: keyMoney || 0,
            advanceAmount,
            advanceType: advanceType || 'fixed',
            totalCapacity,
            facilities: facilities ? (Array.isArray(facilities) ? facilities : facilities.split(',').map(f => f.trim())) : [],
        });

        // Return updated room list
        const rooms = await Room.find({ property: property._id })
            .populate('currentOccupants.student', 'name email phonenumber profileImage');
        res.status(201).json({ success: true, message: 'Room added', room, rooms });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update a room
 * @route   PUT /api/properties/rooms/:roomId
 * @access  Private/Owner
 */
const updateRoom = async (req, res) => {
    try {
        const room = await Room.findById(req.params.roomId).populate('property');
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
        if (room.property.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { roomType, monthlyRent, keyMoney, advanceAmount, advanceType, totalCapacity, facilities } = req.body;

        // Validate capacity >= current occupants
        if (totalCapacity && totalCapacity < room.currentOccupants.length) {
            return res.status(400).json({
                success: false,
                message: `Cannot set capacity to ${totalCapacity}. Room has ${room.currentOccupants.length} current occupant(s).`,
            });
        }

        if (roomType) room.roomType = roomType;
        if (monthlyRent) room.monthlyRent = monthlyRent;
        if (keyMoney !== undefined) room.keyMoney = keyMoney;
        if (advanceAmount) room.advanceAmount = advanceAmount;
        if (advanceType) room.advanceType = advanceType;
        if (totalCapacity) room.totalCapacity = totalCapacity;
        if (facilities) room.facilities = Array.isArray(facilities) ? facilities : facilities.split(',').map(f => f.trim());

        await room.save();
        res.json({ success: true, message: 'Room updated', room });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete a room (only if no confirmed bookings)
 * @route   DELETE /api/properties/rooms/:roomId
 * @access  Private/Owner
 */
const deleteRoom = async (req, res) => {
    try {
        const room = await Room.findById(req.params.roomId).populate('property');
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
        if (room.property.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        if (room.currentOccupants.length > 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete room with active occupants' });
        }

        // Check for pending/approved bookings
        const activeBookings = await Booking.countDocuments({
            room: room._id,
            status: { $in: ['pending', 'approved'] },
        });
        if (activeBookings > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete room with ${activeBookings} pending/approved booking(s). Cancel them first.`,
            });
        }

        await Room.findByIdAndDelete(req.params.roomId);

        // Return updated room list
        const rooms = await Room.find({ property: room.property._id })
            .populate('currentOccupants.student', 'name email phonenumber profileImage');
        res.json({ success: true, message: 'Room deleted', rooms });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Add photo to property (max 10)
 * @route   POST /api/properties/:propertyId/photos
 * @access  Private/Owner
 */
const addPhoto = async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId);
        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
        if (property.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        if (property.photos.length >= 10) {
            return res.status(400).json({ success: false, message: 'Maximum 10 images allowed per listing' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image provided' });
        }

        const result = await uploadFile(req.file, 'unistay_properties');
        property.photos.push({ url: result.url, publicId: result.filePath });
        await property.save();

        res.json({ success: true, message: 'Photo added', photos: property.photos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete photo from property (removes from Cloudinary + DB)
 * @route   DELETE /api/properties/:propertyId/photos/:publicId
 * @access  Private/Owner
 */
const deletePhoto = async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId);
        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
        if (property.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const photoIndex = property.photos.findIndex(p => p.publicId === req.params.publicId);
        if (photoIndex === -1) {
            return res.status(404).json({ success: false, message: 'Photo not found' });
        }

        // Remove from Firebase Storage (also handles old Cloudinary IDs gracefully)
        await deleteFromSupabase(req.params.publicId);

        // Remove from DB
        property.photos.splice(photoIndex, 1);
        await property.save();

        res.json({ success: true, message: 'Photo deleted', photos: property.photos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Toggle property active status
 * @route   PATCH /api/properties/:propertyId/toggle-active
 * @access  Private/Owner or Admin
 */
const toggleActive = async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId);
        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

        // Only owner or superadmin can toggle
        if (property.owner.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Can't activate a rejected/unverified property
        if (!property.isActive && property.verificationStatus !== 'verified') {
            return res.status(400).json({
                success: false,
                message: 'Cannot activate a property that is not verified by admin',
            });
        }

        // Count affected bookings when deactivating
        let pendingBookingsCount = 0;
        if (property.isActive) {
            pendingBookingsCount = await Booking.countDocuments({
                property: property._id,
                status: { $in: ['pending', 'approved'] },
            });
        }

        property.isActive = !property.isActive;
        await property.save();

        res.json({
            success: true,
            message: `Property ${property.isActive ? 'activated' : 'deactivated'}`,
            isActive: property.isActive,
            pendingBookingsCount,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Boarding Arrange view — full boarding management data
 * @route   GET /api/properties/:propertyId/boarding-arrange
 * @access  Private/Owner
 */
const getBoardingArrangeView = async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId);
        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
        if (property.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const rooms = await Room.find({ property: property._id })
            .populate('currentOccupants.student', 'name email phonenumber university nic profileImage')
            .populate('currentOccupants.bookingId', 'status createdAt advancePaid');

        // Get all active bookings for this property
        const bookings = await Booking.find({
            property: property._id,
            status: { $in: ['pending', 'approved', 'confirmed'] },
        })
            .populate('student', 'name email phonenumber university address age nic profileImage')
            .populate('room', 'roomType')
            .sort('-createdAt');

        // Summary stats
        const totalRooms = rooms.length;
        const totalCapacity = rooms.reduce((sum, r) => sum + r.totalCapacity, 0);
        const totalOccupied = rooms.reduce((sum, r) => sum + r.currentOccupants.length, 0);
        const totalVacant = totalCapacity - totalOccupied;
        const pendingRequests = bookings.filter(b => b.status === 'pending').length;

        res.json({
            success: true,
            property,
            rooms,
            bookings,
            stats: { totalRooms, totalCapacity, totalOccupied, totalVacant, pendingRequests },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get owner's properties with rooms + occupant details (all properties, not just verified)
 * @route   GET /api/properties/my-boarding
 * @access  Private/Owner
 */
const getOwnerBoardingManagement = async (req, res) => {
    try {
        // Return ALL owner properties so they can view rooms even before admin verification
        const properties = await Property.find({
            owner: req.user._id,
        }).sort('-createdAt');

        const results = await Promise.all(
            properties.map(async (prop) => {
                const rooms = await Room.find({ property: prop._id })
                    .populate('currentOccupants.student', 'name email phonenumber profileImage')
                    .populate('currentOccupants.bookingId', 'status createdAt advancePaid');
                return { ...prop.toObject(), rooms };
            })
        );

        res.json({ success: true, properties: results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS
// ──────────────────────────────────────────────────────────────────────

/**
 * @desc    Get public listings (verified + active only, with available rooms)
 * @route   GET /api/properties/public
 * @access  Public
 */
const getPublicListings = async (req, res) => {
    try {
        const { search } = req.query;

        const query = {
            isActive: true,
            verificationStatus: 'verified',
            'photos.0': { $exists: true }, // Must have at least 1 photo
        };

        if (search) {
            query.$text = { $search: search };
        }

        const properties = await Property.find(query)
            .populate('owner', 'name email phonenumber profileImage')
            .sort('-createdAt');

        // Attach rooms and filter out properties where ALL rooms are full
        const results = [];
        for (const prop of properties) {
            const rooms = await Room.find({ property: prop._id });
            const hasAvailableRoom = rooms.some(r => r.currentOccupants.length < r.totalCapacity);
            if (hasAvailableRoom) {
                results.push({ ...prop.toObject(), rooms });
            }
        }

        const propertyIds = results.map((property) => property._id);
        const reviews = await Review.find({ property: { $in: propertyIds } })
            .select('property rating');

        const statsMap = new Map();
        reviews.forEach((review) => {
            const key = review.property.toString();
            const current = statsMap.get(key) || { total: 0, count: 0 };
            current.total += review.rating;
            current.count += 1;
            statsMap.set(key, current);
        });

        const propertiesWithReviewStats = results.map((property) => {
            const stats = statsMap.get(property._id.toString()) || { total: 0, count: 0 };
            return {
                ...property,
                reviewCount: stats.count,
                averageRating: stats.count > 0 ? Number((stats.total / stats.count).toFixed(1)) : null,
            };
        });

        res.json({ success: true, properties: propertiesWithReviewStats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get single property by ID (with rooms)
 * @route   GET /api/properties/:propertyId
 * @access  Public
 */
const getListingById = async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId)
            .populate('owner', 'name email phonenumber profileImage');

        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

        const rooms = await Room.find({ property: property._id });
        const reviews = await Review.find({ property: property._id })
            .populate('student', 'name')
            .sort('-createdAt');

        const reviewCount = reviews.length;
        const averageRating = reviewCount > 0
            ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1))
            : null;

        res.json({
            success: true,
            property: {
                ...property.toObject(),
                rooms,
                reviews,
                reviewCount,
                averageRating,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ──────────────────────────────────────────────────────────────────────

/**
 * @desc    Get pending properties for verification
 * @route   GET /api/properties/admin/verification-queue
 * @access  Private/Admin
 */
const getVerificationQueue = async (req, res) => {
    try {
        const properties = await Property.find({ verificationStatus: 'pending' })
            .populate('owner', 'name email phonenumber nic profileImage')
            .sort('-createdAt');

        res.json({ success: true, properties });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all properties (admin view)
 * @route   GET /api/properties/admin/all
 * @access  Private/Admin
 */
const getAllProperties = async (req, res) => {
    try {
        const properties = await Property.find({})
            .populate('owner', 'name email phonenumber profileImage')
            .sort('-createdAt');

        const results = await Promise.all(
            properties.map(async (prop) => {
                const rooms = await Room.find({ property: prop._id });
                return { ...prop.toObject(), rooms };
            })
        );

        res.json({ success: true, properties: results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Set trust badge for a property
 * @route   PATCH /api/properties/admin/:propertyId/badge
 * @access  Private/Admin
 *
 * Badge rules:
 *   Gold:   NIC + Utility Bill + Property Photos + Police Clearance
 *   Silver: NIC + Utility Bill + Property Photos
 *   Bronze: NIC + Property Photos
 */
const setTrustBadge = async (req, res) => {
    try {
        const { badge, badgeMessage } = req.body;
        if (!['gold', 'silver', 'bronze', 'unverified'].includes(badge)) {
            return res.status(400).json({ success: false, message: 'Invalid badge type' });
        }

        const property = await Property.findById(req.params.propertyId);
        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

        const docs = property.verificationDocs;
        const hasNIC = !!docs.nicPhoto?.url;
        const hasUtility = !!docs.utilityBill?.url;
        const hasPhotos = property.photos.length > 0;
        const hasPolice = !!docs.policeReport?.url;

        // Validate badge assignment rules
        if (badge === 'gold' && !(hasNIC && hasUtility && hasPhotos && hasPolice)) {
            return res.status(400).json({ success: false, message: 'Gold badge requires: NIC + Utility Bill + Property Photos + Police Clearance' });
        }
        if (badge === 'silver' && !(hasNIC && hasUtility && hasPhotos)) {
            return res.status(400).json({ success: false, message: 'Silver badge requires: NIC + Utility Bill + Property Photos' });
        }
        if (badge === 'bronze' && !(hasNIC && hasPhotos)) {
            return res.status(400).json({ success: false, message: 'Bronze badge requires: NIC + Property Photos' });
        }

        property.trustBadge = badge;
        property.badgeMessage = badgeMessage || '';
        property.verificationStatus = badge === 'unverified' ? 'pending' : 'verified';
        property.rejectionReason = ''; // Clear any previous rejection
        // Verified → make active; unverified → deactivate so it leaves public listings
        property.isActive = badge !== 'unverified';
        await property.save();

        // Email the owner on verification
        if (badge !== 'unverified') {
            const populatedProp = await Property.findById(property._id).populate('owner', 'name email');
            if (populatedProp.owner?.email) {
                await sendBookingEmail(
                    populatedProp.owner.email,
                    'Property Verified - UniStay',
                    `<p>Hello <strong>${populatedProp.owner.name}</strong>,</p>
                     <p>Congratulations! Your property <strong>${property.name}</strong> has been verified and is now live on UniStay with a <strong>${badge}</strong> trust badge.</p>
                     <p>Students can now find and book your listing.</p>`
                );
            }
        }

        res.json({
            success: true,
            message: `Trust badge set to ${badge}`,
            property,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Debug endpoint - Get all properties with owner info
 * @route   GET /api/properties/debug/all-with-owners
 * @access  Private/Admin
 */
const debugAllProperties = async (req, res) => {
    try {
        const properties = await Property.find({})
            .populate('owner', 'name email role _id')
            .select('name owner verificationStatus createdAt');
        
        res.json({
            success: true, 
            count: properties.length,
            properties: properties.map(p => ({
                _id: p._id,
                name: p.name,
                ownerId: p.owner?._id,
                ownerEmail: p.owner?.email,
                ownerRole: p.owner?.role,
                verificationStatus: p.verificationStatus,
                createdAt: p.createdAt,
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update property details
 * @route   PUT /api/properties/:propertyId
 * @access  Private/Owner or Admin
 */
const updateProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId);
        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

        // Only owner or superadmin
        if (property.owner.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { name, address, description } = req.body;
        if (name) property.name = name;
        if (address) property.address = address;
        if (description) property.description = description;

        // Upload any new verification docs and replace existing ones
        for (const docKey of ['nicPhoto', 'utilityBill', 'policeReport']) {
            if (req.files?.[docKey]?.[0]) {
                // Delete old doc from storage if it exists
                const oldDoc = property.verificationDocs?.[docKey];
                if (oldDoc?.publicId) {
                    try { await deleteFromSupabase(oldDoc.publicId); } catch (_) {}
                }
                const result = await uploadFile(req.files[docKey][0], 'unistay_docs');
                property.verificationDocs[docKey] = { url: result.url, publicId: result.filePath };
            }
        }

        // Any edit by the owner always requires re-verification
        // - Verified property: drop back to pending + deactivate so changes aren't live until admin re-verifies
        // - Rejected/unverified: clear rejection reason and queue for re-review
        if (req.user.role === 'boardingowner') {
            property.verificationStatus = 'pending';
            property.trustBadge = 'unverified';
            property.rejectionReason = '';
            property.isActive = false;
        }

        await property.save();
        res.json({ success: true, message: 'Property updated and submitted for re-verification', property });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete property with smart booking handling
 * @route   DELETE /api/properties/:propertyId
 * @access  Private/Owner or Admin
 */
const deleteProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId).populate('owner', 'name email');
        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

        // Only owner or superadmin
        if (property.owner._id.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Check for confirmed bookings (active students living there)
        const confirmedBookings = await Booking.find({ property: property._id, status: 'confirmed' });
        if (confirmedBookings.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete property with active students. Deactivate it instead or wait until all bookings are completed/cancelled.',
                confirmedCount: confirmedBookings.length,
            });
        }

        // Auto-cancel pending/approved bookings and notify students
        const pendingBookings = await Booking.find({
            property: property._id,
            status: { $in: ['pending', 'approved'] },
        }).populate('student', 'name email');

        for (const booking of pendingBookings) {
            booking.status = 'cancelled';
            await booking.save();
            if (booking.student?.email) {
                await sendBookingEmail(
                    booking.student.email,
                    'Booking Cancelled - Property Removed - UniStay',
                    `<p>Hello <strong>${booking.student.name}</strong>,</p>
                     <p>Your booking for <strong>${property.name}</strong> has been cancelled because the property has been removed by the owner.</p>
                     <p>Please browse other listings on UniStay.</p>`
                );
            }
        }

        // Delete all rooms
        await Room.deleteMany({ property: property._id });

        // Delete photos from Firebase Storage
        for (const photo of property.photos) {
            if (photo.publicId) {
                try { await deleteFromSupabase(photo.publicId); } catch (_) {}
            }
        }
        // Delete verification docs from Firebase Storage
        for (const docKey of ['nicPhoto', 'utilityBill', 'policeReport']) {
            const doc = property.verificationDocs?.[docKey];
            if (doc?.publicId) {
                try { await deleteFromSupabase(doc.publicId); } catch (_) {}
            }
        }

        await Property.findByIdAndDelete(property._id);

        res.json({
            success: true,
            message: 'Property deleted',
            cancelledBookings: pendingBookings.length,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Admin rejects a property with reason
 * @route   PATCH /api/properties/admin/:propertyId/reject
 * @access  Private/Admin
 */
const rejectProperty = async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        if (!rejectionReason || rejectionReason.length < 10) {
            return res.status(400).json({ success: false, message: 'Rejection reason must be at least 10 characters' });
        }

        const property = await Property.findById(req.params.propertyId).populate('owner', 'name email');
        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

        property.verificationStatus = 'rejected';
        property.rejectionReason = rejectionReason;
        property.trustBadge = 'unverified';
        property.isActive = false;
        await property.save();

        // Email the property owner
        if (property.owner?.email) {
            await sendBookingEmail(
                property.owner.email,
                'Property Rejected - UniStay',
                `<p>Hello <strong>${property.owner.name}</strong>,</p>
                 <p>Your property <strong>${property.name}</strong> has been rejected by the admin.</p>
                 <p><strong>Reason:</strong> ${rejectionReason}</p>
                 <p>Please update your listing and re-submit for verification.</p>`
            );
        }

        res.json({ success: true, message: 'Property rejected', property });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Remove an occupant from a room (owner checks out / evicts a student)
 * @route   PATCH /api/properties/rooms/:roomId/remove-occupant
 * @access  Private/Owner
 */
const removeOccupant = async (req, res) => {
    try {
        const { studentId, reason } = req.body;
        if (!studentId) return res.status(400).json({ success: false, message: 'Student ID is required' });

        const room = await Room.findById(req.params.roomId).populate('property');
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
        if (room.property.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Find the occupant entry
        const occupantIndex = room.currentOccupants.findIndex(
            o => o.student.toString() === studentId
        );
        if (occupantIndex === -1) {
            return res.status(404).json({ success: false, message: 'Student not found in this room' });
        }

        const occupant = room.currentOccupants[occupantIndex];

        // Cancel the confirmed booking
        if (occupant.bookingId) {
            const booking = await Booking.findById(occupant.bookingId).populate('student', 'name email');
            if (booking) {
                booking.status = 'cancelled';
                await booking.save();

                // Email the student
                if (booking.student?.email) {
                    await sendBookingEmail(
                        booking.student.email,
                        'Booking Cancelled - UniStay',
                        `<p>Hello <strong>${booking.student.name}</strong>,</p>
                         <p>Your stay at <strong>${room.property.name}</strong> has been ended by the property owner.</p>
                         ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                         <p>If you have any questions, please contact the property owner.</p>`
                    );
                }
            }
        }

        // Remove from occupants
        room.currentOccupants.splice(occupantIndex, 1);
        await room.save();

        // Re-activate property if it was hidden due to full capacity
        await Property.findByIdAndUpdate(room.property._id, { isActive: true });

        // Return updated room with populated data
        const updatedRoom = await Room.findById(room._id)
            .populate('currentOccupants.student', 'name email phonenumber university nic')
            .populate('currentOccupants.bookingId', 'status createdAt advancePaid');

        res.json({ success: true, message: 'Occupant removed', room: updatedRoom });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
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
};
