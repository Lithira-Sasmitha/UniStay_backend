const Notice = require('../models/Notice');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const { sendBookingEmail } = require('../config/emailService');

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Verify the requesting user owns the property */
const assertOwner = async (propertyId, userId) => {
    const property = await Property.findById(propertyId);
    if (!property) return { error: 'Property not found', status: 404 };
    if (property.owner.toString() !== userId.toString())
        return { error: 'Not authorized', status: 403 };
    return { property };
};

/** Get confirmed student emails for a property */
const getConfirmedStudentEmails = async (propertyId) => {
    const bookings = await Booking.find({
        property: propertyId,
        status: 'confirmed',
    }).populate('student', 'name email');

    return bookings
        .filter((b) => b.student?.email)
        .map((b) => ({ email: b.student.email, name: b.student.name }));
};

// ─── Owner: Create notice ─────────────────────────────────────────────────────
/**
 * @route   POST /api/notices
 * @access  Private/Owner
 * @body    { propertyId, title, content, isUrgent, eventDate, expiresAt }
 */
const createNotice = async (req, res) => {
    try {
        const { propertyId, title, content, isUrgent, eventDate, expiresAt } = req.body;

        const { error, status, property } = await assertOwner(propertyId, req.user._id);
        if (error) return res.status(status).json({ success: false, message: error });

        const notice = await Notice.create({
            property: propertyId,
            owner: req.user._id,
            title,
            content,
            isUrgent: Boolean(isUrgent),
            eventDate: eventDate || null,
            expiresAt: expiresAt || null,
        });

        // Email confirmed students
        const students = await getConfirmedStudentEmails(propertyId);
        const urgentTag = notice.isUrgent ? '🚨 URGENT — ' : '';
        const eventLine = notice.eventDate
            ? `<p><strong>Event/Deadline:</strong> ${new Date(notice.eventDate).toDateString()}</p>`
            : '';

        await Promise.all(
            students.map(({ email, name }) =>
                sendBookingEmail(
                    email,
                    `${urgentTag}Notice from ${property.name} – UniStay`,
                    `<p>Hello <strong>${name}</strong>,</p>
                     ${notice.isUrgent ? '<p style="color:#dc2626;font-weight:bold;">⚠️ This is an urgent notice.</p>' : ''}
                     <h3 style="margin:0 0 8px">${notice.title}</h3>
                     <p>${notice.content}</p>
                     ${eventLine}
                     <p style="color:#6b7280;font-size:12px;">— ${property.name} via UniStay</p>`
                )
            )
        );

        res.status(201).json({ success: true, message: 'Notice created and students notified', notice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Owner: Get all notices for a property ────────────────────────────────────
/**
 * @route   GET /api/notices/property/:propertyId
 * @access  Private/Owner
 */
const getOwnerNotices = async (req, res) => {
    try {
        const { error, status } = await assertOwner(req.params.propertyId, req.user._id);
        if (error) return res.status(status).json({ success: false, message: error });

        const notices = await Notice.find({ property: req.params.propertyId }).sort({
            isUrgent: -1,
            createdAt: -1,
        });

        res.json({ success: true, notices });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Owner: Update notice ─────────────────────────────────────────────────────
/**
 * @route   PUT /api/notices/:noticeId
 * @access  Private/Owner
 */
const updateNotice = async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.noticeId);
        if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
        if (notice.owner.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: 'Not authorized' });

        const { title, content, isUrgent, eventDate, expiresAt } = req.body;
        if (title !== undefined) notice.title = title;
        if (content !== undefined) notice.content = content;
        if (isUrgent !== undefined) notice.isUrgent = Boolean(isUrgent);
        if (eventDate !== undefined) notice.eventDate = eventDate || null;
        if (expiresAt !== undefined) notice.expiresAt = expiresAt || null;

        await notice.save();
        res.json({ success: true, message: 'Notice updated', notice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Owner: Delete notice ─────────────────────────────────────────────────────
/**
 * @route   DELETE /api/notices/:noticeId
 * @access  Private/Owner
 */
const deleteNotice = async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.noticeId);
        if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
        if (notice.owner.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: 'Not authorized' });

        await Notice.findByIdAndDelete(req.params.noticeId);
        res.json({ success: true, message: 'Notice deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Student: Get notices for their confirmed property ────────────────────────
/**
 * @route   GET /api/notices/my
 * @access  Private/Student
 *
 * Returns active (non-expired) notices for the property the student
 * has a confirmed booking in.
 */
const getStudentNotices = async (req, res) => {
    try {
        const confirmedBooking = await Booking.findOne({
            student: req.user._id,
            status: 'confirmed',
        });

        if (!confirmedBooking) {
            return res.json({ success: true, notices: [], propertyName: null });
        }

        const now = new Date();
        const notices = await Notice.find({
            property: confirmedBooking.property,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        })
            .populate('property', 'name')
            .sort({ isUrgent: -1, createdAt: -1 });

        const propertyName = notices[0]?.property?.name || null;
        res.json({ success: true, notices, propertyName });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createNotice, getOwnerNotices, updateNotice, deleteNotice, getStudentNotices };
