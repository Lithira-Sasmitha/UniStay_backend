const Message = require('../models/Message');

// @desc    Send a new message or share request
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res, next) => {
  try {
    const { receiverId, propertyId, content, type } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ success: false, message: 'Receiver and content are required' });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      property: propertyId || null,
      content,
      type: type || 'message',
    });

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all messages for current user (sent and received)
// @route   GET /api/messages
// @access  Private
exports.getMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({
      $or: [{ receiver: req.user._id }, { sender: req.user._id }]
    })
      .populate('sender', 'name role email')
      .populate('receiver', 'name role email')
      .populate('property', 'title address')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update share request status (Accept/Reject)
// @route   PATCH /api/messages/:id/status
// @access  Private
exports.updateMessageStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    // Only 'accepted' or 'rejected' are valid updates
    if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Only the receiver can accept/reject the request
    if (message.receiver.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this request' });
    }

    message.status = status;
    await message.save();

    res.status(200).json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};
