const Incident = require('../models/Incident');
const Property = require('../models/Property');

/**
 * Calculates risk trend based on recent incident reports
 * Logic:
 * - last7days >= 2 AND last7days >= (last30days / 2) -> Increasing
 * - last30days >= 3 but not increasing -> Stable Risk
 * - Else -> Low Risk
 */
const calculateRiskTrend = async (propertyId) => {
    try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Fetch unresolved incidents for last 30 days
        const incidents = await Incident.find({
            property: propertyId,
            status: { $in: ['open', 'investigating'] },
            createdAt: { $gte: thirtyDaysAgo }
        });

        const last30days = incidents.length;
        const last7days = incidents.filter(i => i.createdAt >= sevenDaysAgo).length;

        let riskTrend = 'Low Risk';
        let riskPattern = '';

        // Risk Rules
        if (last7days >= 2 && last7days >= (last30days / 2)) {
            riskTrend = 'Increasing';
        } else if (last30days >= 3) {
            riskTrend = 'Stable Risk';
        }

        // Pattern Detection: Same category >= 2 times in last 7 days
        const recentCategories = incidents
            .filter(i => i.createdAt >= sevenDaysAgo)
            .map(i => i.category);
        
        const categoryCounts = {};
        recentCategories.forEach(cat => {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        const repeatedIssue = Object.values(categoryCounts).some(count => count >= 2);
        if (repeatedIssue) {
            riskPattern = 'Repeated Issue Detected';
        }

        // Update Property Document
        await Property.findByIdAndUpdate(propertyId, {
            riskTrend,
            riskPattern,
            lastRiskEvaluation: now
        });

        console.log(`[Safety Governance] Updated risk for property ${propertyId}: ${riskTrend}`);
        return { riskTrend, riskPattern };
    } catch (error) {
        console.error(`Error calculating risk trend for property ${propertyId}:`, error);
        throw error;
    }
};

module.exports = { calculateRiskTrend };
