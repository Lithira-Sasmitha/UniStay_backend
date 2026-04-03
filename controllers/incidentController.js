const Incident = require('../models/Incident');
const { uploadToSupabase } = require('../config/supabase');
const { calculateSafetyStatus } = require('../utils/safetyGovernance');

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
      photos: photoUrl ? [photoUrl] : [],
      status: 'Open',
      auditLog: [{
        action: 'Incident Reported',
        performedBy: req.user._id,
        role: req.user.role,
        details: 'Initial report submitted by student'
      }]
    });

    // Recalculate safety status for this property
    await calculateSafetyStatus(propertyId);

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
      .sort('-createdAt');
      
    res.status(200).json({
      success: true,
      data: incidents,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single incident
// @route   GET /api/incidents/:id
// @access  Private
exports.getIncidentById = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('student', 'name email phone')
      .populate('property', 'name address photos owner');

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Auth check
    const isStudent = req.user.role === 'student' && incident.student._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'superadmin';
    const isOwner = req.user.role === 'boardingowner' && incident.property.owner.toString() === req.user._id.toString();

    if (!isStudent && !isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this incident' });
    }

    res.status(200).json({
      success: true,
      data: incident,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update incident status
// @route   PATCH /api/incidents/:id/status
// @access  Private (Admin)
exports.updateIncidentStatus = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;
    const validStatuses = ['Open', 'Under Investigation', 'Resolved', 'Rejected'];    

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Authorization check: Only Admin can change status
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Not authorized: Only Admin can change incident status' });
    }

    const oldStatus = incident.status;
    incident.status = status;
    if (adminNotes !== undefined) {
      incident.adminNotes = adminNotes;
    }

    if (status === 'Under Investigation' && !incident.investigationStartedAt) {       
      incident.investigationStartedAt = Date.now();
    } else if (status === 'Resolved' && !incident.resolvedAt) {
      incident.resolvedAt = Date.now();
    }
    
    // Add to audit log
    incident.auditLog.push({
      action: 'Status Changed',
      performedBy: req.user._id,
      role: req.user.role,
      details: `Status changed from ${oldStatus} to ${status}`
    });
    
    await incident.save();
    
    // Recalculate safety status for property when incident status changes
    await calculateSafetyStatus(incident.property);
    
    res.status(200).json({
      success: true,
      data: incident,
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
    const { ownerResponse, safetyActions, safetyScore } = req.body;

    if (!ownerResponse && !safetyActions) {
      return res.status(400).json({ success: false, message: 'Please provide a response or select safety actions.' });
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

    if (incident.ownerResponse || incident.ownerRespondedAt) {
      return res.status(400).json({ success: false, message: 'Safety improvement plan already submitted for this incident.' });
    }

    incident.ownerResponse = ownerResponse || '';
    incident.safetyActions = safetyActions || { investigated: false, fixedIssue: false, installedSecurity: false, monitoring: false };
    incident.safetyScore = safetyScore || 0;
    incident.ownerRespondedAt = Date.now();

    incident.auditLog.push({
      action: 'Safety Improvement Deployed',
      performedBy: req.user._id,
      role: req.user.role,
      details: 'Property owner submitted a reactive safety plan with an improvement score of ' + (safetyScore || 0) + '%'
    });
    
    await incident.save();

    res.status(200).json({
      success: true,
      data: incident,
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
    const property = await require('../models/Property').findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const incidents = await Incident.find({ property: propertyId, status: { $ne: 'Rejected' } });

    let activeCount = incidents.filter(inc => inc.status === 'Open' || inc.status === 'Under Investigation').length;

    res.status(200).json({
        success: true,
        data: {
          safetyStatus: property.safetyStatus,
          activeAlerts: property.activeAlerts,
          lastUpdated: property.lastRiskEvaluation,
          totalReported: incidents.length,
          activeCount
        }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get audit log of all incidents
// @route   GET /api/incidents/audit-log
// @access  Private (Admin)
exports.getAuditLog = async (req, res, next) => {
  try {
    const incidents = await Incident.find({ 'auditLog.0': { $exists: true } })
      .select('_id title property auditLog')
      .populate('property', 'name')
      .populate('auditLog.performedBy', 'name email role');

    let fullAuditLog = [];
    incidents.forEach(inc => {
      inc.auditLog.forEach(log => {
        fullAuditLog.push({
          incidentId: inc._id,
          incidentTitle: inc.title,
          propertyName: inc.property ? inc.property.name : 'Unknown',
          action: log.action,
          performedBy: log.performedBy ? log.performedBy.name : 'System',
          role: log.role,
          details: log.details,
          timestamp: log.timestamp
        });
      });
    });

    fullAuditLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
      success: true,
      data: fullAuditLog
    });
  } catch (error) {
    next(error);
  }
};// @desc    Get analytics for incidents
// @route   GET /api/incidents/analytics
// @access  Private (Admin)
exports.getAnalytics = async (req, res, next) => {
  try {
    const incidents = await Incident.find().populate('property', 'name');

    let total = incidents.length;
    let open = 0;
    let highSeverity = 0;

    let monthlyData = {};
    let propertyStats = {};

    incidents.forEach(inc => {
      const s = inc.status?.toLowerCase() || '';
      if (s === 'open' || s === 'under investigation' || s === 'investigating') open++;
      if (inc.severity === 'High') highSeverity++;

      // Monthly Trend
      const month = new Date(inc.createdAt).toLocaleString('default', { month: 'short' });
      if (!monthlyData[month]) monthlyData[month] = { total: 0, highSeverity: 0 };
      monthlyData[month].total++;
      if (inc.severity === 'High') monthlyData[month].highSeverity++;

      // Risky Properties
      if (inc.property && inc.property._id) {
        const pId = inc.property._id.toString();
        if (!propertyStats[pId]) {
          propertyStats[pId] = { id: pId, name: inc.property.name, incidents: 0 };
        }
        propertyStats[pId].incidents++;
      }
    });

    const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendData = Object.keys(monthlyData)
      .map(month => ({ month, ...monthlyData[month] }))
      .sort((a, b) => monthsOrder.indexOf(a.month) - monthsOrder.indexOf(b.month));

    const riskyProperties = Object.values(propertyStats)
      .sort((a, b) => b.incidents - a.incidents)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        stats: { total, open, highSeverity },
        trendData,
        riskyProperties
      }
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
