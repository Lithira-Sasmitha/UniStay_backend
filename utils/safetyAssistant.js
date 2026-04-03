/**
 * Safety Assistant Logic
 * Generates a rule-based response for the Safety Assistant Chat.
 */
const generateSafetyResponse = (question, propertyData) => {
    const q = question.toLowerCase();
    const { 
        name,
        trustBadge = 'unverified', 
        safetyStatus = 'Safe',
        activeAlerts = [],
        activeIncidentCount = 0,
        highSeverityCount = 0,
        categories = []
    } = propertyData;

    // 1. Safety Status / "Is it safe?"
    if (q.includes('safe') || q.includes('security') || q.includes('condition')) {
        if (safetyStatus === 'Under Safety Review') {
            return `We advise caution. ${name} is currently "Under Safety Review" due to high-severity or multiple unresolved incidents.`;       
        }
        if (safetyStatus === 'Caution') {
            return `This property has a "Caution" status. There are ${activeIncidentCount} active safety incidents being monitored.`;
        }
        return `Based on our data, ${name} is considered "Safe" with a ${trustBadge} trust rating and no active incident reports.`;
    }

    // 2. "Why" / Under Review
    if (q.includes('why') || q.includes('reason') || q.includes('review')) {    
        if (activeIncidentCount === 0 && safetyStatus === 'Safe') {
            return "This property is not currently under review and has a clean safety record.";
        }
        let alerts = activeAlerts.length > 0 ? activeAlerts.join(' and ') : `There are ${activeIncidentCount} active incidents`;
        return `The current status is due to: ${alerts}.`;
    }

    // 3. "What issues" / Incident Summary
    if (q.includes('issue') || q.includes('report') || q.includes('problem') || q.includes('incident')) {
        if (activeIncidentCount === 0) {
            return "No safety issues have been reported for this property recently.";
        }
        const cats = categories.length > 0 ? categories.join(', ') : 'various categories';
        return `Recent reports for this property include concerns regarding: ${cats}. Our team is currently investigating these claims.`;
    }

    // 4. Fallback for unrelated questions
    return "I am a Safety Assistant. I can only provide information regarding the safety status, incident reports, and risk trends for this property.";
};

module.exports = { generateSafetyResponse };
