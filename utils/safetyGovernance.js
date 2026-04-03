const Incident = require('../models/Incident');
const Property = require('../models/Property');

/**
 * Calculates safety status based on recent incident reports
 * Safe (green) — No active incidents or all resolved
 * Caution (yellow) — Active low/medium incidents under investigation
 * Under Safety Review (red) — High-severity or multiple unresolved incidents
 */
const calculateSafetyStatus = async (propertyId) => {
    try {
        const activeIncidents = await Incident.find({
            property: propertyId,
            status: { $in: ['Open', 'Under Investigation'] }
        });

        let safetyStatus = 'Safe';
        let activeAlerts = [];

        if (activeIncidents.length > 0) {
            const hasHighSeverity = activeIncidents.some(inc => inc.severity === 'High');
            const hasMultipleUnresolved = activeIncidents.length >= 3;

            if (hasHighSeverity || hasMultipleUnresolved) {
                safetyStatus = 'Under Safety Review';
                if (hasHighSeverity) activeAlerts.push('High-severity safety incident reported');
                if (hasMultipleUnresolved) activeAlerts.push('Multiple unresolved incidents');
            } else {
                safetyStatus = 'Caution';
                activeAlerts.push('Active incident under investigation');
            }
        }

        // Update Property Document
        await Property.findByIdAndUpdate(propertyId, {
            safetyStatus,
            activeAlerts,
            lastRiskEvaluation: new Date()
        });

        console.log(`[Safety Governance] Updated safety status for property ${propertyId}: ${safetyStatus}`);
        return { safetyStatus, activeAlerts };
    } catch (error) {
        console.error(`Error calculating safety status for property ${propertyId}:`, error);
        throw error;
    }
};

module.exports = { calculateSafetyStatus };
