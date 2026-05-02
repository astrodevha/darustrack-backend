const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const accessValidation = require("../middlewares/accessValidation");

// Login route
router.post("/login", authController.login);

// Refresh token route
router.post("/refresh-token", authController.refreshToken);

// Get profile route (requires authentication)
router.get("/profile", accessValidation, authController.getProfile);

// Update profile route (requires authentication)
router.put("/profile", accessValidation, authController.updateProfile);

module.exports = router;