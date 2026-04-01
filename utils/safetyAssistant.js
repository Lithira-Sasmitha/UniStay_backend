/**
 * Safety Assistant Logic
 * Generates a rule-based response for the Safety Assistant Chat.
 */
const generateSafetyResponse = (question, propertyData) => {
    const q = question.toLowerCase();
    const { 
        name,
        trustBadge = 'unverified', 
        riskTrend = 'Low Risk', 
        activeIncidentCount = 0, 
        highSeverityCount = 0,
        categories = [] 
    } = propertyData;

    // 1. Safety Status / "Is it safe?"
    if (q.includes('safe') || q.includes('security') || q.includes('condition')) {
        if (trustBadge === 'gold') {
            return `${name} is Gold Verified, which is our highest safety tier with complete documentation and zero critical risks.`;
        }
        if (riskTrend === 'Increasing') {
            return `We advise caution. ${name} currently shows an increasing safety risk trend due to ${activeIncidentCount} recent unresolved reports.`;
        }
        if (activeIncidentCount > 0) {
            return `This property is currently under "Stable Risk". There are ${activeIncidentCount} active safety incidents being monitored.`;
        }
        return `Based on our data, ${name} is considered safe with a ${trustBadge} trust rating and no active incident reports.`;
    }

    // 2. "Why" / Under Review
    if (q.includes('why') || q.includes('reason') || q.includes('review')) {
        if (activeIncidentCount === 0) {
            return "This property is not currently under review and has a clean safety record.";
        }
        let reason = `There are ${activeIncidentCount} active incidents.`;
        if (highSeverityCount > 0) {
            reason += ` This includes ${highSeverityCount} high-severity issue that requires investigation.`;
        }
        if (riskTrend === 'Increasing') {
            reason += " The frequency of reports has increased significantly this week.";
        }
        return reason;
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
