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

// @desc    Get safety decision insights
// @route   GET /api/safety/:id/decision
// @access  Private
router.get('/:id/decision', protect, async (req, res, next) => {
    try {
        const propertyId = req.params.id;
        const property = await Property.findById(propertyId).populate('rooms');
        if (!property) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }

        const query = { property: propertyId };
        const incidents = await Incident.find(query).sort({ createdAt: -1 });
        
        const activeStatuses = ['open', 'under investigation', 'Open', 'Under Investigation'];
        const activeIncidents = incidents.filter(i => activeStatuses.includes(i.status));
        const highSeverityIncidents = activeIncidents.filter(i => i.severity === 'High');
        
        let reasons = [];
        if (highSeverityIncidents.length > 0) reasons.push(`${highSeverityIncidents.length} high severity incident(s)`);
        if (activeIncidents.length > 0) reasons.push(`${activeIncidents.length} active incidents`);
        
        if (incidents.length > 0) {
            const daysAgo = Math.floor((new Date() - new Date(incidents[0].createdAt)) / (1000 * 60 * 60 * 24));
            reasons.push(`Recent report (${daysAgo === 0 ? 'Today' : daysAgo + ' days ago'})`);
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const recentCount = incidents.filter(i => i.createdAt >= thirtyDaysAgo).length;
        const olderCount = incidents.filter(i => i.createdAt >= sixtyDaysAgo && i.createdAt < thirtyDaysAgo).length;
        
        let riskTrend = 'Stable';
        if (recentCount > olderCount) riskTrend = 'Increasing';
        if (recentCount < olderCount && recentCount === 0) riskTrend = 'Improving';

        let recommendation = 'Safe to stay';
        let recommendationVariant = 'success';
        if (property.safetyStatus === 'Caution' || (highSeverityIncidents.length > 0 && activeIncidents.length <= 2)) {
            recommendation = 'Proceed with caution';
            recommendationVariant = 'warning';
        } else if (property.safetyStatus === 'Under Safety Review' || highSeverityIncidents.length > 1 || activeIncidents.length > 2) {
            recommendation = 'Not recommended';
            recommendationVariant = 'danger';
        }

        let insightMessage = 'Safety risk is manageable.';
        if (riskTrend === 'Increasing' && activeIncidents.length > 0) {
            insightMessage = 'Safety risk is increasing due to repeated incidents.';
        } else if (riskTrend === 'Improving') {
            insightMessage = 'Safety seems to be improving with fewer recent incidents.';
        }

        let minPrice = property.isBoardingHouse && property.rooms ? Math.min(...property.rooms.map(r => r.price)) : 0;
        let rent = minPrice > 0 ? minPrice : (property.price || 20000);
        let perPerson = rent / 2;
        let safetyMessage = recommendation === 'Safe to stay' ? 'Sharing safely recommended' : 'Sharing not recommended currently';

        const timeline = incidents.slice(0, 5).map(inc => ({
            id: inc._id,
            title: inc.title,
            status: inc.status,
            date: inc.createdAt,
            severity: inc.severity
        }));

        res.status(200).json({
            success: true,
            data: {
                propertyName: property.name,
                safetyStatus: property.safetyStatus || 'Safe',
                reasons,
                riskTrend,
                insightMessage,
                sharedLiving: { rent, perPerson, safetyMessage },
                recommendation: { text: recommendation, variant: recommendationVariant },
                timeline
            }
        });
    } catch (error) {
        next(error);
    }
});
module.exports = router;
