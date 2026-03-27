const Incident = require('../models/Incident');
const { uploadToSupabase } = require('../config/supabase');

// @desc    Create a new incident report
// @route   POST /api/incidents
// @access  Private (Student)
exports.createIncident = async (req, res, next) => {
  try {
    const { propertyId, title, category, severity, description } = req.body;

    // Validate required fields
    if (!propertyId || !title || !category || !severity || !description) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    let photoUrl = '';
    // Handle optional file upload
    if (req.file) {
      try {
        const uploadResult = await uploadToSupabase(
          req.file.buffer, 
          req.file.originalname, 
          'incidents', 
          req.file.mimetype
        );
        photoUrl = uploadResult.url;
      } catch (uploadError) {
        console.error('File upload failed:', uploadError);
        // Continue creating incident even if photo fails, or return error
        return res.status(500).json({ success: false, message: 'Failed to upload photo evidence' });
      }
    }

    const incident = await Incident.create({
      student: req.user._id,
      property: propertyId,
      title,
      category,
      severity,
      description,
      photoUrl,
      status: 'open',
      statusHistory: [{
        status: 'open',
        action: 'Incident Reported',
        note: 'Initial report submitted by student.',
        updatedBy: req.user._id,
        actorType: 'student',
        timestamp: new Date()
      }]
    });

    res.status(201).json({
      success: true,
      data: incident,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's own reported incidents
// @route   GET /api/incidents/me
// @access  Private (Student)
exports.getMyIncidents = async (req, res, next) => {
  try {
    const incidents = await Incident.find({ student: req.user._id })
      .populate('property', 'title address')
      .populate('statusHistory.updatedBy', 'name role')
      .sort('-createdAt');
      
    res.status(200).json({
      success: true,
      data: incidents,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all incidents (Admin / Owner filtering)
// @route   GET /api/incidents
// @access  Private (Admin / Owner)
exports.getIncidents = async (req, res, next) => {
  try {
    // Basic filter logic (if it's an owner, only show their properties - advanced logic needed based on auth role)
    // For now, let's keep it simple: Super Admin sees all
    const filter = {};
    if (req.query.propertyId) {
        filter.property = req.query.propertyId;
    }
    
    // If it's a Boarding Owner, they should only see incidents for properties they own
    // This requires looking up their properties first or doing a join.
    // For simplicity in this endpoint right now:
    if (req.user.role === 'boardingowner') {
       const properties = await require('../models/Property').find({ owner: req.user._id });
       const propertyIds = properties.map(p => p._id);
       filter.property = { $in: propertyIds };
    }

    const incidents = await Incident.find(filter)
      .populate('student', 'name email phone')
      .populate('property', 'name owner')
      .populate('statusHistory.updatedBy', 'name role')
      .sort('-createdAt');
      
    res.status(200).json({
      success: true,
      data: incidents,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update incident status
// @route   PATCH /api/incidents/:id/status
// @access  Private (Admin / Owner)
exports.updateIncidentStatus = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;
    const validStatuses = ['open', 'investigating', 'resolved', 'rejected'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Authorization check
    if (req.user.role === 'boardingowner') {
        // Must ensure the incident belongs to a property they own
        const property = await require('../models/Property').findById(incident.property);
        if (property && property.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
    } else if (req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    incident.status = status;
    if (adminNotes !== undefined) {
      incident.adminNotes = adminNotes;
    }
    
    // Add to history
    incident.statusHistory.push({
      status: status,
      action: status === 'investigating' ? 'Under Investigation' : (status === 'resolved' ? 'Resolved' : 'Rejected'),
      note: adminNotes || '',
      updatedBy: req.user._id,
      actorType: 'admin',
      timestamp: new Date()
    });
    
    await incident.save();
    
    // Fetch populated version to include history with names
    const updatedIncident = await Incident.findById(incident._id)
      .populate('student', 'name email phone')
      .populate('property', 'name owner')
      .populate('statusHistory.updatedBy', 'name role');
    
    res.status(200).json({
      success: true,
      data: updatedIncident,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add owner response to incident
// @route   PATCH /api/incidents/:id/owner-response
// @access  Private (Boarding Owner)
exports.addOwnerResponse = async (req, res, next) => {
  try {
    const { ownerResponse } = req.body;

    if (!ownerResponse) {
      return res.status(400).json({ success: false, message: 'Please provide a response' });
    }

    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Verify ownership
    const property = await require('../models/Property').findById(incident.property);
    if (!property || property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to respond to this incident' });
    }

    if (incident.ownerResponse) {
      return res.status(400).json({ success: false, message: 'Response already submitted' });
    }

    incident.ownerResponse = ownerResponse;
    incident.ownerRespondedAt = Date.now();
    
    // Add to history
    incident.statusHistory.push({
      status: incident.status, // Keep current status
      action: 'Owner Responded',
      note: ownerResponse,
      updatedBy: req.user._id,
      actorType: 'owner',
      timestamp: new Date()
    });
    
    await incident.save();

    // Fetch populated version to include history with names
    const updatedIncident = await Incident.findById(incident._id)
      .populate('student', 'name email phone')
      .populate('property', 'name owner')
      .populate('statusHistory.updatedBy', 'name role');

    res.status(200).json({
      success: true,
      data: updatedIncident,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get safety status and badge for a property
// @route   GET /api/properties/:id/safety
// @access  Public
exports.getPropertySafetyStatus = async (req, res, next) => {
  try {
    const propertyId = req.params.propertyId || req.params.id;
    const incidents = await Incident.find({ property: propertyId, status: { $ne: 'rejected' } });

    let level = 'safe';
    let unresolvedIncidents = incidents.filter(inc => inc.status === 'open' || inc.status === 'investigating');
    
    let activeCount = unresolvedIncidents.length;

    if (activeCount > 0) {
        const hasHighSeverity = unresolvedIncidents.some(inc => inc.severity === 'High');
        if (hasHighSeverity || activeCount >= 3) {
            level = 'review'; // Under Review
        } else {
            level = 'caution'; // Caution
        }
    }

    // Get last updated status time (latest incident update)
    let lastUpdated = incidents.length > 0 ? new Date(Math.max(...incidents.map(i => new Date(i.updatedAt).getTime()))) : null;

    res.status(200).json({
        success: true,
        data: {
          level,
          activeCount,
          lastUpdated,
          totalReported: incidents.length
        }
    });
  } catch (error) {
    next(error);
  }
};