const Incident = require("../../models/safetymodel/Incident");

exports.createIncident = async (req, res) => {
    try {
        const user = req.user;

        // 1. Authentication check
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // 2. Role check
        if (user.role !== "student") {
            return res.status(403).json({ message: "Only students can report incidents" });
        }

        const { listingId, category, severity, description } = req.body;

        // 3. Required field validation
        if (!listingId || !category || !severity || !description) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        // 4. Duplicate active incident check
        const existingIncident = await Incident.findOne({
            reporterId: user._id,
            listingId,
            category,
            status: { $nin: ["Resolved", "Rejected"] },
        });

        if (existingIncident) {
            return res.status(400).json({
                message: "You already have an active incident for this category",
            });
        }

        // 5. Create new incident
        const newIncident = await Incident.create({
            reporterId: user._id,
            listingId,
            category,
            severity,
            description,
        });

        return res.status(201).json(newIncident);

    } catch (error) {
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
};