const express = require("express");
const router = express.Router();
const { createIncident } = require("../../controllers/safetyctr/a.js");
const { protect } = require("../../middleware/authMiddleware");

router.post("/", protect, createIncident);

module.exports = router;