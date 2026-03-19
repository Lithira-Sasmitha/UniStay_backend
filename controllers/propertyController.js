const Property = require('../models/Property');
const Room = require('../models/Room');
const { cloudinary } = require('../config/cloudinary');

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

        // Build photos array from uploaded files
        const photos = [];
        if (req.files && req.files.photos && req.files.photos.length > 0) {
            for (const file of req.files.photos) {
                photos.push({ url: file.path, publicId: file.filename });
            }
        }

        // Verification docs from uploaded files
        const verificationDocs = {
            nicPhoto: req.files?.nicPhoto?.[0]
                ? { url: req.files.nicPhoto[0].path, publicId: req.files.nicPhoto[0].filename }
                : { url: '', publicId: '' },
            utilityBill: req.files?.utilityBill?.[0]
                ? { url: req.files.utilityBill[0].path, publicId: req.files.utilityBill[0].filename }
                : { url: '', publicId: '' },
            policeReport: req.files?.policeReport?.[0]
                ? { url: req.files.policeReport[0].path, publicId: req.files.policeReport[0].filename }
                : { url: '', publicId: '' },
        };

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
        console.log('---- getOwnerListings Debug ----');
        console.log('User ID:', req.user._id);
        console.log('User Role:', req.user.role);
        console.log('User Email:', req.user.email);
        
        const properties = await Property.find({ owner: req.user._id }).sort('-createdAt');
        
        console.log('Properties found:', properties.length);
        if (properties.length > 0) {
            console.log('Property owners:', properties.map(p => p.owner.toString()));
        }

        // Attach rooms to each property
        const results = await Promise.all(
            properties.map(async (prop) => {
                const rooms = await Room.find({ property: prop._id }).populate('currentOccupants.student', 'name email');
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

        res.status(201).json({ success: true, message: 'Room added', room });
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

        await Room.findByIdAndDelete(req.params.roomId);
        res.json({ success: true, message: 'Room deleted' });
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

        property.photos.push({ url: req.file.path, publicId: req.file.filename });
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

        // Remove from Cloudinary
        await cloudinary.uploader.destroy(req.params.publicId);

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

        property.isActive = !property.isActive;
        await property.save();

        res.json({ success: true, message: `Property ${property.isActive ? 'activated' : 'deactivated'}`, isActive: property.isActive });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Film Hall view for a property (rooms + occupants)
 * @route   GET /api/properties/:propertyId/film-hall
 * @access  Private/Owner
 */
const getFilmHallView = async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId);
        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
        if (property.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const rooms = await Room.find({ property: property._id })
            .populate('currentOccupants.student', 'name email phonenumber');

        res.json({ success: true, property, rooms });
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
        console.log('---- getOwnerBoardingManagement Debug ----');
        console.log('User ID:', req.user._id);
        console.log('User Role:', req.user.role);
        console.log('User Email:', req.user.email);
        
        // Return ALL owner properties so they can view rooms even before admin verification
        const properties = await Property.find({
            owner: req.user._id,
        }).sort('-createdAt');
        
        console.log('Properties found:', properties.length);

        const results = await Promise.all(
            properties.map(async (prop) => {
                const rooms = await Room.find({ property: prop._id })
                    .populate('currentOccupants.student', 'name email phonenumber')
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
            .populate('owner', 'name email phonenumber')
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

        res.json({ success: true, properties: results });
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
            .populate('owner', 'name email phonenumber');

        if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

        const rooms = await Room.find({ property: property._id });

        res.json({ success: true, property: { ...property.toObject(), rooms } });
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
            .populate('owner', 'name email phonenumber nic')
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
            .populate('owner', 'name email phonenumber')
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
        const { badge } = req.body;
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
        property.verificationStatus = badge === 'unverified' ? 'pending' : 'verified';
        // Ensure verified properties are visible in public listings
        if (badge !== 'unverified') {
            property.isActive = true;
        }
        await property.save();

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
        
        console.log('---- DEBUG: All Properties ----');
        properties.forEach(p => {
            console.log(`Property: ${p.name}, Owner ID: ${p.owner?._id}, Owner Email: ${p.owner?.email}, Owner Role: ${p.owner?.role}`);
        });

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

module.exports = {
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
};
