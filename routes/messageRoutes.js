const express = require('express');
const router = express.Router();
const { sendMessage, getMessages, updateMessageStatus } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(sendMessage)
  .get(getMessages);

router.route('/:id/status')
  .patch(updateMessageStatus);

module.exports = router;
