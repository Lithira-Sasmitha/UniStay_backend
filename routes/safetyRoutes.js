const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Property = require('../models/Property');
const Incident = require('../models/Incident');
const { generateSafetyResponse } = require('../utils/safetyAssistant');

// @desc    Get safety assistant response
// @route   POST /api/safety/chat
// @access  Private
router.post('/chat', protect, async (req, res, next) => {
    try {
        const { propertyId, message } = req.body;

        if (!propertyId || !message) {
            return res.status(400).json({ success: false, message: 'Property ID and message required' });
        }

        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }

        // Gather real incident data for the property
        const activeIncidents = await Incident.find({
            property: propertyId,
            status: { $in: ['Open', 'Under Investigation'] }
        });

        // Prepare structured data for assistant
        const propertyData = {
            name: property.name,
            trustBadge: property.trustBadge,
            safetyStatus: property.safetyStatus,
            activeAlerts: property.activeAlerts,
            activeIncidentCount: activeIncidents.length,
            highSeverityCount: activeIncidents.filter(i => i.severity === 'High').length,
            categories: [...new Set(activeIncidents.map(i => i.category))]      
        };

        const response = generateSafetyResponse(message, propertyData);

        res.status(200).json({
            success: true,
            data: {
                message: response,
                sender: 'assistant',
                timestamp: new Date()
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
